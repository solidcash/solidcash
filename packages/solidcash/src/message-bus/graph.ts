import {
  ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS, ATOMIC_MESSAGE_BUS_MAX_ROWS,
  MAX_MESSAGE_BUS_BLOB_BYTES, occurrenceBoundOf, occurrenceCountViolation,
} from '@solidcash/utils';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import type {
  AbiFunction, Artifact, CallsiteCallerIdentityAbi, ExternalCallAbi, ExternalResultEncoding, FunctionBlockLayout,
  InvocationAnalysisFunction,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import {
  encodeMessageBatch, encodeMessageBusArguments, messageBusTransactionSignatureFrameHex,
  resolveMessageBusAbiFunction, resolveMessageBusHandler,
  type EncodedMessageBatch, type MessageBatchCall,
} from './message-bus.js';
import { MessageBusDiagnosticError } from './diagnostics.js';
import { planKernelLifecycleTopology } from '../stateful/KernelLifecycleTopology.js';
import { resolveExternalResultEncoding } from '../stateful/solidityAbi.js';
import {
  encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope, atomicMessageBusPhysicalLayout,
  type AtomicMessageBusCallManifest, type AtomicParticipantLifecycle, type AtomicPhysicalLayout,
} from './atomic.js';
import {
  deriveValueChunkProducerChildPath,
  type ValueChunkProducerPathContext,
  type ValueChunkProducerPathDisposition,
} from '../stateful/ValueChunkProducerIdentity.js';
import {
  findMessageBusHandlerByNameOrSelector,
  findMessageBusHandlerForInvocation,
  type MessageBusPublishedHandler,
} from './graph-handler-join.js';
import { terminalConditionalReturnBase } from './layout-resolver.js';

export interface CompiledGraphParticipant {
  artifact: Artifact;
  /** V5 opaque direct owner: its ordinary covenant executes, without a message-bus route/verifier. */
  authority?: 'routed' | 'direct';
  /** Physical covenant identity used to intern and position the participant's state-owner block. */
  lockingBytecode: string;
  /** Replacement covenant identity created at master offset zero; omitted preserves the input identity. */
  outputLockingBytecode?: string;
  /**
   * Authenticated public target identity when it differs from the physical state owner, as it does for a
   * proxy/delegate execution or a contract with a published logical CREATE identity. This is the address a
   * source-level call targets. Source-level `address(this)` still reads the exact active input returned by
   * OP_UTXOBYTECODE; an outgoing call identifies its caller by the authenticated state owner, independently of
   * whether the source encoded that call through an interface or a low-level address operation.
   */
  logicalLockingBytecode?: string;
  /**
   * Local balanced-block offset which authenticates `logicalLockingBytecode`. Offset zero is the physical
   * state owner; proxy executors and immutable CREATE identity anchors occupy explicit non-zero offsets.
   */
  logicalIdentityOffset?: number;
  /** V1 authority mode. Omitted preserves the legacy/direct-owner participant route. */
  executionKind?: 'owner' | 'delegate';
  /** Immutable executor identity for the pinned one-hop delegate class. */
  executorLockingBytecode?: string;
  /**
   * Values for route key witnesses no invocation binds. An ordered mix of handlers produces these by
   * construction: a handler with a single mapping access binds only the shared entry, so another row's
   * row-local slot stays unbound while the route still declares it. The caller names that entry - the SDK
   * cannot derive it, because no row touches it - and the covenant still authenticates it like any other.
   */
  unboundRouteWitnesses?: Readonly<Record<string, FunctionArgument>>;
}

export interface CompiledGraphInvocation {
  /**
   * Parent invocation index. `null` identifies the single transaction-origin root.
   * The active caller owner is derived as `invocations[parent].callee`; it is never witness-authored.
   */
  parent: number | null;
  callee: number;
  function: string;
  /** Exact ABI entry-point selector. Required when `function` names distinct overloads. */
  selector?: string;
  args?: readonly FunctionArgument[];
  /** Compiler-stable identity of the parent callsite reached by this invocation. */
  consumerCallsiteId?: number;
  /**
   * Source callsite represented by this invocation. For an ordinary call this equals
   * `consumerCallsiteId`; a collapsed batch retains the pre-collapse source callsite here.
   */
  sourceCallsiteId?: number;
  /** Source-ordered row within a collapsed repeated-owner callsite. */
  sourceLogicalIndex?: number;
  /** Reached runtime occurrence of this source callsite or batch row. */
  occurrenceIndex?: number;
  /** Compiler-authored program point of the source call in its parent's shared effect domain. */
  sourceEffectOrdinal?: number;
  /**
   * Exact locking bytecode evaluated by the parent call expression. It may be the participant's physical
   * owner or an authenticated public identity; settlement still belongs to `callee` in both cases.
   */
  targetLockingBytecode?: string;
  /**
   * Transaction-origin caller for the root row. This is required when the root handler derives a collection
   * key from `msg.sender`; nested callers remain compiler-derived from the authenticated parent participant.
   * The plan carries the same locking bytecode into finalization, where the participant covenant binds it to
   * `tx.origin`.
   */
  logicalCaller?: FunctionArgument;
  /** Compiler-authored mode of the parent edge. Omitted only for the root or legacy direct planners. */
  callMode?: 'call' | 'staticcall';
}

export interface PlannedGraphInvocation {
  index: number;
  parent: number | null;
  caller: number | null;
  callee: number;
  /** Inclusive end of this invocation's canonical depth-first subtree. */
  subtreeEnd: number;
  localRow: number;
  depth: number;
  function: string;
  /** Canonical arguments resolved from compiler-authored callsite metadata during optimistic graph planning. */
  args?: readonly FunctionArgument[];
  selectorHex: string;
  callMode: 'call' | 'staticcall';
  /**
   * X5: the committed call-options byte of this row's parent edge - one field, one encoder, one covenant bound.
   *
   * Bit 0 is the read-only (`staticcall`) mode. Bits 1-7 are the call options a source-level callsite can carry
   * (`{value: ..}` and token-container operations); none is an admitted graph edge, so the only values the
 * covenants accept are 0 and 1, and a transaction-origin row - which answers no callsite and therefore has no
 * edge - must be exactly 0. The bits are DERIVED from the same measurement `assertNoUnboundCallOptions`
 * refuses on, not hardcoded.
   */
  callOptions: number;
  argsHex: string;
  resultTypes: readonly string[];
  /** Authenticated tuple-wide wire representation for this producer's result. */
  resultEncoding?: ExternalResultEncoding;
  /**
   * Compiler callsite identifier of the parent occurrence this invocation answers. Absent for the root and
   * for parents whose artifact publishes no matching callsite.
   */
  consumerCallsiteId?: number;
  /** Stable source producer identity, distinct from the physical callsite for collapsed batches. */
  sourceCallsiteId?: number;
  /** Source-ordered row within a collapsed repeated-owner callsite. */
  sourceLogicalIndex?: number;
  /** Reached runtime occurrence of the source producer. */
  occurrenceIndex?: number;
  /** Compiler-authored program point of the parent call in its shared write/call effect domain. */
  sourceEffectOrdinal?: number;
  /** Whether source identity was published by the compiler or normalized from a legacy batch row. */
  sourceCallsiteProvenance?: 'compiler' | 'legacy-logical';
  /** Complete only when every root-to-invocation edge has compiler-authenticated source coordinates. */
  readonly producerPath: ValueChunkProducerPathDisposition;
  /** Exact source-level call target and the participant-local input which authenticates it. */
  targetLockingBytecode: string;
  targetIdentityOffset: number;
  /**
   * Resolved caller authentication for this edge. Absent only for the transaction-origin root. Nested rows
   * carry the compiler-published descriptor plus the participant-local lock/offset that authenticate it.
   */
  callerIdentity?: ResolvedGraphCallerIdentity;
  /** Child invocation results which must exist before this invocation can resume. */
  resultDependencies: readonly number[];
}

/** Resolved caller subject for one planned graph edge. */
export interface ResolvedGraphCallerIdentity {
  version: 1;
  role: CallsiteCallerIdentityAbi['role'];
  auth: CallsiteCallerIdentityAbi['auth'];
  /** Participant-local input that authenticates `lockingBytecode` (0xffff for origin). */
  authOffset: number;
  lockingBytecode: string;
  /** Alias of authOffset retained for existing callManifest / compose consumers. */
  offset: number;
  subjectLockingBytecode?: string;
  sourceCallsiteProvenance: 'compiler' | 'legacy-logical';
}

export interface CompiledParticipantExecution {
  participant: number;
  authority?: 'routed' | 'direct';
  /** Exact artifact whose route and state layout this physical owner executes. */
  artifact: Artifact;
  lockingBytecode: string;
  /** Authenticated output identity; omitted is the canonical preservation case. */
  outputLockingBytecode?: string;
  logicalLockingBytecode?: string;
  /** Local balanced-block offset of the authenticated public call target. */
  logicalIdentityOffset: number;
  executionKind: 0 | 1;
  /** Local balanced-block offset of the distinct delegate executor input. */
  executorOffset: number | null;
  executorInputIndex: number;
  executorLockingBytecode: string;
  batch?: EncodedMessageBatch;
  /** ABI-derived calldata for one opaque direct invocation; never a routed batch. */
  directRow?: { function: string; selectorHex: string; argsHex: string };
  /** Global invocation indices, in the exact order executed by this owner's message-bus batch route. */
  invocations: readonly number[];
  /** Exact compiler-emitted balanced physical block for this owner's message-bus batch route. */
  blockLayout: FunctionBlockLayout;
  /** Exact compiler-owned route ABI, retained so argument derivation cannot silently lose internal witnesses. */
  routeInputs: NonNullable<Artifact['messageBus']>['route']['inputs'];
  /** Exclusive logical position after every invocation owned by this participant has completed. */
  settlementBoundary: number;
  /** Exclusive completion position for each local row, in message-bus batch execution order. */
  completionPositions: readonly number[];
  /** Derived only from the selected compiler-published handler and its typed invocation arguments. */
  lifecycle?: AtomicParticipantLifecycle;
}

export interface CompiledGraphPlan {
  participants: readonly CompiledParticipantExecution[];
  invocations: readonly PlannedGraphInvocation[];
  /** Root `msg.sender`, carried from planning into finalization so collection-key and caller frames agree. */
  rootCallerLockingBytecode?: string;
}

/** Physical event offsets owned by the selected local rows of a compiler-published graph effect frame. */
export function selectedGraphEventOffsets(
  plan: CompiledGraphPlan,
  participant: CompiledParticipantExecution,
): ReadonlySet<number> | undefined {
  const capability = participant.artifact.messageBus;
  const eventSlots = participant.blockLayout!.slots
    .filter((slot) => slot.kind === 'event' && slot.slotIndex !== undefined);
  let frame = capability?.route?.graphEffectFrame;
  if (!frame) {
    // Older ordinary unrolled routes predate explicit graph-effect metadata. They still publish a canonical
    // one-event-per-row prefix: exactly `maximumRows` consecutive slot indices beginning at zero. Infer only
    // that narrow, independently checkable shape and only when every selected handler emits at most once.
    const maximumRows = capability?.maximumRows ?? 0;
    const selectedHandlers = participant.invocations.map((invocationIndex) => {
      const invocation = plan.invocations[invocationIndex];
      return findMessageBusHandlerForInvocation(participant.artifact, invocation);
    });
    const canonicalPrefix = maximumRows > 0 && eventSlots.length === maximumRows
      && eventSlots.slice(0, maximumRows).every((slot, index) => slot.slotIndex === index);
    if (canonicalPrefix && selectedHandlers.every((handler) => (handler?.emits?.length ?? 0) <= 1)) {
      frame = {
        sites: maximumRows, eventBase: 0, eventWidth: 1,
        transferBase: 0, transferWidth: 0,
        tokenTransferBase: 0, tokenTransferWidth: 0, tokenNftTransfers: false,
      };
    }
  }
  if (!frame || frame.eventWidth < 1) return undefined;
  const offsetBySlot = new Map(eventSlots.map((slot) => [slot.slotIndex!, slot.offset]));
  const selected = new Set<number>();
  participant.invocations.forEach((invocationIndex, localRow) => {
    if (localRow >= frame.sites) return;
    const invocation = plan.invocations[invocationIndex];
    const handler = findMessageBusHandlerForInvocation(participant.artifact, invocation);
    for (const emitted of handler?.emits ?? []) {
      if (emitted.emitIndex < 0 || emitted.emitIndex >= frame.eventWidth) continue;
      const offset = offsetBySlot.get(frame.eventBase + localRow * frame.eventWidth + emitted.emitIndex);
      if (offset !== undefined) selected.add(offset);
    }
  });
  return selected;
}

/**
 * Reject a result-dependency graph which requires an invocation to consume an unavailable future value.
 * Structural execution/owner edges are intentionally absent: A -> B -> A is valid when its invocation-level
 * result dependencies still have a topological order.
 */
export function assertResolvableResultDependencies(
  invocationCount: number,
  dependencies: readonly (readonly number[])[],
): void {
  if (!Number.isInteger(invocationCount) || invocationCount < 0
    || dependencies.length !== invocationCount) {
    throw new MessageBusDiagnosticError(
      'L3_RESULT_DEPENDENCY_INVALID',
      'result dependency table has the wrong invocation count',
      { measured: dependencies.length, limit: invocationCount },
    );
  }
  dependencies.forEach((outgoing, consumer) => {
    const unique = new Set<number>();
    for (const producer of outgoing) {
      if (!Number.isInteger(producer) || producer < 0 || producer >= invocationCount) {
        throw new MessageBusDiagnosticError(
          'L3_RESULT_DEPENDENCY_INVALID',
          `invocation ${consumer} names out-of-range result producer ${producer}`,
          { consumerInvocation: consumer, producerInvocation: producer, invocationIds: [consumer] },
        );
      }
      if (producer === consumer || unique.has(producer)) {
        throw new MessageBusDiagnosticError(
          'L3_RESULT_DEPENDENCY_INVALID',
          `invocation ${consumer} has an invalid duplicate/self result dependency on ${producer}`,
          {
            consumerInvocation: consumer,
            producerInvocation: producer,
            cyclicEdge: [consumer, producer],
            invocationIds: [consumer, producer],
          },
        );
      }
      unique.add(producer);
    }
  });
  let shortest: number[] | undefined;
  for (let start = 0; start < invocationCount; start += 1) {
    const queue: number[][] = [[start]];
    while (queue.length > 0) {
      const path = queue.shift()!;
      for (const producer of dependencies[path[path.length - 1]]) {
        if (producer === start) {
          const cycle = [...path, start];
          if (!shortest || cycle.length < shortest.length) shortest = cycle;
        } else if (!path.includes(producer) && (!shortest || path.length + 1 < shortest.length)) {
          queue.push([...path, producer]);
        }
      }
    }
  }
  if (shortest) {
    throw new MessageBusDiagnosticError(
      'L3_FUTURE_RESULT_DEPENDENCY',
      `result dependency cycle ${shortest.join(' -> ')} requires an unavailable future result`,
      {
        consumerInvocation: shortest[0],
        producerInvocation: shortest[1],
        cyclicEdge: [shortest[0], shortest[1]],
        invocationIds: shortest,
        callChain: shortest.map((invocation) => `invocation:${invocation}`),
      },
    );
  }
}

export interface FinalizedAtomicInvocationGraph {
  plan: CompiledGraphPlan;
  layout: AtomicPhysicalLayout;
  callManifest: AtomicMessageBusCallManifest;
  bytes: Uint8Array;
  messageEnvelope: Uint8Array;
}

export interface AtomicEventSlotEffect {
  participant: number;
  offset: number;
  active?: boolean;
  lockingBytecodeHex: string;
  commitmentHex: string;
  /** Exact local invocation row for a runtime-sized event occurrence in the participant trailing band. */
  runtimeRow?: number;
  /** Compiler-published schema used to bind a runtime occurrence to that row. */
  eventSignature?: string;
}

export interface AtomicResourceSlotEffect {
  participant: number;
  offset: number;
  /** 0 transition/preserve, 1 create, 2 delete, 3 satoshi container, 4 token container, 5 replace. */
  mode: number;
  lockingBytecodeHex: string;
  /** Required by mode 5, where one authenticated mutable resource replaces another at the same coordinate. */
  outputLockingBytecodeHex?: string;
  tokenCategoryHex: string;
  outputTokenCategoryHex?: string;
  inputCommitmentHex: string;
  outputCommitmentHex: string;
  inputValue?: bigint;
  outputValue?: bigint;
}

export interface AtomicValueSlotEffect {
  participant: number;
  offset: number;
  lockingBytecodeHex: string;
  amount: bigint;
}

export interface AtomicTokenSlotEffect {
  participant: number;
  offset: number;
  lockingBytecodeHex: string;
  tokenCategoryHex: string;
  amount: bigint;
  commitmentHex: string;
  capability: 'ft' | 'none' | 'mutable' | 'minting';
}

export interface AtomicSidecarSlotEffect {
  participant: number;
  offset: number;
  kind: 'blockhashOracle' | 'keccakSideCar' | 'ecrecoverSideCar';
  lockingBytecodeHex: string;
  tokenCategoryHex: string;
  inputCommitmentHex: string;
  outputCommitmentHex: string;
  value: bigint;
}

export interface AtomicDeploymentOutputEffect {
  lockingBytecodeHex: string;
  /** Display-order category id (the vout-0 genesis transaction id), without a capability suffix. */
  tokenCategoryHex: string;
  capability: 'minting' | 'mutable';
  commitmentHex: string;
  tokenAmount: bigint;
  value: bigint;
}

/** Exact child-genesis output span selected by one compiler-published deployment occurrence. */
export interface AtomicDeploymentSlotEffect {
  participant: number;
  invocation: number;
  siteIndex: number;
  /** Participant-local balanced slot occupied by the token-free vout-0 genesis input and child master output. */
  offset: number;
  /** False reserves and authenticates the site's canonical neutral balanced span. */
  active: boolean;
  genesisTransactionHashHex?: string;
  genesisOutputIndex?: number;
  /** Child master first, followed by every mutable child data NFT in compiler-published order. */
  outputs: readonly AtomicDeploymentOutputEffect[];
}

const uint8Hex = (value: number): string => value.toString(16).padStart(2, '0');

const uint16LeHex = (value: number, field: string): string => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`messageBus: ${field} does not fit uint16`);
  }
  return `${uint8Hex(value & 0xff)}${uint8Hex(value >>> 8)}`;
};

const uint64LeHex = (value: bigint, field: string): string => {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) throw new Error(`messageBus: ${field} is outside uint64`);
  let rest = value;
  const bytes = new Uint8Array(8);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return binToHex(bytes);
};

