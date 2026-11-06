/**
 * Seeding a signer's logical CREATE nonce from the chain, for a provider with a remote party behind it.
 *
 * A signer counts its CREATE nonce in its own process, and a logical address is derived from it, so a second process
 * deploying from one account would anchor at the address the first took, which leaves that address ambiguous and the
 * deployment's value spent. A chain keeps every earlier run's anchors, so the free slot is read off it.
 */

import type Signer from '../Signer.js';
import type NetworkProvider from './NetworkProvider.js';

async function logicalAddressOccupied(
  provider: NetworkProvider,
  address: string,
  resolve: (provider: NetworkProvider, address: string) => Promise<unknown>,
): Promise<boolean> {
  try {
    await resolve(provider, address);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ambiguous/.test(message)) return true;
    if (/missing or invalid/.test(message)) return false;
    throw error;
  }
}

/**
 * Advances `signer`'s CREATE nonce to the smallest logical address with no identity anchor.
 *
 * A no-op while the signer holds an active reservation; never lowers the local nonce; probes forward from the local
 * nonce, or from 0 on the first call (`seeded` remembers who had theirs), until it finds a free address.
 */
export async function seedLogicalNonce(
  provider: NetworkProvider, signer: Signer, seeded: WeakSet<Signer>,
): Promise<void> {
  if (signer.transactionNonceReserved) return;
  const local = signer._getTransactionNonceState();
  const firstSeed = !seeded.has(signer);
  seeded.add(signer);
  const { deriveLogicalCreateAddress, resolveLogicalIdentity } = await import('../stateful/logical-identity.js');
  const deployer = signer.getAddress();
  let candidate = firstSeed ? 0n : local;
  while (await logicalAddressOccupied(provider, deriveLogicalCreateAddress(deployer, candidate), resolveLogicalIdentity)) {
    candidate += 1n;
  }
  if (candidate > local) signer._setTransactionNonceState(candidate);
}
