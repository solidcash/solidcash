import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BLOCKHASH_MAX_DEPTH, blockhashOracleLockingBytecode, buildBlockhashSlotCommitment, hash160, type Artifact,
} from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/** Satoshis each blockhash slot holds. */
export const BLOCKHASH_SLOT_AMOUNT = 1_200n;

/** How many recent blocks a reader's ring holds: 1 to 256, or 'now' for the latest block only. */
export type BlockhashDepth = number | 'now';

/** The slot count `depth` names, 256 when it is unset. */
export function blockhashRingDepth(depth: BlockhashDepth | undefined): number {
  if (depth === undefined) return BLOCKHASH_MAX_DEPTH;
  if (depth === 'now') return 1;
  if (typeof depth !== 'number' || !Number.isInteger(depth) || depth < 1 || depth > BLOCKHASH_MAX_DEPTH) {
    throw new Error(`blockhashDepth must be an integer from 1 to ${BLOCKHASH_MAX_DEPTH} or 'now', not ${String(depth)}`);
  }
  return depth;
}

/**
 * The slot count a deployment of a blockhash reader mints: `depth`, else the depth its compiler inferred from its reads
 * (`artifact.blockhashDepth`), else 256. A depth below the inferred one is refused, as those reads would fail.
 */
export function blockhashRingSlotCount(
  artifact: Pick<Artifact, 'contractName' | 'blockhashDepth'>, depth: BlockhashDepth | undefined,
): number {
  const needed = artifact.blockhashDepth;
  if (depth === undefined) return blockhashRingDepth(needed);
  const slots = blockhashRingDepth(depth);
  if (needed !== undefined && slots < needed) {
    throw new Error(`blockhashDepth ${slots} is below the ${needed} slots the blockhash reads of `
      + `${artifact.contractName} need, so those reads would fail`);
  }
  return slots;
}

/**
 * A blockhash reader's ring, minted at its genesis: `blockhashRingSlotCount` mutable NFTs of its category at the
 * category's slot lock. Slot s holds n = s, a zero hash, the owner whose signed updates alone write it, and the depth.
 * The owner is the deployer's choice, else the provider's own block oracle key on a simulator or devnet.
 */
export function blockhashRingGenesisOutputs(
  artifact: Artifact, categoryId: string, provider: NetworkProvider,
  ownerPublicKey: Uint8Array | undefined, depth: BlockhashDepth | undefined,
): Output[] {
  if (artifact.usesBlockhash !== true) {
    if (ownerPublicKey !== undefined || depth !== undefined) {
      throw new Error('blockhashKeeperPublicKey and blockhashDepth need an artifact that reads blockhash');
    }
    return [];
  }
  const slots = blockhashRingSlotCount(artifact, depth);
  const owner = ownerPublicKey ?? provider.blockOracleOwnerPublicKey;
  if (owner === undefined) {
    throw new Error('a contract that reads blockhash needs blockhashKeeperPublicKey, the key that writes its '
      + 'blockhash slots, and this network provides none');
  }
  if (owner.length !== 33 || !secp256k1.validatePublicKey(owner)) {
    throw new Error('blockhashKeeperPublicKey must be a valid compressed public key');
  }
  const to = blockhashOracleLockingBytecode(hexToBin(categoryId));
  const ownerPkh = hash160(owner);
  return Array.from({ length: slots }, (_slot, s) => ({
    to,
    amount: BLOCKHASH_SLOT_AMOUNT,
    token: {
      category: categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(buildBlockhashSlotCommitment(BigInt(s), new Uint8Array(32), ownerPkh, slots)),
      },
    },
  }));
}