/** Canonical off-chain commitment to the compiler-authored incoming policy published by an artifact. */
export function atomicParticipantPolicyHash(artifact: Artifact): string {
  const handlers = artifact.messageBus?.handlers;
  if (!handlers) throw new Error('messageBus: atomic participant has no compiler-published message-bus batch policy');
  const policy = handlers.map((handler) => ({
    name: handler.name,
    selector: handler.selector.toLowerCase(),
    inputs: handler.inputs.map((input) => input.type),
    outputs: (handler.outputs ?? []).map((output) => output.type),
    eligible: handler.eligible,
    rejectionCode: handler.rejectionCode ?? '',
    emits: (handler.emits ?? []).map((event) => [event.eventName, event.eventSignature, event.emitIndex]),
    transfers: (handler.transfers ?? []).map((transfer) => ({
      transferIndex: transfer.transferIndex,
      recipient: transfer.recipient,
      amount: transfer.amount,
      recipientRecipe: transfer.recipientRecipe ?? null,
      amountRecipe: transfer.amountRecipe ?? null,
      derivedRecipient: transfer.derivedRecipient ? {
        ...transfer.derivedRecipient,
        creationBytecode: transfer.derivedRecipient.creationBytecode.toLowerCase(),
      } : null,
      callOption: transfer.callOption ?? '',
      condition: transfer.condition ?? null,
    })),
    tokenOperations: (handler.tokenContainerAccesses ?? []).map((access) =>
      [access.keyParam, ...access.operations, access.transferCount ?? 0, access.transferNftCount ?? 0]),
    lifecycleTopology: handler.lifecycleTopology ?? null,
    usesTransactionSignature: handler.usesTransactionSignature ?? false,
    transactionSignaturePolicy: handler.transactionSignaturePolicy ? {
      hashType: handler.transactionSignaturePolicy.hashType,
      parameterIndices: [...handler.transactionSignaturePolicy.parameterIndices],
      coveredBytecodes: (handler.transactionSignaturePolicy.coveredBytecodes ?? []).map((entry) => ({
        parameterIndex: entry.parameterIndex, leafIndex: entry.leafIndex, bytecode: entry.bytecode.toLowerCase(),
      })),
    } : null,
    signatureBytecode: handler.signatureBytecode?.toLowerCase() ?? '',
    childDeployments: (handler.childDeployments ?? []).map((site) => ({
      siteIndex: site.siteIndex,
      contractName: site.contractName,
      occurrence: site.occurrence,
      ...(site.spanOffset !== undefined && { spanOffset: site.spanOffset }),
      ...(site.spanWidth !== undefined && { spanWidth: site.spanWidth }),
      ...(site.activation !== undefined && { activation: site.activation }),
      genesisInputCount: site.genesisInputCount,
      masterOutputCount: site.masterOutputCount,
      dataNftOutputCount: site.dataNftOutputCount,
      entryNftOutputCount: site.entryNftOutputCount ?? 0,
      totalOutputCount: site.totalOutputCount,
      categorySource: site.categorySource,
      constructorArgs: site.constructorArgs,
      ...(site.salt && { salt: site.salt }),
      ...(site.value && { value: site.value }),
      creationBytecode: site.creationBytecode.toLowerCase(),
      childLayoutDigest: site.childLayoutDigest ?? '',
      genesisState: site.genesisState ?? null,
      genesisEntries: site.genesisEntries ?? [],
    })),
  }));
  return binToHex(sha256.hash(utf8ToBin(JSON.stringify(policy))));
}

