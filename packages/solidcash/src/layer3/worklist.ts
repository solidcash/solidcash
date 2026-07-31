import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  scriptToBytecode,
  type AbiFunction, type ArgSource, type ExternalCallAbi,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import {
  assertNoUnboundCallOptions, assertPlannedOccurrenceCount, planCompiledGraph, resolveGraphAbiFunction,
  type CompiledGraphInvocation, type CompiledGraphParticipant, type CompiledGraphPlan,
} from './graph.js';

export interface WorklistParticipant extends CompiledGraphParticipant {
  /** Constructor values are needed only when an emitted call argument forwards a constructor parameter. */
  constructorArgs?: readonly FunctionArgument[];
}

export type WorklistTargetRegistry = Readonly<Record<
string, WorklistParticipant | readonly WorklistParticipant[]
>>;

export interface DeriveCompiledGraphOptions {
  root: WorklistParticipant;
  function: string;
  args?: readonly FunctionArgument[];
  targets: WorklistTargetRegistry;
  /** Correctness bound for source recursion and runtime-sized shapes. The transcript v1 ceiling is 24. */
  maximumInvocations?: number;
  /**
   * Runtime occurrence supplied by the same derivation probe which evaluated the root call. It selects only
   * how many rows the SDK constructs; source emission and participant projections authenticate the count.
   */
  occurrence?: (context: {
    participant: WorklistParticipant;
    function: string;
    callsiteId: number;
    kind: 'conditional' | 'loop';
  }) => number;
  /**
   * Values of compiler-labelled non-trivial argument expressions, obtained from the derivation VM trace.
   * The generated caller covenant independently emits and compares the canonical argument bytes.
   */
  expressionArgument?: (context: {
    participant: WorklistParticipant;
    function: string;
    callsiteId: number;
    argument: number;
    occurrence: number;
  }) => FunctionArgument;
  /**
   * Runtime-resolved target and method for compiler-labelled function-pointer
   * and varying-selector callsites. The derivation probe supplies the concrete
   * choice; the caller's graph-emission covenant remains authoritative.
   */
  dynamicCall?: (context: {
    participant: WorklistParticipant;
    function: string;
    callsiteId: number;
    occurrence: number;
    kind: 'function-pointer' | 'selector-table' | 'low-level';
  }) => { participant: WorklistParticipant; function: string; args?: readonly FunctionArgument[] };
}

const functionAbi = (participant: WorklistParticipant, name: string): AbiFunction => {
  const resolved = resolveGraphAbiFunction(participant.artifact, name);
  if (!resolved) throw new Error(`layer3: symbolic worklist requires one ABI function '${name}'`);
  return resolved;
};

/**
 * Compiler-authored mode of one graph edge.
 *
 * Never coerce. This helper always supplies a mode, so a silent `mode ?? 'call'` here would hand
 * `planCompiledGraph` an explicit `call` for a delegate edge. That planner now reads the compiler-authored
 * mode whether or not one was supplied, so the two agree - but the refusal belongs here as well, because this
 * is where the published mode is first read and where a coercion would be written.
 */
const edgeCallMode = (call: ExternalCallAbi): 'call' | 'staticcall' => {
  const mode = call.callMode ?? 'call';
  if (mode === 'call' || mode === 'staticcall') return mode;
  throw new Error(
    `layer3: callsite ${call.callsiteId} declares call mode '${mode}', which is not a participant-graph edge`,
  );
};

const literal = (source: ArgSource): FunctionArgument => {
  if (source.value === undefined || source.type === undefined) {
    throw new Error('layer3: malformed literal call argument');
  }
  if (/^(u?int|bigint)/.test(source.type)) return BigInt(source.value);
  if (source.type === 'bool') return source.value === 'true';
  if (/^bytes/.test(source.type)) return hexToBin(source.value);
  if (source.type === 'string') return source.value;
  throw new Error(`layer3: unsupported literal call argument type '${source.type}'`);
};

