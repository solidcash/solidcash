import { hexToBin } from '@bitauth/libauth';
import type { AbiFunction, ArgSource, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  planCompiledGraph, type CompiledGraphInvocation, type CompiledGraphParticipant, type CompiledGraphPlan,
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
}

const functionAbi = (participant: WorklistParticipant, name: string): AbiFunction => {
  const matches = participant.artifact.abi.filter((candidate) => candidate.name === name);
  if (matches.length !== 1) {
    throw new Error(`layer3: symbolic worklist requires one ABI function '${name}'`);
  }
  return matches[0];
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
): FunctionArgument[] => (call.argSources ?? []).map((source) => {
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
  throw new Error(
    `layer3: callsite ${call.callsiteId} argument expression is not symbolically resolvable`,
  );
});

/**
 * Expand the compiler-emitted, statically bounded external-call closure into one owner-reusing graph.
 *
 * The application supplies deployed participants, never transcript rows. Participant identity is interned by
 * exact locking bytecode, so two calls to one owner produce two logical invocations but one physical owner
 * block. Conditional/loop/pointer/opaque shapes remain fail-closed until their runtime occurrence proof is
 * connected to this worklist.
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
  ): void => {
    if (invocations.length >= maximum) {
      throw new Error(`layer3: symbolic worklist exceeds its ${maximum}-invocation bound`);
    }
    const owner = intern(participant);
    const invocation = invocations.length;
    invocations.push({ parent, callee: owner, function: functionName, args });
    const fn = functionAbi(participant, functionName);
    const key = `${owner}:${functionName}`;
    if (active.has(key)) {
      throw new Error(
        `layer3: recursive call closure at '${functionName}' needs an explicit bounded occurrence proof`,
      );
    }
    active.add(key);
    for (const call of fn.externalCalls ?? []) {
      if (call.occurrence !== 'once' || call.loopArrayVar || call.selectorArrayVar
        || call.fnPtrCall || call.batchInvocations || call.opaqueReturn) {
        throw new Error(
          `layer3: callsite ${call.callsiteId} is not a singular statically resolvable worklist edge`,
        );
      }
      const target = takeTarget(call);
      expand(
        target,
        call.functionName,
        resolveArguments(participant, args, call),
        invocation,
      );
    }
    active.delete(key);
  };

  expand(options.root, options.function, options.args ?? [], null);
  return planCompiledGraph(participants, invocations);
}
