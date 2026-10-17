import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  logicalIdentityBandKey, resolveLogicalIdentityByCategory, type ResolvedLogicalIdentity,
} from './logical-identity.js';

type OrdinarySelfContract = {
  categoryId: string;
  _logicalAddress?: string;
  target?: string;
  address?: string;
  inner: { provider: NetworkProvider; lockingBytecode: string };
};

/** Only the selected ordinary ABI can request the existing optional self-identity protocol. */
export function usesOrdinarySelfIdentity(abi: AbiFunction | undefined): boolean {
  return abi !== undefined && !('messageBusConvention' in abi)
    && abi.inputs.some((input) => input.name === '__internal__graphSelfIdentityInput');
}

export async function resolveOrdinarySelfIdentity(
  contract: OrdinarySelfContract, abi: AbiFunction | undefined,
): Promise<ResolvedLogicalIdentity | undefined> {
  if (!usesOrdinarySelfIdentity(abi)) return undefined;
  const identity = await resolveLogicalIdentityByCategory(contract.inner.provider, contract.categoryId,
    [contract._logicalAddress, contract.target, contract.address]);
  if (identity === undefined) return undefined; // Native deployments retain the physical-self sentinel.
  if (identity.categoryId.toLowerCase() !== contract.categoryId.toLowerCase()
    || binToHex(identity.rootLockingBytecode).toLowerCase() !== contract.inner.lockingBytecode.toLowerCase()) {
    throw new Error('Ordinary self identity does not match the selected physical state owner.');
  }
  return identity;
}

/** Incoming physical target proofs do not replace the callee's independently authenticated own-self anchor. */
export async function ensureOrdinarySelfIdentityBand(
  contract: OrdinarySelfContract, abi: AbiFunction | undefined,
  anchors: UnlockableUtxo[], bands: Map<string, number>,
): Promise<number | undefined> {
  const identity = await resolveOrdinarySelfIdentity(contract, abi);
  if (identity === undefined) return undefined;
  const key = logicalIdentityBandKey(identity.logicalAddress);
  const found = anchors.findIndex((anchor) => anchor.txid.toLowerCase() === identity.anchor.txid.toLowerCase()
    && anchor.vout === identity.anchor.vout);
  if (found >= 0) { bands.set(key, found); return found; }
  if (bands.has(key)) throw new Error('Ordinary self identity conflicts with an existing anchor band.');
  const band = anchors.length;
  anchors.push({ ...identity.anchor, unlocker: identity.unlocker });
  bands.set(key, band);
  return band;
}