const resolveArguments = (
  sourceParticipant: WorklistParticipant,
  visibleArgs: readonly FunctionArgument[],
  call: ExternalCallAbi,
  functionName: string,
  occurrence: number,
  expressionArgument: DeriveCompiledGraphOptions['expressionArgument'],
): FunctionArgument[] => (call.argSources ?? []).map((source, argument) => {
  if (source.kind === 'forward' && source.paramIndex !== undefined) {
    const value = visibleArgs[source.paramIndex];
    if (value === undefined) {
      throw new Error(`layer3: callsite ${call.callsiteId} forwards an absent argument`);
    }
    return value;
  }
  if (source.kind === 'constructorArg' && source.paramName) {
    const index = sourceParticipant.artifact.constructorInputs
      .findIndex((input) => input.name === source.paramName);
    const value = sourceParticipant.constructorArgs?.[index];
    if (index < 0 || value === undefined) {
      throw new Error(`layer3: constructor argument '${source.paramName}' is unavailable to the worklist`);
    }
    return value;
  }
  if (source.kind === 'literal') return literal(source);
  if (source.kind === 'expression') {
    const value = expressionArgument?.({
      participant: sourceParticipant,
      function: functionName,
      callsiteId: call.callsiteId!,
      argument,
      occurrence,
    });
    if (value !== undefined) return value;
  }
  throw new Error(
    `layer3: callsite ${call.callsiteId} argument expression is not symbolically resolvable`,
  );
});

/**
 * Expand the compiler-emitted, statically bounded external-call closure into one owner-reusing graph.
 *
 * The application supplies deployed participants, never transcript rows. Participant identity is interned by
 * exact locking bytecode, so two calls to one owner produce two logical invocations but one physical owner
 * block. Runtime-dependent occurrences and targets are accepted only through explicit derivation-probe
 * callbacks; the caller projection remains authoritative for the reached rows. Expansion completes before
 * `planCompiledGraph` reads any balanced block, so resource/effect slots are not guessed or iteratively
 * stabilized: they are compiler-owned parts of each interned participant artifact and are laid out exactly
 * once after the physical owner set is complete.
 */
