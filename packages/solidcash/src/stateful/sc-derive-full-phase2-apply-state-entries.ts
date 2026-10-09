/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 2 state + entry commitment apply.
 */

import type { EntryAccessAbi, StateLayout } from '@solidcash/utils';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StateValueType } from '../types/state-inference.js';
import { entryAccessAt } from './route-expression-key.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  extractCommitmentMapFromTrace,
  extractCommitmentsFromTrace,
} from './trace-commitment-helpers.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';

export interface DeriveFullPhase2StateEntryApplyHost {
  readonly categoryId: string;
}

export type DeriveFullPhase2StateEntryApplyResult = {
  commitmentProgress: number;
  derivedAState: Record<string, StateValueType> | undefined;
  derivedStateCount: number;
  stateCommits: string[];
  latestEntryCommits: string[];
  latestEventCommits: string[];
  latestLoopEntryCommits: string[];
};

/**
 * Locate A's state/entry output window on the Phase-2 probe and apply verified
 * commitments into the STB. Returns progress counters and latest commit lists.
 */
export function deriveFullPhase2ApplyStateAndEntries(
  host: DeriveFullPhase2StateEntryApplyHost,
  stb: StatefulTransactionBuilder,
  params: {
    probeBuilder2: TransactionBuilder;
    fullTrace2: AuthenticationProgramStateCommon[];
    commitmentProgress: number;
    derivedAState: Record<string, StateValueType> | undefined;
    derivedStateCount: number;
    stateCount: number;
    entryCount: number;
    stateLayout: StateLayout;
    requiredNftIndices: readonly number[];
    entryAccesses: readonly EntryAccessAbi[] | undefined;
    delegatecallInputIndex: number | undefined;
    phaseCheckpoint: (stage: string) => void;
  },
): DeriveFullPhase2StateEntryApplyResult {
  let {
    commitmentProgress, derivedAState, derivedStateCount,
  } = params;
  const {
    probeBuilder2, fullTrace2, stateCount, entryCount, stateLayout,
    requiredNftIndices, entryAccesses, delegatecallInputIndex, phaseCheckpoint,
  } = params;

  // A direct call emits its state immediately after output 0. In a composed delegate call, the proxy
  // block follows all routed callees, so locate its minting master by category and read the contiguous
  // data-NFT outputs which follow it.
  const delegateMasterOutputIndex = delegatecallInputIndex === undefined ? -1
    : probeBuilder2.outputs.findIndex((output, outputIndex, outputs) =>
      output.token?.category === host.categoryId
      && output.token?.nft?.capability === 'minting'
      && Array.from({ length: stateCount }, (_, i) => outputs[outputIndex + 1 + i])
        .every((candidate) => candidate?.token?.category === host.categoryId
          && candidate.token.nft?.capability === 'mutable'));
  const stateOutputBase = delegateMasterOutputIndex >= 0 ? delegateMasterOutputIndex + 1 : 1;
  const stateOutputRange = { min: stateOutputBase, max: stateOutputBase + stateCount };
  const stateCommits = extractCommitmentsFromTrace(
    fullTrace2, stateCount, stateOutputRange, delegatecallInputIndex !== undefined,
    false,
  ) ?? [];
  commitmentProgress += stateCommits.length;
  let latestEntryCommits: string[] = [];
  let latestEventCommits: string[] = [];
  let latestLoopEntryCommits: string[] = [];

  // Apply state commitments - always update when commitments are available,
  // even if the count hasn't increased (values may have changed between iterations).
  const newStateCommitCount = Math.min(stateCommits.length, stateCount);
  if (newStateCommitCount > 0) {
    const partialState = commitmentsToState(stateCommits.slice(0, newStateCommitCount), stateLayout,
      requiredNftIndices.slice(0, newStateCommitCount));
    if (!derivedAState) derivedAState = {};
    for (const [name, value] of Object.entries(partialState)) {
      derivedAState[name] = value;
      stb.setState(name, value);
    }
    for (let commitmentIndex = 0; commitmentIndex < newStateCommitCount; commitmentIndex++) {
      stb.setStateRawCommitment(requiredNftIndices[commitmentIndex], stateCommits[commitmentIndex]);
    }
    derivedStateCount = Math.max(derivedStateCount, newStateCommitCount);
  }
  phaseCheckpoint('state');

  // Entry commitments: output indices [entryBase, entryBase + entryCount). Map each verified
  // commitment to ITS slot by output index (slotOrder[outputIndex - base]) rather than positionally:
  // the covenant checks written entries in write order and skips absent read-only slots, so a
  // positional (i-th commitment -> slot i) assignment misaligns when writes are out of slot order.
  if (entryCount > 0) {
    const entryOutputBase = stb.getEntryOutputBase();
    const entryOutputRange = { min: entryOutputBase, max: entryOutputBase + entryCount };
    const commitMap = extractCommitmentMapFromTrace(
      fullTrace2, entryOutputRange, delegatecallInputIndex !== undefined,
      false,
    );
    const slotOrder = stb.getEntryOutputSlotOrder();
    const orderedCommits: string[] = [];
    for (const [outIdx, commit] of commitMap) {
      const slot = slotOrder[outIdx - entryOutputBase];
      // Pinned slots (a sorted-insert P', known exactly) must not be re-derived - the covenant reads the
      // predecessor's input commitment too, which the extraction would otherwise oscillate onto.
      // A native vmap node always contains slot32||next32. Ignore shorter OTC observations: they belong to
      // unrelated empty/default comparisons at the same output index and otherwise oscillate a valid
      // derived target back to the legacy empty commitment.
      const slotCollection = slot === undefined ? undefined
        : stateLayout.collections?.find((c) => c.name === entryAccessAt({ entryAccesses }, slot)?.collection);
      const structurallyValid = slotCollection?.sorted ? commit.length >= 128 : true;
      if (slot !== undefined && structurallyValid && !stb.isEntrySlotPinned(slot)) {
        stb.setEntryRawCommitment(slot, commit); orderedCommits.push(commit);
      }
    }
    commitmentProgress += orderedCommits.length;
    latestEntryCommits = orderedCommits;

    // Cache lowering represents an invariant mapping entry as one conditional flush. The SDK must not
    // manufacture an absent entry merely because it seeded that flush's candidate during a probe: when
    // the dirty arm is not reached, the covenant never pins an entry commitment. Conversely, an existing
    // input still needs its exact preservation output. Settle only after the trace reached this phase;
    // pinned entries have compiler-proven values and deliberately bypass trace derivation.
    const observedSlots = new Set([...commitMap.keys()].map((outIdx) =>
      slotOrder[outIdx - entryOutputBase]));
    const conditionalSlots = new Set(slotOrder.filter((slotIndex): slotIndex is number =>
      slotIndex !== undefined && stb.isEntrySlotConditional(slotIndex)));
    for (const slotIndex of conditionalSlots) {
      // A sorted-batch lane keeps its output: the batch covenant reads that lane's fixed block
      // coordinate for every bounded lane and compares the entry covenant lock it finds there, so
      // deleting an active lane leaves a bare funder where the entry belongs. Which lanes are
      // inactive is already settled by the batch witnesses and the inactive-slot deletion.
      if (observedSlots.has(slotIndex) || stb.isEntrySlotPinned(slotIndex)
        || stb.isEntryOutputSlotRequired(slotIndex)) continue;
      const commitment = stb.getExistingEntryCommitment(slotIndex);
      if (commitment) {
        stb.setEntryRawCommitment(slotIndex, commitment);
        stb.pinEntrySlot(slotIndex);
      } else {
        stb.deleteEntry(slotIndex);
        const collection = entryAccessAt({ entryAccesses }, slotIndex)?.collection;
        // An inactive INSERT has no rewritten predecessor either. The batch probe may have seeded that
        // trailing predecessor solely to reach the conditional flush; once the flush proves absent, remove
        // the seed so it cannot mint a phantom collection entry.
        // This fixed conditional lane owns only its own speculative insert. A kernel route may also
        // publish source-row runtime segments for the same collection; those commitments belong to the
        // shared row journal and must survive an inactive/zero-trip sibling lane.
        // A PINNED family is compiler-authenticated geometry, not a speculative seed: the rewritten
        // vmap-batch predecessors and computed loop entries the route covenant addresses by absolute
        // trailing coordinate exist for the reached rows regardless of which conditional lane was
        // skipped. Clearing them here removes those outputs and shifts every later trailing family
        // (dynamic chunks, value chunks) down by their width.
        if (collection && !stb.isLoopEntryPinned(collection)
          && !stb.hasRuntimeLoopEntrySegments(collection)) {
          stb.setLoopEntryCommitments(collection, []);
        }
      }
    }
  }


  return {
    commitmentProgress,
    derivedAState,
    derivedStateCount,
    stateCommits,
    latestEntryCommits,
    latestEventCommits,
    latestLoopEntryCommits,
  };
}