/** Freeze the currently admitted invocation and typed effect families into the atomic wire. */
export function finalizeAtomicInvocationGraph(
  plan: CompiledGraphPlan, stateCategories: readonly string[],
  results: Readonly<Record<number, string>> = {},
  eventEffects: readonly AtomicEventSlotEffect[] = [],
  resourceEffects: readonly AtomicResourceSlotEffect[] = [],
  valueEffects: readonly AtomicValueSlotEffect[] = [],
  tokenEffects: readonly AtomicTokenSlotEffect[] = [],
  sidecarEffects: readonly AtomicSidecarSlotEffect[] = [],
  actualSizes?: readonly number[],
  deploymentEffects: readonly AtomicDeploymentSlotEffect[] = [],
): FinalizedAtomicInvocationGraph {
  if (stateCategories.length !== plan.participants.length) {
    throw new Error('messageBus: atomic master categories must align with participants');
  }
  if (actualSizes !== undefined && actualSizes.length !== plan.participants.length) {
    throw new Error('messageBus: actual participant sizes must align with participants');
  }
  for (const participant of plan.participants) {
    if (participant.authority !== 'direct') continue;
    const claimed = [eventEffects, resourceEffects, valueEffects, tokenEffects, sidecarEffects,
      deploymentEffects].some((effects) => effects.some((effect) => effect.participant === participant.participant));
    if (claimed) {
      throw new Error(`messageBus: direct participant ${participant.participant} cannot claim graph effects`);
    }
  }
  const spans = plan.participants.map((participant, index) => {
    if (participant.lifecycle !== undefined) return participant.lifecycle.balancedSpan;
    const block = participant.blockLayout!;
    const fixedSize = block.fixedSuffix ? block.blockSize
      : Math.min(block.trailingBase ?? block.blockSize, terminalConditionalReturnBase(block) ?? block.blockSize);
    const actualSize = actualSizes?.[index] ?? block.blockSize;
    if (!Number.isSafeInteger(actualSize) || actualSize < fixedSize || actualSize > block.blockSize) {
      throw new Error(
        `messageBus: participant ${index} actual span ${actualSize} is outside [${fixedSize}, ${block.blockSize}]`,
      );
    }
    return actualSize;
  });
  const directV5 = plan.participants.some((participant) => participant.authority === 'direct');
  if (directV5) {
    const unsupported = plan.participants.findIndex((participant) => participant.authority !== 'direct'
      && !participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(5));
    if (unsupported >= 0) {
      throw new Error(`messageBus: routed participant ${unsupported} does not advertise atomic V5 authority`);
    }
  }
  const layout = atomicMessageBusPhysicalLayout(
    spans, plan.participants.map((participant) => participant.authority ?? 'routed'),
  );
  // Every participant must verify the exact same physical carrier. A missing messageEnvelope is an
  // absent region, not a property read. Proxy-forward, direct root-route, and historical verifier-local
  // transports are distinct covenants.
  const envelopeTransport = plan.participants[0].artifact.messageBus?.atomicMessageBus
    ?.messageEnvelope?.region;
  if (envelopeTransport !== 'participant-verifiers'
    && envelopeTransport !== 'root-route' && envelopeTransport !== 'proxy-forward') {
    throw new Error('messageBus: root participant has no supported atomic envelope transport');
  }
  const mismatchedEnvelopeTransport = plan.participants.findIndex((participant) => (
    participant.authority !== 'direct'
      && participant.artifact.messageBus?.atomicMessageBus?.messageEnvelope?.region !== envelopeTransport
  ));
  if (mismatchedEnvelopeTransport >= 0) {
    throw new Error(
      `messageBus: participant ${mismatchedEnvelopeTransport} uses a different atomic envelope transport`,
    );
  }
  const outputIdentityV2 = plan.participants.some((participant) =>
    participant.outputLockingBytecode !== undefined
      && participant.outputLockingBytecode.toLowerCase() !== participant.lockingBytecode.toLowerCase());
  const transactionSignatureFrames = plan.invocations.map((invocation) => {
    const participant = plan.participants[invocation.callee];
    return participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(4)
      ? messageBusTransactionSignatureFrameHex(participant.artifact, invocation.function, invocation.selectorHex)
      : '';
  });
  const signatureV4 = transactionSignatureFrames.some((signatureFrame, invocationIndex) =>
    signatureFrame.length > 0
      && plan.participants[plan.invocations[invocationIndex].callee]
        .artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(4));
  // V4 carries the V3 participant suffix for wire extensibility. Resource-free lifecycle authority stays
  // selector-derived from the one-row local batch (and the verifier commitment lifecycle code); the V4 suffix
  // remains the neutral `mode=0,count=0` spelling. Signed non-lifecycle siblings may therefore share a V4
  // manifest with a lifecycle participant. Detached `sig` leaves on the lifecycle handler itself remain a
  // compiler `KERNEL_TX_SIGNATURE` fence.
  if (outputIdentityV2) {
    const legacy = plan.participants.findIndex((participant) => participant.authority !== 'direct'
      && !participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(2));
    if (legacy >= 0) {
      throw new Error(
        `messageBus: participant ${legacy} verifier does not advertise atomic callManifest protocol 2`,
      );
    }
  }
  if (signatureV4) {
    const legacy = plan.participants.findIndex((participant) => participant.authority !== 'direct'
      && !participant.artifact.messageBus?.atomicMessageBus?.protocolVersions?.includes(4));
    if (legacy >= 0) {
      throw new Error(
        `messageBus: participant ${legacy} verifier does not advertise atomic callManifest protocol 4`,
      );
    }
  }
  const unsupported = plan.participants.find((participant) => {
    const slots = participant.blockLayout!.slots;
    return slots.some((slot) => ![
      'master', 'dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer',
      'transfer', 'tcTransfer', 'event', 'returnEvent', 'blockhashOracle', 'keccakSideCar',
      'ecrecoverSideCar', 'deploy', 'deployDataNft', 'trailing', 'lowLevelCall', 'identityAnchor',
      'lifecycleMaster',
    ].includes(slot.kind));
  });
  if (unsupported) {
    throw new MessageBusDiagnosticError(
      'L3_TRANSCRIPT_EFFECT_UNIMPLEMENTED',
      `participant ${unsupported.participant} requires typed resource/effect rows not yet admitted`,
      { participant: unsupported.participant },
    );
  }
  const participants = plan.participants.map((participant, index) => {
    const category = stateCategories[index].toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(category)) {
      throw new Error(`messageBus: participant ${index} master category must be 32-byte hex`);
    }
    const maximumSize = participant.lifecycle?.balancedSpan ?? participant.blockLayout!.blockSize;
    const lifecyclePrefix = participant.lifecycle === undefined ? 0
      : (participant.blockLayout?.slots.filter((slot) =>
        slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft').length ?? 0);
    // fixedSuffix (identity anchors / executor) only forbids trailing *compaction* (see spans above).
    // It must not collapse callManifest fixedSize to maximumSize: that published graphFixedSize=88 with
    // trailingUsed=0 for FakeToken (artifact trailingBase 23 + identity +1), and the OUTPUTBYTECODE lock
    // loop then compared trailing NFT locks against the wrong schedule (take-job input 225 EQUALVERIFY).
    const fixedSize = participant.authority === 'direct' ? maximumSize : participant.lifecycle === undefined
      ? Math.min(participant.blockLayout!.trailingBase ?? maximumSize,
        terminalConditionalReturnBase(participant.blockLayout!) ?? maximumSize)
      : 1 + lifecyclePrefix;
    const actualSize = spans[index];
    const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
    const publishesResult = participant.invocations.some((invocation) =>
      plan.invocations[invocation].resultTypes.length > 0);
    const lockingBytecode = participant.lockingBytecode.toLowerCase();
    const outputLockingBytecode = (participant.outputLockingBytecode ?? participant.lockingBytecode).toLowerCase();
    const internalCategory = (category.match(/../g) as string[]).reverse().join('');
    return {
      lockingBytecode, stateCategory: internalCategory,
      ...((directV5 || outputIdentityV2 || signatureV4) && { outputLockingBytecode }),
      ...(participant.authority === 'direct' && { authority: 'direct' as const }),
      fixedSize, actualSize, maximumSize,
      trailingUsed: actualSize - fixedSize,
      // Route layouts publish the union of every eligible handler, so a void selected batch can retain a physical
      // return coordinate without activating it. Advertising that inactive coordinate makes the verifier demand
      // the canonical encoded empty vector (`00`) from a deliberately token-free balanced output.
      returnOffset: !publishesResult || returnSlot === undefined ? 0xffff : returnSlot.offset,
      // Lifecycle remains a compiler-authored planning property. Its authority is derived by the specialized
      // participant verifier from its authenticated one-row batch selector/count and this ordinary V1/V2 block
      // geometry, so no caller-authored lifecycle transcript is serialized into the global manifest.
    };
  });
  const invocationRows = plan.invocations.map((invocation) => {
    const result = results[invocation.index] ?? '';
    if (!/^(?:[0-9a-fA-F]{2})*$/.test(result)) {
      throw new Error(`messageBus: invocation ${invocation.index} result is not byte-aligned hex`);
    }
    if (invocation.resultTypes.length > 0 && results[invocation.index] === undefined) {
      throw new Error(`messageBus: returning invocation ${invocation.index} lacks canonical result bytes`);
    }
    if (invocation.resultTypes.length === 0 && result.length > 0) {
      throw new Error(`messageBus: void invocation ${invocation.index} cannot carry a result`);
    }
    const caller = invocation.caller === null ? 0xff : invocation.caller;
    const callerIdentity = invocation.parent === null
      ? undefined : graphInvocationCallerIdentity(plan.participants, plan.invocations, invocation);
    const subjectHex = invocation.caller === null
      ? plan.rootCallerLockingBytecode ?? ''
      : callerIdentity!.lockingBytecode;
    const completion = plan.participants[invocation.callee].completionPositions[invocation.localRow];
    if (completion === undefined) {
      throw new Error(`messageBus: invocation ${invocation.index} has no compiler-authored completion position`);
    }
    const signatureFrame = transactionSignatureFrames[invocation.index];
    if (signatureV4) {
      if (plan.participants[invocation.callee].authority === 'direct') {
        if (signatureFrame.length !== 0) {
          throw new Error(`messageBus: direct invocation ${invocation.index} cannot claim signature provenance`);
        }
      } else {
        const projected = plan.participants[invocation.callee].batch?.rows[invocation.localRow];
        if (projected === undefined || projected.selectorHex.toLowerCase() !== invocation.selectorHex.toLowerCase()
          || projected.argsHex.toLowerCase() !== invocation.argsHex.toLowerCase()) {
          throw new Error(
            `messageBus: invocation ${invocation.index} signature provenance is not aligned with its encoded row`,
          );
        }
        if (projected.transactionSignatureFrameHex.toLowerCase() !== signatureFrame.toLowerCase()) {
          throw new Error(
            `messageBus: invocation ${invocation.index} signature provenance disagrees with compiler policy`,
          );
        }
      }
    }
    return {
      kind: 0, owner: caller === 0xff ? invocation.callee : caller, consumer: invocation.callee,
      slot: invocation.consumerCallsiteId ?? 0xffff, mode: callOptionsByte(invocation),
      sourceOffset: invocation.caller === null
        ? 0xffff : callerIdentity!.offset,
      // Settlement belongs to the physical participant, while this edge authenticates the exact address value
      // used by the source expression (physical owner or an explicit public identity anchor).
      targetOffset: invocation.targetIdentityOffset,
      selectorHex: invocation.selectorHex,
      position: completion, parent: invocation.parent ?? 0xffff, depth: invocation.depth,
      subtreeEnd: invocation.subtreeEnd, subjectHex, argsHex: invocation.argsHex, resultHex: result.toLowerCase(),
      effectHex: '',
      ...(signatureV4 && signatureFrame.length > 0 && { transactionSignatureFrameHex: signatureFrame }),
    };
  });
  const resourceKeys = new Set(resourceEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (resourceKeys.size !== resourceEffects.length) {
    throw new Error('messageBus: atomic resource effects contain a duplicate participant slot');
  }
  const resourceRows = [...resourceEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      if (!participant) throw new Error(`messageBus: resource effect names participant ${effect.participant}`);
      const slot = participant.blockLayout!.slots.find((candidate) =>
        ['dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer', 'trailing', 'lowLevelCall']
          .includes(candidate.kind)
        && candidate.offset === effect.offset);
      if (!slot) {
        throw new Error(`messageBus: participant ${effect.participant} has no resource slot ${effect.offset}`);
      }
      const satoshiContainer = slot.kind === 'satoshiContainer';
      // A co-spent delegate executor is a token-bearing covenant resource in the participant block. Model it
      // through the same fully-authenticated input/output token row as a source-level token container; the SDK
      // additionally requires exact preservation, and the executor's own master covenant independently binds it.
      const tokenContainer = slot.kind === 'tokenContainer' || slot.kind === 'lowLevelCall';
      const lifecycleConsume = effect.mode === 2
        && (slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft')
        && plan.participants[effect.participant]?.lifecycle?.kind === 'selfdestruct';
      if (effect.mode < 0 || effect.mode > 5
        || (satoshiContainer ? effect.mode !== 3 : effect.mode === 3)
        || (tokenContainer ? effect.mode !== 4 : effect.mode === 4)
        || (!satoshiContainer && !tokenContainer
          && slot.kind !== 'entry' && slot.kind !== 'trailing' && effect.mode !== 0
          && !lifecycleConsume)) {
        throw new Error(`messageBus: participant ${effect.participant} resource slot ${effect.offset} has invalid mode`);
      }
      for (const [field, value] of [
        ['locking bytecode', effect.lockingBytecodeHex], ['token category', effect.tokenCategoryHex],
        ['output locking bytecode', effect.outputLockingBytecodeHex ?? ''],
        ['output token category', effect.outputTokenCategoryHex ?? ''],
        ['input commitment', effect.inputCommitmentHex], ['output commitment', effect.outputCommitmentHex],
      ] as const) {
        if (!/^(?:[0-9a-fA-F]{2})*$/.test(value)) {
          throw new Error(`messageBus: participant ${effect.participant} resource ${field} is not byte hex`);
        }
      }
      if (satoshiContainer ? effect.tokenCategoryHex.length !== 0
        || effect.inputCommitmentHex.length !== 0 || effect.outputCommitmentHex.length !== 0
        || effect.inputValue === undefined || effect.outputValue === undefined
        : tokenContainer ? !/^[0-9a-fA-F]{64}(?:01|02)?$/.test(effect.tokenCategoryHex)
          || !/^(?:[0-9a-fA-F]{64}(?:01|02)?)?$/.test(effect.outputTokenCategoryHex ?? '')
          || ((effect.outputTokenCategoryHex?.length ?? 0) > 0
            && effect.outputTokenCategoryHex!.slice(0, 64).toLowerCase()
              !== effect.tokenCategoryHex.slice(0, 64).toLowerCase())
          || ((effect.outputTokenCategoryHex?.length ?? 0) === 0 && effect.outputCommitmentHex.length !== 0)
          || effect.inputValue === undefined || effect.outputValue === undefined
          : effect.tokenCategoryHex.length !== 66 || !effect.tokenCategoryHex.endsWith('01')
          || (effect.mode === 1 && effect.inputCommitmentHex.length !== 0)
          || (effect.mode === 2 && effect.outputCommitmentHex.length !== 0)
          || (effect.mode === 5 && !(effect.outputLockingBytecodeHex?.length))) {
        throw new Error(`messageBus: participant ${effect.participant} resource is not a mutable NFT`);
      }
      return {
        kind: 1, owner: effect.participant, consumer: effect.participant,
        slot: effect.offset, mode: effect.mode, sourceOffset: effect.offset, targetOffset: effect.offset,
        selectorHex: '00000000', position: effect.offset, parent: 0xffff, depth: 0,
        subtreeEnd: effect.offset, subjectHex: effect.lockingBytecodeHex.toLowerCase(),
        argsHex: satoshiContainer
          ? uint64LeHex(effect.inputValue!, 'satoshi-container input value')
          : effect.tokenCategoryHex.toLowerCase(),
        resultHex: tokenContainer
          ? uint64LeHex(effect.inputValue!, 'token-container input amount')
            + effect.inputCommitmentHex.toLowerCase()
          : effect.inputCommitmentHex.toLowerCase(),
        effectHex: satoshiContainer
          ? uint64LeHex(effect.outputValue!, 'satoshi-container output value')
          : tokenContainer ? uint8Hex((effect.outputTokenCategoryHex?.length ?? 0) / 2)
            + (effect.outputTokenCategoryHex ?? '').toLowerCase()
            + ((effect.outputTokenCategoryHex?.length ?? 0) === 0 ? ''
              : uint64LeHex(effect.outputValue!, 'token-container output amount')
                + effect.outputCommitmentHex.toLowerCase())
            : effect.mode === 5
              ? uint16LeHex(
                (effect.outputLockingBytecodeHex?.length ?? 0) / 2,
                'replacement output locking bytecode length',
              ) + effect.outputLockingBytecodeHex!.toLowerCase() + effect.outputCommitmentHex.toLowerCase()
              : effect.outputCommitmentHex.toLowerCase(),
      };
    });
  const effectKeys = new Set(eventEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (effectKeys.size !== eventEffects.length) {
    throw new Error('messageBus: atomic event effects contain a duplicate participant slot');
  }
  const eventOrdinals = new Map<number, number>();
  const eventRows = [...eventEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      if (!participant) throw new Error(`messageBus: event effect names participant ${effect.participant}`);
      const slot = participant.blockLayout!.slots.find((candidate) => candidate.offset === effect.offset
        && (candidate.kind === 'event' || (effect.runtimeRow !== undefined && candidate.kind === 'trailing')));
      if (!slot) {
        throw new Error(`messageBus: participant ${effect.participant} has no event slot ${effect.offset}`);
      }
      if (!effect.active) throw new Error('messageBus: inactive event slots must not produce callManifest rows');
      const eventSlotCount = participant.blockLayout!.slots.filter((candidate) => candidate.kind === 'event').length;
      const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
      const eventOrdinal = eventOrdinals.get(effect.participant) ?? 0;
      eventOrdinals.set(effect.participant, eventOrdinal + 1);
      const emittingInvocations = participant.invocations.flatMap((invocationIndex) => {
        const invocation = plan.invocations[invocationIndex];
        const handler = findMessageBusHandlerForInvocation(participant.artifact, invocation);
        return Array.from({ length: handler?.emits?.length ?? 0 }, () => invocationIndex);
      });
      if (maximumRows < 1 || (effect.runtimeRow === undefined && slot.slotIndex === undefined)
        || (emittingInvocations.length === 0 && eventSlotCount % maximumRows !== 0)) {
        throw new Error(`messageBus: participant ${effect.participant} has a non-canonical event frame`);
      }
      const frameWidth = maximumRows > 0 && eventSlotCount % maximumRows === 0
        ? eventSlotCount / maximumRows : 0;
      // Physical event sites belong to the compiler's unrolled selector dispatcher and need not be compact row
      // ordinals. Bind each discovered active event to the corresponding emitting invocation in execution order;
      // the slot itself remains authenticated independently by sourceOffset/targetOffset.
      // Older/minimal artifacts do not publish handler-level emit metadata. Keep their canonical physical-frame
      // binding as a compatibility fallback; full artifacts use the reached emitting invocation sequence above.
      const graphFrame = participant.artifact.messageBus?.route?.graphEffectFrame;
      const fixedSlotIndex = slot.slotIndex;
      let parent: number | undefined;
      if (effect.runtimeRow !== undefined) {
        const candidate = participant.invocations.find((invocationIndex) =>
          plan.invocations[invocationIndex].localRow === effect.runtimeRow);
        const invocation = candidate === undefined ? undefined : plan.invocations[candidate];
        const handler = invocation === undefined
          ? undefined
          : findMessageBusHandlerForInvocation(participant.artifact, invocation);
        const publishedSignatures = new Set((handler?.runtimeLoopEvents ?? [])
          .flatMap((loop) => loop.eventSignatures));
        if (candidate !== undefined && effect.eventSignature !== undefined
          && publishedSignatures.has(effect.eventSignature)) parent = candidate;
      } else if (graphFrame && graphFrame.eventWidth > 0 && fixedSlotIndex !== undefined
        && fixedSlotIndex >= graphFrame.eventBase
        && fixedSlotIndex < graphFrame.eventBase + graphFrame.sites * graphFrame.eventWidth) {
        const relative = fixedSlotIndex - graphFrame.eventBase;
        const localRow = Math.floor(relative / graphFrame.eventWidth);
        const emitIndex = relative % graphFrame.eventWidth;
        const candidate = participant.invocations[localRow];
        const invocation = candidate === undefined ? undefined : plan.invocations[candidate];
        const handler = invocation === undefined
          ? undefined
          : findMessageBusHandlerForInvocation(participant.artifact, invocation);
        if (handler?.emits?.some((emitted) => emitted.emitIndex === emitIndex)) parent = candidate;
      } else {
        parent = emittingInvocations[eventOrdinal]
          ?? (frameWidth > 0 && fixedSlotIndex !== undefined
            ? participant.invocations[Math.floor(fixedSlotIndex / frameWidth)] : undefined);
      }
      if (!/^(?:[0-9a-fA-F]{2})*$/.test(effect.lockingBytecodeHex)
        || !/^(?:[0-9a-fA-F]{2})*$/.test(effect.commitmentHex)) {
        throw new Error(`messageBus: participant ${participant.participant} event slot ${slot.offset} is not byte hex`);
      }
      if (parent === undefined) {
        throw new Error(
          `messageBus: event participant ${participant.participant} '${participant.artifact.contractName}' `
          + `slot ${slot.offset} has active ordinal ${eventOrdinal}, but its selected handlers declare `
          + `${emittingInvocations.length} event emission(s) across ${participant.invocations.length} invocation(s)`,
        );
      }
      const invocation = plan.invocations[parent];
      return {
        kind: 2, owner: participant.participant, consumer: participant.participant,
        slot: slot.offset, mode: effect.active ? 1 : 0,
        sourceOffset: slot.offset, targetOffset: slot.offset, selectorHex: '00000000',
        position: slot.offset, parent, depth: invocation.depth,
        subtreeEnd: parent, subjectHex: effect.lockingBytecodeHex.toLowerCase(),
        argsHex: '', resultHex: '', effectHex: effect.commitmentHex.toLowerCase(),
      };
    });
  const valueKeys = new Set(valueEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (valueKeys.size !== valueEffects.length) {
    throw new Error('messageBus: atomic value effects contain a duplicate participant slot');
  }
  const valueRows = [...valueEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      const slot = participant?.blockLayout!.slots.find((candidate) =>
        candidate.kind === 'transfer' && candidate.offset === effect.offset);
      if (!participant || !slot || slot.slotIndex === undefined) {
        throw new Error(`messageBus: participant ${effect.participant} has no transfer slot ${effect.offset}`);
      }
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(effect.lockingBytecodeHex)
        || effect.lockingBytecodeHex.toLowerCase() === '51' || effect.amount <= 0n) {
        throw new Error(`messageBus: participant ${effect.participant} transfer slot ${effect.offset} is invalid`);
      }
      const transferSlots = participant.blockLayout!.slots.filter((candidate) => candidate.kind === 'transfer').length;
      const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
      if (maximumRows < 1 || transferSlots % maximumRows !== 0) {
        throw new Error(`messageBus: participant ${effect.participant} has a non-canonical transfer frame`);
      }
      const frameWidth = transferSlots / maximumRows;
      const parent = participant.invocations[Math.floor(slot.slotIndex / frameWidth)];
      if (parent === undefined) throw new Error(`messageBus: transfer participant ${effect.participant} has no invocation`);
      const invocation = plan.invocations[parent];
      return {
        kind: 3, owner: effect.participant, consumer: effect.participant,
        slot: effect.offset, mode: 1, sourceOffset: effect.offset, targetOffset: effect.offset,
        selectorHex: '00000000', position: effect.offset, parent, depth: invocation.depth,
        subtreeEnd: parent, subjectHex: effect.lockingBytecodeHex.toLowerCase(),
        argsHex: '', resultHex: '', effectHex: uint64LeHex(effect.amount, 'value transfer amount'),
      };
    });
  const tokenKeys = new Set(tokenEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (tokenKeys.size !== tokenEffects.length) {
    throw new Error('messageBus: atomic token effects contain a duplicate participant slot');
  }
  const tokenRows = [...tokenEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      const slot = participant?.blockLayout!.slots.find((candidate) =>
        candidate.kind === 'tcTransfer' && candidate.offset === effect.offset);
      if (!participant || !slot || slot.slotIndex === undefined) {
        throw new Error(`messageBus: participant ${effect.participant} has no token-transfer slot ${effect.offset}`);
      }
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(effect.lockingBytecodeHex)
        || effect.lockingBytecodeHex.toLowerCase() === '51'
        || !/^[0-9a-fA-F]{64}(?:01|02)?$/.test(effect.tokenCategoryHex)
        || !/^(?:[0-9a-fA-F]{2})*$/.test(effect.commitmentHex)
        || (effect.capability === 'ft'
          ? effect.tokenCategoryHex.length !== 64 || effect.amount <= 0n || effect.commitmentHex.length !== 0
          : effect.amount !== 0n
            || (effect.capability === 'none' ? effect.tokenCategoryHex.length !== 64
              : !effect.tokenCategoryHex.endsWith(effect.capability === 'mutable' ? '01' : '02')))) {
        throw new Error(`messageBus: participant ${effect.participant} token-transfer slot ${effect.offset} is invalid`);
      }
      const transferSlots = participant.blockLayout!.slots.filter((candidate) => candidate.kind === 'tcTransfer').length;
      const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
      if (maximumRows < 1 || transferSlots % maximumRows !== 0) {
        throw new Error(`messageBus: participant ${effect.participant} has a non-canonical token-transfer frame`);
      }
      const frameWidth = transferSlots / maximumRows;
      const parent = participant.invocations[Math.floor(slot.slotIndex / frameWidth)];
      if (parent === undefined) {
        throw new Error(`messageBus: token-transfer participant ${effect.participant} has no invocation`);
      }
      const invocation = plan.invocations[parent];
      return {
        kind: 4, owner: effect.participant, consumer: effect.participant,
        slot: effect.offset, mode: { ft: 0, none: 1, mutable: 2, minting: 3 }[effect.capability],
        sourceOffset: effect.offset, targetOffset: effect.offset,
        selectorHex: '00000000', position: effect.offset, parent, depth: invocation.depth,
        subtreeEnd: parent, subjectHex: effect.lockingBytecodeHex.toLowerCase(),
        argsHex: effect.tokenCategoryHex.toLowerCase(), resultHex: '',
        effectHex: effect.capability === 'ft'
          ? uint64LeHex(effect.amount, 'fungible token transfer amount')
          : effect.commitmentHex.toLowerCase(),
      };
    });
  const deploymentKeys = new Set(deploymentEffects.map((effect) =>
    `${effect.participant}:${effect.invocation}:${effect.siteIndex}`));
  if (deploymentKeys.size !== deploymentEffects.length) {
    throw new Error('messageBus: atomic deployment effects contain a duplicate invocation site');
  }
  const expectedDeploymentKeys = new Set<string>();
  type CanonicalDeploymentSites = NonNullable<MessageBusPublishedHandler['childDeployments']>;
  const canonicalDeploymentSites = (invocationIndex: number): CanonicalDeploymentSites => {
    const invocation = plan.invocations[invocationIndex];
    const participant = invocation === undefined ? undefined : plan.participants[invocation.callee];
    const handler = participant === undefined
      ? undefined
      : findMessageBusHandlerForInvocation(participant.artifact, invocation);
    const sites = handler?.childDeployments ?? [];
    let expectedSpanOffset = 0;
    if (sites.some((site, index) => {
      const spanWidth = site.spanWidth ?? site.totalOutputCount;
      const spanOffset = site.spanOffset ?? expectedSpanOffset;
      const valid = site.siteIndex === index
        && (site.occurrence === 'once' || (site.occurrence === 'conditional' && site.activation !== undefined))
        && site.genesisInputCount === 1 && site.masterOutputCount === 1
        && Number.isSafeInteger(site.dataNftOutputCount) && site.dataNftOutputCount >= 0
        && Number.isSafeInteger(site.entryNftOutputCount ?? 0) && (site.entryNftOutputCount ?? 0) >= 0
        && site.totalOutputCount === 1 + site.dataNftOutputCount + (site.entryNftOutputCount ?? 0)
        && spanWidth === site.totalOutputCount && spanOffset === expectedSpanOffset;
      expectedSpanOffset += site.totalOutputCount;
      return !valid;
    })) {
      throw new Error(`messageBus: invocation ${invocationIndex} has a non-canonical deployment topology`);
    }
    return sites;
  };
  for (const invocation of plan.invocations) {
    const sites = canonicalDeploymentSites(invocation.index);
    for (const site of sites) {
      expectedDeploymentKeys.add(`${invocation.callee}:${invocation.index}:${site.siteIndex}`);
    }
  }
  if (expectedDeploymentKeys.size !== deploymentKeys.size
    || [...expectedDeploymentKeys].some((key) => !deploymentKeys.has(key))) {
    throw new Error('messageBus: atomic deployment effects do not exactly cover reached deployment invocations');
  }
  const deploymentOffsets = new Set(deploymentEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (deploymentOffsets.size !== deploymentEffects.length) {
    throw new Error('messageBus: atomic deployment effects contain a duplicate participant slot');
  }
  const deploymentRows = [...deploymentEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      const invocation = plan.invocations[effect.invocation];
      if (!participant || !invocation || invocation.callee !== effect.participant
        || !participant.invocations.includes(effect.invocation)) {
        throw new Error(
          `messageBus: deployment participant ${effect.participant} does not own invocation ${effect.invocation}`,
        );
      }
      const sites = canonicalDeploymentSites(effect.invocation);
      const site = sites[effect.siteIndex];
      if (!site || site.siteIndex !== effect.siteIndex) {
        throw new Error(
          `messageBus: invocation ${effect.invocation} has no straight-line deployment site ${effect.siteIndex}`,
        );
      }
      // The compiler publishes one physical deployment window per route row: its first member is the
      // token-free genesis input/child-master pair (`deploy`), and every remaining member is output-only
      // (`deployDataNft`). Multiple logical source sites partition that window in source order; later child
      // masters remain members of the same physical window rather than introducing another `deploy` slot.
      const rowSlots = participant.blockLayout!.slots.filter((candidate) =>
        (candidate.kind === 'deploy' || candidate.kind === 'deployDataNft')
        && candidate.slotIndex === invocation.localRow)
        .sort((left, right) => left.offset - right.offset);
      const rowBase = rowSlots[0];
      if (!rowBase || rowBase.kind !== 'deploy'
        || rowSlots.some((slot, index) => slot.offset !== rowBase.offset + index
          || (index > 0 && slot.kind !== 'deployDataNft'))) {
        throw new Error(
          `messageBus: participant ${effect.participant} row ${invocation.localRow} has a non-canonical deployment window`,
        );
      }
      const siteOffset = rowBase.offset + (site.spanOffset
        ?? sites.slice(0, effect.siteIndex).reduce((offset, prior) => offset + prior.totalOutputCount, 0));
      const usedWidth = sites.reduce((width, candidate) => width + candidate.totalOutputCount, 0);
      if (usedWidth > rowSlots.length || siteOffset !== effect.offset
        || effect.offset + site.totalOutputCount > rowBase.offset + rowSlots.length) {
        throw new Error(
          `messageBus: participant ${effect.participant} deployment site ${effect.siteIndex} has a non-canonical output span`,
        );
      }
      const active = effect.active !== false;
      if (active && effect.outputs.length !== site.totalOutputCount) {
        throw new Error(
          `messageBus: deployment site ${effect.siteIndex} requires ${site.totalOutputCount} exact outputs`,
        );
      }
      if (!active && (site.occurrence !== 'conditional' || effect.outputs.length !== 0)) {
        throw new Error(`messageBus: deployment site ${effect.siteIndex} has a non-canonical inactive span`);
      }
      if (!active) {
        return {
          kind: 5, owner: effect.participant, consumer: effect.participant,
          slot: effect.offset, mode: 1, sourceOffset: effect.offset, targetOffset: effect.offset,
          selectorHex: '00000000', position: effect.offset, parent: effect.invocation, depth: invocation.depth,
          subtreeEnd: effect.invocation, subjectHex: '',
          argsHex: uint16LeHex(effect.siteIndex, 'deployment site index'),
          resultHex: '', effectHex: uint16LeHex(site.totalOutputCount, 'inactive deployment span width'),
        };
      }
      const genesis = effect.genesisTransactionHashHex?.toLowerCase() ?? '';
      if (!/^[0-9a-f]{64}$/.test(genesis) || effect.genesisOutputIndex !== 0) {
        throw new Error(`messageBus: deployment site ${effect.siteIndex} genesis must be a 32-byte vout-0 transaction`);
      }
      effect.outputs.forEach((output, index) => {
        const expectedCapability = index === 0 ? 'minting' : 'mutable';
        if (!/^(?:[0-9a-fA-F]{2})+$/.test(output.lockingBytecodeHex)
          || !/^(?:[0-9a-fA-F]{2})*$/.test(output.commitmentHex)
          || output.tokenCategoryHex.toLowerCase() !== genesis
          || output.capability !== expectedCapability || output.tokenAmount !== 0n
          || output.value < 0n || output.value > 0xffff_ffff_ffff_ffffn) {
          throw new Error(
            `messageBus: deployment site ${effect.siteIndex} output ${index} does not match its child-genesis shape`,
          );
        }
      });
      const internalCategory = (genesis.match(/../g) as string[]).reverse().join('');
      const descriptorDigest = site.childLayoutDigest?.toLowerCase() ?? '';
      if (!/^[0-9a-f]{64}$/.test(descriptorDigest)) {
        throw new Error(
          `messageBus: deployment site ${effect.siteIndex} has no authenticated child layout descriptor`,
        );
      }
      const effectHex = uint16LeHex(effect.outputs.length, 'deployment output count')
        + effect.outputs.map((output, index) => {
          const lockingBytecode = output.lockingBytecodeHex.toLowerCase();
          const commitment = output.commitmentHex.toLowerCase();
          return uint64LeHex(output.value, `deployment output ${index} value`)
            + uint8Hex(output.capability === 'minting' ? 2 : 1)
            + uint16LeHex(lockingBytecode.length / 2, `deployment output ${index} locking bytecode length`)
            + lockingBytecode
            + uint16LeHex(commitment.length / 2, `deployment output ${index} commitment length`)
            + commitment;
        }).join('');
      return {
        kind: 5, owner: effect.participant, consumer: effect.participant,
        slot: effect.offset, mode: 0, sourceOffset: effect.offset, targetOffset: effect.offset,
        selectorHex: '00000000', position: effect.offset, parent: effect.invocation, depth: invocation.depth,
        subtreeEnd: effect.invocation, subjectHex: '',
        argsHex: uint16LeHex(effect.siteIndex, 'deployment site index') + internalCategory + descriptorDigest,
        resultHex: '', effectHex,
      };
    });
  const sidecarKeys = new Set(sidecarEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (sidecarKeys.size !== sidecarEffects.length) {
    throw new Error('messageBus: atomic sidecar effects contain a duplicate participant slot');
  }
  const sidecarRows = [...sidecarEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      const slot = participant?.blockLayout!.slots.find((candidate) =>
        candidate.kind === effect.kind && candidate.offset === effect.offset);
      if (!participant || !slot) {
        throw new Error(`messageBus: participant ${effect.participant} has no ${effect.kind} slot ${effect.offset}`);
      }
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(effect.lockingBytecodeHex)
        || !/^[0-9a-fA-F]{64}(?:01|02)?$/.test(effect.tokenCategoryHex)
        || !/^(?:[0-9a-fA-F]{2})*$/.test(effect.inputCommitmentHex)
        || !/^(?:[0-9a-fA-F]{2})*$/.test(effect.outputCommitmentHex)
        || effect.value < 0n) {
        throw new Error(`messageBus: participant ${effect.participant} sidecar slot ${effect.offset} is invalid`);
      }
      return {
        kind: 6, owner: effect.participant, consumer: effect.participant,
        slot: effect.offset,
        mode: { blockhashOracle: 0, keccakSideCar: 1, ecrecoverSideCar: 2 }[effect.kind],
        sourceOffset: effect.offset, targetOffset: effect.offset, selectorHex: '00000000',
        position: effect.offset, parent: 0xffff, depth: 0, subtreeEnd: effect.offset,
        subjectHex: effect.lockingBytecodeHex.toLowerCase(),
        argsHex: effect.tokenCategoryHex.toLowerCase() + effect.inputCommitmentHex.toLowerCase(),
        resultHex: '', effectHex: uint64LeHex(effect.value, 'sidecar value')
          + effect.outputCommitmentHex.toLowerCase(),
      };
    });
  const rows = [
    ...invocationRows, ...resourceRows, ...eventRows, ...valueRows, ...tokenRows,
    ...deploymentRows, ...sidecarRows,
  ];
  const callManifest = {
    ...(directV5 ? { version: 5 as const }
      : signatureV4 ? { version: 4 as const }
        : outputIdentityV2 ? { version: 2 as const } : {}), participants, rows,
  };
  const bytes = encodeAtomicMessageBusCallManifest(callManifest);
  return Object.freeze({ plan, layout, callManifest, bytes, messageEnvelope: encodeAtomicMessageEnvelope(callManifest) });
}

