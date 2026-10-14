/**
 * phase-boundary extract: Compose phase-boundary extract — post-assemble semantic-effect observation + event relocate.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
} from '@solidcash/utils';
import type { TokenDetails } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import type { ComputedValueChunkClaim } from './compose-participant-helpers.js';
import type { SemanticClaimObservation } from './compose-prepared-invocation.js';
import {
  finalizeAtomicInvocationGraph,
  selectedGraphEventOffsets,
  type AtomicEventSlotEffect,
  type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect,
  type AtomicTokenSlotEffect,
  type AtomicValueSlotEffect,
} from './graph.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import { discoverMessageBusComputedResourceOutputs } from './preflight.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type PlanParticipant = CompiledGraphPlan['participants'][number];
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;

export interface ComposeSemanticEffectClaims {
  computedValueChunks: readonly ComputedValueChunkClaim[] | ComputedValueChunkClaim[];
  resourceEffects: readonly AtomicResourceSlotEffect[] | AtomicResourceSlotEffect[];
  valueEffects: readonly AtomicValueSlotEffect[] | AtomicValueSlotEffect[];
  tokenEffects: readonly AtomicTokenSlotEffect[] | AtomicTokenSlotEffect[];
  sidecarEffects: readonly AtomicSidecarSlotEffect[] | AtomicSidecarSlotEffect[];
  eventEffects: readonly AtomicEventSlotEffect[] | AtomicEventSlotEffect[];
}

export interface ObserveComposeSemanticEffectsContext {
  provisional: TransactionBuilder;
  eventProbeProgram?: ReturnType<TransactionBuilder['buildLibauthProgram']>;
  finalized: FinalizedGraph;
  plan: CompiledGraphPlan;
  categories: readonly string[];
  byLockingBytecode: Map<string, StatefulContract>;
  resourceSlots: readonly { participant: number; offset: number; kind: string }[];
  valueSlots: readonly { participant: number; offset: number }[];
  tokenSlots: readonly { participant: number; offset: number }[];
  sidecarSlots: readonly { participant: number; offset: number; kind: AtomicSidecarSlotEffect['kind'] }[];
  eventSlots: () => readonly {
    participant: number; offset: number; runtimeRow?: number; eventSignature?: string; chunked?: true;
  }[];
  incompleteParticipants: ReadonlySet<number>;
  valueChunkConvergence: { ownedOutputs: readonly number[] };
  eventLockingBytecodes: (participant: PlanParticipant) => string[];
  eventLockingBytecodeAtOffset: (participant: PlanParticipant, offset: number) => string | undefined;
  eventLockingBytecodeForCommitment: (participant: PlanParticipant, commitment: string) => string | undefined;
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
  selfdestructByParticipant: ReadonlyMap<number, unknown>;
}

function internalTokenCategory(token: TokenDetails): string {
  const category = binToHex(hexToBin(token.category).reverse());
  if (!token.nft) return category;
  const capability = { none: '', mutable: '01', minting: '02' }[token.nft.capability];
  return `${category}${capability}`;
}

/** Refresh resource claims discovered only after event relocation lets the implementation body execute. */
function refreshDiscoveredMutableResourceEffects(
  ctx: ObserveComposeSemanticEffectsContext,
  effects: AtomicResourceSlotEffect[],
  proposals: ReadonlyMap<number, Uint8Array>,
): void {
  const resourceOrder = new Map(ctx.resourceSlots.map((slot, index) => (
    [`${slot.participant}:${slot.offset}`, index] as const
  )));
  for (const [absolute, proposedCommitment] of proposals) {
    const slot = ctx.resourceSlots.find((candidate) => (
      ctx.finalized.layout.participantInputs[candidate.participant] + candidate.offset === absolute
    ));
    if (slot === undefined) continue;
    const input = ctx.provisional.inputs[absolute];
    const output = ctx.provisional.outputs[absolute];
    const inputMutable = input?.token?.nft?.capability === 'mutable';
    const outputMutable = output?.token?.nft?.capability === 'mutable';
    if (!input || !output || (!inputMutable && !outputMutable)) continue;
    const inputLockingBytecode = input.unlocker.generateLockingBytecode();
    const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    const lockingBytecodeChanges = inputMutable && outputMutable
      && binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode);
    const mode = inputMutable ? (outputMutable ? (lockingBytecodeChanges ? 5 : 0) : 2) : 1;
    const activeToken = inputMutable ? input.token! : output.token!;
    const refreshed: AtomicResourceSlotEffect = {
      participant: slot.participant,
      offset: slot.offset,
      mode,
      lockingBytecodeHex: binToHex(inputMutable ? inputLockingBytecode : outputLockingBytecode),
      ...(mode === 5 && { outputLockingBytecodeHex: binToHex(outputLockingBytecode) }),
      tokenCategoryHex: `${binToHex(hexToBin(activeToken.category).reverse())}01`,
      inputCommitmentHex: inputMutable ? input.token!.nft!.commitment : '',
      outputCommitmentHex: outputMutable ? binToHex(proposedCommitment) : '',
    };
    const prior = effects.findIndex((effect) => effect.participant === slot.participant
      && effect.offset === slot.offset);
    if (prior < 0) effects.push(refreshed);
    else effects[prior] = refreshed;
  }
  effects.sort((left, right) => (resourceOrder.get(`${left.participant}:${left.offset}`) ?? Number.MAX_SAFE_INTEGER)
    - (resourceOrder.get(`${right.participant}:${right.offset}`) ?? Number.MAX_SAFE_INTEGER));
}

