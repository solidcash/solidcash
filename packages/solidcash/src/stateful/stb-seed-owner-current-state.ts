/**
 * phase-boundary extract: STB build-phase extract — seed owner currentState from data NFTs + stateUpdates.
 */

import {
  parsePushdataCommitment,
  type AbiFunction,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { evaluateFixedEffectPredicate } from '../message-bus/message-bus.js';
import type { UnlockableUtxo } from '../interfaces.js';

export interface SeedOwnerCurrentStateHost {
  readonly requiredNftIndices: readonly number[];
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly stateLayout: StateLayout;
  readonly stateUpdates: ReadonlyMap<string, StateValue>;
  /**
   * Set when the handler's own state is frozen by the covenant on this call: its only delegate edges are
   * conditional and every published guard evaluates false for the call's arguments. The requested updates are
   * then unauthorized, so the current commitments are seeded unchanged.
   */
  readonly preserveOwnState?: boolean;
}

/**
 * A delegatecall function skips its own state covenant for the whole body and defers every write to a co-spent
 * delegate, so the compiler freezes the proxy's own data NFTs on every path that did not reach a conditional
 * delegate edge. When the published guard of that edge evaluates false for the call's own arguments, no write
 * is authorized and the spend must re-emit the current commitment rather than the value the caller asked for.
 *
 * Fails closed in every other direction: an edge with no guard, an edge that evaluates true, an unconditional
 * edge, an argument the evaluator cannot resolve, or a non-delegatecall handler all read as "authorized" and
 * leave the caller's request in place.
 */
export function ownStatePreservedOnUntakenConditionalDelegate(
  abiFunction: Pick<AbiFunction, 'lowLevelCalls'>, params: readonly FunctionArgument[],
): boolean {
  const edges = (abiFunction.lowLevelCalls ?? []).filter((call) => call.callMode === 'delegatecall');
  if (edges.length === 0) return false;
  for (const edge of edges) {
    if (edge.occurrence !== 'conditional' || edge.condition === undefined) return false;
    if (evaluateFixedEffectPredicate(edge.condition, params) !== false) return false;
  }
  return true;
}

/**
 * Read owner data-NFT commitments into a mutable state map, then apply explicit stateUpdates unless the
 * covenant has frozen the handler's own state on this call.
 */
export function seedOwnerCurrentState(
  host: SeedOwnerCurrentStateHost,
): Record<string, StateValue> {
  const currentState: Record<string, StateValue> = {};
  for (let i = 0; i < host.requiredNftIndices.length; i++) {
    const nftIdx = host.requiredNftIndices[i];
    const nftUtxo = host.dataNftUtxos[i];
    if (nftUtxo?.token?.nft?.commitment) {
      const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, host.stateLayout, nftIdx);
      for (const [key, value] of Object.entries(parsed)) {
        currentState[key] = value;
      }
    }
  }
  if (host.preserveOwnState !== true) {
    for (const [name, value] of host.stateUpdates) {
      currentState[name] = value;
    }
  }
  return currentState;
}