/**
 * One participant's bounded runtime-resource region, in ABSOLUTE transaction slots.
 *
 * The compiler reserves this region inside the participant's balanced block for resources whose count is
 * only known at run time: dynamic-storage chunks, loop entries and loop sidecars. Its size is fixed at
 * compile time and is part of `blockSize`, so every later participant is already placed past it - the region
 * is not an extension of the block, it is part of it.
 *
 * Published because the composer cannot derive it: `blockLayout.trailingBase` is LOCAL to the block, and only
 * this layout knows where the block starts. Without it, S3's transaction is assembled by adding the two by
 * hand at every call site, which is exactly the global-index dependency L1 exists to remove.
 */
export interface GraphTrailingRegion {
  /** Index into `CompiledGraphPlan.participants`. */
  participant: number;
  /** First absolute input/output slot of the region. */
  base: number;
  /** Slots reserved. A longer run cannot be described by the balanced model at all. */
  capacity: number;
}

export interface GraphTrailingCapacityView {
  participantInputs: readonly number[];
  trailingRegions: readonly GraphTrailingRegion[];
}

/**
 * Refuse a runtime-resource run the balanced model cannot describe, BEFORE anything is signed.
 *
 * `runs` names, per participant, how many trailing slots that owner's handlers actually claim: one per
 * dynamic-storage chunk output, loop entry or loop sidecar. The direct route already refuses this shape
 * (`StatefulTransactionBuilder`, "Runtime resource outputs exceed balanced trailing capacity"); the graph
 * route had no analogue, and the difference is measurable. A 65-chunk write against a 64-slot region was
 * built, funded and signed, and then refused by the VM at the first participant input - a slot that names
 * nothing about the cause, because the overflowing block simply runs into the proof region. This states the
 * refusal where the composer can act on it, at zero signature requests.
 *
 * It is a describability rule, not a covenant: the covenant is what actually authenticates the chunk run, and
 * nothing here relaxes it. A run WITHIN capacity is accepted by this check and still has to satisfy the
 * count, order, category, capability and commitment checks in the participant's own route.
 */
export function assertGraphTrailingCapacity(
  layout: GraphTrailingCapacityView,
  runs: Readonly<Record<number, number>>,
): void {
  for (const [key, run] of Object.entries(runs)) {
    const participant = Number(key);
    if (!Number.isInteger(participant) || participant < 0
      || participant >= layout.participantInputs.length) {
      throw new Error(`messageBus: trailing run names participant ${key}, which this graph does not have`);
    }
    if (!Number.isInteger(run) || run < 0) {
      throw new Error(`messageBus: participant ${participant} has a non-integer runtime-resource run`);
    }
    if (run === 0) continue;
    const region = layout.trailingRegions.find((entry) => entry.participant === participant);
    if (region === undefined) {
      throw new MessageBusDiagnosticError(
        'L3_RESOURCE_CAPACITY',
        `messageBus: participant ${participant} claims ${run} runtime-resource slots but its block declares no `
        + 'trailing region',
        { participant, measured: run, limit: 0 },
      );
    }
    if (run > region.capacity) {
      throw new MessageBusDiagnosticError(
        'L3_RESOURCE_CAPACITY',
        `messageBus: participant ${participant} runtime-resource run exceeds its balanced trailing capacity `
        + `(${run} > ${region.capacity})`,
        { participant, measured: run, limit: region.capacity },
      );
    }
  }
}

const MAX_GRAPH_PARTICIPANTS = ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS;
// Each of at most eight participants publishes a one-byte route row count. The manifest itself allows more
// rows, but no representable graph can have more invocation rows than the sum of those participant capacities.
// Keep this as the worklist's safety bound; individual route/blob limits are checked by their owners later.
export const MAX_GRAPH_INVOCATIONS = Math.min(
  ATOMIC_MESSAGE_BUS_MAX_ROWS, ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS * 0xff,
);
const MAX_GRAPH_DEPTH = 7;

/**
 * Shared legacy envelope ceiling. Kernel participants use the BCH-2026 stack-item ceiling
 * unless the graph planner supplies an explicit, tighter limit.
 */
export const GRAPH_MAX_BATCH_BLOB_BYTES = MAX_MESSAGE_BUS_BLOB_BYTES;

/**
 * Refuse a participant whose published blob envelope is wider than the atomic verifier admits.
 *
 * The direction is not symmetric, and only one side is a defect. A participant publishing a SMALLER maximum is
 * merely tighter: `encodeMessageBatch` refuses the oversized blob first, by name. A participant publishing a
 * LARGER one is the drift that costs: the SDK encodes a blob its own encoder accepts, and the co-spent
 * participant verifier then refuses the whole transaction, naming nothing about blob width.
 */
export function assertGraphBatchBlobEnvelope(
  artifact: Artifact, participant: number, maximumBlobBytes?: number,
): void {
  const maximum = maximumBlobBytes ?? (artifact.messageBus?.convention === 'kernel-row-loop'
    ? ConsensusBch2026.maximumStackItemLength : GRAPH_MAX_BATCH_BLOB_BYTES);
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error('messageBus: graph maximum blob bytes must be a positive integer');
  }
  const published = artifact.messageBus?.maximumBlobBytes;
  if (published === undefined || published <= maximum) return;
  throw new Error(
    `messageBus: participant ${participant} publishes an message-bus batch blob envelope of ${published} bytes, wider than the `
    + `${maximum} the atomic bus admits`,
  );
}
/** Bit 0 of the call-options byte: the compiler-proven read-only (`staticcall`) mode. */
const CALL_OPTION_READ_ONLY = 1;
/** Bit 1: the admitted singular raw-call value option. Higher source-level option bits remain refused. */
const CALL_OPTION_VALUE = 2;
const CALL_OPTION_TOKEN_CONTAINER = 4;
const CALL_OPTION_BLOCK_SLOT = 8;

/**
 * The single encoder of a row's committed call-options byte, used by BOTH framings that carry it: the caller's
 * emission row and the global invocation row. They are compared by the participant verifier,
 * so a second copy of this ternary is a place for the two to drift - the shape X31 removed for `abi.find`.
 *
 * `callMode` stays the field the rest of the planner reasons about; this asserts the byte agrees with it.
 */
const callOptionsByte = (invocation: PlannedGraphInvocation): number => {
  const options = invocation.callOptions;
  if (!Number.isInteger(options) || options < 0 || options > 0xff) {
    throw new Error(`messageBus: invocation ${invocation.index} has no canonical call-options byte`);
  }
  const readOnly = invocation.callMode === 'staticcall' ? CALL_OPTION_READ_ONLY : 0;
  if ((options & CALL_OPTION_READ_ONLY) !== readOnly) {
    throw new Error(
      `messageBus: invocation ${invocation.index} call-options byte disagrees with its '${invocation.callMode}' mode`,
    );
  }
  return options;
};

/** Runtime-selected callsites authenticate their concrete selector/calldata in the atomic messageEnvelope. */
const isRuntimeResolvedCallsite = (callsite: ExternalCallAbi): boolean =>
  callsite.fnPtrCall === true
  || callsite.selectorArrayVar !== undefined
  || callsite.loopArrayVar !== undefined
  || callsite.functionName === '__raw__'
  || callsite.opaqueReturn === true;

/** One reached child row for sourceCallsite attribution attribution (name + optional published source identity). */
export type ReachedConsumerCallsite = {
  functionName: string;
  /** Pre-collapse compiler source callsite id when published. */
  sourceCallsiteId?: number;
  /** Optional selector hex for selector-aware disambiguation. */
  selectorHex?: string;
};

/**
 * Bind each reached child to one compiler-authored occurrence without guessing across incompatible schemas.
 * sourceCallsite attribution: prefer published `sourceCallsiteId` / unique selector;
 * kernel (`requireUniqueAttribution`) fails closed on same-name multi-candidate collapse.
 */
export function bindConsumerCallsites(
  parent: number,
  callsites: readonly ExternalCallAbi[],
  reached: readonly (string | ReachedConsumerCallsite)[],
  options?: { requireUniqueAttribution?: boolean },
): (ExternalCallAbi | undefined)[] {
  const rows: ReachedConsumerCallsite[] = reached.map((entry) => (
    typeof entry === 'string' ? { functionName: entry } : entry
  ));
  if (callsites.length === 0) return rows.map(() => undefined);
  // sourceCallsite attribution: published sourceCallsiteId / selector rows skip the positional shortcut.
  const hasPublishedIdentity = rows.some((row) => (
    row.sourceCallsiteId !== undefined || (row.selectorHex !== undefined && row.selectorHex !== '')
  ));
  const singular = callsites.every((callsite) => (occurrenceBoundOf(callsite).maximum ?? 2) <= 1);
  const positionallyCompatible = callsites.length === rows.length && rows.every((row, position) => {
    const callsite = callsites[position];
    return isRuntimeResolvedCallsite(callsite)
      || (callsite.rawFunctionName ?? callsite.functionName) === row.functionName;
  });
  // A fully reached bounded conditional list remains in compiler callsite order. Preserve that stronger identity
  // (including selector-only raw rows) rather than widening every raw callsite into a candidate for every child.
  if (!hasPublishedIdentity && singular && positionallyCompatible) {
    return rows.map((row, position) => {
      const callsite = callsites[position]!;
      if (!isRuntimeResolvedCallsite(callsite) && callsite.functionName !== row.functionName) {
        throw new Error(
          `messageBus: invocation ${parent} reaches '${row.functionName}' where its compiler-authored callsite `
          + `${position} calls '${callsite.functionName}'`,
        );
      }
      return callsite;
    });
  }
  return rows.map((row) => {
    // sourceCallsite attribution: published source identity is authoritative when present.
    if (row.sourceCallsiteId !== undefined) {
      const byId = callsites.find((callsite) => (
        callsite.callsiteId === row.sourceCallsiteId
        || callsite.batchInvocations?.some((batch) => batch.sourceCallsiteId === row.sourceCallsiteId)
      ));
      if (byId === undefined) {
        throw new Error(
          `messageBus: invocation ${parent} names absent source callsite ${row.sourceCallsiteId} `
            + `for '${row.functionName}'`,
        );
      }
      return byId;
    }
    if (row.selectorHex !== undefined && row.selectorHex !== '') {
      const selector = row.selectorHex.toLowerCase();
      const bySelector = callsites.filter((callsite) => (
        (callsite.rawSelector ?? '').toLowerCase() === selector
        || (callsite.possibleTargets ?? []).some((target) => target.selector.toLowerCase() === selector)
      ));
      if (bySelector.length === 1) return bySelector[0];
      if (bySelector.length > 1) {
        throw new Error(
          `messageBus: invocation ${parent} selector ${selector} matches ${bySelector.length} callsites`,
        );
      }
    }
    const candidates = callsites.filter((callsite) =>
      (isRuntimeResolvedCallsite(callsite)
        && (callsite.rawFunctionName === undefined || callsite.rawFunctionName === row.functionName))
      || callsite.functionName === row.functionName);
    if (candidates.length === 0) return undefined;
    const contract = (callsite: ExternalCallAbi): string =>
      `${callsite.hasReturnValues === true}|${(callsite.returnTypes ?? []).join(',')}|`
      + `${callsite.resultEncoding ?? 'legacy'}`;
    if (new Set(candidates.map(contract)).size > 1) {
      throw new Error(
        `messageBus: invocation ${parent} cannot bind '${row.functionName}' to one callsite; its conditional or `
        + 'loop callsites disagree on the consumed result',
      );
    }
    // sourceCallsite attribution: same-name multi-candidate collapse is forbidden under kernel unique attribution.
    if (candidates.length > 1 && options?.requireUniqueAttribution === true) {
      throw new Error(
        `messageBus: invocation ${parent} reaches '${row.functionName}' at ${candidates.length} `
          + 'same-schema callsites; publish sourceCallsiteId (name-first attribution disabled)',
      );
    }
    return candidates[0];
  });
}

/**
 * Freeze a planned graph into one unambiguous execution callManifest.
 *
 * Results are supplied only after producer VM probes. Every returning invocation must have exactly one
 * canonical result byte vector, while void invocations must not be assigned one. The callManifest commits both
 * the global depth-first tree and each owner's exact message-bus batch execution blob, preventing a graph/local-policy
 * desynchronization.
 */
export function assertPlannedOccurrenceCount(
  call: ExternalCallAbi, count: number, allowRuntimeBoundedLoop = false,
): void {
  const bound = occurrenceBoundOf(call);
  if (bound.kind === 'loop' && bound.maximum === undefined) {
    if (allowRuntimeBoundedLoop) return;
    throw new MessageBusDiagnosticError(
      'L3_UNBOUNDED_EXTERNAL_CALL_LOOP',
      `unbounded-external-call-loop-callManifest-ineligible: callsite ${call.callsiteId ?? '?'}`,
      { callsiteId: call.callsiteId, measured: count },
    );
  }
  const violation = occurrenceCountViolation(call, count);
  if (violation !== undefined) throw new Error(`messageBus: ${violation}`);
}

/**
 * Rows one compiler-authored callsite can answer.
 *
 * The legs mirror `occurrenceCountViolation` exactly, so a count within the capacity can never be a violation
 * and a count above it always is. A collapsed repeated-call callsite names its rows outright. A non-loop
 * callsite is reached at most once whether or not the compiler spent bytes saying so. Only a loop can leave
 * its ceiling unproven, and an unproven ceiling admits any count up to the global invocation bound.
 */
const batchedCallsiteBounds = (call: ExternalCallAbi): { minimum: number; maximum: number } | undefined => {
  if (call.batchInvocations === undefined) return undefined;
  let minimum = 0;
  let maximum = 0;
  for (const row of call.batchInvocations) {
    const occurrence = row.occurrence ?? 'once';
    if (occurrence === 'once') {
      minimum += 1;
      maximum += 1;
    } else if (occurrence === 'conditional') {
      maximum += 1;
    } else {
      maximum = Number.POSITIVE_INFINITY;
    }
  }
  return { minimum, maximum };
};

const callsiteRowCapacity = (call: ExternalCallAbi): number => {
  const batched = batchedCallsiteBounds(call);
  if (batched !== undefined) return batched.maximum;
  const bound = occurrenceBoundOf(call);
  if (bound.kind !== 'loop') return 1;
  return bound.maximum ?? Number.POSITIVE_INFINITY;
};

/**
 * Refuse a caller-supplied row set one handler cannot have emitted, using the same bound as the other entry
 * point and naming the callsite the surplus would have to answer.
 *
 * This is deliberately computed from the handler's TOTAL published capacity rather than from
 * `bindConsumerCallsites`' per-row attribution. That attribution is an acknowledged guess - it binds by name
 * and takes the first matching candidate, so two callsites of one name collapse onto the first - and refusing
 * on a guess produces false rejections rather than a tightening. Filling the callsites in source order is
 * guess-free: with every earlier callsite at its published ceiling, the last one is the only place a further
 * row could come from, so the surplus is reported against it.
 *
 * Deliberately NOT touched: a loop callsite legitimately answers many rows, and a collapsed repeated-call
 * callsite legitimately answers `batchInvocations.length` of them. Both stay many-to-one; the bound, not the
 * arity, is what separates them from rows a `once` callsite cannot have emitted.
 */
function assertHandlerRowCapacity(
  callsites: readonly ExternalCallAbi[], rows: number, allowRuntimeBoundedLoops = false,
): void {
  const unbounded = callsites.find((callsite) => {
    const bound = occurrenceBoundOf(callsite);
    return bound.kind === 'loop' && bound.maximum === undefined;
  });
  if (unbounded) assertPlannedOccurrenceCount(unbounded, rows, allowRuntimeBoundedLoops);
  if (callsites.length === 0 || rows === 0) return;
  const capacities = callsites.map(callsiteRowCapacity);
  const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (rows <= total) return;
  const last = capacities.length - 1;
  const surplus = capacities[last] + (rows - total);
  const batched = callsites[last].batchInvocations;
  // A collapsed repeated-call callsite is `once` yet answers every row it NAMES, so the occurrence wording
  // would read "reached at most once" against a callsite that legitimately emits several. It publishes its own
  // exact count instead. `deriveCompiledGraphPlan` cannot reach this leg: it expands that callsite to exactly
  // `batchInvocations.length` rows by construction.
  if (batched !== undefined) {
    assertBatchedCallsiteRowCount(callsites[last], surplus);
    throw new Error(`messageBus: batched callsite ${callsites[last].callsiteId ?? '?'} capacity drift`);
  }
  assertPlannedOccurrenceCount(callsites[last], surplus);
}