export function observeComposeSemanticEffects(
  ctx: ObserveComposeSemanticEffectsContext,
  claims: ComposeSemanticEffectClaims,
): {
    semanticObservations: SemanticClaimObservation[];
    derivedEventEffects: AtomicEventSlotEffect[];
    derivedResourceEffects: AtomicResourceSlotEffect[];
    derivedValueEffects: AtomicValueSlotEffect[];
    derivedTokenEffects: AtomicTokenSlotEffect[];
    derivedSidecarEffects: AtomicSidecarSlotEffect[];
  } {
  // Independent semantic effects share one complete-graph observation pass. Record mutations monotonically,
  // but do not restart until fixed resource/value/token/sidecar/event observations have also been collected;
  // otherwise an earlier provisional class can permanently starve a later class which it needs to pass.
  const semanticObservations: SemanticClaimObservation[] = [];
  const derivedComputedValueChunks: ComputedValueChunkClaim[] = [];
  for (const absolute of ctx.valueChunkConvergence.ownedOutputs) {
    let participant = -1;
    for (let index = 0; index < ctx.finalized.layout.participantInputs.length; index += 1) {
      const base = ctx.finalized.layout.participantInputs[index];
      if (absolute >= base && absolute < base + ctx.finalized.callManifest.participants[index].actualSize) {
        participant = index;
        break;
      }
    }
    if (participant < 0) continue;
    const output = ctx.provisional.outputs[absolute];
    const lockingBytecode = output === undefined ? undefined
      : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (lockingBytecode === undefined || output?.token?.nft?.capability !== 'mutable') continue;
    derivedComputedValueChunks.push({
      participant,
      offset: absolute - ctx.finalized.layout.participantInputs[participant],
      lockingBytecodeHex: binToHex(lockingBytecode),
      tokenCategory: output.token.category,
      commitment: output.token.nft.commitment,
    });
  }
  semanticObservations.push({
    previous: claims.computedValueChunks,
    observed: derivedComputedValueChunks,
    apply: (observed) => { claims.computedValueChunks = observed as ComputedValueChunkClaim[]; },
  });
  const derivedResourceEffects: AtomicResourceSlotEffect[] = [];
  for (const slot of ctx.resourceSlots) {
    if (slot.offset >= ctx.finalized.callManifest.participants[slot.participant].actualSize) continue;
    const absolute = ctx.finalized.layout.participantInputs[slot.participant] + slot.offset;
    const input = ctx.provisional.inputs[absolute];
    const output = ctx.provisional.outputs[absolute];
    if (!input || !output) throw new Error(`messageBus: resource slot ${slot.participant}:${slot.offset} is absent`);
    const inputToken = input.token;
    const outputToken = output.token;
    // An unresolved dynamic chunk is a first-pass probe placeholder, not a claimed NFT transition. Its
    // participant is independently reported by the builder, and the stable/final gate below rejects any
    // graph which never replaces it with a concrete commitment.
    if (slot.kind === 'trailing' && ctx.incompleteParticipants.has(slot.participant)
      && outputToken?.nft?.capability === 'mutable' && outputToken.nft.commitment === '00') continue;
    if (slot.kind === 'satoshiContainer') {
      const inputLockingBytecode = input.unlocker.generateLockingBytecode();
      const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (inputToken || outputToken || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
        throw new Error(`messageBus: satoshi container ${slot.participant}:${slot.offset} is not preserved`);
      }
      derivedResourceEffects.push({
        participant: slot.participant, offset: slot.offset, mode: 3,
        lockingBytecodeHex: binToHex(inputLockingBytecode), tokenCategoryHex: '',
        inputCommitmentHex: '', outputCommitmentHex: '',
        inputValue: input.satoshis, outputValue: output.amount,
      });
      continue;
    }
    if (slot.kind === 'tokenContainer') {
      const inputLockingBytecode = input.unlocker.generateLockingBytecode();
      const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (!inputToken || (outputToken && inputToken.category !== outputToken.category)
        || (!outputToken && binToHex(outputLockingBytecode) !== '6a')
        || (outputToken && (input.satoshis !== output.amount
          || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)))) {
        throw new Error(`messageBus: token container ${slot.participant}:${slot.offset} is invalid`);
      }
      derivedResourceEffects.push({
        participant: slot.participant, offset: slot.offset, mode: 4,
        lockingBytecodeHex: binToHex(inputLockingBytecode),
        tokenCategoryHex: internalTokenCategory(inputToken),
        outputTokenCategoryHex: outputToken ? internalTokenCategory(outputToken) : '',
        inputCommitmentHex: inputToken.nft?.commitment ?? '',
        outputCommitmentHex: outputToken?.nft?.commitment ?? '',
        inputValue: inputToken.amount, outputValue: outputToken?.amount ?? 0n,
      });
      continue;
    }
    if (slot.kind === 'lowLevelCall') {
      const inputLockingBytecode = input.unlocker.generateLockingBytecode();
      const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (!inputToken || !outputToken || inputToken.nft?.capability !== 'minting'
        || internalTokenCategory(inputToken) !== internalTokenCategory(outputToken)
        || inputToken.amount !== outputToken.amount
        || inputToken.nft.commitment !== outputToken.nft?.commitment
        || input.satoshis !== output.amount
        || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
        throw new Error(
          `messageBus: covenant identity ${slot.participant}:${slot.offset} is not preserved exactly`,
        );
      }
      const tokenCategoryHex = internalTokenCategory(inputToken);
      derivedResourceEffects.push({
        participant: slot.participant, offset: slot.offset, mode: 4,
        lockingBytecodeHex: binToHex(inputLockingBytecode),
        tokenCategoryHex, outputTokenCategoryHex: tokenCategoryHex,
        inputCommitmentHex: inputToken.nft.commitment,
        outputCommitmentHex: outputToken.nft.commitment,
        inputValue: inputToken.amount, outputValue: outputToken.amount,
      });
      continue;
    }
    const inputMutable = inputToken?.nft?.capability === 'mutable';
    const outputMutable = outputToken?.nft?.capability === 'mutable';
    if (!inputMutable && !outputMutable) continue;
    const inputLockingBytecode = input.unlocker.generateLockingBytecode();
    const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    const lockingBytecodeChanges = inputMutable && outputMutable
      && binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode);
    const mode = inputMutable ? (outputMutable ? (lockingBytecodeChanges ? 5 : 0) : 2) : 1;
    if (mode === 2 && outputToken !== undefined) {
      throw new Error(`messageBus: DELETE resource slot ${slot.participant}:${slot.offset} must be token-free`);
    }
    const retirementConsume = mode === 2
      && (slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft')
      && (ctx.selfdestructByParticipant.has(slot.participant)
        || ctx.plan.participants[slot.participant]?.lifecycle?.kind === 'selfdestruct');
    if (slot.kind !== 'entry' && slot.kind !== 'trailing' && mode !== 0 && !retirementConsume) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-fixed-resource-not-preserved', {
          slot,
          absolute,
          inputCategory: inputToken?.category,
          outputCategory: outputToken?.category,
          inputCapability: inputToken?.nft?.capability,
          outputCapability: outputToken?.nft?.capability,
          inputCommitment: inputToken?.nft?.commitment,
          outputCommitment: outputToken?.nft?.commitment,
          inputLockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
          outputLockingBytecode: binToHex(typeof output.to === 'string'
            ? addressToLockScript(output.to) : output.to),
        });
      }
      throw new Error(`messageBus: fixed resource slot ${slot.participant}:${slot.offset} is not preserved`);
    }
    const activeToken = inputMutable ? inputToken : outputToken!;
    // Trailing value-chunk slots rewrite commitments and may re-dust satoshis; category must still match.
    if (activeToken.amount !== 0n || (inputMutable && outputMutable
      && (inputToken.category !== outputToken!.category
        || (slot.kind !== 'trailing' && input.satoshis !== output.amount)))) {
      throw new Error(`messageBus: resource slot ${slot.participant}:${slot.offset} has an invalid NFT transition`);
    }
    const resourceLockingBytecode = inputMutable ? inputLockingBytecode : outputLockingBytecode;
    derivedResourceEffects.push({
      participant: slot.participant, offset: slot.offset, mode,
      lockingBytecodeHex: binToHex(resourceLockingBytecode),
      ...(mode === 5 && { outputLockingBytecodeHex: binToHex(outputLockingBytecode) }),
      tokenCategoryHex: `${binToHex(hexToBin(activeToken.category).reverse())}01`,
      inputCommitmentHex: inputMutable ? inputToken.nft!.commitment : '',
      outputCommitmentHex: outputMutable ? outputToken!.nft!.commitment : '',
    });
  }
  semanticObservations.push({
    previous: claims.resourceEffects,
    observed: derivedResourceEffects,
    apply: (observed) => { claims.resourceEffects = observed as AtomicResourceSlotEffect[]; },
  });
  const derivedValueEffects: AtomicValueSlotEffect[] = [];
  for (const slot of ctx.valueSlots) {
    if (slot.offset >= ctx.finalized.callManifest.participants[slot.participant].actualSize) continue;
    const absolute = ctx.finalized.layout.participantInputs[slot.participant] + slot.offset;
    const input = ctx.provisional.inputs[absolute];
    const output = ctx.provisional.outputs[absolute];
    if (!input || !output || input.token || output.token
      || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
      throw new Error(`messageBus: transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
    }
    const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (binToHex(lockingBytecode) === '51') continue;
    derivedValueEffects.push({
      ...slot, lockingBytecodeHex: binToHex(lockingBytecode), amount: output.amount,
    });
  }
  semanticObservations.push({
    previous: claims.valueEffects,
    observed: derivedValueEffects,
    apply: (observed) => { claims.valueEffects = observed as AtomicValueSlotEffect[]; },
  });
  const derivedTokenEffects: AtomicTokenSlotEffect[] = [];
  for (const slot of ctx.tokenSlots) {
    if (slot.offset >= ctx.finalized.callManifest.participants[slot.participant].actualSize) continue;
    const absolute = ctx.finalized.layout.participantInputs[slot.participant] + slot.offset;
    const input = ctx.provisional.inputs[absolute];
    const output = ctx.provisional.outputs[absolute];
    if (!input || !output || input.token
      || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
      throw new Error(`messageBus: token-transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
    }
    if (!output.token) {
      const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (binToHex(lockingBytecode) === '51') continue;
      throw new Error(`messageBus: token-transfer slot ${slot.participant}:${slot.offset} has no token`);
    }
    const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    derivedTokenEffects.push({
      ...slot, lockingBytecodeHex: binToHex(lockingBytecode),
      tokenCategoryHex: internalTokenCategory(output.token),
      amount: output.token.amount,
      commitmentHex: output.token.nft?.commitment ?? '',
      capability: output.token.nft?.capability ?? 'ft',
    });
  }
  semanticObservations.push({
    previous: claims.tokenEffects,
    observed: derivedTokenEffects,
    apply: (observed) => { claims.tokenEffects = observed as AtomicTokenSlotEffect[]; },
  });
  const derivedSidecarEffects: AtomicSidecarSlotEffect[] = [];
  for (const slot of ctx.sidecarSlots) {
    if (slot.offset >= ctx.finalized.callManifest.participants[slot.participant].actualSize) continue;
    const absolute = ctx.finalized.layout.participantInputs[slot.participant] + slot.offset;
    const input = ctx.provisional.inputs[absolute];
    const output = ctx.provisional.outputs[absolute];
    if (!input || !output) throw new Error(`messageBus: sidecar slot ${slot.participant}:${slot.offset} is absent`);
    if (!input.token || !output.token) continue;
    const inputLockingBytecode = input.unlocker.generateLockingBytecode();
    const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)
      || internalTokenCategory(input.token) !== internalTokenCategory(output.token)
      || input.token.amount !== output.token.amount || input.satoshis !== output.amount) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-sidecar-not-recreated', {
          slot,
          absolute,
          inputLockingBytecode: binToHex(inputLockingBytecode),
          outputLockingBytecode: binToHex(outputLockingBytecode),
          inputCategory: internalTokenCategory(input.token),
          outputCategory: internalTokenCategory(output.token),
          inputCommitment: input.token.nft?.commitment,
          outputCommitment: output.token.nft?.commitment,
          inputAmount: input.token.amount,
          outputAmount: output.token.amount,
          inputSatoshis: input.satoshis,
          outputSatoshis: output.amount,
        });
      }
      throw new Error(`messageBus: sidecar slot ${slot.participant}:${slot.offset} is not recreated in place`);
    }
    derivedSidecarEffects.push({
      ...slot, lockingBytecodeHex: binToHex(inputLockingBytecode),
      tokenCategoryHex: internalTokenCategory(input.token),
      inputCommitmentHex: input.token.nft?.commitment ?? '',
      outputCommitmentHex: output.token.nft?.commitment ?? '', value: input.satoshis,
    });
  }
  semanticObservations.push({
    previous: claims.sidecarEffects,
    observed: derivedSidecarEffects,
    apply: (observed) => { claims.sidecarEffects = observed as AtomicSidecarSlotEffect[]; },
  });
  const derivedEventEffects: AtomicEventSlotEffect[] = [];
  const eventProgram = ctx.eventProbeProgram ?? ctx.provisional.buildLibauthProgram();
  const eventSlots = ctx.eventSlots();
  const eventSlotsByParticipant = new Map<number, typeof eventSlots[number][]>();
  for (const slot of eventSlots) {
    const owned = eventSlotsByParticipant.get(slot.participant) ?? [];
    owned.push(slot);
    eventSlotsByParticipant.set(slot.participant, owned);
  }
  const discoveredEvents = new Map<number, { commitment: string; lockingBytecode?: string }>();
  for (const participant of ctx.plan.participants) {
    const selectedOffsets = selectedGraphEventOffsets(ctx.plan, participant);
    // The compiler-published frame can reserve hundreds of inactive sites. Probing those sites makes the
    // event trace report impossible missing commitments and triggers an unnecessary full VM fallback.
    // Runtime-row slots and routes without a provable selected frame still require the complete probe.
    const ownedSlots = (eventSlotsByParticipant.get(participant.participant) ?? [])
      .filter((slot) => slot.runtimeRow !== undefined
        || selectedOffsets === undefined || selectedOffsets.has(slot.offset));
    const participantBase = ctx.finalized.layout.participantInputs[participant.participant];
    const eventIndices = ownedSlots.map((slot) => participantBase + slot.offset);
    if (eventIndices.length === 0) continue;
    const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
      ? participantBase + participant.executorOffset : participantBase;
    const contract = ctx.byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    for (const [outputIndex, expectation] of contract._messageBusEventCommitmentsFromTransaction(
      ctx.provisional, eventIndices, executionInput, eventProgram,
    )) discoveredEvents.set(outputIndex, expectation);
  }
  // The route's unrolled dispatcher owns the physical event site. A compact local probe initially places
  // reached events by logical row, but those coordinates can differ when several selector arms share the
  // route. The selected-site trace above is the compiler's authority: relocate the SDK's artifact-derived event
  // templates onto the exact event slots introspected by the covenant, and return every other reserved slot
  // to its canonical balanced-output shape. No contract-specific handler or event names participate.
  let eventFrameRelocated = false;
  for (const participant of ctx.plan.participants) {
    const participantBase = ctx.finalized.layout.participantInputs[participant.participant];
    const selectedEventOffsets = selectedGraphEventOffsets(ctx.plan, participant);
    const indices = (eventSlotsByParticipant.get(participant.participant) ?? [])
      .map((slot) => participantBase + slot.offset);
    if (indices.length === 0) continue;
    // Stream records sit in the trailing band, outside any window selection, and are never inactive templates.
    const streamTargets = new Set((eventSlotsByParticipant.get(participant.participant) ?? [])
      .filter((slot) => slot.runtimeRow !== undefined).map((slot) => participantBase + slot.offset));
    const eventLocks = ctx.eventLockingBytecodes(participant);
    const eventLockSet = new Set(eventLocks);
    const participantEnd = participantBase
      + ctx.finalized.callManifest.participants[participant.participant].actualSize;
    const active = Array.from({ length: participantEnd - participantBase }, (_unused, offset) =>
      participantBase + offset).filter((index) => {
      const output = ctx.provisional.outputs[index];
      const nft = ctx.provisional.outputs[index]?.token?.nft;
      const lockingBytecode = output === undefined ? undefined
        : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      return nft?.capability === 'none' && lockingBytecode !== undefined
        && eventLockSet.has(binToHex(lockingBytecode));
    });
    // A kind-2 row is an authenticated producer result from the preceding fixed-point pass. A faithful VM
    // trace normally stops reporting that event once its output is correct, so retain the stable row by
    // physical participant slot rather than reading the absence of a new mismatch as an inactive event.
    const authenticated = new Map(ctx.finalized.callManifest.rows.flatMap((row) =>
      row.kind === 2 && row.mode === 1 && row.owner === participant.participant
        ? [[participantBase + row.targetOffset, {
          commitment: row.effectHex, lockingBytecode: row.subjectHex,
        }] as const] : []));
    const expectationAt = (index: number): { commitment: string; lockingBytecode?: string } | undefined => {
      const observed = discoveredEvents.get(index);
      const prior = authenticated.get(index);
      if (!observed) return prior;
      return {
        commitment: observed.commitment,
        lockingBytecode: observed.lockingBytecode
          ?? (prior?.commitment === observed.commitment ? prior.lockingBytecode : undefined),
      };
    };
    // Inactive route slots only bind an empty commitment. A relaxed trace can carry that introspection into
    // a neighboring equality and produce a false commitment match, but it cannot invent the event covenant's
    // independently verified locking bytecode. The executing covenant's commitment+lock pair is authoritative
    // for proxy/delegate routes, where the logical handler artifact need not publish the physical event lock.
    const targets = indices.filter((index) => {
      const expectation = expectationAt(index);
      const schemaLock = expectation === undefined ? undefined
        : ctx.eventLockingBytecodeForCommitment(participant, expectation.commitment);
      // The SDK materialized this immutable output from the selected handler's compiler-published event
      // site, so its lock is exact site evidence even when a commitment mismatch stopped the VM immediately
      // before the following OUTPUTBYTECODE pin and the trace cannot reconstruct the payload.
      const callsiteLock = ctx.eventLockingBytecodeAtOffset(participant, index - participantBase);
      const activeTemplate = active.includes(index);
      return (streamTargets.has(index) || selectedEventOffsets === undefined
        || selectedEventOffsets.has(index - participantBase))
        && (expectation?.commitment.length ?? 0) > 0
        // A commitment mismatch stops the faithful VM trace before the handler can execute its following
        // output-bytecode pin. The emitted commitment still carries the compiler-published event schema;
        // when that schema identifies exactly one selected-handler covenant, it is an equally exact output
        // template for the next fixed-point pass. Ambiguous or unknown schemas remain trace-only.
        && (expectation?.lockingBytecode !== undefined || schemaLock !== undefined
          || callsiteLock !== undefined || activeTemplate);
    });
    const inactive = indices.filter((index) => !streamTargets.has(index))
      .map((index) => ctx.provisional.outputs[index]).find((output) => !output.token);
    // A chunk of a chunked event need not parse as any schema, and a short one can parse as the wrong one.
    const chunkedTargets = new Set((eventSlotsByParticipant.get(participant.participant) ?? [])
      .filter((slot) => slot.chunked).map((slot) => participantBase + slot.offset));
    if (!inactive && targets.some((target) => !active.includes(target))) {
      throw new Error('messageBus: event-frame relocation has no canonical inactive output');
    }
    // A stream the trace has not read yet has nothing to relocate.
    if (!inactive && targets.length === 0 && active.length > 0
      && indices.every((index) => streamTargets.has(index))) continue;
    if (!inactive && targets.length === 0 && active.length > 0) {
      throw new Error('messageBus: inactive event frame has no canonical empty output');
    }
    if (targets.length === 0 && active.length === 0) continue;
    eventFrameRelocated = true;
    const template = inactive ?? ctx.provisional.outputs[targets[0]];
    if (!template) throw new Error('messageBus: active event frame has no output template');
    const targetTemplates = new Map(targets.map((target) => [target, ctx.provisional.outputs[target]]));
    if (inactive) {
      for (const index of new Set([...indices, ...active])) {
        if (!streamTargets.has(index)) ctx.provisional.outputs[index] = { ...inactive };
      }
    }
    targets.forEach((target, index) => {
      const expectation = expectationAt(target)!;
      // A flattened route trace can expose a sibling event identity beside the reached handler's payload.
      // Prefer the unique event schema published by the selected handlers; retain the trace for genuinely
      // ambiguous same-schema events, where the commitment alone cannot identify a named covenant.
      const decodedLock = chunkedTargets.has(target)
        ? undefined : ctx.eventLockingBytecodeForCommitment(participant, expectation.commitment);
      const callsiteLock = ctx.eventLockingBytecodeAtOffset(participant, target - participantBase);
      const current = targetTemplates.get(target);
      const currentLock = typeof current?.to === 'string'
        ? addressToLockScript(current.to) : current?.to;
      ctx.provisional.outputs[target] = {
        to: decodedLock !== undefined
          ? hexToBin(decodedLock)
          : expectation.lockingBytecode !== undefined
            ? hexToBin(expectation.lockingBytecode)
            : callsiteLock !== undefined
              ? hexToBin(callsiteLock)
              : currentLock ?? hexToBin(eventLocks[index]),
        // Preserve the value the compiler-built site at this target already carried: `template` can be a
        // different (inactive) index's output, and its satoshi amount is an observable part of the frame.
        amount: current?.amount ?? template.amount,
        token: {
          category: ctx.categories[participant.participant], amount: 0n,
          nft: { capability: 'none', commitment: expectation.commitment },
        },
      };
    });
  }
  // Relocation never probes or reads the fee tail between participants. Size and balance the complete final
  // event frame once; reserializing the multi-thousand-input transaction after each owner is redundant.
  if (eventFrameRelocated) {
    ctx.rebalanceFeeTail(ctx.provisional, 'relocated compiler-authenticated event outputs');
  }
  // Event slots are semantic prerequisites for implementations which both emit an event and update a mutable
  // entry. The first resource probe can stop at the event-slot lookup before it reaches the entry covenant;
  // relocation above makes that path executable without changing the already-stable event claim. Re-run the
  // structurally bounded resource observation now and refresh precisely the claims it discovers, so the current
  // semantic pass cannot admit a stale entry placeholder. Discovery is deliberately non-mutating: the next
  // graph pass applies this compiler-authenticated semantic claim as a recipe, and the VM remains validation-only.
  const postEventResourceProposals = discoverMessageBusComputedResourceOutputs(ctx.provisional);
  refreshDiscoveredMutableResourceEffects(ctx, derivedResourceEffects, postEventResourceProposals);
  for (const slot of eventSlots) {
    const outputIndex = ctx.finalized.layout.participantInputs[slot.participant] + slot.offset;
    const output = ctx.provisional.outputs[outputIndex];
    if (!output) throw new Error(`messageBus: event slot ${slot.participant}:${slot.offset} has no output`);
    const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    const expectation = discoveredEvents.get(outputIndex);
    const commitment = expectation?.commitment ?? output.token?.nft?.commitment ?? '';
    const active = output.token !== undefined && commitment.length > 0;
    if (active && (output.token!.category !== ctx.categories[slot.participant]
      || output.token!.nft?.capability !== 'none')) {
      throw new Error(
        `messageBus: event slot ${slot.participant}:${slot.offset} is not an immutable participant NFT`,
      );
    }
    if (active) {
      derivedEventEffects.push({
        ...slot, active, lockingBytecodeHex: binToHex(lockingBytecode),
        commitmentHex: commitment,
      });
    }
  }
  return {
    semanticObservations,
    derivedEventEffects,
    derivedResourceEffects,
    derivedValueEffects,
    derivedTokenEffects,
    derivedSidecarEffects,
  };
}
