import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  artifactExecutionIdentityFingerprint,
  scriptToBytecode,
  occurrenceBoundOf, type AbiFunction, type ArgSource, type ExternalCallAbi,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { lockingBytecodeToSolidityAddressPayload } from '../utils.js';
import {
  MAX_GRAPH_INVOCATIONS, assertNoUnboundCallOptions, assertPlannedOccurrenceCount,
  planCompiledGraph, resolveGraphAbiFunction,
  type CompiledGraphInvocation, type CompiledGraphParticipant, type CompiledGraphPlan,
} from './graph.js';
import { MessageBusDiagnosticError, type MessageBusDiagnosticContext } from './diagnostics.js';
import { projectMessageBusHandlerArguments } from './message-bus.js';

const MAX_WORKLIST_DEPTH = 7;

function solidityAddressArgumentIdentity(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0) return '00'.repeat(20);
  if (bytes.length === 32) {
    return bytes.subarray(0, 12).every((byte) => byte === 0) ? binToHex(bytes.subarray(12)) : undefined;
  }
  const identity = lockingBytecodeToSolidityAddressPayload(bytes);
  return identity && binToHex(identity);
}

const artifactExecutionIdentities = new WeakMap<object, string>();

/**
 * Content identity for the complete compiler publication consumed by graph planning.
 *
 * Stateful proxy handles may expose a fresh immutable artifact object on each access. Object identity therefore
 * cannot identify the artifact installed at one physical owner: separate callsites to that owner would look like
 * conflicting programs. Domain-separated binary fingerprint over bytecode, fingerprint, ABI, messageBus,
 * and stateLayout (not raw `JSON.stringify`). Equal normalized bytecode alone cannot make two incompatible
 * resource geometries alias one owner.
 */
const artifactExecutionIdentity = (artifact: WorklistParticipant['artifact']): string => {
  const cached = artifactExecutionIdentities.get(artifact);
  if (cached !== undefined) return cached;
  const identity = artifactExecutionIdentityFingerprint(artifact);
  artifactExecutionIdentities.set(artifact, identity);
  return identity;
};

export interface WorklistParticipant extends CompiledGraphParticipant {
  /** Constructor values are needed only when an emitted call argument forwards a constructor parameter. */
  constructorArgs?: readonly FunctionArgument[];
}

export interface WorklistTargetResolution {
  participant: WorklistParticipant;
  /** Exact ABI entry point selected on this target. */
  selector?: string;
  /** Exact address evaluated by this call edge when it differs from the participant's default public identity. */
  targetLockingBytecode?: string;
}

export type WorklistTargetRegistry = Readonly<Record<
string, WorklistParticipant | readonly WorklistParticipant[]
>>;

export interface DeriveCompiledGraphOptions {
  root: WorklistParticipant;
  function: string;
  /** Exact root ABI entry point. Required when `function` names distinct overloads. */
  selector?: string;
  args?: readonly FunctionArgument[];
  /** Transaction-origin locking bytecode authenticated by the messageEnvelope's root row. */
  rootCaller?: Uint8Array;
  targets: WorklistTargetRegistry;
  /**
   * Resolve a typed call target by its compiler-stable callsite and reached occurrence. Unlike interface
   * arrays this is independent of traversal-global cursor order, so conditional/loop fixed points can reuse
   * one owner or select heterogeneous owners without pre-enumerating unrelated callsites.
   */
  target?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
    callsiteId: number;
    occurrence: number;
    interfaceName: string;
    /** Source-template identity when this is one row of a collapsed repeated-call batch. */
    batchLogicalIndex?: number;
  }) => WorklistParticipant | WorklistTargetResolution | undefined;
  /** Optional tighter correctness bound for source recursion and runtime-sized shapes. */
  maximumInvocations?: number;
  /**
   * Runtime occurrence supplied by the same derivation probe which evaluated the root call. It selects only
   * how many rows the SDK constructs; source emission and participant projections authenticate the count.
   */
  occurrence?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    /** Stable parent invocation identity; recursive re-entry must not share a traversal-global cursor. */
    invocation: number;
    callsiteId: number;
    kind: 'conditional' | 'loop';
  }) => number;
  /**
   * Compiler-discovered direct children in source execution order when two loop callsites share one
   * authenticated outer domain. This is only a traversal schedule: every row still binds to its published
   * callsite/occurrence and the caller's VM emission covenant authenticates the resulting order.
   */
  orderedOccurrences?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
  }) => readonly { callsiteId: number; occurrence: number }[] | undefined;
  /**
   * Exact reached source-loop indices for one runtime-sized row template in a collapsed repeated-call batch.
   * Transparent graph discovery supplies this when predicates can remove individual loop iterations; ordinary
   * callers can omit it when the compiler-authored array cardinality alone determines the reached rows.
   */
  batchOccurrences?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
    callsiteId: number;
    batchLogicalIndex: number;
    kind: 'conditional' | 'loop';
  }) => readonly number[] | undefined;
  /**
   * Values of compiler-labelled non-trivial argument expressions, obtained from the derivation VM trace.
   * The generated caller covenant independently emits and compares the canonical argument bytes.
   */
  expressionArgument?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
    callsiteId: number;
    argument: number;
    occurrence: number;
  }) => FunctionArgument;
  /** Reached source-loop iteration when a conditional row's compact occurrence differs from its source index. */
  sourceIteration?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
    callsiteId: number;
    occurrence: number;
    counterName?: string;
  }) => number | undefined;
  /**
   * Runtime-resolved target and method for compiler-labelled function-pointer
   * and varying-selector callsites. The derivation probe supplies the concrete
   * choice; the caller's graph-emission covenant remains authoritative.
   */
  dynamicCall?: (context: {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    invocation: number;
    callsiteId: number;
    occurrence: number;
    kind: 'function-pointer' | 'selector-table' | 'low-level';
  }) => {
    participant: WorklistParticipant;
    function: string;
    selector?: string;
    args?: readonly FunctionArgument[];
    targetLockingBytecode?: string;
  };
}