/**
 * Rows one compiler-authored callsite MUST answer.
 *
 * The mirror of `callsiteRowCapacity`, leg for leg, on the same shared bound. A collapsed repeated-call
 * callsite names its rows outright. Every other class takes the floor `occurrenceBoundOf` publishes, which is
 * 1 for a straight-line `once` callsite - reached structurally, whether or not the compiler spent bytes saying
 * so - and, for a conditional or loop callsite, only what the compiler actually proved. An absent floor is
 * zero: a branch that was not taken legitimately emits no row.
 */
const callsiteRowFloor = (call: ExternalCallAbi): number => {
  const batched = batchedCallsiteBounds(call);
  if (batched !== undefined) return batched.minimum;
  return occurrenceBoundOf(call).minimum ?? 0;
};

function assertBatchedCallsiteRowCount(call: ExternalCallAbi, count: number): void {
  const bound = batchedCallsiteBounds(call);
  if (!bound) return;
  if (count >= bound.minimum && count <= bound.maximum) return;
  if (bound.minimum === bound.maximum) {
    throw new Error(
      `messageBus: callsite ${call.callsiteId ?? '?'} identifies ${bound.minimum} batched rows, `
      + `but ${count} were planned`,
    );
  }
  const maximum = Number.isFinite(bound.maximum) ? String(bound.maximum) : 'an unbounded runtime maximum';
  throw new Error(
    `messageBus: callsite ${call.callsiteId ?? '?'} admits ${bound.minimum}..${maximum} batched rows, `
    + `but ${count} were planned`,
  );
}

/**
 * X179: refuse a caller-supplied row set that DROPS a row one handler must have emitted.
 *
 * `assertHandlerRowCapacity` bounds this from above only, and was skipped entirely for a handler planned with
 * no children at all - so a handler whose whole body is one unconditional external call could be planned with
 * the call simply left out, and the route published it as an admitted handler whose observable effect is
 * nothing. `deriveCompiledGraphPlan` cannot produce that plan: it expands every `once` callsite
 * unconditionally and `takeTarget` throws when no participant answers it, which is the derivation entry
 * point's statement that a dropped edge is not an outcome. This is the same statement on the entry point that
 * takes rows from the caller.
 *
 * THE VM AGREES, FOR THE ORDINARY SHAPE. A caller route partitions its authenticated emission vector row by
 * row, so a dropped edge leaves it with nothing to split and the transaction is refused at the caller's own
 * master input - `MessageBusDroppedEdgeX179.test.ts` settles both argument shapes co-spent and refuses both with
 * the child removed, and `MessageBusOccurrenceExhaustion.test.ts` records the same signature for a callManifest
 * that omits a reached occurrence. This turns that unnamed `OP_SPLIT` failure into a named plan-time
 * diagnostic, in the same way `assertSingleConsumedResult` does for result fan-in.
 *
 * IT IS NOT A BOUNDARY. `Attack.attack` - one unconditional callsite, counterparty bus-inadmissible - settles
 * with an EMPTY emission vector (`MessageBusRecoveredVoidWriterX177.test.ts`), so for at least that handler shape
 * the caller covenant does not bind its own outgoing edge and this refusal is the only thing between the
 * composer and a published handler that does nothing. The SDK is an untrusted witness constructor: a spender
 * who hand-assembles the plan is not subject to this at all. Closing it properly is compiler-side.
 *
 * Reported against the first callsite the rows do not reach, for the same reason the ceiling side reports
 * against the last: with every earlier callsite at its published floor, that is the only callsite a missing
 * row can belong to, so the attribution is guess-free rather than `bindConsumerCallsites`' by-name guess.
 */
function assertHandlerRowFloor(callsites: readonly ExternalCallAbi[], rows: number): void {
  if (callsites.length === 0) return;
  const floors = callsites.map(callsiteRowFloor);
  if (rows >= floors.reduce((sum, floor) => sum + floor, 0)) return;
  let remaining = rows;
  for (const [index, callsite] of callsites.entries()) {
    if (remaining >= floors[index]) {
      remaining -= floors[index];
      continue;
    }
    // A collapsed repeated-call callsite is `once` yet emits every row it NAMES, so the occurrence wording
    // would read "reached at most once" against a callsite that legitimately emits several.
    if (callsite.batchInvocations !== undefined) {
      assertBatchedCallsiteRowCount(callsite, remaining);
      throw new Error(`messageBus: batched callsite ${callsite.callsiteId ?? '?'} floor drift`);
    }
    assertPlannedOccurrenceCount(callsite, remaining);
    // The shared bound admitted a count this floor does not, so the two have drifted. Refuse rather than
    // fall through to a plan whose only remaining decider is a covenant measured not to bind this edge.
    throw new Error(
      `messageBus: callsite ${callsite.callsiteId ?? '?'} must be answered by ${floors[index]} rows, `
      + `but ${remaining} were planned`,
    );
  }
}

/** Block slots that carry a call option or an unconditioned value movement. */
const OPTION_SLOT_KINDS: ReadonlySet<string> = new Set([
  'satoshiContainer', 'transfer', 'tokenContainer', 'tcTransfer',
]);

/**
 * Name the compiler gives one handler's graph EMISSION clone.
 *
 * `compiler.ts` clones every `graphTailHandlers` member as `__message_bus_graph_<handler>`.
 *
 * SUPERSEDED IN PART, and the note is kept rather than deleted because the gate below still reads this name.
 * `computeScalarJournalClosures` used to exclude every emission clone from SEC-18's widened closure, which is
 * what made this name a reliable answer to "does this row read the pre-state". It no longer is: a clone is now
 * admitted for its PLAIN SCALAR slots, so a clone reading `state:<scalar>` loads through the live journal and
 * the covenant itself refuses the stale composition - proven by bypass constructors in
 * `MessageBusEmissionCloneJournalX111.test.ts`. X146 subsequently completed the clone journal and closed the
 * DYNAMIC half at consensus too. The gate below is therefore a planner diagnostic on current compiler output,
 * not a security boundary. Keep it fail-closed for older artifacts, but do not trust its name vocabulary or
 * invocation metadata.
 *
 * X138 removed the one ADMISSION a published claim could buy - see the note on the write claim in
 * `assertNoStaleEmissionCloneReads`. It is still not a boundary: a spender that never calls
 * `planCompiledGraph` is not subject to it at all. `MessageBusEmissionCloneFakeWriteX138.test.ts` preserves the
 * hand-assembled bypass and proves X146 moved its refusal into the covenant.
 */
const GRAPH_EMISSION_CLONE_PREFIX = '__message_bus_graph_';

/**
 * State-variable name behind one footprint resource, for both spellings a variable appears under.
 *
 * A scalar slot is `state:<name>`; an entry of a collection or state array is `collection:<name>:<key>`. Both
 * matter on the WRITE side: `legs.push(..)` publishes only `collection:legs:*`, yet it moves that variable's
 * scalar length slot, which is what `computeScalarJournalClosures` counts as a write (`StateArrayPushNode`).
 * Reading the write side as scalar-only would therefore miss a push writer entirely.
 */
const footprintVariable = (resource: string): string | undefined => {
  if (resource.startsWith('state:')) return resource.slice('state:'.length);
  if (!resource.startsWith('collection:')) return undefined;
  const rest = resource.slice('collection:'.length);
  const separator = rest.lastIndexOf(':');
  return separator < 0 ? rest : rest.slice(0, separator);
};

/** Scalar slots one summary reads. The scalar journal is what SEC-18 widened, so this side stays exact. */
const scalarReadsOf = (summary: InvocationAnalysisFunction): readonly string[] => summary.reads
  .filter((resource) => resource.startsWith('state:'))
  .map((resource) => resource.slice('state:'.length));

/** Every state variable one summary writes, under either spelling. */
const writtenVariablesOf = (summary: InvocationAnalysisFunction): readonly string[] => summary.writes
  .map(footprintVariable)
  .filter((name): name is string => name !== undefined);

/**
 * X138. Chunk-backed state variables of one participant, taken from the STATE LAYOUT rather than from a
 * per-function footprint.
 *
 * `stateLayout` is the shape the participant's own covenant rebuilds and compares against its data NFT, so a
 * participant that misdeclares it cannot settle at all. A per-function `writes`/`reads` list is not like that
 * - nothing in the transaction commits to `invocationAnalysis`, which is exactly why one fabricated write on
 * an emission clone used to buy admission (X138). Both are fields of an artifact the spender hands the
 * planner, so neither is trusted; the difference is that a lie about this one is self-defeating.
 */
const dynamicVariablesOf = (artifact: Artifact): ReadonlySet<string> => new Set(
  (artifact.stateLayout?.variables ?? []).filter((variable) => variable.dynamic).map((v) => v.name),
);

/** One row of one owner, in the order that owner's message-bus batch route executes them. */
interface OwnerRow { localRow: number; function: string }

/**
 * X111. Refuse a route whose ROW SET makes a read-only graph emission clone observe the PRE-transaction value
 * of a slot an EARLIER row of the same owner already wrote.
 *
 * SEC-18 widened the scalar journal to every route-reachable function, so a pure reader observes the newest
 * write. Emission clones were excluded from that widening, so a clone which touched a scalar slot and wrote
 * none still read the authenticated input commitment. That was exploitable exactly as SEC-18 was: the caller
 * contract's own body emits the guard row, so a spender cannot drop it, and a post-condition then passes
 * against the value the transaction is changing.
 *
 * THE PREMISE ABOVE IS NO LONGER TRUE FOR SCALAR SLOTS. The exclusion was called non-negotiable at
 * code-generation time and it was not: `computeScalarJournalClosures` now admits an emission clone for its
 * plain scalar slots, and the two constructors that bypass this function entirely - the hand-assembled plan
 * and the artifact with the clone dropped from `invocationAnalysis` - are refused by the vault's own covenant.
 * X146 later completed the clone's dynamic journal and proved the hand-assembled bypass is refused at the
 * participant's dynamic master while the live-read and reader-first controls settle. This rule remains a
 * fail-closed diagnostic for older artifacts; it must not be cited as the consensus boundary.
 *
 * WHY THIS IS THE RIGHT SITE. The equivalent compile-time refusal was implemented and measured: it
 * false-refused the vmap capstone entirely, because `registerCredit`/`registerDebit` write `legs` and sit in the
 * route CLOSURE even when no such row exists in the transaction. Route-closure membership is not
 * route-composition membership. Here the row set is concrete, so the writers considered are the ones the
 * transaction really contains.
 *
 * WHY ORDER IS PART OF THE RULE. A clone at local row 0 reading the pre-state is reading the sequentially
 * correct value - there is no earlier write for it to have missed. Only an EARLIER writer of the same slot
 * makes the read stale, and the journal is sequential, so a later write can never reach an earlier read.
 * Ignoring order would refuse the honest reader-first composition.
 *
 * WHAT IS CONSERVATIVE. A clone whose footprint is `unknown` has no enumerable read set, so any writer of any
 * slot on the same owner refuses it. A participant publishing no invocation analysis at all cannot be
 * diagnosed and is refused rather than skipped. This keeps the planner fail-closed for older artifacts even
 * though current compiler output enforces the property in the covenant.
 */
function assertNoStaleEmissionCloneReads(
  participants: readonly CompiledGraphParticipant[],
  rowsByOwner: readonly (readonly OwnerRow[])[],
): void {
  participants.forEach((participant, owner) => {
    const summaries = participant.artifact.invocationAnalysis?.functions;
    if (summaries === undefined) {
      throw new Error(
        `messageBus: participant ${owner} publishes no invocation analysis, so a stale graph emission-clone read `
        + 'cannot be diagnosed; recompile the participant with a compiler that publishes it',
      );
    }
    const byName = new Map(summaries.map((summary) => [summary.name, summary]));
    const rows = rowsByOwner[owner];
    // Earliest local row writing each variable, over the rows THIS transaction contains.
    const writtenAt = new Map<string, OwnerRow>();
    for (const row of rows) {
      const executed = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`)
        ?? byName.get(row.function);
      if (executed === undefined) continue;
      for (const name of writtenVariablesOf(executed)) {
        if (!writtenAt.has(name)) writtenAt.set(name, row);
      }
    }
    const refuse = (row: OwnerRow, writer: OwnerRow, slot: string): never => {
      throw new Error(
        `messageBus: participant ${owner} row ${row.localRow} '${row.function}' is a read-only graph emission `
        + `clone reading '${slot}', which row ${writer.localRow} '${writer.function}' of the same owner `
        + 'writes earlier in the route; the clone reads the pre-transaction value, so this composition is '
        + 'not an admitted graph shape',
      );
    };
    // X138. The write claim below is the SPENDER'S, and it used to be read first and unconditionally: one
    // published `writes: ['state:nosuchslot']` on a read-only clone turned the whole rule off. That is a
    // claim-driven ADMISSION, the one direction a witness-side check may never take, and behind it the
    // chunk-backed residual settles - `MessageBusEmissionCloneFakeWriteX138.test.ts` broadcasts a transaction
    // whose guard row is true of the pre-state 30 and false of the 40 the same transaction commits, on an
    // artifact whose bytecode and address are byte-identical to the honest one.
    //
    // The claim is now honoured for a PLAIN SCALAR slot only. There it is not load-bearing: the compiler
    // journals a clone's scalar slots whether or not it writes, and the covenant refuses the stale scalar
    // composition itself, so believing a liar costs a diagnostic and nothing else. On a chunk-backed slot the
    // compiler journals nothing unless the clone really is a writer, so the claim is the entire boundary and
    // is refused outright. Dynamism comes from `stateLayout`, which the participant's own covenant enforces.
    const dynamic = dynamicVariablesOf(participant.artifact);
    for (const row of rows) {
      const clone = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`);
      if (clone === undefined) continue;
      const claimsWrite = writtenVariablesOf(clone).length > 0;
      if (clone.unknown) {
        // No enumerable read set, so the dynamic arm cannot be isolated: the claim is honoured only when the
        // participant declares no chunk-backed slot for the unnamed read to be on.
        if (claimsWrite && dynamic.size === 0) continue;
        for (const [slot, writer] of writtenAt) {
          if (writer.localRow < row.localRow) refuse(row, writer, slot);
        }
        continue;
      }
      for (const slot of scalarReadsOf(clone)) {
        const writer = writtenAt.get(slot);
        if (writer === undefined || writer.localRow >= row.localRow) continue;
        if (claimsWrite && !dynamic.has(slot)) continue;
        refuse(row, writer, slot);
      }
    }
  });
}

/**
 * Resolve the single ABI function one graph row names.
 *
 * Overloads share a name, so a name alone can select a different dispatch target than the caller meant, and
 * the callManifest would then commit the wrong selector and argument vector consistently. Entries agreeing on
 * their selector are the same target and are not ambiguous.
 */
export function resolveGraphAbiFunction(
  artifact: Artifact, name: string, selector?: string,
): AbiFunction | undefined {
  try {
    return resolveMessageBusAbiFunction(artifact, name, selector);
  } catch (error) {
    // The selector remains authoritative for kernel dispatch; retain the source row name in graph diagnostics.
    if (selector !== undefined && error instanceof Error
      && /does not identify an ABI function/.test(error.message)) {
      throw new Error(
        `messageBus: selector ${selector} does not identify ABI function '${name}' in '${artifact.contractName}'`,
      );
    }
    throw error;
  }
}

type GraphCallerParticipant = {
  artifact: Artifact;
  lockingBytecode: string;
  executionKind?: 'owner' | 'delegate' | 0 | 1;
  logicalLockingBytecode?: string;
  logicalIdentityOffset?: number;
  executorLockingBytecode?: string;
  executorOffset?: number | null;
};

type GraphCallerInvocation = (
  Pick<CompiledGraphInvocation,
  'parent' | 'callee' | 'function' | 'consumerCallsiteId' | 'selector' | 'targetLockingBytecode'>
  | Pick<PlannedGraphInvocation,
  'parent' | 'callee' | 'function' | 'consumerCallsiteId' | 'callerIdentity' | 'targetLockingBytecode'
  | 'targetIdentityOffset'>
) & { selectorHex?: string };

const resolveActiveCallerIdentity = (
  caller: GraphCallerParticipant,
  parent: GraphCallerInvocation,
  published: CallsiteCallerIdentityAbi,
): ResolvedGraphCallerIdentity => {
  if (published.version !== 1) {
    throw new Error(`messageBus: unsupported callsite callerIdentity version ${published.version}`);
  }
  if (published.auth !== 'input-bytecode' || published.authOffset !== 0xffff) {
    throw new Error('messageBus: active callerIdentity requires input-bytecode auth at the derived offset');
  }
  const delegate = caller.executionKind === 'delegate' || caller.executionKind === 1;
  const publicSelf = caller.artifact.messageBus?.route?.inputs.some(
    (input) => input.name === '__internal__graphSelfIdentityInput',
  ) === true;
  if (delegate || (publicSelf && caller.logicalLockingBytecode !== undefined
    && caller.logicalLockingBytecode.toLowerCase() !== caller.lockingBytecode.toLowerCase())) {
    const logical = caller.logicalLockingBytecode?.toLowerCase();
    const logicalOffset = caller.logicalIdentityOffset;
    if (logical === undefined || typeof logicalOffset !== 'number'
      || !Number.isInteger(logicalOffset) || logicalOffset <= 0) {
      throw new Error('messageBus: active public caller requires an authenticated logical identity');
    }
    return {
      version: 1, role: 'active', auth: 'input-bytecode', authOffset: logicalOffset,
      lockingBytecode: logical, offset: logicalOffset,
      sourceCallsiteProvenance: 'compiler',
    };
  }
  const physical = caller.lockingBytecode.toLowerCase();
  const logical = caller.logicalLockingBytecode?.toLowerCase();
  // `planCompiledGraph` resolves target aliases after it has encoded local rows. Mirror that exact default for
  // the earlier row build: the transaction root is necessarily physical, while a nested invocation defaults to
  // its authenticated public identity when one exists. An explicit target remains authoritative.
  const entered = parent.targetLockingBytecode?.toLowerCase()
    ?? (parent.parent === null ? physical : logical ?? physical);
  const offset = 'targetIdentityOffset' in parent
    ? parent.targetIdentityOffset
    : entered === logical ? caller.logicalIdentityOffset : 0;
  if (entered === physical && (offset === undefined || offset === 0)) {
    return {
      version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0,
      lockingBytecode: physical, offset: 0, sourceCallsiteProvenance: 'compiler',
    };
  }
  const logicalOffset = caller.logicalIdentityOffset;
  if (logical !== undefined && entered === logical
    && typeof logicalOffset === 'number' && Number.isInteger(logicalOffset) && logicalOffset > 0
    && (offset === undefined || offset === logicalOffset)) {
    return {
      version: 1, role: 'active', auth: 'input-bytecode', authOffset: logicalOffset,
      lockingBytecode: logical, offset: logicalOffset, sourceCallsiteProvenance: 'compiler',
    };
  }
  throw new Error('messageBus: active callerIdentity does not match the authenticated parent target');
};

