import { MAX_MESSAGE_BUS_BLOB_BYTES, occurrenceBoundOf, occurrenceCountViolation } from '@solidcash/utils';
import type {
  AbiFunction, Artifact, ExternalCallAbi, InvocationAnalysisFunction,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  encodeMessageBatch, type EncodedMessageBatch, type MessageBatchCall,
} from './message-bus.js';
import { MessageBusDiagnosticError } from './diagnostics.js';
import {
  encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope, atomicMessageBusPhysicalLayout,
  type AtomicMessageBusCallManifest, type AtomicPhysicalLayout,
} from './atomic.js';

export interface CompiledGraphParticipant {
  artifact: Artifact;
  lockingBytecode: string;
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
   * The logical caller owner is derived as `invocations[parent].callee`; it is never witness-authored.
   */
  parent: number | null;
  callee: number;
  function: string;
  args?: readonly FunctionArgument[];
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
  /**
   * Compiler callsite identifier of the parent occurrence this invocation answers. Absent for the root and
   * for parents whose artifact publishes no matching callsite.
   */
  consumerCallsiteId?: number;
  /** Child invocation results which must exist before this invocation can resume. */
  resultDependencies: readonly number[];
}

export interface CompiledParticipantExecution {
  participant: number;
  /** Exact artifact whose route and state layout this physical owner executes. */
  artifact: Artifact;
  lockingBytecode: string;
  executionKind: 0 | 1;
  /** Local balanced-block offset of the distinct delegate executor input. */
  executorOffset: number | null;
  executorInputIndex: number;
  executorLockingBytecode: string;
  batch: EncodedMessageBatch;
  /** Global invocation indices, in the exact order executed by this owner's message-bus batch route. */
  invocations: readonly number[];
  /** Exact compiler-emitted balanced physical block for this owner's message-bus batch route. */
  blockLayout: NonNullable<Artifact['messageBus']>['route']['blockLayout'];
  /** Exact compiler-owned route ABI, retained so argument derivation cannot silently lose internal witnesses. */
  routeInputs: NonNullable<Artifact['messageBus']>['route']['inputs'];
  /** Exclusive logical position after every invocation owned by this participant has completed. */
  settlementBoundary: number;
  /** Exclusive completion position for each local row, in message-bus batch execution order. */
  completionPositions: readonly number[];
}

export interface CompiledGraphPlan {
  participants: readonly CompiledParticipantExecution[];
  invocations: readonly PlannedGraphInvocation[];
  /** Root `msg.sender`, carried from planning into finalization so collection-key and caller frames agree. */
  rootCallerLockingBytecode?: string;
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
  active: boolean;
  lockingBytecodeHex: string;
  commitmentHex: string;
}

export interface AtomicResourceSlotEffect {
  participant: number;
  offset: number;
  /** 0 transition/preserve, 1 create, 2 delete. */
  mode: number;
  lockingBytecodeHex: string;
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

const uint8Hex = (value: number): string => value.toString(16).padStart(2, '0');

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
    transfers: (handler.transfers ?? []).map((transfer) => [transfer.transferIndex, transfer.callOption ?? '']),
    tokenOperations: (handler.tokenContainerAccesses ?? []).map((access) =>
      [access.keyParam, ...access.operations, access.transferCount ?? 0, access.transferNftCount ?? 0]),
  }));
  return binToHex(sha256.hash(utf8ToBin(JSON.stringify(policy))));
}