const functionAbi = (participant: WorklistParticipant, name: string, selector?: string): AbiFunction => {
  const resolved = resolveGraphAbiFunction(participant.artifact, name, selector);
  if (!resolved) throw new Error(`messageBus: symbolic worklist requires one ABI function '${name}'`);
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
    `messageBus: callsite ${call.callsiteId} declares call mode '${mode}', which is not a participant-graph edge`,
  );
};

const literal = (source: ArgSource): FunctionArgument => {
  if (source.value === undefined || source.type === undefined) {
    throw new Error('messageBus: malformed literal call argument');
  }
  if (/^(u?int|bigint)/.test(source.type)) return BigInt(source.value);
  if (source.type === 'bool') return source.value === 'true';
  if (/^bytes/.test(source.type)) return hexToBin(source.value);
  if (source.type === 'string') return source.value;
  throw new Error(`messageBus: unsupported literal call argument type '${source.type}'`);
};

const resolveArguments = (
  sourceParticipant: WorklistParticipant,
  visibleArgs: readonly FunctionArgument[],
  call: ExternalCallAbi,
  functionName: string,
  functionSelector: string | undefined,
  invocation: number,
  occurrence: number,
  expressionArgument: DeriveCompiledGraphOptions['expressionArgument'],
  sourceIteration: DeriveCompiledGraphOptions['sourceIteration'],
): FunctionArgument[] => (call.argSources ?? []).map((source, argument) => {
  if (source.kind === 'forward' && source.paramIndex !== undefined) {
    const value = visibleArgs[source.paramIndex];
    if (value === undefined) {
      throw new Error(`messageBus: callsite ${call.callsiteId} forwards an absent argument`);
    }
    return value;
  }
  if (source.kind === 'constructorArg' && source.paramName) {
    const index = sourceParticipant.artifact.constructorInputs
      .findIndex((input) => input.name === source.paramName);
    const value = sourceParticipant.constructorArgs?.[index];
    if (index < 0 || value === undefined) {
      throw new Error(`messageBus: constructor argument '${source.paramName}' is unavailable to the worklist`);
    }
    return value;
  }
  if (source.kind === 'literal') return literal(source);
  if (source.kind === 'loopIndex' && source.initialValue !== undefined) {
    if (source.stepValue !== undefined) {
      const sourceIndex = sourceIteration?.({
        participant: sourceParticipant, function: functionName,
        ...(functionSelector !== undefined && { selector: functionSelector }),
        invocation, callsiteId: call.callsiteId!, occurrence,
        ...(source.counterName !== undefined && { counterName: source.counterName }),
      }) ?? occurrence;
      if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 0) {
        throw new Error(`messageBus: callsite ${call.callsiteId} has an invalid source iteration`);
      }
      return BigInt(source.initialValue) + BigInt(source.stepValue) * BigInt(sourceIndex);
    }
    if (source.stepExpression) {
      const value = expressionArgument?.({
        participant: sourceParticipant,
        function: functionName,
        ...(functionSelector !== undefined && { selector: functionSelector }),
        invocation,
        callsiteId: call.callsiteId!,
        argument,
        occurrence,
      });
      if (value !== undefined) return value;
    }
  }
  if (source.kind === 'selfAddress') {
    if (sourceParticipant.artifact.messageBus?.route.inputs.some(
      (input) => input.name === '__internal__graphSelfIdentityInput',
    ) && sourceParticipant.logicalLockingBytecode !== undefined) {
      return hexToBin(sourceParticipant.logicalLockingBytecode);
    }
    // Native/older routes without a public-self witness retain the physical owner projection.
    if (!sourceParticipant.lockingBytecode) {
      throw new Error('messageBus: participant has no authenticated state-owner locking bytecode');
    }
    return hexToBin(sourceParticipant.lockingBytecode);
  }
  if (source.kind === 'expression' || source.kind === 'msgSender' || source.kind === 'arrayElement') {
    const value = expressionArgument?.({
      participant: sourceParticipant,
      function: functionName,
      ...(functionSelector !== undefined && { selector: functionSelector }),
      invocation,
      callsiteId: call.callsiteId!,
      argument,
      occurrence,
    });
    if (value !== undefined) return value;
  }
  throw new Error(
    `messageBus: callsite ${call.callsiteId} argument expression is not symbolically resolvable`,
  );
});