const publishedCallsiteCallerIdentity = (
  parentParticipant: GraphCallerParticipant,
  parentInvocation: GraphCallerInvocation,
  child: GraphCallerInvocation,
): CallsiteCallerIdentityAbi | undefined => {
  const selector = 'selector' in parentInvocation ? parentInvocation.selector
    : 'selectorHex' in parentInvocation ? parentInvocation.selectorHex : undefined;
  let parentFunction: AbiFunction | undefined;
  try {
    parentFunction = resolveGraphAbiFunction(
      parentParticipant.artifact, parentInvocation.function, selector,
    );
  } catch {
    // Fixture / lifecycle peers may carry a selector that does not name the parent handler. Fall back to
    // name-only resolution so a missing publication still takes the legacy path instead of failing closed here.
    try {
      parentFunction = resolveGraphAbiFunction(parentParticipant.artifact, parentInvocation.function);
    } catch {
      parentFunction = undefined;
    }
  }
  const callsites = parentFunction?.externalCalls ?? [];
  if (child.consumerCallsiteId !== undefined) {
    return callsites.find((call) => call.callsiteId === child.consumerCallsiteId)?.callerIdentity;
  }
  const byName = callsites.filter((call) =>
    (call.rawFunctionName ?? call.functionName) === child.function);
  return byName.length === 1 ? byName[0].callerIdentity : undefined;
};

const resolvePublishedCallerIdentity = (
  caller: GraphCallerParticipant,
  published: CallsiteCallerIdentityAbi,
  provenance: 'compiler' | 'legacy-logical',
): ResolvedGraphCallerIdentity => {
  if (published.version !== 1) {
    throw new Error(`messageBus: unsupported callsite callerIdentity version ${published.version}`);
  }
  if (published.role === 'origin') {
    if (published.authOffset !== 0xffff) {
      throw new Error('messageBus: origin callerIdentity must publish authOffset 0xffff');
    }
    return {
      version: 1, role: 'origin', auth: published.auth, authOffset: 0xffff,
      lockingBytecode: published.subjectLockingBytecode?.toLowerCase() ?? '',
      offset: 0xffff, subjectLockingBytecode: published.subjectLockingBytecode?.toLowerCase(),
      sourceCallsiteProvenance: provenance,
    };
  }
  if (published.auth === 'literal') {
    const lock = published.subjectLockingBytecode?.toLowerCase();
    if (!lock || !/^([0-9a-f]{2})+$/.test(lock)) {
      throw new Error('messageBus: literal callerIdentity requires subjectLockingBytecode hex');
    }
    return {
      version: 1, role: published.role, auth: 'literal', authOffset: published.authOffset,
      lockingBytecode: lock, offset: published.authOffset, subjectLockingBytecode: lock,
      sourceCallsiteProvenance: provenance,
    };
  }
  switch (published.role) {
    case 'owner': {
      const offset = published.authOffset;
      return {
        version: 1, role: 'owner', auth: published.auth, authOffset: offset,
        lockingBytecode: caller.lockingBytecode.toLowerCase(), offset,
        sourceCallsiteProvenance: provenance,
      };
    }
    case 'create':
    case 'proxy': {
      const logical = caller.logicalLockingBytecode?.toLowerCase();
      if (!logical) {
        throw new Error(
          `messageBus: callerIdentity role '${published.role}' requires an authenticated logical identity`,
        );
      }
      const offset = published.authOffset === 0xffff
        ? (caller.logicalIdentityOffset ?? 0)
        : published.authOffset;
      return {
        version: 1, role: published.role, auth: published.auth, authOffset: offset,
        lockingBytecode: logical, offset, sourceCallsiteProvenance: provenance,
      };
    }
    case 'executor': {
      const executor = caller.executorLockingBytecode?.toLowerCase();
      const offset = published.authOffset === 0xffff
        ? (caller.executorOffset ?? 0xffff)
        : published.authOffset;
      if (!executor || offset === 0xffff) {
        throw new Error('messageBus: callerIdentity role \'executor\' requires a pinned executor input');
      }
      return {
        version: 1, role: 'executor', auth: published.auth, authOffset: offset,
        lockingBytecode: executor, offset, sourceCallsiteProvenance: provenance,
      };
    }
    default:
      throw new Error(`messageBus: unsupported callerIdentity role '${(published as CallsiteCallerIdentityAbi).role}'`);
  }
};

/**
 * Resolve the authenticated caller subject for one CALL/staticcall edge from the compiler-published
 * callsite descriptor. Never invent owner@0 from proxy/delegate execution geometry when a publication exists.
 */
export function graphInvocationCallerIdentity(
  participants: readonly GraphCallerParticipant[],
  invocations: readonly GraphCallerInvocation[],
  invocation: GraphCallerInvocation,
): ResolvedGraphCallerIdentity {
  if (invocation.parent === null) {
    throw new Error('messageBus: transaction-origin invocation has no participant caller identity');
  }
  if ('callerIdentity' in invocation && invocation.callerIdentity !== undefined) {
    return invocation.callerIdentity;
  }
  const parentInvocation = invocations[invocation.parent];
  const caller = participants[parentInvocation.callee];
  const published = publishedCallsiteCallerIdentity(caller, parentInvocation, invocation);
  if (published !== undefined) {
    if (published.role === 'active') {
      return resolveActiveCallerIdentity(caller, parentInvocation, published);
    }
    return resolvePublishedCallerIdentity(caller, published, 'compiler');
  }
  // Kernel routes require an explicit publication; legacy artifacts keep today's owner@0 fallback.
  if (caller.artifact.messageBus?.convention === 'kernel-row-loop') {
    throw new Error(
      'messageBus: kernel callsite is missing compiler-published callerIdentity',
    );
  }
  return resolvePublishedCallerIdentity(caller, {
    version: 1, role: 'owner', auth: 'input-bytecode', authOffset: 0,
  }, 'legacy-logical');
}

/**
 * Measure the call options one graph invocation's function carries that the executed message-bus batch route does not.
 *
 * `IFoo(addr).m{value: v}()` publishes `transferCount` and `satoshiContainer`/`transfer` slots on the DIRECT
 * block layout, while the message-bus batch route layout, the handler policy and the callManifest row stay byte identical
 * to the option-free form. Executing such a function as a graph row therefore drops the option silently unless
 * something commits it - which is what the row's call-options byte is for.
 *
 * A first-party `this.transfer(..)` publishes the SAME direct-mode fields yet is carried into the route, which
 * is why the direct block layout alone cannot tell a bound effect from a dropped one and why this compares the
 * two policies instead of flagging every value-moving function. The measured discriminator is the message-bus batch
 * handler: an option contributes nothing to `handler.transfers`, a first-party transfer contributes one entry
 * and eight route `transfer` slots. A value-bearing child creation is the other bound form: its exact transfer
 * index and typed amount recipe are published by the selector-exact child-deployment site. Dropped token-container
 * operations are already refused at compile time; the container arm here is the SDK-side backstop for the same class.
 *
 * X5: this is ONE measurement with two consumers - `assertNoUnboundCallOptions`, which turns it into the single
 * named refusal, and `planCompiledGraph`, which encodes it into the committed row. Splitting the measurement
 * would let the refusal and the committed byte disagree about the same artifact.
 */
export function measureUnboundCallOptions(
  artifact: Artifact, fn: AbiFunction, name: string,
): { optionBits: number; detail?: string } {
  const handler = findMessageBusHandlerByNameOrSelector(artifact, {
    name,
    selector: fn.selector,
  });
  const routeKinds = new Set((artifact.messageBus?.route.blockLayout?.slots ?? [])
    .map((slot) => slot.kind as string));
  const deploymentValues = handler?.childDeployments?.filter((site) => site.value !== undefined).length ?? 0;
  const unboundValue = (fn.transferCount ?? 0) - (handler?.transfers?.length ?? 0) - deploymentValues;
  const unboundContainer = (fn.tokenContainerAccesses?.length ?? 0)
    - (handler?.tokenContainerAccesses?.length ?? 0);
  // Backstop for an artifact whose per-handler policy is absent or understated: a direct-mode option slot
  // kind the route never reserves cannot be settled by the row, whatever the counts claim.
  const droppedKinds = [...new Set((fn.blockLayout?.slots ?? [])
    .filter((slot) => OPTION_SLOT_KINDS.has(slot.kind) && !routeKinds.has(slot.kind))
    .map((slot) => slot.kind))];
  const optionBits = (unboundValue > 0 ? CALL_OPTION_VALUE : 0)
    | (unboundContainer > 0 ? CALL_OPTION_TOKEN_CONTAINER : 0)
    | (droppedKinds.length > 0 ? CALL_OPTION_BLOCK_SLOT : 0);
  let detail: string | undefined;
  if (unboundValue > 0) detail = `${unboundValue} value option(s)/transfer(s)`;
  else if (unboundContainer > 0) detail = `${unboundContainer} token-container operation(s)`;
  else if (droppedKinds.length > 0) detail = `block slots ${droppedKinds.join(', ')}`;
  return { optionBits, ...(detail !== undefined && { detail }) };
}

/**
 * The single named refusal for a graph row whose function carries an unbound call option.
 *
 * X31: one exported function, reached from both public planning entry points, so the same artifact produces a
 * byte-identical string whichever one the caller used.
 */
export function assertNoUnboundCallOptions(
  lockingBytecode: string, artifact: Artifact, fn: AbiFunction, name: string,
): void {
  const { detail } = measureUnboundCallOptions(artifact, fn, name);
  if (detail === undefined) return;
  throw new Error(
    `messageBus: function '${name}' of participant ${lockingBytecode.slice(0, 12)} declares `
    + `${detail}, which the callManifest row does not bind; call options are not an admitted graph edge`,
  );
}

/**
 * Group a finite logical graph by physical owner while preserving global invocation order.
 *
 * Each owner receives one real compiler-generated message-bus batch plan, regardless of how often a cycle re-enters it.
 * The resulting `localRow` mapping is deterministic and is the bridge between global call edges and the
 * owner-local sequential journal. This function intentionally does not accept selectors, encoded arguments,
 * or results from the caller: all are derived from compiler artifacts.
 */
