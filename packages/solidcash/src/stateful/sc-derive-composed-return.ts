/**
 * phase-boundary extract: SC staticCall read of a function whose calls reach one owner more than once.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import Signer from '../Signer.js';
import type { StatefulContract } from './StatefulContract.js';

/** Caller of a read with no connected signer. The composition is built for its VM result and never sent. */
const READ_ONLY_CALLER_KEY = new Uint8Array(32).fill(1);

type RegisteredOwner = {
  categoryId?: string;
  inner?: { lockingBytecode?: string };
  proxy?: RegisteredOwner;
};

const ownerKey = (owner: { categoryId: string; inner: { lockingBytecode: string } }): string => (
  `${owner.categoryId.toLowerCase()}:${owner.inner.lockingBytecode.toLowerCase()}`
);

/**
 * Return blob of `functionName`, read through the atomic composition its send would use; undefined when the
 * ordinary return probe serves the read.
 *
 * The probe builder lets only a participant's first callsite own its input, so a later callsite on the same owner
 * (another method, or other arguments) presents the first one's selector and arguments to the caller's check and
 * the probe fails there. A send of the same function is promoted to the atomic composer for exactly this reason
 * (two edges to one owner). The read builds that composition without broadcasting it and returns the root
 * invocation's result, which the composer derives from the root's own covenant like every other return.
 */
export async function deriveComposedReturnBlob(
  contract: StatefulContract<Artifact>,
  signer: Signer | undefined,
  functionName: string,
  args: readonly FunctionArgument[],
  abiFunction: AbiFunction,
): Promise<Uint8Array | undefined> {
  const artifact = contract.inner.artifact;
  const edges = abiFunction.externalCalls ?? [];
  const selector = abiFunction.selector;
  // A framed contract reads through its own call handle; this composer does not compose framed masters.
  if (artifact.composition?.convention === 'framed' || edges.length < 2 || selector === undefined
    || artifact.messageBus?.handlers.some((handler) =>
      handler.selector.toLowerCase() === selector.toLowerCase() && handler.eligible) !== true) {
    return undefined;
  }
  const registry = (contract as unknown as { _externalRegistry: ReadonlyMap<string, unknown> })._externalRegistry;
  const registeredOwners = new Set<string>();
  const repeatsOwner = edges.some((edge) => {
    // A loop's occurrences are resolved one by one by the probe itself (`resolveLoopReturnCommitment`).
    if (edge.occurrence === 'loop') return false;
    const registered = registry.get(edge.interfaceName) as RegisteredOwner | undefined;
    const owner = registered?.proxy ?? registered;
    if (owner?.categoryId === undefined || owner.inner?.lockingBytecode === undefined) return false;
    const key = ownerKey(owner as { categoryId: string; inner: { lockingBytecode: string } });
    if (registeredOwners.has(key)) return true;
    registeredOwners.add(key);
    return false;
  });
  if (!repeatsOwner) return undefined;

  const caller = signer ?? new Signer(READ_ONLY_CALLER_KEY, contract.inner.provider);
  const stateCache = new Map<StatefulContract, Promise<Record<string, unknown>>>();
  const stateOf = (participant: StatefulContract): Promise<Record<string, unknown>> => {
    let pending = stateCache.get(participant);
    if (!pending) {
      pending = participant.getState() as Promise<Record<string, unknown>>;
      stateCache.set(participant, pending);
    }
    return pending;
  };
  const { discoverInitialCallTopology } = await import('../message-bus/compose-result-topology.js');
  const { calls } = await discoverInitialCallTopology({
    contract,
    functionName,
    selector,
    args: Object.freeze([...args]),
    producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
  }, caller.getLockingBytecode(), stateOf);
  // The registry only suggested the repeat; the discovered graph names the owners the source actually reaches.
  const ownerCounts = new Map<string, number>();
  for (const call of calls) {
    const key = ownerKey(call.contract);
    ownerCounts.set(key, (ownerCounts.get(key) ?? 0) + 1);
  }
  if (![...ownerCounts.values()].some((count) => count > 1)) return undefined;
  const { composeDiscoveredGraph } = await import('../message-bus/compose.js');
  const { composedInvocationResults } = await import('../message-bus/compose-invocation-results.js');
  const builder = await composeDiscoveredGraph({
    preparedCalls: calls,
    funder: { txid: '00'.repeat(32), vout: 0, satoshis: 100_000_000n, unlocker: caller.unlockP2PKH() },
    changeAddress: caller.getAddress(),
  }).build();
  const rootResult = composedInvocationResults(builder)?.[0];
  if (rootResult === undefined) {
    throw new Error(`staticCall: the composed read of '${functionName}' published no result for its root call`);
  }
  return hexToBin(rootResult);
}