/**
 * Expand the compiler-emitted, statically bounded external-call closure into one owner-reusing graph.
 *
 * The application supplies deployed participants, never callManifest rows. Participant identity is interned by
 * exact locking bytecode, so two calls to one owner produce two logical invocations but one physical owner
 * block. Runtime-dependent occurrences and targets are accepted only through explicit derivation-probe
 * callbacks; the caller projection remains authoritative for the reached rows. Expansion completes before
 * `planCompiledGraph` reads any balanced block, so resource/effect slots are not guessed or iteratively
 * stabilized: they are compiler-owned parts of each interned participant artifact and are laid out exactly
 * once after the physical owner set is complete.
 */
export function deriveCompiledGraphPlan(options: DeriveCompiledGraphOptions): CompiledGraphPlan {
  const maximum = options.maximumInvocations ?? MAX_GRAPH_INVOCATIONS;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_GRAPH_INVOCATIONS) {
    throw new Error(`messageBus: symbolic worklist maximum must be between 1 and ${MAX_GRAPH_INVOCATIONS}`);
  }
  const participants: WorklistParticipant[] = [];
  const invocations: CompiledGraphInvocation[] = [];
  const activeInvocations: number[] = [];
  const diagnosticContext = (call?: ExternalCallAbi): MessageBusDiagnosticContext => ({
    invocationIds: [...activeInvocations],
    callChain: activeInvocations.map((index) => {
      const row = invocations[index];
      return `${index}:${participants[row.callee]?.artifact.contractName ?? '?owner'}.${row.function}`;
    }),
    ...(call?.callsiteId !== undefined && { callsiteId: call.callsiteId }),
    ...(call?.sourceLocation !== undefined && { callsiteLocation: call.sourceLocation }),
    ...(call !== undefined && { interfaceName: call.interfaceName }),
  });
  const participantByLbc = new Map<string, number>();
  const intern = (participant: WorklistParticipant): number => {
    const lbc = participant.lockingBytecode.toLowerCase();
    const existing = participantByLbc.get(lbc);
    if (existing !== undefined) {
      const priorArtifact = participants[existing].artifact;
      if (priorArtifact !== participant.artifact
        && artifactExecutionIdentity(priorArtifact) !== artifactExecutionIdentity(participant.artifact)) {
        throw new MessageBusDiagnosticError(
          'L3_OWNER_ARTIFACT_CONFLICT',
          `one physical owner '${lbc}' was registered with different artifacts while deriving `
            + `${diagnosticContext().callChain?.join(' -> ') || 'the root invocation'}`,
          { ...diagnosticContext(), ownerIdentity: lbc },
        );
      }
      const priorLogical = participants[existing].logicalLockingBytecode ?? lbc;
      const nextLogical = participant.logicalLockingBytecode ?? lbc;
      if (priorLogical.toLowerCase() !== nextLogical.toLowerCase()) {
        throw new Error(`messageBus: one physical owner '${lbc}' was registered with different logical identities`);
      }
      return existing;
    }
    const index = participants.length;
    participants.push(participant);
    participantByLbc.set(lbc, index);
    return index;
  };

  const targetCursors = new Map<string, number>();
  const takeTarget = (
    call: ExternalCallAbi,
    participant: WorklistParticipant,
    fn: AbiFunction,
    functionName: string,
    invocation: number,
    occurrence: number,
    batchLogicalIndex?: number,
  ): WorklistTargetResolution => {
    const resolved = options.target?.({
      participant, function: functionName, ...(fn.selector !== undefined && { selector: fn.selector }),
      invocation, callsiteId: call.callsiteId!, occurrence,
      interfaceName: call.interfaceName,
      ...(batchLogicalIndex !== undefined && { batchLogicalIndex }),
    });
    if (resolved) return 'participant' in resolved ? resolved : { participant: resolved };
    const targetIsRuntimeDerived = call.loopArrayVar || call.addressStateVar
      || (call.addressParam !== undefined
        && !fn.inputs.some((input) => input.name === call.addressParam));
    if (targetIsRuntimeDerived) {
      throw new MessageBusDiagnosticError(
        'L3_TARGET_UNRESOLVED',
        `resource-derived callsite ${call.callsiteId} occurrence ${occurrence} lacks a target proof; `
          + `call chain ${diagnosticContext(call).callChain?.join(' -> ')} -> ${call.interfaceName}.${call.functionName}`,
        diagnosticContext(call),
      );
    }
    const registered = options.targets[call.interfaceName];
    if (!registered) {
      throw new MessageBusDiagnosticError(
        'L3_TARGET_UNRESOLVED',
        `no symbolic target registered for '${call.interfaceName}' at callsite ${call.callsiteId ?? '?'}; `
          + `call chain ${diagnosticContext(call).callChain?.join(' -> ')}`,
        diagnosticContext(call),
      );
    }
    if (!Array.isArray(registered)) return { participant: registered as WorklistParticipant };
    const cursor = targetCursors.get(call.interfaceName) ?? 0;
    const target = registered[cursor];
    if (!target) {
      throw new MessageBusDiagnosticError(
        'L3_TARGET_EXHAUSTED',
        `symbolic target list for '${call.interfaceName}' is exhausted at callsite ${call.callsiteId ?? '?'}; `
          + `call chain ${diagnosticContext(call).callChain?.join(' -> ')}`,
        diagnosticContext(call),
      );
    }
    targetCursors.set(call.interfaceName, cursor + 1);
    return { participant: target };
  };
  const assertForwardedTarget = (
    source: WorklistParticipant,
    fn: AbiFunction,
    functionName: string,
    invocation: number,
    visibleArgs: readonly FunctionArgument[],
    call: ExternalCallAbi,
    target: WorklistParticipant,
    occurrence: number,
    resolvedTargetLockingBytecode?: string,
  ): string | undefined => {
    const targetName = call.addressParam ?? call.loopArrayVar;
    if (!targetName) return undefined;
    const input = fn.inputs.findIndex((candidate) => candidate.name === targetName);
    if (input < 0) return undefined;
    const outerCounter = (call.iterationDomain ?? call.nestedIterationDomains?.[0])?.counterName;
    const sourceIndex = call.loopArrayVar ? options.sourceIteration?.({
      participant: source, function: functionName,
      ...(fn.selector !== undefined && { selector: fn.selector }),
      invocation, callsiteId: call.callsiteId!, occurrence,
      ...(outerCounter !== undefined && { counterName: outerCounter }),
    }) ?? occurrence : occurrence;
    if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 0) {
      throw new Error(`messageBus: callsite ${call.callsiteId} has an invalid target source iteration`);
    }
    const supplied = call.loopArrayVar && Array.isArray(visibleArgs[input])
      ? visibleArgs[input][sourceIndex] : visibleArgs[input];
    if (supplied === undefined) {
      throw new Error(`messageBus: callsite ${call.callsiteId} target argument is unavailable`);
    }
    const structs = source.artifact.structs ?? source.artifact.stateLayout?.structs;
    const encoded = encodeFunctionArgument(supplied as FunctionArgument, 'address', structs);
    const encodedHex = encoded instanceof Uint8Array ? binToHex(encoded) : undefined;
    const authenticatedTargets = [
      target.lockingBytecode, target.logicalLockingBytecode, resolvedTargetLockingBytecode,
    ]
      .filter((candidate): candidate is string => candidate !== undefined)
      .map((candidate) => candidate.toLowerCase());
    const sourceUsesSolidityAddresses = source.artifact.compiler?.options?.solidityImportCompat === true;
    const suppliedIdentity = sourceUsesSolidityAddresses && encoded instanceof Uint8Array
      && (encoded.length === 20 || encoded.length === 32)
      ? solidityAddressArgumentIdentity(encoded) : undefined;
    const suppliedTargets = encodedHex === undefined ? [] : [encodedHex];
    const exactTarget = authenticatedTargets.find((candidate) => candidate === encodedHex);
    const projectedTargets = [...new Set(authenticatedTargets.filter((candidate) => {
      if (suppliedIdentity === undefined) return false;
      const narrowed = lockingBytecodeToSolidityAddressPayload(hexToBin(candidate));
      return narrowed !== undefined && binToHex(narrowed) === suppliedIdentity;
    }))];
    // ABI address words are identities, not scripts. Resolve a canonical word only against this owner's
    // authenticated locks; never pick arbitrarily when physical and logical locks have the same projection.
    const provedTarget = exactTarget ?? (projectedTargets.length === 1 ? projectedTargets[0] : undefined);
    if (provedTarget === undefined) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-forwarded-target-mismatch', {
          callsiteId: call.callsiteId,
          sourceContract: source.artifact.contractName,
          suppliedTargets,
          authenticatedTargets,
          sourceUsesSolidityAddresses,
        });
      }
      throw new Error(`messageBus: callsite ${call.callsiteId} target proof disagrees with registered owner`);
    }
    return provedTarget;
  };

  const active = new Map<string, number>();
  const expand = (
    participant: WorklistParticipant,
    functionName: string,
    selector: string | undefined,
    args: readonly FunctionArgument[],
    parent: number | null,
    callMode?: 'call' | 'staticcall',
    boundedRecursiveEdge = false,
    consumerCallsiteId?: number,
    targetLockingBytecode?: string,
    sourceOccurrence?: {
      sourceCallsiteId: number;
      sourceLogicalIndex?: number;
      occurrenceIndex: number;
      sourceEffectOrdinal?: number;
    },
  ): void => {
    if (invocations.length >= maximum) {
      throw new MessageBusDiagnosticError(
        'L3_INVOCATION_LIMIT',
        `symbolic worklist would append invocation ${invocations.length}, exceeding its `
          + `${maximum}-invocation bound; call chain ${diagnosticContext().callChain?.join(' -> ')}`,
        { ...diagnosticContext(), measured: invocations.length + 1, limit: maximum },
      );
    }
    if (activeInvocations.length > MAX_WORKLIST_DEPTH) {
      throw new MessageBusDiagnosticError(
        'L3_GRAPH_DEPTH_LIMIT',
        `symbolic worklist would append depth ${activeInvocations.length}, exceeding the deployed `
          + `${MAX_WORKLIST_DEPTH}-depth bound; call chain ${diagnosticContext().callChain?.join(' -> ')}`,
        {
          ...diagnosticContext(), measured: activeInvocations.length, limit: MAX_WORKLIST_DEPTH,
        },
      );
    }
    const owner = intern(participant);
    const invocation = invocations.length;
    let boundTarget = targetLockingBytecode
      ?? participant.logicalLockingBytecode ?? participant.lockingBytecode;
    if (parent !== null
      && participants[invocations[parent].callee].artifact.compiler?.options?.solidityImportCompat === true
      && /^(?:0{24})?[0-9a-f]{40}$/i.test(boundTarget)) {
      // Imported Solidity may evaluate a state/producer-derived target as a 20-byte identity or ABI word.
      // The native graph must name the exact co-spent lock, which the compiler re-projects and
      // checks against that source value. Only the selected participant's authenticated identities
      // are candidates; an unknown or ambiguous projection still fails planCompiledGraph's gate.
      const identities = [...new Set([
        participant.lockingBytecode.toLowerCase(), participant.logicalLockingBytecode?.toLowerCase(),
      ].filter((value): value is string => value !== undefined))];
      const matches = identities.filter((identity) => {
        const projected = lockingBytecodeToSolidityAddressPayload(hexToBin(identity));
        return projected !== undefined && binToHex(projected) === boundTarget.slice(-40).toLowerCase();
      });
      if (matches.length === 1) [boundTarget] = matches;
    }
    invocations.push({
      parent, callee: owner, function: functionName, args,
      ...(selector !== undefined && { selector }), ...(callMode && { callMode }),
      ...(consumerCallsiteId !== undefined && { consumerCallsiteId }),
      ...(sourceOccurrence !== undefined && sourceOccurrence),
      ...(parent !== null && {
        targetLockingBytecode: boundTarget,
      }),
      ...(parent === null && options.rootCaller !== undefined && { logicalCaller: options.rootCaller }),
    });
    activeInvocations.push(invocation);
    const fn = functionAbi(participant, functionName, selector);
    // Outgoing expressions read the decoded handler frame. Solidity value-address inputs are ABI words in
    // that frame, while a parameter used to select a call target retains its authenticated native lock.
    const executionArgs = projectMessageBusHandlerArguments(participant.artifact, fn.name, fn.selector, args);
    assertNoUnboundCallOptions(
      participant.lockingBytecode, participant.artifact, fn, functionName,
    );
    const key = `${owner}:${fn.selector ?? functionName}`;
    const activeCount = active.get(key) ?? 0;
    if (activeCount > 0 && !boundedRecursiveEdge) {
      throw new MessageBusDiagnosticError(
        'L3_RECURSIVE_CLOSURE',
        `recursive call closure at invocation ${invocation} '${functionName}' needs an explicit bounded `
          + `occurrence proof; call chain ${diagnosticContext().callChain?.join(' -> ')}`,
        diagnosticContext(),
      );
    }
    active.set(key, activeCount + 1);
    const publishedCalls = fn.externalCalls ?? [];
    const ordered = options.orderedOccurrences?.({
      participant, function: functionName, ...(fn.selector !== undefined && { selector: fn.selector }), invocation,
    });
    const scheduledCounts = new Map<number, number>();
    const scheduledCalls = ordered?.map(({ callsiteId, occurrence }) => {
      const call = publishedCalls.find((candidate) => candidate.callsiteId === callsiteId);
      if (!call || call.batchInvocations || call.opaqueReturn || call.interfaceName === '__raw__'
        || call.selectorArrayVar || call.fnPtrCall) {
        throw new Error(`messageBus: ordered occurrence ${callsiteId} is not a typed non-batched callsite`);
      }
      const expected = scheduledCounts.get(callsiteId) ?? 0;
      if (occurrence !== expected) {
        throw new Error(`messageBus: ordered callsite ${callsiteId} occurrence ${occurrence} is not ${expected}`);
      }
      scheduledCounts.set(callsiteId, expected + 1);
      return { call, occurrence };
    });
    if (scheduledCalls) {
      for (const call of publishedCalls) {
        const count = scheduledCounts.get(call.callsiteId!) ?? 0;
        assertPlannedOccurrenceCount(call, count);
      }
    }
    for (const { call, occurrence: scheduledOccurrence } of scheduledCalls
      ?? publishedCalls.map((publishedCall) => ({ call: publishedCall, occurrence: undefined }))) {
      // Recognize a raw edge by its compiler-authored identity, not by opaqueReturn. A VOID low-level call is
      // a raw edge that returns nothing, so it must not claim opaqueReturn - that flag means "opaque
      // integrity-bound return". Keying the branch off the flag left the honestly published void artifact
      // unrecognized, surfacing the internal sentinel `no symbolic target registered for '__raw__'`.
      const isRawEdge = call.interfaceName === '__raw__' && call.functionName === '__raw__';
      if (isRawEdge || call.opaqueReturn) {
        if (!isRawEdge) {
          throw new Error(
            `messageBus: callsite ${call.callsiteId} is not a singular statically resolvable worklist edge`,
          );
        }
        const occurrence = call.occurrence ?? 'once';
        const boundedLiteralLoop = occurrence === 'loop'
          && call.occurrenceBoundSource === 'literal'
          && call.minimumOccurrences !== undefined
          && call.minimumOccurrences === call.maximumOccurrences
          && call.minimumOccurrences >= 1 && call.minimumOccurrences <= 24;
        const boundedConditional = occurrence === 'conditional'
          && (call.maximumOccurrences ?? 1) === 1;
        if (occurrence !== 'once' && !boundedLiteralLoop && !boundedConditional) {
          throw new Error(
            `messageBus: raw callsite ${call.callsiteId} is ${call.occurrence} and has no bounded occurrence proof; `
            + 'iterated low-level calls are not an admitted graph edge',
          );
        }
        const count = occurrence === 'once' ? 1
          : boundedLiteralLoop ? call.minimumOccurrences!
            : options.occurrence?.({
              participant,
              function: functionName,
              ...(fn.selector !== undefined && { selector: fn.selector }),
              invocation,
              callsiteId: call.callsiteId!,
              kind: 'conditional',
            }) ?? -1;
        if (!Number.isInteger(count) || count < 0) {
          throw new Error(`messageBus: raw callsite ${call.callsiteId} lacks a valid ${occurrence} occurrence proof`);
        }
        if (boundedConditional) assertPlannedOccurrenceCount(call, count);
        for (let reached = 0; reached < count; reached += 1) {
          const resolved = options.dynamicCall?.({
            participant,
            function: functionName,
            ...(fn.selector !== undefined && { selector: fn.selector }),
            invocation,
            callsiteId: call.callsiteId!,
            occurrence: reached,
            kind: 'low-level',
          });
          if (!resolved?.args) {
            throw new Error(`messageBus: raw callsite ${call.callsiteId} lacks decoded calldata proof ${reached}`);
          }
          const targetFunction = functionAbi(resolved.participant, resolved.function, resolved.selector);
          if (!targetFunction.selector) {
            throw new Error(`messageBus: raw callsite ${call.callsiteId} resolved to a selectorless function`);
          }
          const structs = resolved.participant.artifact.structs
          ?? resolved.participant.artifact.stateLayout?.structs;
          if (resolved.args.length !== targetFunction.inputs.filter((input) =>
            !input.name.startsWith('__internal__')).length) {
            throw new Error(`messageBus: raw callsite ${call.callsiteId} decoded argument count is wrong`);
          }
          const encoded = resolved.args.map((argument, index) =>
            encodeFunctionArgument(argument, targetFunction.inputs[index].type, structs));
          if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
            throw new Error(`messageBus: raw callsite ${call.callsiteId} contains a transaction signature`);
          }
          const canonicalPayload = new Uint8Array([
            ...hexToBin(targetFunction.selector),
            ...scriptToBytecode(encoded as Uint8Array[]),
          ]);
          const decodedShape = call.rawArgSources && (call.rawFunctionName || call.rawSelector);
          if (decodedShape) {
            if (call.rawFunctionName && resolved.function !== call.rawFunctionName) {
              throw new Error(`messageBus: raw callsite ${call.callsiteId} decoded function disagrees with source`);
            }
            if (call.rawSelector && targetFunction.selector.toLowerCase() !== call.rawSelector.toLowerCase()) {
              throw new Error(`messageBus: raw callsite ${call.callsiteId} decoded selector disagrees with source`);
            }
            const expectedArgs = resolveArguments(
              participant, executionArgs, { ...call, argSources: call.rawArgSources }, functionName, fn.selector,
              invocation, reached, options.expressionArgument, options.sourceIteration,
            );
            const sourceUsesSolidityAddresses = participant.artifact.compiler?.options?.solidityImportCompat === true
              || participant.artifact.compiler?.options?.evmCompat === true;
            const expectedEncoded = expectedArgs.map((argument, index) =>
              encodeFunctionArgument(argument, targetFunction.inputs[index].type, structs));
            if (expectedEncoded.length !== encoded.length
              || expectedEncoded.some((argument, index) => {
                const actual = encoded[index];
                if (!(argument instanceof Uint8Array) || !(actual instanceof Uint8Array)) return true;
                if (binToHex(argument) === binToHex(actual)) return false;
                const type = targetFunction.inputs[index].type;
                // Struct/return value lanes carry ABI words, while source expressions such as address(this)
                // retain native locks. Compare only typed Solidity addresses by their canonical identity;
                // leave the authenticated argument transcript untouched and keep native/bytes equality exact.
                if (!sourceUsesSolidityAddresses || (type !== 'address' && type !== 'address payable')) return true;
                const expectedIdentity = solidityAddressArgumentIdentity(argument);
                const actualIdentity = solidityAddressArgumentIdentity(actual);
                return expectedIdentity === undefined || actualIdentity === undefined
                  || expectedIdentity !== actualIdentity;
              })) {
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
                console.error('atomic-raw-argument-mismatch', {
                  callsiteId: call.callsiteId,
                  resolvedFunction: resolved.function,
                  expectedArgs,
                  resolvedArgs: resolved.args,
                  expectedEncoded: expectedEncoded.map((argument) => argument instanceof Uint8Array
                    ? binToHex(argument) : '<signature>'),
                  resolvedEncoded: encoded.map((argument) => binToHex(argument as Uint8Array)),
                  targetTypes: targetFunction.inputs.map((input) => input.type),
                  sourceUsesSolidityAddresses,
                  sourceContract: participant.artifact.contractName,
                  rawArgSources: call.rawArgSources,
                });
              }
              throw new Error(`messageBus: raw callsite ${call.callsiteId} decoded arguments disagree with source`);
            }
          } else {
            const payload = resolveArguments(
              participant, executionArgs, call, functionName, fn.selector, invocation, reached,
              options.expressionArgument, options.sourceIteration,
            )[0];
            if (!(payload instanceof Uint8Array)) {
              throw new Error(`messageBus: raw callsite ${call.callsiteId} calldata is not bytes`);
            }
            if (binToHex(canonicalPayload) !== binToHex(payload)) {
              throw new Error(`messageBus: raw callsite ${call.callsiteId} decoded calldata is not canonical`);
            }
          }
          // A visible forwarded address is checked here. State/expression-derived targets intentionally have no
          // public ABI argument; their compiler-emitted graph projection binds the concrete owner on-chain.
          const provedTarget = assertForwardedTarget(
            participant, fn, functionName, invocation, args, call,
            resolved.participant, reached, resolved.targetLockingBytecode,
          );
          expand(
            resolved.participant,
            resolved.function,
            targetFunction.selector,
            resolved.args,
            invocation,
            edgeCallMode(call),
            false,
            call.callsiteId,
            provedTarget ?? resolved.targetLockingBytecode,
            {
              sourceCallsiteId: call.callsiteId!,
              occurrenceIndex: reached,
              ...(call.sourceEffectOrdinal !== undefined && {
                sourceEffectOrdinal: call.sourceEffectOrdinal,
              }),
            },
          );
        }
        continue;
      }
      if (call.batchInvocations) {
        if ((call.occurrence ?? 'once') !== 'once') {
          throw new Error(`messageBus: batched callsite ${call.callsiteId} must be straight-line`);
        }
        const rows = [...call.batchInvocations].sort((a, b) => a.logicalIndex - b.logicalIndex);
        rows.forEach((row, index) => {
          if (row.logicalIndex !== index) {
            throw new Error(`messageBus: batched callsite ${call.callsiteId} has non-canonical logical indices`);
          }
          const kind = row.occurrence ?? 'once';
          let inferredMaximum: number | undefined;
          let reached = kind === 'once' ? [0] : options.batchOccurrences?.({
            participant,
            function: functionName,
            ...(fn.selector !== undefined && { selector: fn.selector }),
            invocation,
            callsiteId: call.callsiteId!,
            batchLogicalIndex: row.logicalIndex,
            kind,
          });
          if (reached === undefined && kind === 'conditional') {
            const count = options.occurrence?.({
              participant,
              function: functionName,
              ...(fn.selector !== undefined && { selector: fn.selector }),
              invocation,
              callsiteId: call.callsiteId!,
              kind,
            }) ?? -1;
            if (!Number.isInteger(count) || count < 0 || count > 1) {
              throw new Error(
                `messageBus: batched conditional row ${row.logicalIndex} at callsite ${call.callsiteId} `
                + 'lacks a valid occurrence proof',
              );
            }
            reached = count === 1 ? [0] : [];
          }
          if (reached === undefined && kind === 'loop') {
            const indices = new Set<number>();
            const visit = (value: unknown, seen = new Set<object>()): void => {
              if (!value || typeof value !== 'object' || seen.has(value as object)) return;
              seen.add(value as object);
              const source = value as { kind?: string; paramIndex?: number };
              if (source.kind === 'arrayElement' && source.paramIndex !== undefined) {
                indices.add(source.paramIndex);
              }
              for (const child of Object.values(value)) {
                if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
                else visit(child, seen);
              }
            };
            visit(row.argSources);
            const lengths = [...indices].map((paramIndex) => {
              const value = args[paramIndex];
              if (!Array.isArray(value)) {
                throw new Error(
                  `messageBus: batched loop row ${row.logicalIndex} parameter ${paramIndex} is not an array`,
                );
              }
              return value.length;
            });
            if (lengths.length === 0 || !lengths.every((length) => length === lengths[0])) {
              throw new Error(
                `messageBus: batched loop row ${row.logicalIndex} at callsite ${call.callsiteId} `
                + 'has no unambiguous compiler-authored array cardinality',
              );
            }
            inferredMaximum = lengths[0];
            reached = Array.from({ length: inferredMaximum }, (_, occurrence) => occurrence);
          }
          if (!reached || reached.some((occurrence, position) => (
            !Number.isSafeInteger(occurrence) || occurrence < 0
            || (position > 0 && occurrence <= reached![position - 1])
            || (inferredMaximum !== undefined && occurrence >= inferredMaximum)
          ))) {
            throw new Error(
              `messageBus: batched row ${row.logicalIndex} at callsite ${call.callsiteId} `
              + 'has invalid reached occurrence indices',
            );
          }
          if (kind === 'conditional' && (reached.length > 1 || reached.some((occurrence) => occurrence !== 0))) {
            throw new Error(
              `messageBus: batched conditional row ${row.logicalIndex} at callsite ${call.callsiteId} `
              + 'has an invalid occurrence proof',
            );
          }
          reached.forEach((occurrence) => {
            const resolvedTarget = takeTarget(
              call, participant, fn, functionName, invocation, occurrence, row.logicalIndex,
            );
            const target = resolvedTarget.participant;
            const targetFunction = target.artifact.abi.find((candidate) =>
              candidate.selector?.toLowerCase() === row.selector.toLowerCase());
            if (!targetFunction) {
              throw new Error(
                `messageBus: batched callsite ${call.callsiteId} selector ${row.selector} is absent from its target`,
              );
            }
            const isKernel = participant.artifact.messageBus?.convention === 'kernel-row-loop';
            if (isKernel && row.sourceCallsiteId === undefined) {
              throw new Error(
                `messageBus: kernel batched callsite ${call.callsiteId} row ${row.logicalIndex} `
                + 'omits sourceCallsiteId',
              );
            }
            expand(
              target,
              targetFunction.name,
              targetFunction.selector,
              resolveArguments(
                participant,
                executionArgs,
                { ...call, functionName: targetFunction.name, argSources: row.argSources },
                functionName,
                fn.selector,
                invocation,
                occurrence,
                options.expressionArgument,
                options.sourceIteration,
              ),
              invocation,
              edgeCallMode(call),
              false,
              call.callsiteId,
              resolvedTarget.targetLockingBytecode,
              {
                // Kernel rows must publish source identity; legacy may alias physical only explicitly above.
                sourceCallsiteId: row.sourceCallsiteId ?? call.callsiteId!,
                sourceLogicalIndex: row.logicalIndex,
                occurrenceIndex: occurrence,
                ...(row.sourceEffectOrdinal !== undefined && {
                  sourceEffectOrdinal: row.sourceEffectOrdinal,
                }),
              },
            );
          });
        });
        continue;
      }
      const occurrenceKind = call.occurrence ?? 'once';
      let count = scheduledCalls ? scheduledCounts.get(call.callsiteId!) ?? 0 : 1;
      if (occurrenceKind !== 'once' && !scheduledCalls) {
        count = options.occurrence?.({
          participant,
          function: functionName,
          ...(fn.selector !== undefined && { selector: fn.selector }),
          invocation,
          callsiteId: call.callsiteId!,
          kind: occurrenceKind,
        }) ?? -1;
        // Only what the shared bound cannot know: whether the derivation probe answered at all. An absent
        // callback yields -1 and a non-integer answer is not a row count; both mean there is no proof to check.
        if (!Number.isInteger(count) || count < 0) {
          throw new Error(
            `messageBus: callsite ${call.callsiteId} lacks a valid ${occurrenceKind} occurrence proof`,
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
            ...(fn.selector !== undefined && { selector: fn.selector }),
            invocation,
            callsiteId: call.callsiteId!,
            occurrence: reached,
            kind: call.selectorArrayVar ? 'selector-table' : 'function-pointer',
          });
          if (!resolved) {
            throw new Error(`messageBus: callsite ${call.callsiteId} lacks a dynamic call proof`);
          }
          const resolvedFunction = functionAbi(resolved.participant, resolved.function, resolved.selector);
          if (call.possibleTargets?.length && !call.possibleTargets.some((candidate) =>
            candidate.functionName === resolved.function
            && candidate.selector.toLowerCase() === resolvedFunction.selector?.toLowerCase())) {
            throw new Error(
              `messageBus: callsite ${call.callsiteId} resolved outside its compiler-bounded target set`,
            );
          }
          expand(
            resolved.participant,
            resolved.function,
            resolvedFunction.selector,
            resolveArguments(
              participant,
              executionArgs,
              { ...call, functionName: resolved.function },
              functionName,
              fn.selector,
              invocation,
              reached,
              options.expressionArgument,
              options.sourceIteration,
            ),
            invocation,
            edgeCallMode(call),
            occurrenceKind !== 'once' && occurrenceBoundOf(call).maximum !== undefined,
            call.callsiteId,
            resolved.targetLockingBytecode,
            {
              sourceCallsiteId: call.callsiteId!,
              occurrenceIndex: reached,
              ...(call.sourceEffectOrdinal !== undefined && {
                sourceEffectOrdinal: call.sourceEffectOrdinal,
              }),
            },
          );
        }
        continue;
      }
      for (const reached of scheduledOccurrence === undefined
        ? Array.from({ length: count }, (_, occurrence) => occurrence) : [scheduledOccurrence]) {
        const resolvedTarget = takeTarget(call, participant, fn, functionName, invocation, reached);
        const target = resolvedTarget.participant;
        const targetFunction = functionAbi(target, call.functionName, resolvedTarget.selector);
        const provedTarget = assertForwardedTarget(
          participant, fn, functionName, invocation, args, call,
          target, reached, resolvedTarget.targetLockingBytecode,
        );
        expand(
          target,
          call.functionName,
          targetFunction.selector,
          resolveArguments(
            participant, executionArgs, call, functionName, fn.selector, invocation, reached,
            options.expressionArgument, options.sourceIteration,
          ),
          invocation,
          edgeCallMode(call),
          occurrenceKind !== 'once' && occurrenceBoundOf(call).maximum !== undefined,
          call.callsiteId,
          provedTarget ?? resolvedTarget.targetLockingBytecode,
          {
            sourceCallsiteId: call.callsiteId!,
            occurrenceIndex: reached,
            ...(call.sourceEffectOrdinal !== undefined && {
              sourceEffectOrdinal: call.sourceEffectOrdinal,
            }),
          },
        );
      }
    }
    if (activeCount === 0) active.delete(key);
    else active.set(key, activeCount);
    activeInvocations.pop();
  };

  const rootFunction = functionAbi(options.root, options.function, options.selector);
  expand(options.root, options.function, rootFunction.selector, options.args ?? [], null);
  return planCompiledGraph(participants, invocations);
}