export function planCompiledGraph(
  participants: readonly CompiledGraphParticipant[],
  invocations: readonly CompiledGraphInvocation[],
  options: { allowRuntimeBoundedLoops?: boolean; maximumBlobBytes?: number } = {},
): CompiledGraphPlan {
  if (participants.length < 1 || participants.length > MAX_GRAPH_PARTICIPANTS) {
    throw new MessageBusDiagnosticError(
      'L3_PARTICIPANT_LIMIT',
      `messageBus: compiled graph participant count must be between 1 and ${MAX_GRAPH_PARTICIPANTS}`,
      { measured: participants.length, limit: MAX_GRAPH_PARTICIPANTS },
    );
  }
  if (invocations.length > MAX_GRAPH_INVOCATIONS) {
    throw new MessageBusDiagnosticError(
      'L3_INVOCATION_LIMIT',
      `messageBus: compiled graph has more than ${MAX_GRAPH_INVOCATIONS} invocations`,
      {
        measured: invocations.length,
        limit: MAX_GRAPH_INVOCATIONS,
        invocationIds: invocations.map((_invocation, index) => index),
        callChain: invocations.map((invocation, index) => `${index}:${invocation.function}`),
      },
    );
  }
  const identities = new Set<string>();
  participants.forEach((participant, index) => {
    const lbc = participant.lockingBytecode.toLowerCase();
    if (!/^([0-9a-f]{2})+$/.test(lbc)) {
      throw new Error(`messageBus: participant ${index} locking bytecode must be hex bytes`);
    }
    if (participant.logicalLockingBytecode !== undefined
      && !/^([0-9a-f]{2})+$/.test(participant.logicalLockingBytecode.toLowerCase())) {
      throw new Error(`messageBus: participant ${index} logical locking bytecode must be hex bytes`);
    }
    if (participant.outputLockingBytecode !== undefined
      && !/^([0-9a-f]{2})+$/.test(participant.outputLockingBytecode.toLowerCase())) {
      throw new Error(`messageBus: participant ${index} output locking bytecode must be non-empty hex bytes`);
    }
    if (identities.has(lbc)) {
      throw new Error('messageBus: two participant rows name the same physical locking bytecode');
    }
    identities.add(lbc);
    // X106: the artifact's published blob envelope has to fit the participant verifier's compiled-in bound.
    // Skipped for an artifact publishing no envelope at all, which fails later by name at `messageBus!`.
    assertGraphBatchBlobEnvelope(participant.artifact, index, options.maximumBlobBytes);
  });
  if (invocations.length === 0 || invocations[0].parent !== null
    || invocations.slice(1).some((invocation) => invocation.parent === null)) {
    throw new Error('messageBus: compiled graph requires exactly one root invocation at index 0');
  }
  const invocationTargetIdentity = (
    invocation: CompiledGraphInvocation, index: number,
  ): { lockingBytecode: string; offset: number } => {
    const participant = participants[invocation.callee];
    const physical = participant.lockingBytecode.toLowerCase();
    if (invocation.parent === null) {
      if (invocation.targetLockingBytecode !== undefined
        && invocation.targetLockingBytecode.toLowerCase() !== physical) {
        throw new Error(`messageBus: root invocation ${index} cannot target a participant identity alias`);
      }
      return { lockingBytecode: physical, offset: 0 };
    }
    const logical = participant.logicalLockingBytecode?.toLowerCase();
    const requested = invocation.targetLockingBytecode?.toLowerCase() ?? logical ?? physical;
    if (!/^([0-9a-f]{2})+$/.test(requested)) {
      throw new Error(`messageBus: invocation ${index} target locking bytecode must be hex bytes`);
    }
    if (requested === physical) return { lockingBytecode: physical, offset: 0 };
    if (logical !== undefined && requested === logical) {
      return { lockingBytecode: logical, offset: participant.logicalIdentityOffset ?? 0 };
    }
    throw new Error(
      `messageBus: invocation ${index} target is not an authenticated identity of participant ${invocation.callee}`
      + ` (function=${invocation.function}, target=${requested}, physical=${physical}, logical=${logical ?? 'none'})`,
    );
  };

  const perOwner: MessageBatchCall[][] = participants.map(() => []);
  const globalByOwner: number[][] = participants.map(() => []);
  const subtreeEnds = invocations.map((_invocation, index) => index);
  const active: number[] = [];
  invocations.forEach((invocation, index) => {
    if (!Number.isInteger(invocation.callee)
      || invocation.callee < 0 || invocation.callee >= participants.length) {
      throw new Error(`messageBus: invocation ${index} callee is out of range`);
    }
    if (index === 0) {
      active.push(0);
    } else {
      if (invocation.logicalCaller !== undefined) {
        throw new Error(
          `messageBus: invocation ${index} cannot override its compiler-derived parent caller`,
        );
      }
      if (!Number.isInteger(invocation.parent)
        || invocation.parent! < 0 || invocation.parent! >= index) {
        throw new Error(`messageBus: invocation ${index} parent must be a preceding invocation`);
      }
      while (active.length > 0 && active[active.length - 1] !== invocation.parent) active.pop();
      if (active.length === 0) {
        throw new Error(`messageBus: invocation ${index} re-enters a completed subtree`);
      }
      for (const ancestor of active) subtreeEnds[ancestor] = index;
      active.push(index);
    }
    if (active.length - 1 > MAX_GRAPH_DEPTH) {
      throw new MessageBusDiagnosticError(
        'L3_GRAPH_DEPTH_LIMIT',
        `messageBus: compiled graph depth exceeds ${MAX_GRAPH_DEPTH}`,
        {
          measured: active.length - 1,
          limit: MAX_GRAPH_DEPTH,
          invocationIds: [...active],
          callChain: active.map((invocationIndex) =>
            `${invocationIndex}:${invocations[invocationIndex].function}`),
          handler: invocation.function,
          participant: invocation.callee,
        },
      );
    }
    const abiFunction = resolveGraphAbiFunction(
      participants[invocation.callee].artifact, invocation.function, invocation.selector,
    );
    const rowHandler = resolveMessageBusHandler(
      participants[invocation.callee].artifact, invocation.function, abiFunction?.selector,
    );
    perOwner[invocation.callee].push({
      function: invocation.function,
      ...(abiFunction?.selector !== undefined && { selector: abiFunction.selector }),
      args: invocation.args,
      // Graph admission rejects every unbound incoming `{value: ...}` call option. A nested payable row with
      // no compiler-authored transfer therefore has exactly zero logical BCH value. Transfer-bearing rows derive
      // their (possibly conditional) negative delta from the same authenticated recipes used by composition.
      ...(invocation.parent !== null && rowHandler?.usesMsgValue
        && (rowHandler.transfers?.length ?? 0) === 0 && { msgValue: 0n }),
      // Staticcall must ride the SCB2 mode byte: the detached verifier's `batchModeWidth == 0` path requires
      // callManifestMode == 0, so a staticcall edge (manifest mode bit 0 set) against a version-1 batch fails
      // OP_VERIFY at MessageBusVerifier.spend. Keep ordinary call rows mode-free so mixed-selector nested
      // batches still match the parent covenant's version-1 `appendExternalBatchRow` SCB1 blob; only an
      // explicit staticcall flips encodeMessageBatch to version 2.
      ...(invocation.callMode === 'staticcall' ? { callMode: 'staticcall' as const } : {}),
      ...(invocation.parent === null
        ? (invocation.logicalCaller === undefined ? {} : { logicalCaller: invocation.logicalCaller })
        : {
          logicalCaller: hexToBin(graphInvocationCallerIdentity(
            participants, invocations, invocation,
          ).lockingBytecode),
        }),
    });
    globalByOwner[invocation.callee].push(index);
  });

  // X31: the policy checks `deriveCompiledGraphPlan` runs during expansion. They live here too because this is
  // the other public planning entry point and every committed capstone fixture uses it - an option-bearing
  // graph used to settle through it with the option silently dropped. Ordered after the structural walk so a
  // malformed graph still reports its structural defect first.
  const optionBits = invocations.map((invocation, index) => {
    if (invocation.callMode !== undefined
      && invocation.callMode !== 'call' && invocation.callMode !== 'staticcall') {
      throw new Error(
        `messageBus: invocation ${index} declares call mode '${invocation.callMode}', `
        + 'which is not a participant-graph edge',
      );
    }
    const participant = participants[invocation.callee];
    const abiFunction = resolveGraphAbiFunction(participant.artifact, invocation.function, invocation.selector);
    // An absent ABI entry is refused rather than skipped, matching `deriveCompiledGraphPlan`'s `functionAbi`.
    // Skipping it silently disabled the call-option check for the one artifact shape that can hide the
    // evidence: the direct-mode `transferCount`/`blockLayout` an option publishes live on this entry, so a row
    // whose handler exists but whose ABI entry does not had nothing left to compare against.
    if (abiFunction === undefined) {
      throw new Error(
        `messageBus: participant ${invocation.callee} declares no ABI function '${invocation.function}'`,
      );
    }
    assertNoUnboundCallOptions(
      participant.lockingBytecode, participant.artifact, abiFunction, invocation.function,
    );
    // X5: the refusal above precedes this, so an accepted plan always measures zero option bits. Deriving them
    // anyway - from that same measurement - is what makes the committed byte a real field: relax the refusal and
    // the option travels into the callManifest, where the participant verifier rejects it, instead of vanishing.
    return measureUnboundCallOptions(participant.artifact, abiFunction, invocation.function).optionBits;
  });

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
    console.error('atomic-graph-owner-rows', participants.map((participant, owner) => ({
      owner,
      contract: participant.artifact.contractName,
      rows: perOwner[owner].map((row) => ({ function: row.function, args: row.args })),
      witnesses: participant.artifact.messageBus?.handlers.filter((handler) => handler.eligible)
        .map((handler) => ({ name: handler.name, keys: handler.batchKeyWitnesses })),
    })));
  }
  const executions: CompiledParticipantExecution[] = participants.map((participant, owner) => {
    if (perOwner[owner].length === 0) {
      throw new Error(`messageBus: participant ${owner} has no invocation and must not be co-spent`);
    }
    const executionKind = participant.executionKind === 'delegate' ? 1 : 0;
    const direct = participant.authority === 'direct';
    const directInvocationIndex = globalByOwner[owner][0];
    const directInvocation = direct ? invocations[directInvocationIndex] : undefined;
    const directAbi = directInvocation === undefined ? undefined : resolveGraphAbiFunction(
      participant.artifact, directInvocation.function, directInvocation.selector,
    );
    const directVisibleInputs = directAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
    if (direct && (owner === 0 || executionKind !== 0 || globalByOwner[owner].length !== 1
      || !directAbi?.blockLayout || !directAbi.selector
      || (directAbi.outputs?.length ?? 0) !== 0
      || directAbi.usesMsgSender === true
      || directAbi.usesMsgData === true
      || directAbi.inputs.some((input) => input.name === '__internal__msgData')
      || directAbi.inputs.some((input) => input.name === '__internal__msgSenderCategory')
      || directAbi.entryAccesses?.some((access) => access.keySources?.some((source) =>
        source.kind === 'msgSender' && source.senderOp === 'msg.sender'))
      || directAbi.externalCalls?.some((call) => call.addressIsMsgSender === true)
      || directAbi.inputs.filter((input) => input.name === '__internal__callInputIndex').length > 1
      || (directAbi.inputs.some((input) => input.name === '__internal__callInputIndex')
        && directAbi.inputs[directAbi.inputs.length - 1]?.name !== '__internal__callInputIndex')
      || (!directAbi.inputs.some((input) => input.name === '__internal__callInputIndex')
        && directAbi.inputs.some((input) => input.name.startsWith('__internal__')))
      || directVisibleInputs.length !== 1 || !/^uint\d*$/.test(directVisibleInputs[0].type)
      || invocations.some((invocation) => invocation.parent === directInvocationIndex)
      || participant.outputLockingBytecode !== undefined
      || participant.logicalLockingBytecode !== undefined
      || directAbi.blockLayout.slots.some((slot) => !['master', 'dataNft', 'readOnlyDataNft', 'entry'].includes(slot.kind)))) {
      throw new Error(`messageBus: direct participant ${owner} exceeds the V5 opaque-call proof profile`);
    }
    const directArg = direct ? encodeFunctionArgument(
      directInvocation!.args?.[0] as FunctionArgument, directVisibleInputs[0].type,
      participant.artifact.structs ?? participant.artifact.stateLayout?.structs,
    ) : undefined;
    if (direct && !(directArg instanceof Uint8Array)) {
      throw new Error(`messageBus: direct participant ${owner} has no concrete scalar argument`);
    }
    const executorSlots = executionKind === 1
      ? participant.artifact.messageBus?.route.blockLayout?.slots
        .filter((slot) => slot.kind === 'lowLevelCall') ?? []
      : [];
    const logicalIdentityOffset = participant.logicalIdentityOffset ?? 0;
    const participantBlockSize = (direct ? directAbi?.blockLayout
      : participant.artifact.messageBus?.route.blockLayout)?.blockSize ?? 0;
    const selectedLifecycle = globalByOwner[owner].flatMap((invocationIndex) => {
      const invocation = invocations[invocationIndex];
      const abi = resolveGraphAbiFunction(participant.artifact, invocation.function, invocation.selector);
      const handler = resolveMessageBusHandler(
        participant.artifact, invocation.function, abi?.selector,
      );
      return handler?.lifecycleTopology === undefined ? [] : [{ invocation, handler }];
    });
    let lifecycle: AtomicParticipantLifecycle | undefined;
    if (selectedLifecycle.length > 0) {
      if (selectedLifecycle.length !== 1 || globalByOwner[owner].length !== 1) {
        throw new Error(
          `messageBus: lifecycle participant ${owner} must execute exactly one lifecycle invocation`,
        );
      }
      const layoutSlots = participant.artifact.messageBus?.route.blockLayout?.slots ?? [];
      const dataNftSlots = layoutSlots.filter((slot) =>
        slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft');
      const disallowedLifecycleSlots = layoutSlots.some((slot) =>
        slot.kind !== 'master' && slot.kind !== 'dataNft' && slot.kind !== 'readOnlyDataNft');
      if (executionKind !== 0 || participant.outputLockingBytecode !== undefined
        || layoutSlots.length < 1 || layoutSlots[0]?.kind !== 'master'
        || disallowedLifecycleSlots
        || participantBlockSize !== 1 + dataNftSlots.length) {
        throw new Error(
          `messageBus: lifecycle participant ${owner} requires one direct master[+dataNft] balanced block`,
        );
      }
      const selected = selectedLifecycle[0];
      if (participant.artifact.messageBus?.verifierProgram?.lifecycle !== true
        && participant.artifact.messageBus?.verifierProgram?.splitLifecycle !== true) {
        throw new Error(
          `messageBus: lifecycle participant ${owner} verifier does not advertise selector-derived authority`,
        );
      }
      const topology = planKernelLifecycleTopology(
        selected.handler.lifecycleTopology, selected.invocation.args ?? [],
      );
      const prefix = topology.resourcePrefix?.dataNftCount ?? 0;
      if (prefix !== dataNftSlots.length
        || (topology.resourcePrefix !== undefined
          && topology.resourcePrefix.nftIndices.length !== prefix)) {
        throw new Error(
          `messageBus: lifecycle participant ${owner} resourcePrefix does not match its block layout`,
        );
      }
      const fixedSize = 1 + prefix;
      if (topology.kind === 'selfdestruct') {
        if (topology.categoryCensus.inputCount !== 1 || topology.categoryCensus.outputCount !== 0) {
          throw new Error(`messageBus: lifecycle participant ${owner} retirement census is not canonical`);
        }
        if (topology.resourcePrefix !== undefined && topology.resourcePrefix.mode !== 'consume') {
          throw new Error(`messageBus: lifecycle participant ${owner} retirement prefix mode is not consume`);
        }
        lifecycle = Object.freeze({
          version: 1 as const, kind: 'selfdestruct' as const, count: 1,
          inputSpan: fixedSize, outputSpan: fixedSize, balancedSpan: fixedSize,
          inputTail: 'retired-master' as const, outputTail: 'reclaim' as const,
        });
      } else {
        const count = topology.kind === 'split'
          ? topology.categoryCensus.outputCount - 1 : topology.categoryCensus.inputCount - 1;
        if (count < 1 || count >= 32767) {
          throw new Error(`messageBus: lifecycle participant ${owner} count does not fit its balanced span`);
        }
        if (topology.resourcePrefix !== undefined && topology.resourcePrefix.mode !== 'preserve') {
          throw new Error(`messageBus: lifecycle participant ${owner} split/merge prefix mode is not preserve`);
        }
        const split = topology.kind === 'split';
        const balancedSpan = fixedSize + count;
        lifecycle = Object.freeze({
          version: 1 as const, kind: topology.kind, count,
          inputSpan: split ? fixedSize : balancedSpan,
          outputSpan: split ? balancedSpan : fixedSize,
          balancedSpan,
          inputTail: split ? 'funding' as const : 'consumed-masters' as const,
          outputTail: split ? 'created-masters' as const : 'reclaim' as const,
        });
      }
    }
    if (!Number.isInteger(logicalIdentityOffset)
      || logicalIdentityOffset < 0 || logicalIdentityOffset >= participantBlockSize) {
      throw new Error(`messageBus: participant ${owner} logical identity offset is outside its balanced block`);
    }
    if (participant.logicalLockingBytecode === undefined && logicalIdentityOffset !== 0) {
      throw new Error(`messageBus: participant ${owner} cannot offset an undeclared logical identity`);
    }
    if (executionKind === 1) {
      if (!/^([0-9a-fA-F]{2})+$/.test(participant.executorLockingBytecode ?? '')) {
        throw new Error(`messageBus: delegate participant ${owner} lacks canonical executor locking bytecode`);
      }
      if (executorSlots.length !== 1 || executorSlots[0].offset === 0) {
        throw new Error(`messageBus: delegate participant ${owner} requires exactly one executor slot`);
      }
    } else if (participant.executorLockingBytecode !== undefined) {
      throw new Error(`messageBus: owner participant ${owner} cannot declare a delegate executor`);
    }
    return Object.freeze({
      participant: owner,
      ...(direct && { authority: 'direct' as const }),
      artifact: participant.artifact,
      lockingBytecode: participant.lockingBytecode.toLowerCase(),
      ...(participant.outputLockingBytecode !== undefined && {
        outputLockingBytecode: participant.outputLockingBytecode.toLowerCase(),
      }),
      ...(participant.logicalLockingBytecode !== undefined && {
        logicalLockingBytecode: participant.logicalLockingBytecode.toLowerCase(),
      }),
      logicalIdentityOffset,
      executionKind,
      executorOffset: executionKind === 1 ? executorSlots[0].offset : null,
      executorInputIndex: executionKind === 1
        ? participants.slice(0, owner).reduce(
          (base, candidate, index) => base + (candidate.authority === 'direct'
            ? resolveGraphAbiFunction(candidate.artifact,
              invocations[globalByOwner[index][0]].function,
              invocations[globalByOwner[index][0]].selector)?.blockLayout?.blockSize ?? 0
            : candidate.artifact.messageBus!.route.blockLayout!.blockSize),
          0,
        ) + executorSlots[0].offset
        : 0xffff,
      executorLockingBytecode: executionKind === 1
        ? participant.executorLockingBytecode!.toLowerCase() : '',
      // Atomic composition re-derives and authenticates the terminal continuation value across every selected
      // writer row. Standalone batches retain the artifact's one-row fixed-chunkable guard.
      ...(direct ? { directRow: {
        function: directInvocation!.function,
        selectorHex: directAbi!.selector!,
        argsHex: binToHex(encodeMessageBusArguments(
          [directArg as Uint8Array], [directVisibleInputs[0].type],
          participant.artifact.structs ?? participant.artifact.stateLayout?.structs,
        )),
      } } : { batch: encodeMessageBatch(
        participant.artifact, perOwner[owner], participant.unboundRouteWitnesses,
        { atomicContinuationConvergence: true },
      ) }),
      invocations: Object.freeze(globalByOwner[owner]),
      blockLayout: direct ? directAbi!.blockLayout! : participant.artifact.messageBus!.route.blockLayout!,
      routeInputs: direct ? [] : participant.artifact.messageBus!.route.inputs,
      settlementBoundary: Math.max(...globalByOwner[owner].map((index) => subtreeEnds[index] + 1)),
      completionPositions: Object.freeze(globalByOwner[owner].map((index) => subtreeEnds[index] + 1)),
      ...(lifecycle && { lifecycle }),
    });
  });

  const localCursor = participants.map(() => 0);
  const depths = invocations.map(() => 0);
  for (let index = 1; index < invocations.length; index += 1) {
    depths[index] = depths[invocations[index].parent!] + 1;
    if (depths[index] > 7) throw new Error('messageBus: compiled graph exceeds maximum depth 7');
  }
  const plannedBase = invocations.map((invocation, index) => {
    const execution = executions[invocation.callee];
    const localRow = localCursor[invocation.callee];
    localCursor[invocation.callee] += 1;
    const row = execution.directRow ?? execution.batch!.rows[localRow];
    const result = execution.batch?.results.find((candidate) => candidate.row === localRow);
    const caller = invocation.parent === null ? null : invocations[invocation.parent].callee;
    const targetIdentity = invocationTargetIdentity(invocation, index);
    let callMode: 'call' | 'staticcall' = invocation.callMode ?? 'call';
    if (invocation.parent === null) {
      // X5: the transaction-origin row answers no callsite, so there is no published mode for a caller-supplied
      // one to agree with, and the committed byte the covenant now bounds must be exactly 0. Coercing it to
      // `call` instead would silently discard what the caller asked for - the shape this row is about.
      if (invocation.callMode !== undefined && invocation.callMode !== 'call') {
        throw new Error(
          `messageBus: root invocation ${index} declares call mode '${invocation.callMode}', but the transaction `
          + 'origin answers no callsite and carries no call options',
        );
      }
    } else {
      const parentInvocation = invocations[invocation.parent];
      const parentArtifact = participants[parentInvocation.callee].artifact;
      const parentFunction = resolveGraphAbiFunction(
        parentArtifact, parentInvocation.function, parentInvocation.selector,
      );
      const candidates = parentFunction?.externalCalls?.filter((call) =>
        invocation.consumerCallsiteId !== undefined
          ? call.callsiteId === invocation.consumerCallsiteId
          : call.functionName === invocation.function) ?? [];
      const modes = [...new Set(candidates.map((call) => call.callMode ?? 'call'))];
      // The compiler-authored mode is read whether or not the caller supplied one. Reading it only on the
      // INFERENCE path meant an explicit `callMode: 'call'` executed a delegate edge as an ordinary call,
      // unseen by either check - exactly the coercion `edgeCallMode` refuses on the other entry point, where
      // no supplied mode exists to shadow it.
      if (modes.includes('delegatecall')) {
        throw new Error('messageBus: delegatecall is not a participant-graph call mode');
      }
      if (invocation.callMode === undefined) {
        if (modes.length > 1) {
          throw new Error(`messageBus: call mode for invocation ${index} is ambiguous`);
        }
        callMode = modes[0] === 'staticcall' ? 'staticcall' : 'call';
      }
      // X5: the remaining half of the round-15 divergence. Refusing only `delegatecall` left the two ordinary
      // modes free to disagree: a caller-supplied `call` on a callsite the compiler published as `staticcall`
      // was committed as `call`, which also skipped the read-only proof above. The compiled caller route
      // rebuilds this byte from its own slot and rejects the mismatch, so the transaction never settled - but it
      // failed as an unnamed script error at the caller's input rather than as a planning refusal.
      //
      // A name-matched candidate set is the only place a published mode exists to compare against. When it is
      // empty the callsite resolves its method at runtime - a raw `__raw__` edge, a function pointer, a selector
      // table - and its `functionName` is a placeholder, so there is nothing to disagree with here; that shape
      // stays bound by the caller's own emission-row equality on the VM.
      if (invocation.callMode !== undefined && candidates.length > 0
        && !modes.includes(invocation.callMode)) {
        throw new Error(
          `messageBus: invocation ${index} declares call mode '${invocation.callMode}', but its compiler-authored `
          + `callsite declares '${modes.join("'/'")}'`,
        );
      }
    }
    const callerIdentity = invocation.parent === null
      ? undefined
      : graphInvocationCallerIdentity(participants, invocations, invocation);
    return Object.freeze({
      index,
      parent: invocation.parent,
      caller,
      callee: invocation.callee,
      subtreeEnd: subtreeEnds[index],
      localRow,
      depth: depths[index],
      function: row.function,
      args: invocation.args,
      selectorHex: row.selectorHex,
      callMode,
      callOptions: (callMode === 'staticcall' ? CALL_OPTION_READ_ONLY : 0) | optionBits[index],
      argsHex: row.argsHex,
      resultTypes: Object.freeze([...(result?.types ?? [])]),
      ...(result && { resultEncoding: result.resultEncoding }),
      targetLockingBytecode: targetIdentity.lockingBytecode,
      targetIdentityOffset: targetIdentity.offset,
      ...(callerIdentity !== undefined && { callerIdentity }),
    });
  });
  // Compiler-side diagnostic for §6.3's transitive rule. This is deliberately duplicated by the root
  // participant verifier's `staticFrames` walk: artifacts and plans are builder input, so this early refusal improves
  // attribution but is not the security boundary.
  for (const invocation of plannedBase) {
    if (invocation.callMode !== 'staticcall') continue;
    for (let descendant = invocation.index + 1; descendant <= invocation.subtreeEnd; descendant += 1) {
      if (plannedBase[descendant].callMode !== 'staticcall') {
        throw new Error(
          `messageBus: staticcall invocation ${invocation.index} has non-static descendant ${descendant}`,
        );
      }
    }
  }
  // X111: ordered after `plannedBase` because the rule reads each owner's local row ORDER, and before the
  // result-dependency walk so a stale-read composition names its own cause rather than whatever schema or
  // callsite mismatch it happens to also carry.
  assertNoStaleEmissionCloneReads(
    participants,
    globalByOwner.map((owned) => owned.map((index) => ({
      localRow: plannedBase[index].localRow, function: plannedBase[index].function,
    }))),
  );
  const childrenOf: number[][] = invocations.map(() => []);
  for (let child = 1; child < invocations.length; child += 1) {
    childrenOf[invocations[child].parent!].push(child);
  }
  const consumerCallsites: (number | undefined)[] = invocations.map(() => undefined);
  const boundValueBits = invocations.map(() => 0);
  const sourceOccurrences: ({
    sourceCallsiteId: number;
    sourceLogicalIndex?: number;
    occurrenceIndex: number;
    sourceEffectOrdinal?: number;
    sourceCallsiteProvenance: 'compiler' | 'legacy-logical';
  } | undefined)[] = invocations.map(() => undefined);
  const resultDependencies: number[][] = invocations.map(() => []);
  for (let parent = 0; parent < invocations.length; parent += 1) {
    const children = childrenOf[parent];
    const parentInvocation = invocations[parent];
    const parentArtifact = participants[parentInvocation.callee].artifact;
    const parentFunction = resolveGraphAbiFunction(
      parentArtifact, parentInvocation.function, parentInvocation.selector,
    );
    // X179: the floor, ordered before the ceiling and before the `children.length === 0` skip, because a
    // handler planned with NO children is exactly the shape it refuses - the skip is what let a dropped edge
    // through. The ABI lookup above already ran once per invocation in `optionBits`, so a handler with no ABI
    // entry has already been refused by name and this cannot be the first place it is noticed.
    assertHandlerRowFloor(parentFunction?.externalCalls ?? [], children.length);
    if (children.length === 0) continue;
    // X36: the occurrence bound `deriveCompiledGraphPlan` applies during expansion, applied here to the rows
    // this entry point is handed instead. Ordered before the binding so a row count the handler cannot have
    // emitted is named as such rather than surfacing as a result-schema or covenant partition mismatch.
    assertHandlerRowCapacity(
      parentFunction?.externalCalls ?? [], children.length, options.allowRuntimeBoundedLoops === true,
    );
    const publishedCallsites = parentFunction?.externalCalls ?? [];
    const identified = children.map((child) => invocations[child].consumerCallsiteId);
    const hasIdentified = identified.some((callsiteId) => callsiteId !== undefined);
    if (hasIdentified && identified.some((callsiteId) => callsiteId === undefined)) {
      throw new Error(`messageBus: invocation ${parent} mixes identified and unidentified child callsites`);
    }
    const bindings = hasIdentified
      ? identified.map((callsiteId, position) => {
        const callsite = publishedCallsites.find((candidate) => candidate.callsiteId === callsiteId);
        if (!callsite) {
          throw new Error(
            `messageBus: invocation ${parent} names absent compiler callsite ${callsiteId}`,
          );
        }
        const reachedFunction = invocations[children[position]].function;
        const expectedFunction = callsite.rawFunctionName ?? callsite.functionName;
        if (callsite.batchInvocations === undefined
          && !isRuntimeResolvedCallsite(callsite) && expectedFunction !== reachedFunction) {
          throw new Error(
            `messageBus: invocation ${parent} binds callsite ${callsiteId} to '${reachedFunction}', `
            + `but the compiler publishes '${expectedFunction}'`,
          );
        }
        return callsite;
      })
      : bindConsumerCallsites(
        parent,
        publishedCallsites,
        children.map((child) => ({
          functionName: invocations[child]!.function,
          sourceCallsiteId: invocations[child]!.sourceCallsiteId
            ?? invocations[child]!.consumerCallsiteId,
          selectorHex: invocations[child]!.selector,
        })),
        {
          // sourceCallsite attribution: kernel routes refuse same-name first-match collapse.
          requireUniqueAttribution: parentArtifact.messageBus?.convention === 'kernel-row-loop',
        },
      );
    if (hasIdentified) {
      for (const callsite of publishedCallsites) {
        const count = bindings.filter((binding) => binding?.callsiteId === callsite.callsiteId).length;
        if (callsite.batchInvocations !== undefined) {
          assertBatchedCallsiteRowCount(callsite, count);
          continue;
        }
        assertPlannedOccurrenceCount(callsite, count, options.allowRuntimeBoundedLoops === true);
      }
    }
    const seenSourceOccurrences = new Set<string>();
    const inferredOccurrence = new Map<string, number>();
    children.forEach((child, position) => {
      const callsite = bindings[position];
      let callValueEffect = callsite?.callValueEffect;
      consumerCallsites[child] = callsite?.callsiteId;
      if (callsite?.callsiteId !== undefined) {
        const invocation = invocations[child];
        let sourceCallsiteId = invocation.sourceCallsiteId;
        let sourceLogicalIndex = invocation.sourceLogicalIndex;
        let occurrenceIndex = invocation.occurrenceIndex;
        let sourceEffectOrdinal: number | undefined;
        let sourceCallsiteProvenance: 'compiler' | 'legacy-logical' = 'compiler';
        if (callsite.batchInvocations !== undefined) {
          if (sourceLogicalIndex === undefined) {
            throw new Error(
              `messageBus: invocation ${child} omits source identity for batched callsite ${callsite.callsiteId}`,
            );
          }
          if (!Number.isSafeInteger(sourceLogicalIndex) || sourceLogicalIndex < 0) {
            throw new Error(`messageBus: invocation ${child} has an invalid batched source identity`);
          }
          const row = callsite.batchInvocations.find((candidate) => candidate.logicalIndex === sourceLogicalIndex);
          if (!row) {
            throw new Error(
              `messageBus: invocation ${child} names absent source row `
              + `${sourceCallsiteId}:${sourceLogicalIndex} at batched callsite ${callsite.callsiteId}`,
            );
          }
          if (row.sourceCallsiteId === undefined) {
            // Kernel artifacts must publish source identity on every batch row; legacy aliasing is opt-in only.
            if (parentArtifact.messageBus?.convention === 'kernel-row-loop') {
              throw new Error(
                `messageBus: kernel batched callsite ${callsite.callsiteId} omits sourceCallsiteId `
                + `on row ${sourceLogicalIndex}`,
              );
            }
            sourceCallsiteProvenance = 'legacy-logical';
            if (sourceCallsiteId !== undefined && sourceCallsiteId !== callsite.callsiteId) {
              throw new Error(
                `messageBus: invocation ${child} assigns an unauthenticated source callsite to a legacy batch row`,
              );
            }
            sourceCallsiteId = callsite.callsiteId;
          } else {
            if (sourceCallsiteId === undefined) {
              throw new Error(
                `messageBus: invocation ${child} omits compiler source callsite for batched callsite `
                + `${callsite.callsiteId}`,
              );
            }
            if (sourceCallsiteId !== row.sourceCallsiteId) {
              throw new Error(
                `messageBus: invocation ${child} source callsite ${sourceCallsiteId} disagrees with `
                + `compiler row ${row.sourceCallsiteId}`,
              );
            }
          }
          sourceEffectOrdinal = row.sourceEffectOrdinal;
          callValueEffect = row.callValueEffect;
          if (!Number.isSafeInteger(sourceCallsiteId) || sourceCallsiteId < 0) {
            throw new Error(`messageBus: invocation ${child} has an invalid batched source callsite`);
          }
          if (row.selector.toLowerCase() !== plannedBase[child].selectorHex.toLowerCase()) {
            throw new Error(
              `messageBus: invocation ${child} source row selector disagrees with its planned target`,
            );
          }
          const targetFunction = resolveGraphAbiFunction(
            participants[invocations[child].callee].artifact,
            invocations[child].function,
            invocations[child].selector,
          );
          const visibleTargetInputs = targetFunction?.inputs.filter((input) =>
            !input.name.startsWith('__internal__'));
          if (!visibleTargetInputs || row.inputs.length !== visibleTargetInputs.length
            || row.inputs.some((input, inputIndex) => input.type !== visibleTargetInputs[inputIndex].type)) {
            throw new Error(
              `messageBus: invocation ${child} source row schema disagrees with its planned target`,
            );
          }
          if ((row.occurrence ?? 'once') !== 'loop' && occurrenceIndex !== undefined && occurrenceIndex !== 0) {
            throw new Error(
              `messageBus: invocation ${child} assigns occurrence ${occurrenceIndex} to a `
              + `${row.occurrence ?? 'once'} source row`,
            );
          }
        } else {
          if (sourceCallsiteId !== undefined && sourceCallsiteId !== callsite.callsiteId) {
            throw new Error(
              `messageBus: invocation ${child} source callsite ${sourceCallsiteId} disagrees with `
              + `physical callsite ${callsite.callsiteId}`,
            );
          }
          if (sourceLogicalIndex !== undefined) {
            throw new Error(
              `messageBus: invocation ${child} assigns a batch logical index to non-batched callsite `
              + `${callsite.callsiteId}`,
            );
          }
          sourceCallsiteId = callsite.callsiteId;
          sourceEffectOrdinal = callsite.sourceEffectOrdinal;
          if ((callsite.occurrence ?? 'once') !== 'loop'
            && occurrenceIndex !== undefined && occurrenceIndex !== 0) {
            throw new Error(
              `messageBus: invocation ${child} assigns occurrence ${occurrenceIndex} to a `
              + `${callsite.occurrence ?? 'once'} callsite`,
            );
          }
        }
        if (sourceEffectOrdinal !== undefined
          && (!Number.isSafeInteger(sourceEffectOrdinal) || sourceEffectOrdinal < 0)) {
          throw new Error(`messageBus: invocation ${child} has an invalid compiler source-effect ordinal`);
        }
        if (invocation.sourceEffectOrdinal !== undefined
          && invocation.sourceEffectOrdinal !== sourceEffectOrdinal) {
          throw new Error(
            `messageBus: invocation ${child} source-effect ordinal disagrees with its compiler callsite`,
          );
        }
        const sourceKey = `${sourceCallsiteId}:${sourceLogicalIndex ?? -1}`;
        const expectedOccurrence = inferredOccurrence.get(sourceKey) ?? 0;
        if (occurrenceIndex === undefined) {
          occurrenceIndex = expectedOccurrence;
        }
        if (!Number.isSafeInteger(occurrenceIndex) || occurrenceIndex < 0) {
          throw new Error(`messageBus: invocation ${child} has an invalid source occurrence index`);
        }
        if (occurrenceIndex !== expectedOccurrence) {
          throw new Error(
            `messageBus: invocation ${child} source occurrence ${sourceKey}:${occurrenceIndex} is not `
            + `the canonical next occurrence ${expectedOccurrence}`,
          );
        }
        inferredOccurrence.set(sourceKey, expectedOccurrence + 1);
        const identity = `${sourceKey}:${occurrenceIndex}`;
        if (seenSourceOccurrences.has(identity)) {
          throw new Error(
            `messageBus: invocation ${parent} repeats source occurrence ${identity} at physical callsite `
            + `${callsite.callsiteId}`,
          );
        }
        seenSourceOccurrences.add(identity);
        sourceOccurrences[child] = {
          sourceCallsiteId,
          ...(sourceLogicalIndex !== undefined && { sourceLogicalIndex }),
          occurrenceIndex,
          ...(sourceEffectOrdinal !== undefined && { sourceEffectOrdinal }),
          sourceCallsiteProvenance,
        };
      }
      // Value authority belongs to the validated source edge, not every child of a handler that can pay.
      // Grouped rows must use their own marker; the physical representative may describe a different call.
      if (callValueEffect === undefined) {
        const parentHandler = resolveMessageBusHandler(
          parentArtifact, parentInvocation.function, parentFunction?.selector,
        );
        const valueTransfers = parentHandler?.transfers?.filter((transfer) => transfer.callOption === 'value') ?? [];
        if (valueTransfers.length > 0) {
          // Preserve only the old, unambiguous single unconditional raw edge outside the kernel convention.
          if (parentArtifact.messageBus?.convention !== 'kernel-row-loop'
            && publishedCallsites.length === 1 && children.length === 1 && !callsite?.batchInvocations
            && callsite?.interfaceName === '__raw__' && callsite.functionName === '__raw__'
            && (callsite.occurrence ?? 'once') === 'once' && !callsite.condition
            && valueTransfers.length === 1 && !valueTransfers[0].condition) {
            callValueEffect = true;
          } else {
            throw new Error(`messageBus: invocation ${child} omits framedsite value metadata; recompile its caller`);
          }
        }
      } else if (typeof callValueEffect !== 'boolean') {
        throw new Error(`messageBus: invocation ${child} has invalid framedsite value metadata`);
      }
      if (callValueEffect) boundValueBits[child] = CALL_OPTION_VALUE;
      if (!callsite?.hasReturnValues) return;
      const produced = plannedBase[child].resultTypes;
      // A low-level call returns `(success, bytes)` even when the invoked method is void: the authenticated
      // result bytes are empty. This is the optional-return convention used by SafeERC20-style callers.
      // Typed calls still require the producer schema promised by the compiler.
      if (produced.length === 0 && !callsite.opaqueReturn) {
        throw new Error(
          `messageBus: invocation ${parent} consumes a result from void invocation ${child}`,
        );
      }
      // Producer/consumer ABI equality. A runtime-resolved callsite has no compile-time method, and an
      // opaque low-level return is intentionally untyped, so neither publishes a schema to compare.
      const expected = callsite.returnTypes;
      if (!callsite.opaqueReturn && !isRuntimeResolvedCallsite(callsite) && expected !== undefined
        && expected.join(',') !== produced.join(',')) {
        throw new Error(
          `messageBus: invocation ${parent} expects result schema (${expected.join(',')}) from invocation `
          + `${child}, which produces (${produced.join(',')})`,
        );
      }
      if (!callsite.opaqueReturn && !isRuntimeResolvedCallsite(callsite) && expected !== undefined) {
        const expectedEncoding = resolveExternalResultEncoding(
          callsite.resultEncoding, parentArtifact, expected,
          `message-bus callsite ${callsite.callsiteId ?? '?'} in '${parentFunction?.name ?? '?'}'`,
        );
        if (plannedBase[child].resultEncoding !== expectedEncoding) {
          throw new Error(
            `messageBus: invocation ${parent} expects result encoding '${expectedEncoding}' from invocation `
            + `${child}, which produces '${plannedBase[child].resultEncoding ?? 'none'}'`,
          );
        }
      }
      resultDependencies[parent].push(child);
    });
    for (const callsite of publishedCallsites) {
      if (callsite.callsiteId === undefined || callsite.batchInvocations === undefined) continue;
      const rows = callsite.batchInvocations;
      const publishedSourceCount = rows.filter((row) => row.sourceCallsiteId !== undefined).length;
      const publishedEffectCount = rows.filter((row) => row.sourceEffectOrdinal !== undefined).length;
      if (publishedSourceCount !== 0 && publishedSourceCount !== rows.length) {
        throw new Error(`messageBus: batched callsite ${callsite.callsiteId} mixes legacy and source-aware rows`);
      }
      if (publishedEffectCount !== 0 && publishedEffectCount !== rows.length) {
        throw new Error(`messageBus: batched callsite ${callsite.callsiteId} mixes source-effect provenance`);
      }
      if (rows.some((row, logicalIndex) => row.logicalIndex !== logicalIndex
        || (row.sourceCallsiteId !== undefined
          && (!Number.isSafeInteger(row.sourceCallsiteId) || row.sourceCallsiteId < 0)))) {
        throw new Error(`messageBus: batched callsite ${callsite.callsiteId} has non-canonical logical indices`);
      }
      const sourceIds = new Set(rows.flatMap((row) => row.sourceCallsiteId === undefined
        ? [] : [row.sourceCallsiteId]));
      if (publishedSourceCount > 0 && sourceIds.size !== rows.length) {
        throw new Error(`messageBus: batched callsite ${callsite.callsiteId} has duplicate source callsites`);
      }
      const effectOrdinals = new Set(rows.flatMap((row) => row.sourceEffectOrdinal === undefined
        ? [] : [row.sourceEffectOrdinal]));
      if (publishedEffectCount > 0 && effectOrdinals.size !== rows.length) {
        throw new Error(`messageBus: batched callsite ${callsite.callsiteId} repeats a source-effect identity`);
      }
      for (const row of rows) {
        const count = children.filter((child) => {
          const source = sourceOccurrences[child];
          return consumerCallsites[child] === callsite.callsiteId
            && source?.sourceCallsiteId === (row.sourceCallsiteId ?? callsite.callsiteId)
            && source?.sourceLogicalIndex === row.logicalIndex;
        }).length;
        const kind = row.occurrence ?? 'once';
        if (kind === 'once' && count !== 1) {
          throw new Error(
            `messageBus: batched callsite ${callsite.callsiteId} source row ${row.logicalIndex} `
            + `must be represented exactly once, but ${count} occurrences were planned`,
          );
        }
        if (kind === 'conditional' && count > 1) {
          throw new Error(
            `messageBus: batched callsite ${callsite.callsiteId} conditional source row ${row.logicalIndex} `
            + `was represented ${count} times`,
          );
        }
      }
    }
    // Fixed-row graph handlers authenticate and consume each child result in
    // source order. Runtime raw loops do the same with their bounded
    // occurrence cursor. Both forms therefore admit any acyclic dependency
    // list within the existing graph/row maxima.
  }
  assertResolvableResultDependencies(invocations.length, resultDependencies);
  const unavailableProducerPath: ValueChunkProducerPathDisposition = Object.freeze({ status: 'unavailable' });
  const producerPaths: ValueChunkProducerPathDisposition[] = invocations.map(() => unavailableProducerPath);
  const rootProducerContext: ValueChunkProducerPathContext = Object.freeze({
    version: 1, sourcePath: Object.freeze([]),
  });
  producerPaths[0] = Object.freeze({ status: 'complete', context: rootProducerContext });
  for (let index = 1; index < invocations.length; index += 1) {
    const invocation = invocations[index];
    const source = sourceOccurrences[index];
    const parentDisposition = producerPaths[invocation.parent!];
    if (!source || source.sourceCallsiteProvenance !== 'compiler'
      || source.sourceEffectOrdinal === undefined || parentDisposition.status !== 'complete') continue;
    const parentExecution = executions[invocations[invocation.parent!].callee];
    producerPaths[index] = deriveValueChunkProducerChildPath({
      parent: parentDisposition,
      parentExecutionLockingBytecode: parentExecution.executionKind === 1
        ? parentExecution.executorLockingBytecode : parentExecution.lockingBytecode,
      parentSelector: plannedBase[invocation.parent!].selectorHex,
      sourceCallsiteId: source.sourceCallsiteId,
      ...(source.sourceLogicalIndex !== undefined && { sourceLogicalIndex: source.sourceLogicalIndex }),
      occurrenceIndex: source.occurrenceIndex,
      sourceEffectOrdinal: source.sourceEffectOrdinal,
    });
  }
  const planned = plannedBase.map((invocation, index) => Object.freeze({
    ...invocation,
    callOptions: invocation.callOptions | boundValueBits[index],
    ...(consumerCallsites[index] !== undefined && { consumerCallsiteId: consumerCallsites[index] }),
    ...(sourceOccurrences[index] !== undefined && sourceOccurrences[index]),
    producerPath: producerPaths[index],
    resultDependencies: Object.freeze(resultDependencies[index]),
  }));
  // R5: omitted provenance must not be confused with legacy-logical. Every edge that publishes
  // a sourceCallsiteId must stamp provenance; kernel parent owners refuse legacy-logical.
  assertExplicitSourceCallsiteProvenance(planned, invocations, executions);
  const rootLogicalCaller = invocations[0].logicalCaller;
  if (rootLogicalCaller !== undefined && !(rootLogicalCaller instanceof Uint8Array)) {
    throw new Error('messageBus: root logical caller must be locking bytecode bytes');
  }

  return Object.freeze({
    participants: Object.freeze(executions),
    invocations: Object.freeze(planned),
    ...(rootLogicalCaller === undefined
      ? {} : { rootCallerLockingBytecode: binToHex(rootLogicalCaller) }),
  });
}

