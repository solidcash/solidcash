import { isContractUnlocker, type UnlockableUtxo } from '../interfaces.js';
import { isScidIdentityCommitment } from './logical-identity.js';

/** Identity outputs pinned by the selected direct leaf's own immutable-input scan. */
export function sameIndexScidIdentityInputIndices(inputs: readonly UnlockableUtxo[]): Set<number> {
  const indices = new Set<number>();
  for (const [index, anchor] of inputs.entries()) {
    if (anchor.token?.nft?.capability !== 'none'
      || !isScidIdentityCommitment(anchor.token.nft.commitment)) continue;
    const category = anchor.token.category.toLowerCase();
    const owner = inputs.find((input) => input.token?.category.toLowerCase() === category
      && input.token.nft?.capability === 'minting');
    if (!owner?.unlocker || !isContractUnlocker(owner.unlocker)) continue;
    const abi = owner.unlocker.abiFunction;
    const artifact = owner.unlocker.contract.artifact;
    // Framed masters skip this scan, and callers/delegates admit a relocatable sender anchor.
    if (artifact.composition?.convention === 'framed' || artifact.delegateOnly === true
      || 'messageBusConvention' in abi || abi.unsafeTier !== undefined
      || abi.modifiers?.includes('selfdestruct') || abi.modifiers?.includes('delegate')
      || (abi.externalCalls?.length ?? 0) > 0 || (abi.lowLevelCalls?.length ?? 0) > 0
      || (abi.libraryDelegateCalls?.length ?? 0) > 0) continue;
    indices.add(index);
  }
  return indices;
}
