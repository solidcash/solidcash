/**
 * phase-boundary extract: Compose phase-boundary extract — seed prior-pass computed resource/value-chunk claims + converge.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { canApplyRepairedNftCommitment } from '../stateful/computed-output-repair.js';
import { addressToLockScript } from '../utils.js';
import type { ComputedValueChunkClaim } from './compose-participant-helpers.js';
import {
  convergeMessageBusComputedDynamicChunkOutputs,
} from './computed-dynamic-chunks.js';
import { convergeMessageBusComputedValueChunkOutputs } from './computed-value-chunks.js';
import {
  finalizeAtomicInvocationGraph,
  type AtomicResourceSlotEffect,
} from './graph.js';
import { convergeMessageBusComputedResourceOutputs } from './preflight.js';
import { canSeedComputedValueChunkClaim } from './compose-recipes.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import { isVmValidationOnly } from './materialization-mode.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;

export interface SeedComposeComputedClaimsContext {
  provisional: TransactionBuilder;
  finalized: FinalizedGraph;
  plan: CompiledGraphPlan;
  provider: NetworkProvider;
  resourceSlots: readonly { participant: number; offset: number; kind: string }[];
  claimedResourceEffects: readonly AtomicResourceSlotEffect[];
  claimedComputedValueChunks: readonly ComputedValueChunkClaim[];
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
}

export interface SeedComposeComputedClaimsResult {
  resourceConvergence: ReturnType<typeof convergeMessageBusComputedResourceOutputs>;
  valueChunkConvergence: ReturnType<typeof convergeMessageBusComputedValueChunkOutputs>;
  dynamicChunkConvergence: ReturnType<typeof convergeMessageBusComputedDynamicChunkOutputs>;
}

/**
 * Seed mutable data-NFT / entry resource claims and computed value-chunk claims from the prior
 * semantic pass, then converge resource/value/dyn outputs on the complete provisional graph.
 */
export function seedComposeComputedClaims(
  ctx: SeedComposeComputedClaimsContext,
): SeedComposeComputedClaimsResult {
  const {
    provisional, finalized, plan, provider, resourceSlots,
    claimedResourceEffects, claimedComputedValueChunks, rebalanceFeeTail,
  } = ctx;

  // A resource claim learned on the prior pass must seed the new local probe. Otherwise the verifier sees
  // the old local commitment, rejects it against the new manifest before the implementation executes, and
  // the covenant cannot reach the pin which originally authenticated the claim. Restrict seeding to exact
  // mutable data-NFT lineage and compiler-declared entry coordinates (including a token-free trailing
  // coordinate authenticated as a sorted insertion); every other resource class keeps its ordinary path.
  let seededComputedResource = false;
  for (const slot of resourceSlots) {
    if (slot.kind !== 'dataNft' && slot.kind !== 'entry' && slot.kind !== 'trailing') continue;
    const claim = claimedResourceEffects.find((effect) => effect.participant === slot.participant
      && effect.offset === slot.offset
      && (slot.kind === 'dataNft' ? effect.mode === 0
        : slot.kind === 'entry' ? effect.mode === 0 || effect.mode === 1
          : effect.mode === 1));
    if (!claim) continue;
    const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
    const input = provisional.inputs[absolute];
    const output = provisional.outputs[absolute];
    if (output?.token?.nft?.capability !== 'mutable') continue;
    if (slot.kind === 'dataNft' && (input?.token?.nft?.capability !== 'mutable'
      || input.token.category !== output.token.category
      || input.token.nft.commitment !== claim.inputCommitmentHex)) continue;
    if (slot.kind === 'entry') {
      const inputMutable = input?.token?.nft?.capability === 'mutable';
      if ((claim.mode === 0 && (!inputMutable || input.token!.category !== output.token.category))
        || (claim.mode === 1 && inputMutable)) continue;
    }
    if (slot.kind === 'trailing') {
      const outputLockingBytecode = output.to instanceof Uint8Array
        ? output.to : addressToLockScript(output.to);
      const tokenCategoryHex = `${binToHex(hexToBin(output.token.category).reverse())}01`;
      if (input?.token !== undefined
        || binToHex(outputLockingBytecode) !== claim.lockingBytecodeHex
        || tokenCategoryHex !== claim.tokenCategoryHex) continue;
    }
    const proposed = hexToBin(claim.outputCommitmentHex);
    const action = canApplyRepairedNftCommitment({
      capability: output.token.nft.capability,
      currentCommitmentHex: output.token.nft.commitment,
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: slot.kind === 'dataNft',
      maximumCommitmentBytes: provider.consensusLimits?.maximumNftCommitmentBytes ?? 128,
    });
    if (action === 'skip') continue;
    output.token.nft.commitment = claim.outputCommitmentHex;
    seededComputedResource = true;
  }
  let seededComputedValueChunk = false;
  for (const claim of claimedComputedValueChunks) {
    const participant = finalized.callManifest.participants[claim.participant];
    const trailingBase = plan.participants[claim.participant]?.blockLayout?.trailingBase;
    if (!participant || trailingBase === undefined || claim.offset < trailingBase
      || claim.offset >= participant.actualSize) continue;
    const absolute = finalized.layout.participantInputs[claim.participant] + claim.offset;
    const input = provisional.inputs[absolute];
    const output = provisional.outputs[absolute];
    if (!canSeedComputedValueChunkClaim(input, output, claim)) continue;
    const lockingBytecode = hexToBin(claim.lockingBytecodeHex);
    const currentLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
    if (binToHex(currentLockingBytecode) !== claim.lockingBytecodeHex) {
      output.to = lockingBytecode;
      seededComputedValueChunk = true;
    }
    if (output.token!.nft!.commitment !== claim.commitment) {
      output.token!.nft!.commitment = claim.commitment;
      seededComputedValueChunk = true;
    }
  }
  // State derived by a delegated or cross-participant call is unknowable to the isolated local builders.
  // Converge it on the complete graph before reading resource effects, so the next manifest authenticates
  // the repaired commitment rather than treating the late write as an unclaimed output mutation.
  // Top-level dynamic chunk RMW is the same class: local probes freeze the prior chunk commitment while the
  // route already authenticates the concat-derived replacement (aa→aabb) on the complete graph.
  // Recipe mode may seed prior semantic claims, but it cannot mutate outputs from a newly exposed failed VM
  // frame. Leave that next frontier to the non-mutating post-event discovery pass; devOracle retains the legacy
  // in-place convergence behavior.
  const resourceConvergence = isVmValidationOnly()
    ? { repairs: 0, rounds: 0, outputs: [] as number[] }
    : convergeMessageBusComputedResourceOutputs(provisional);
  const valueChunkConvergence = convergeMessageBusComputedValueChunkOutputs(provisional);
  // Recipe mode cannot apply VM-mined chunk repairs. Intermediate semantic graphs are provisional, so
  // validating every one repeats an expensive full-graph VM pass without changing any claim. The stable
  // graph is still checked for incomplete chunks and the final admit validates every chunk covenant.
  const dynamicChunkConvergence = isVmValidationOnly()
    ? { repairs: 0, rounds: 0, ownedOutputs: [], authenticatedOutputs: [], outputs: [] }
    : convergeMessageBusComputedDynamicChunkOutputs(provisional);
  if (seededComputedResource || seededComputedValueChunk
    || resourceConvergence.repairs > 0 || valueChunkConvergence.repairs > 0
    || dynamicChunkConvergence.repairs > 0) {
    rebalanceFeeTail(provisional, 'converged mutable resource outputs');
  }
  return { resourceConvergence, valueChunkConvergence, dynamicChunkConvergence };
}
