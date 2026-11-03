import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  UNSET_BLOCK_ORACLE_FIELDS, blockOracleLockingBytecode, encodeBlockOracleCommitment, hash160, type Artifact,
  type BlockOracleCommitmentFields,
} from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/**
 * A block.* reader's own block-info oracle, minted at its genesis: one mutable NFT of its category at the lock the
 * oracle covenant gives that category, naming the owner whose signed updates alone move its fields. The owner is
 * the deployer's choice, else the provider's own key on a simulator or devnet that keeps its oracles current. Its
 * fields are the provider's current ones where it keeps them, else unset; `fields` states them instead (a created
 * child's are unset, which its creator's replay requires).
 */
export function blockOracleGenesisOutput(
  artifact: Artifact, categoryId: string, provider: NetworkProvider,
  ownerPublicKey: Uint8Array | undefined, amount: bigint, fields?: BlockOracleCommitmentFields,
): Output | undefined {
  if (artifact.usesBlockOracle !== true) return undefined;
  const owner = ownerPublicKey ?? provider.blockOracleOwnerPublicKey;
  if (owner === undefined) {
    throw new Error('a contract that reads block.* needs blockOracleOwnerPublicKey, the key that updates its block '
      + 'oracle, and this network provides none');
  }
  if (owner.length !== 33 || !secp256k1.validatePublicKey(owner)) {
    throw new Error('blockOracleOwnerPublicKey must be a valid compressed public key');
  }
  const commitment = encodeBlockOracleCommitment(
    hash160(owner), fields ?? provider.blockOracleFields?.() ?? UNSET_BLOCK_ORACLE_FIELDS,
  );
  return {
    to: blockOracleLockingBytecode(hexToBin(categoryId)), amount,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } },
  };
}