export function deriveCompiledGraphPlan(options: DeriveCompiledGraphOptions): CompiledGraphPlan {
  const maximum = options.maximumInvocations ?? 24;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 24) {
    throw new Error('layer3: symbolic worklist maximum must be between 1 and 24');
  }
  const participants: WorklistParticipant[] = [];
  const participantByLbc = new Map<string, number>();
  const intern = (participant: WorklistParticipant): number => {
    const lbc = participant.lockingBytecode.toLowerCase();
    const existing = participantByLbc.get(lbc);
    if (existing !== undefined) {
      if (participants[existing].artifact !== participant.artifact) {
        throw new Error('layer3: one physical owner was registered with different artifacts');
      }
      return existing;
    }
    const index = participants.length;
    participants.push(participant);
    participantByLbc.set(lbc, index);
    return index;
  };

  const targetCursors = new Map<string, number>();
  const takeTarget = (call: ExternalCallAbi): WorklistParticipant => {
    const registered = options.targets[call.interfaceName];
    if (!registered) {
      throw new Error(`layer3: no symbolic target registered for '${call.interfaceName}'`);
    }
    if (!Array.isArray(registered)) return registered as WorklistParticipant;
    const cursor = targetCursors.get(call.interfaceName) ?? 0;
    const target = registered[cursor];
    if (!target) throw new Error(`layer3: symbolic target list for '${call.interfaceName}' is exhausted`);
    targetCursors.set(call.interfaceName, cursor + 1);
    return target;
  };

  const invocations: CompiledGraphInvocation[] = [];
  const active = new Set<string>();
  const expand = (
    participant: WorklistParticipant,
    functionName: string,
    args: readonly FunctionArgument[],
    parent: number | null,
    callMode?: 'call' | 'staticcall',
  ): void => {
    if (invocations.length >= maximum) {
      throw new Error(`layer3: symbolic worklist exceeds its ${maximum}-invocation bound`);
    }
    const owner = intern(participant);
    const invocation = invocations.length;
    invocations.push({ parent, callee: owner, function: functionName, args, ...(callMode && { callMode }) });
    const fn = functionAbi(participant, functionName);
    assertNoUnboundCallOptions(
      participant.lockingBytecode, participant.artifact, fn, functionName,
    );
    const key = `${owner}:${functionName}`;
    if (active.has(key)) {
      throw new Error(
        `layer3: recursive call closure at '${functionName}' needs an explicit bounded occurrence proof`,
      );
    }
    active.add(key);
    for (const call of fn.externalCalls ?? []) {
      // Recognize a raw edge by its compiler-authored identity, not by opaqueReturn. A VOID low-level call is
      // a raw edge that returns nothing, so it must not claim opaqueReturn - that flag means "opaque
      // integrity-bound return". Keying the branch off the flag left the honestly published void artifact
      // unrecognized, surfacing the internal sentinel `no symbolic target registered for '__raw__'`.
      const isRawEdge = call.interfaceName === '__raw__' && call.functionName === '__raw__';
      if (isRawEdge || call.opaqueReturn) {
        if (!isRawEdge) {
          throw new Error(
            `layer3: callsite ${call.callsiteId} is not a singular statically resolvable worklist edge`,
          );
        }
        const occurrence = call.occurrence ?? 'once';
        const boundedLiteralLoop = occurrence === 'loop'
          && call.occurrenceBoundSource === 'literal'
          && call.minimumOccurrences !== undefined
          && call.minimumOccurrences === call.maximumOccurrences
          && call.minimumOccurrences >= 1 && call.minimumOccurrences <= 24;
        if (occurrence !== 'once' && !boundedLiteralLoop) {
          throw new Error(
            `layer3: raw callsite ${call.callsiteId} is ${call.occurrence} and has no bounded occurrence proof; `
            + 'iterated low-level calls are not an admitted graph edge',
          );
        }
        const count = boundedLiteralLoop ? call.minimumOccurrences! : 1;
        for (let reached = 0; reached < count; reached += 1) {
          const resolved = options.dynamicCall?.({
            participant,
            function: functionName,
            callsiteId: call.callsiteId!,
            occurrence: reached,
            kind: 'low-level',
          });
          if (!resolved?.args) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} lacks decoded calldata proof ${reached}`);
          }
          const targetFunction = functionAbi(resolved.participant, resolved.function);
          if (!targetFunction.selector) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} resolved to a selectorless function`);
          }
          const payload = resolveArguments(
            participant, args, call, functionName, reached, options.expressionArgument,
          )[0];
          if (!(payload instanceof Uint8Array)) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} calldata is not bytes`);
          }
          const structs = resolved.participant.artifact.structs
          ?? resolved.participant.artifact.stateLayout?.structs;
          if (resolved.args.length !== targetFunction.inputs.filter((input) =>
            !input.name.startsWith('__internal__')).length) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} decoded argument count is wrong`);
          }
          const encoded = resolved.args.map((argument, index) =>
            encodeFunctionArgument(argument, targetFunction.inputs[index].type, structs));
          if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} contains a transaction signature`);
          }
          const canonicalPayload = new Uint8Array([
            ...hexToBin(targetFunction.selector),
            ...scriptToBytecode(encoded as Uint8Array[]),
          ]);
          if (binToHex(canonicalPayload) !== binToHex(payload)) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} decoded calldata is not canonical`);
          }
          const targetInput = fn.inputs.findIndex((input) => input.name === call.addressParam);
          const targetValue = targetInput >= 0 ? args[targetInput] : undefined;
          const encodedTarget = targetValue === undefined
            ? undefined : encodeFunctionArgument(targetValue, 'address', structs);
          if (!(encodedTarget instanceof Uint8Array)
          || binToHex(encodedTarget) !== resolved.participant.lockingBytecode.toLowerCase()) {
            throw new Error(`layer3: raw callsite ${call.callsiteId} target proof disagrees with calldata owner`);
          }
          expand(
            resolved.participant,
            resolved.function,
            resolved.args,
            invocation,
            edgeCallMode(call),
          );
        }
        continue;
      }
      if (call.batchInvocations) {
        if ((call.occurrence ?? 'once') !== 'once') {
          throw new Error(`layer3: batched callsite ${call.callsiteId} must be straight-line`);
        }
        const target = takeTarget(call);
        const rows = [...call.batchInvocations].sort((a, b) => a.logicalIndex - b.logicalIndex);
        rows.forEach((row, index) => {
          if (row.logicalIndex !== index) {
            throw new Error(`layer3: batched callsite ${call.callsiteId} has non-canonical logical indices`);
          }
          const targetFunction = target.artifact.abi.find((candidate) =>
            candidate.selector?.toLowerCase() === row.selector.toLowerCase());
          if (!targetFunction) {
            throw new Error(
              `layer3: batched callsite ${call.callsiteId} selector ${row.selector} is absent from its target`,
            );
          }
          expand(
            target,
            targetFunction.name,
            resolveArguments(
              participant,
              args,
              { ...call, functionName: targetFunction.name, argSources: row.argSources },
              functionName,
              row.logicalIndex,
              options.expressionArgument,
            ),
            invocation,
            edgeCallMode(call),
          );
        });
        continue;
      }
      const occurrenceKind = call.occurrence ?? 'once';
      let count = 1;
      if (occurrenceKind !== 'once') {
        count = options.occurrence?.({
          participant,
          function: functionName,
          callsiteId: call.callsiteId!,
          kind: occurrenceKind,
        }) ?? -1;
        // Only what the shared bound cannot know: whether the derivation probe answered at all. An absent
        // callback yields -1 and a non-integer answer is not a row count; both mean there is no proof to check.
        if (!Number.isInteger(count) || count < 0) {
          throw new Error(
            `layer3: callsite ${call.callsiteId} lacks a valid ${occurrenceKind} occurrence proof`,
          );
        }
        // X36: every bound leg - the conditional ceiling of one, the proven ceiling and the proven floor - is
        // the shared helper's, so this entry point and `planCompiledGraph` refuse the same counts with the same
        // words. The ceiling legs used to be spelled out again in the gate above, which refused the same counts
        // with a coarser message and was free to drift from the bound it was duplicating.
        assertPlannedOccurrenceCount(call, count);
      }
      if (call.selectorArrayVar || call.fnPtrCall) {
        for (let reached = 0; reached < count; reached += 1) {
          const resolved = options.dynamicCall?.({
            participant,
            function: functionName,
            callsiteId: call.callsiteId!,
            occurrence: reached,
            kind: call.selectorArrayVar ? 'selector-table' : 'function-pointer',
          });
          if (!resolved) {
            throw new Error(`layer3: callsite ${call.callsiteId} lacks a dynamic call proof`);
          }
          const resolvedFunction = functionAbi(resolved.participant, resolved.function);
          if (call.possibleTargets?.length && !call.possibleTargets.some((candidate) =>
            candidate.functionName === resolved.function
            && candidate.selector.toLowerCase() === resolvedFunction.selector?.toLowerCase())) {
            throw new Error(
              `layer3: callsite ${call.callsiteId} resolved outside its compiler-bounded target set`,
            );
          }
          expand(
            resolved.participant,
            resolved.function,
            resolveArguments(
              participant,
              args,
              { ...call, functionName: resolved.function },
              functionName,
              reached,
              options.expressionArgument,
            ),
            invocation,
            edgeCallMode(call),
          );
        }
        continue;
      }
      for (let reached = 0; reached < count; reached += 1) {
        const target = takeTarget(call);
        expand(
          target,
          call.functionName,
          resolveArguments(
            participant, args, call, functionName, reached, options.expressionArgument,
          ),
          invocation,
          edgeCallMode(call),
        );
      }
    }
    active.delete(key);
  };

  expand(options.root, options.function, options.args ?? [], null);
  return planCompiledGraph(participants, invocations);
}