/** Freeze the currently admitted invocation, state-resource, and event families into the atomic wire. */
export function finalizeAtomicInvocationGraph(
  plan: CompiledGraphPlan, stateCategories: readonly string[],
  results: Readonly<Record<number, string>> = {},
  eventEffects: readonly AtomicEventSlotEffect[] = [],
  resourceEffects: readonly AtomicResourceSlotEffect[] = [],
  valueEffects: readonly AtomicValueSlotEffect[] = [],
  tokenEffects: readonly AtomicTokenSlotEffect[] = [],
  sidecarEffects: readonly AtomicSidecarSlotEffect[] = [],
  actualSizes?: readonly number[],
): FinalizedAtomicInvocationGraph {
  if (stateCategories.length !== plan.participants.length) {
    throw new Error('messageBus: atomic master categories must align with participants');
  }
  if (actualSizes !== undefined && actualSizes.length !== plan.participants.length) {
    throw new Error('messageBus: actual participant sizes must align with participants');
  }
  const spans = plan.participants.map((participant, index) => {
    const block = participant.blockLayout!;
    const fixedSize = block.trailingBase ?? block.blockSize;
    const actualSize = actualSizes?.[index] ?? block.blockSize;
    if (!Number.isSafeInteger(actualSize) || actualSize < fixedSize || actualSize > block.blockSize) {
      throw new Error(
        `messageBus: participant ${index} actual span ${actualSize} is outside [${fixedSize}, ${block.blockSize}]`,
      );
    }
    return actualSize;
  });
  const layout = atomicMessageBusPhysicalLayout(spans);
  const unsupported = plan.participants.find((participant) => {
    const slots = participant.blockLayout!.slots;
    return slots.some((slot) => ![
      'master', 'dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer',
      'transfer', 'tcTransfer', 'event', 'returnEvent', 'blockhashOracle', 'keccakSideCar',
      'ecrecoverSideCar', 'trailing',
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
    const maximumSize = participant.blockLayout!.blockSize;
    const fixedSize = participant.blockLayout!.trailingBase ?? maximumSize;
    const actualSize = spans[index];
    const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
    const lockingBytecode = participant.lockingBytecode.toLowerCase();
    const internalCategory = (category.match(/../g) as string[]).reverse().join('');
    return {
      lockingBytecode, stateCategory: internalCategory,
      fixedSize, actualSize, maximumSize,
      trailingUsed: actualSize - fixedSize,
      returnOffset: returnSlot === undefined ? 0xffff : returnSlot.offset,
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
    const subjectHex = invocation.caller === null
      ? plan.rootCallerLockingBytecode ?? ''
      : plan.participants[invocation.caller].lockingBytecode;
    const completion = plan.participants[invocation.callee].completionPositions[invocation.localRow];
    if (completion === undefined) {
      throw new Error(`messageBus: invocation ${invocation.index} has no compiler-authored completion position`);
    }
    return {
      kind: 0, owner: caller === 0xff ? invocation.callee : caller, consumer: invocation.callee,
      slot: invocation.consumerCallsiteId ?? 0xffff, mode: callOptionsByte(invocation),
      sourceOffset: invocation.caller === null ? 0xffff : 0,
      targetOffset: 0, selectorHex: invocation.selectorHex,
      position: completion, parent: invocation.parent ?? 0xffff, depth: invocation.depth,
      subtreeEnd: invocation.subtreeEnd, subjectHex, argsHex: invocation.argsHex, resultHex: result.toLowerCase(),
      effectHex: '',
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
        ['dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer', 'trailing']
          .includes(candidate.kind)
        && candidate.offset === effect.offset);
      if (!slot) {
        throw new Error(`messageBus: participant ${effect.participant} has no resource slot ${effect.offset}`);
      }
      const satoshiContainer = slot.kind === 'satoshiContainer';
      const tokenContainer = slot.kind === 'tokenContainer';
      if (effect.mode < 0 || effect.mode > 4
        || (satoshiContainer ? effect.mode !== 3 : effect.mode === 3)
        || (tokenContainer ? effect.mode !== 4 : effect.mode === 4)
        || (!satoshiContainer && !tokenContainer && slot.kind !== 'trailing' && effect.mode !== 0)) {
        throw new Error(`messageBus: participant ${effect.participant} resource slot ${effect.offset} has invalid mode`);
      }
      for (const [field, value] of [
        ['locking bytecode', effect.lockingBytecodeHex], ['token category', effect.tokenCategoryHex],
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
          || (effect.mode === 2 && effect.outputCommitmentHex.length !== 0)) {
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
            : effect.outputCommitmentHex.toLowerCase(),
      };
    });
  const effectKeys = new Set(eventEffects.map((effect) => `${effect.participant}:${effect.offset}`));
  if (effectKeys.size !== eventEffects.length) {
    throw new Error('messageBus: atomic event effects contain a duplicate participant slot');
  }
  const eventRows = [...eventEffects]
    .sort((a, b) => a.participant - b.participant || a.offset - b.offset)
    .map((effect) => {
      const participant = plan.participants[effect.participant];
      if (!participant) throw new Error(`messageBus: event effect names participant ${effect.participant}`);
      const slot = participant.blockLayout!.slots.find((candidate) =>
        candidate.kind === 'event' && candidate.offset === effect.offset);
      if (!slot) {
        throw new Error(`messageBus: participant ${effect.participant} has no event slot ${effect.offset}`);
      }
      if (!effect.active) throw new Error('messageBus: inactive event slots must not produce callManifest rows');
      const eventSlotCount = participant.blockLayout!.slots.filter((candidate) => candidate.kind === 'event').length;
      const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
      if (maximumRows < 1 || eventSlotCount % maximumRows !== 0 || slot.slotIndex === undefined) {
        throw new Error(`messageBus: participant ${effect.participant} has a non-canonical event frame`);
      }
      const frameWidth = eventSlotCount / maximumRows;
      const parent = participant.invocations[Math.floor(slot.slotIndex / frameWidth)];
      if (!/^(?:[0-9a-fA-F]{2})*$/.test(effect.lockingBytecodeHex)
        || !/^(?:[0-9a-fA-F]{2})*$/.test(effect.commitmentHex)) {
        throw new Error(`messageBus: participant ${participant.participant} event slot ${slot.offset} is not byte hex`);
      }
      if (parent === undefined) throw new Error(`messageBus: event participant ${participant.participant} has no invocation`);
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
    ...invocationRows, ...resourceRows, ...eventRows, ...valueRows, ...tokenRows, ...sidecarRows,
  ];
  const callManifest = { participants, rows };
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

const MAX_GRAPH_PARTICIPANTS = 8;
const MAX_GRAPH_INVOCATIONS = 24;
const MAX_GRAPH_DEPTH = 7;

/**
 * Largest message-bus batch batch blob the atomic bus admits, in bytes (X106).
 *
 * NOT A SECOND COPY ANY MORE. This is the shared `MAX_MESSAGE_BUS_BLOB_BYTES` from `@solidcash/utils` under
 * the name the SDK's messageBus callers already use, so the messageEnvelope's per-participant frame check and the
 * compiler's route check (republished as `artifact.messageBus.maximumBlobBytes`) cannot drift apart. Both were
 * a bare `223`; `@solidcash/utils` is the only package the compiler and the SDK both depend on, so it is the
 * only place they can share one literal.
 *
 * A re-export rather than a rename, because the value is load-bearing: the blob is one BCH stack item, and the
 * shared value is the consensus 520-byte maximum accepted by the compiler-generated PUSHDATA2 route.
 *
 * `assertGraphBatchBlobEnvelope` closes the loop the other way, from the artifact back to this bound.
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
export function assertGraphBatchBlobEnvelope(artifact: Artifact, participant: number): void {
  const published = artifact.messageBus?.maximumBlobBytes;
  if (published === undefined || published <= GRAPH_MAX_BATCH_BLOB_BYTES) return;
  throw new Error(
    `messageBus: participant ${participant} publishes an message-bus batch blob envelope of ${published} bytes, wider than the `
    + `${GRAPH_MAX_BATCH_BLOB_BYTES} the atomic bus admits`,
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

/** Bind each reached child to one compiler-authored occurrence without guessing across incompatible schemas. */
function bindConsumerCallsites(
  parent: number,
  callsites: readonly ExternalCallAbi[],
  reached: readonly string[],
): (ExternalCallAbi | undefined)[] {
  if (callsites.length === 0) return reached.map(() => undefined);
  const singular = callsites.every((callsite) =>
    callsite.occurrence === undefined || callsite.occurrence === 'once');
  const sorted = (names: readonly string[]): string => [...names].sort().join('\x00');
  const namesArePermuted = sorted(reached) === sorted(callsites.map((call) => call.functionName));
  if (singular && callsites.length === reached.length && namesArePermuted) {
    return reached.map((functionName, position) => {
      const callsite = callsites[position];
      if (!isRuntimeResolvedCallsite(callsite) && callsite.functionName !== functionName) {
        throw new Error(
          `messageBus: invocation ${parent} reaches '${functionName}' where its compiler-authored callsite `
          + `${position} calls '${callsite.functionName}'`,
        );
      }
      return callsite;
    });
  }
  return reached.map((functionName) => {
    const candidates = callsites.filter((callsite) =>
      isRuntimeResolvedCallsite(callsite) || callsite.functionName === functionName);
    if (candidates.length === 0) return undefined;
    const contract = (callsite: ExternalCallAbi): string =>
      `${callsite.hasReturnValues === true}|${(callsite.returnTypes ?? []).join(',')}`;
    if (new Set(candidates.map(contract)).size > 1) {
      throw new Error(
        `messageBus: invocation ${parent} cannot bind '${functionName}' to one callsite; its conditional or `
        + 'loop callsites disagree on the consumed result',
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
export function assertPlannedOccurrenceCount(call: ExternalCallAbi, count: number): void {
  const bound = occurrenceBoundOf(call);
  if (bound.kind === 'loop' && bound.maximum === undefined) {
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
const callsiteRowCapacity = (call: ExternalCallAbi): number => {
  if (call.batchInvocations !== undefined) return call.batchInvocations.length;
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
function assertHandlerRowCapacity(callsites: readonly ExternalCallAbi[], rows: number): void {
  const unbounded = callsites.find((callsite) => {
    const bound = occurrenceBoundOf(callsite);
    return bound.kind === 'loop' && bound.maximum === undefined;
  });
  if (unbounded) assertPlannedOccurrenceCount(unbounded, rows);
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
    throw new Error(
      `messageBus: callsite ${callsites[last].callsiteId ?? '?'} collapses ${batched.length} repeated calls, `
      + `but ${surplus} rows were planned`,
    );
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
  if (call.batchInvocations !== undefined) return call.batchInvocations.length;
  return occurrenceBoundOf(call).minimum ?? 0;
};

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
      throw new Error(
        `messageBus: callsite ${callsite.callsiteId ?? '?'} collapses ${callsite.batchInvocations.length} `
        + `repeated calls, but only ${remaining} rows were planned`,
      );
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
export function resolveGraphAbiFunction(artifact: Artifact, name: string): AbiFunction | undefined {
  const matches = artifact.abi.filter((candidate) => candidate.name === name);
  if (matches.length > 1
    && new Set(matches.map((candidate) => candidate.selector ?? '')).size > 1) {
    throw new Error(
      `messageBus: participant artifact declares ${matches.length} distinct ABI functions named '${name}'`,
    );
  }
  return matches[0];
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
 * and eight route `transfer` slots. Dropped token-container operations are already refused at compile time;
 * the container arm here is the SDK-side backstop for the same class.
 *
 * X5: this is ONE measurement with two consumers - `assertNoUnboundCallOptions`, which turns it into the single
 * named refusal, and `planCompiledGraph`, which encodes it into the committed row. Splitting the measurement
 * would let the refusal and the committed byte disagree about the same artifact.
 */
export function measureUnboundCallOptions(
  artifact: Artifact, fn: AbiFunction, name: string,
): { optionBits: number; detail?: string } {
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  const routeKinds = new Set((artifact.messageBus?.route.blockLayout?.slots ?? [])
    .map((slot) => slot.kind as string));
  const unboundValue = (fn.transferCount ?? 0) - (handler?.transfers?.length ?? 0);
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
    if (identities.has(lbc)) {
      throw new Error('messageBus: two participant rows name the same physical locking bytecode');
    }
    identities.add(lbc);
    // X106: the artifact's published blob envelope has to fit the participant verifier's compiled-in bound.
    // Skipped for an artifact publishing no envelope at all, which fails later by name at `messageBus!`.
    assertGraphBatchBlobEnvelope(participant.artifact, index);
  });
  if (invocations.length === 0 || invocations[0].parent !== null
    || invocations.slice(1).some((invocation) => invocation.parent === null)) {
    throw new Error('messageBus: compiled graph requires exactly one root invocation at index 0');
  }

  const perOwner: MessageBatchCall[][] = participants.map(() => []);
  const globalByOwner: number[][] = participants.map(() => []);
  const subtreeEnds = invocations.map((_invocation, index) => index);
  const active: number[] = [];
  const encodedCallMode = (invocation: CompiledGraphInvocation): 'call' | 'staticcall' => {
    if (invocation.parent === null) return 'call';
    if (invocation.callMode === 'staticcall') return 'staticcall';
    if (invocation.callMode !== undefined) return 'call';
    const parentInvocation = invocations[invocation.parent];
    const parentFunction = resolveGraphAbiFunction(
      participants[parentInvocation.callee].artifact, parentInvocation.function,
    );
    const modes = [...new Set((parentFunction?.externalCalls ?? [])
      .filter((call) => call.functionName === invocation.function)
      .map((call) => call.callMode ?? 'call'))];
    return modes.length === 1 && modes[0] === 'staticcall' ? 'staticcall' : 'call';
  };
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
    perOwner[invocation.callee].push({
      function: invocation.function,
      args: invocation.args,
      ...(invocation.parent !== null && { callMode: encodedCallMode(invocation) }),
      ...(invocation.parent === null
        ? (invocation.logicalCaller === undefined ? {} : { logicalCaller: invocation.logicalCaller })
        : { logicalCaller: hexToBin(participants[invocations[invocation.parent].callee].lockingBytecode) }),
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
    const abiFunction = resolveGraphAbiFunction(participant.artifact, invocation.function);
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
    let bits = measureUnboundCallOptions(participant.artifact, abiFunction, invocation.function).optionBits;
    // A bound raw `{value:}` option belongs to this row's PARENT EDGE, not to the invocation of the
    // caller handler that authored it. E2 admits exactly one unconditional raw edge, so its compiler-owned
    // transfer marker identifies the one child row without guessing from runtime values.
    if (invocation.parent !== null) {
      const parentInvocation = invocations[invocation.parent];
      const parentParticipant = participants[parentInvocation.callee];
      const parentHandler = parentParticipant.artifact.messageBus?.handlers
        .find((candidate) => candidate.name === parentInvocation.function);
      if (parentHandler?.transfers?.some((transfer) => transfer.callOption === 'value')) {
        bits |= CALL_OPTION_VALUE;
      }
    }
    return bits;
  });

  const executions = participants.map((participant, owner) => {
    if (perOwner[owner].length === 0) {
      throw new Error(`messageBus: participant ${owner} has no invocation and must not be co-spent`);
    }
    const executionKind = participant.executionKind === 'delegate' ? 1 : 0;
    const executorSlots = executionKind === 1
      ? participant.artifact.messageBus?.route.blockLayout?.slots
        .filter((slot) => slot.kind === 'lowLevelCall') ?? []
      : [];
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
      artifact: participant.artifact,
      lockingBytecode: participant.lockingBytecode.toLowerCase(),
      executionKind,
      executorOffset: executionKind === 1 ? executorSlots[0].offset : null,
      executorInputIndex: executionKind === 1
        ? participants.slice(0, owner).reduce(
          (base, candidate) => base + candidate.artifact.messageBus!.route.blockLayout!.blockSize,
          0,
        ) + executorSlots[0].offset
        : 0xffff,
      executorLockingBytecode: executionKind === 1
        ? participant.executorLockingBytecode!.toLowerCase() : '',
      batch: encodeMessageBatch(participant.artifact, perOwner[owner], participant.unboundRouteWitnesses),
      invocations: Object.freeze(globalByOwner[owner]),
      blockLayout: participant.artifact.messageBus!.route.blockLayout!,
      routeInputs: participant.artifact.messageBus!.route.inputs,
      settlementBoundary: Math.max(...globalByOwner[owner].map((index) => subtreeEnds[index] + 1)),
      completionPositions: Object.freeze(globalByOwner[owner].map((index) => subtreeEnds[index] + 1)),
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
    const row = execution.batch.rows[localRow];
    const result = execution.batch.results.find((candidate) => candidate.row === localRow);
    const caller = invocation.parent === null ? null : invocations[invocation.parent].callee;
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
      const parentFunction = resolveGraphAbiFunction(parentArtifact, parentInvocation.function);
      const candidates = parentFunction?.externalCalls?.filter((call) =>
        call.functionName === invocation.function) ?? [];
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
    return Object.freeze({
      index,
      parent: invocation.parent,
      caller,
      callee: invocation.callee,
      subtreeEnd: subtreeEnds[index],
      localRow,
      depth: depths[index],
      function: row.function,
      selectorHex: row.selectorHex,
      callMode,
      callOptions: (callMode === 'staticcall' ? CALL_OPTION_READ_ONLY : 0) | optionBits[index],
      argsHex: row.argsHex,
      resultTypes: Object.freeze([...(result?.types ?? [])]),
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
  const resultDependencies: number[][] = invocations.map(() => []);
  for (let parent = 0; parent < invocations.length; parent += 1) {
    const children = childrenOf[parent];
    const parentInvocation = invocations[parent];
    const parentFunction = resolveGraphAbiFunction(
      participants[parentInvocation.callee].artifact, parentInvocation.function,
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
    assertHandlerRowCapacity(parentFunction?.externalCalls ?? [], children.length);
    const bindings = bindConsumerCallsites(
      parent, parentFunction?.externalCalls ?? [],
      children.map((child) => invocations[child].function),
    );
    children.forEach((child, position) => {
      const callsite = bindings[position];
      consumerCallsites[child] = callsite?.callsiteId;
      if (!callsite?.hasReturnValues) return;
      const produced = plannedBase[child].resultTypes;
      if (produced.length === 0) {
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
      resultDependencies[parent].push(child);
    });
    // Fixed-row graph handlers authenticate and consume each child result in
    // source order. Runtime raw loops do the same with their bounded
    // occurrence cursor. Both forms therefore admit any acyclic dependency
    // list within the existing graph/row maxima.
  }
  assertResolvableResultDependencies(invocations.length, resultDependencies);
  const planned = plannedBase.map((invocation, index) => Object.freeze({
    ...invocation,
    ...(consumerCallsites[index] !== undefined && { consumerCallsiteId: consumerCallsites[index] }),
    resultDependencies: Object.freeze(resultDependencies[index]),
  }));
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
import {
  binToHex, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