/**
 * R5: fail closed when source identity is published without provenance, or when a kernel
 * parent owner still carries legacy-logical provenance (omitted empty ≠ legacy).
 */
export function assertExplicitSourceCallsiteProvenance(
  planned: readonly {
    sourceCallsiteId?: number;
    sourceCallsiteProvenance?: 'compiler' | 'legacy-logical';
  }[],
  rawInvocations: readonly { parent: number | null; callee: number }[],
  participants: readonly { artifact?: Artifact }[],
): void {
  const kernelParticipants = new Set<number>();
  participants.forEach((participant, index) => {
    if (participant.artifact?.messageBus?.convention === 'kernel-row-loop') {
      kernelParticipants.add(index);
    }
  });
  for (let index = 0; index < planned.length; index += 1) {
    const invocation = planned[index]!;
    if (invocation.sourceCallsiteId === undefined) continue;
    if (invocation.sourceCallsiteProvenance === undefined) {
      throw new Error(
        `messageBus: invocation ${index} publishes sourceCallsiteId ${invocation.sourceCallsiteId} `
        + 'without sourceCallsiteProvenance (omitted empty is not legacy-logical)',
      );
    }
    if (invocation.sourceCallsiteProvenance !== 'legacy-logical') continue;
    const parent = rawInvocations[index]?.parent;
    if (parent === null || parent === undefined) continue;
    const parentCallee = rawInvocations[parent]?.callee;
    if (parentCallee !== undefined && kernelParticipants.has(parentCallee)) {
      throw new Error(
        `messageBus: invocation ${index} carries legacy-logical provenance under kernel-row-loop`,
      );
    }
  }
}
import {
  binToHex, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
