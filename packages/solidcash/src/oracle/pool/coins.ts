import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import {
  POOL_FLAG_SLOT, decodePoolBatonCommitment, decodePoolInfoCommitment, decodePoolSlotCommitment, hash160, hash256,
  poolBatonLockingBytecode, poolBatonRedeemScript, poolInfoLockingBytecode, poolInfoRedeemScript,
  poolSlotLockingBytecode, poolSlotRedeemScript, scriptToBytecode,
  type PoolBatonFields, type PoolInfoFields, type PoolSlotFields,
} from '@solidcash/utils';
import type { LibauthOutput, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  calculateDust, createSighashPreimage, publicKeyToP2PKHLockingBytecode, toSigningSerializationType,
} from '../../utils.js';

/** A block a ring slot holds: its height and its hash in display order. */
export interface PoolBlock {
  readonly n: bigint;
  readonly hash: Uint8Array;
}

/** The block fields a pool's info coins publish. */
export type PoolBlockFields = Omit<PoolInfoFields, 'flags' | 'owner'>;

export type PoolCoinKind = 'info' | 'slot' | 'baton';

/** A pool coin as a provider lists it, at its pool lock, with its decoded commitment. */
export interface PoolCoin<F> {
  readonly utxo: Utxo;
  readonly fields: F;
}

/** A pool's locks and redeem scripts. `category` is in display order. */
export interface PoolLocks {
  readonly category: Uint8Array;
  readonly info: Uint8Array;
  readonly slot: Uint8Array;
  readonly baton: Uint8Array;
  readonly infoRedeem: Uint8Array;
  readonly slotRedeem: Uint8Array;
  readonly batonRedeem: Uint8Array;
}

/** A time-type nLockTime is at least this. */
export const LOCKTIME_THRESHOLD = 500_000_000n;

/** SIGHASH_ALL | SIGHASH_UTXOS; the signature byte adds the fork id. */
const SIGHASH = 0x21;

/** Every pool transaction pays the relay minimum. */
const FEE_PER_BYTE = 1n;

/** Non-final, so nLockTime binds and CLTV reads it. */
const SEQUENCE = 0xfffffffe;

const locksByCategory = new Map<string, PoolLocks>();

/** The category as a lowercase 64-character hex string, or a thrown error. */
export function checkPoolCategory(category: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(category)) throw new Error(`oracle pool category ${category} is not 32 bytes of hex`);
  return category.toLowerCase();
}

export function poolLocks(category: string): PoolLocks {
  const key = checkPoolCategory(category);
  let locks = locksByCategory.get(key);
  if (locks === undefined) {
    const id = hexToBin(key);
    locks = {
      category: id,
      info: poolInfoLockingBytecode(id),
      slot: poolSlotLockingBytecode(id),
      baton: poolBatonLockingBytecode(id),
      infoRedeem: poolInfoRedeemScript(id),
      slotRedeem: poolSlotRedeemScript(id),
      batonRedeem: poolBatonRedeemScript(id),
    };
    locksByCategory.set(key, locks);
  }
  return locks;
}

export function publicKeyOf(key: Uint8Array): Uint8Array {
  const pubkey = secp256k1.derivePublicKeyCompressed(key);
  if (typeof pubkey === 'string') throw new Error(`oracle pool key is invalid: ${pubkey}`);
  return pubkey;
}

/** The hash a pool commitment names for `key`. */
export function poolOwnerOf(key: Uint8Array): Uint8Array {
  return hash160(publicKeyOf(key));
}

export function p2pkhLockOf(key: Uint8Array): Uint8Array {
  return publicKeyToP2PKHLockingBytecode(publicKeyOf(key));
}

/**
 * The kind of a pool coin of `category`, by capability and the kind bit of its flags, or undefined for any other
 * coin. A coin listed with a lock other than its kind's is not a pool coin.
 */
export function poolCoinKind(utxo: Utxo, category: string): PoolCoinKind | undefined {
  const { token } = utxo;
  if (token?.nft === undefined || token.amount !== 0n || token.category.toLowerCase() !== category.toLowerCase()) {
    return undefined;
  }
  let kind: PoolCoinKind | undefined;
  if (token.nft.capability === 'minting') kind = 'baton';
  else if (token.nft.capability === 'mutable') {
    kind = ((hexToBin(token.nft.commitment)[0] ?? 0) & POOL_FLAG_SLOT) === 0 ? 'info' : 'slot';
  }
  if (kind === undefined) return undefined;
  const lock = poolLocks(category)[kind];
  if (utxo.lockingBytecode !== undefined && binToHex(utxo.lockingBytecode) !== binToHex(lock)) return undefined;
  return kind;
}

function decodeAs<F>(
  utxo: Utxo, category: string, kind: PoolCoinKind, decode: (commitment: Uint8Array) => F,
): PoolCoin<F> | undefined {
  if (poolCoinKind(utxo, category) !== kind) return undefined;
  try {
    const fields = decode(hexToBin(utxo.token!.nft!.commitment));
    return { utxo: { ...utxo, lockingBytecode: poolLocks(category)[kind] }, fields };
  } catch {
    return undefined;
  }
}

export function poolInfoCoin(utxo: Utxo, category: string): PoolCoin<PoolInfoFields> | undefined {
  return decodeAs(utxo, category, 'info', decodePoolInfoCommitment);
}

export function poolSlotCoin(utxo: Utxo, category: string): PoolCoin<PoolSlotFields> | undefined {
  return decodeAs(utxo, category, 'slot', decodePoolSlotCommitment);
}

export function poolBatonCoin(utxo: Utxo, category: string): PoolCoin<PoolBatonFields> | undefined {
  return decodeAs(utxo, category, 'baton', decodePoolBatonCommitment);
}

/** An NFT output of the pool at `lockingBytecode`. */
export function poolOutput(
  lockingBytecode: Uint8Array, valueSatoshis: bigint, category: string, capability: 'mutable' | 'minting',
  commitment: Uint8Array,
): LibauthOutput {
  return {
    lockingBytecode, valueSatoshis, token: { amount: 0n, category: hexToBin(category), nft: { capability, commitment } },
  };
}

function libauthOutput(utxo: Utxo, lockingBytecode: Uint8Array): LibauthOutput {
  const { token } = utxo;
  return {
    lockingBytecode,
    valueSatoshis: utxo.satoshis,
    ...(token === undefined ? {} : {
      token: {
        amount: token.amount,
        category: hexToBin(token.category),
        ...(token.nft === undefined ? {} : {
          nft: { capability: token.nft.capability, commitment: hexToBin(token.nft.commitment) },
        }),
      },
    }),
  };
}

/** `key` signs over `coveredBytecode`, the redeem script of a p2sh32 coin or the lock of a P2PKH one. */
export type PoolSigner = (key: Uint8Array, coveredBytecode: Uint8Array) => Uint8Array;

export interface PoolSpend {
  readonly utxo: Utxo;
  readonly lockingBytecode: Uint8Array;
  readonly unlock: (sign: PoolSigner) => Uint8Array;
}

export function p2pkhSpend(utxo: Utxo, key: Uint8Array): PoolSpend {
  const pubkey = publicKeyOf(key);
  const lockingBytecode = publicKeyToP2PKHLockingBytecode(pubkey);
  return { utxo, lockingBytecode, unlock: (sign) => scriptToBytecode([sign(key, lockingBytecode), pubkey]) };
}

export interface AssembledPoolTransaction {
  readonly hex: string;
  readonly txid: string;
  readonly transaction: Transaction;
}

/**
 * A signed version-2 transaction: `spends` in order, then `outputs`, then a change output at `change` that takes
 * what is left after a fee of 1 satoshi per byte. Pool coins recreate at their own index, so each one's output sits
 * at its input's index.
 */
export function assemblePoolTransaction(
  spends: readonly PoolSpend[], outputs: readonly LibauthOutput[], locktime: number, change: Uint8Array,
): AssembledPoolTransaction {
  const sourceOutputs = spends.map((spend) => libauthOutput(spend.utxo, spend.lockingBytecode));
  const spare = sourceOutputs.reduce((sum, output) => sum + output.valueSatoshis, 0n)
    - outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  // Schnorr signatures have one size, so the change value alone differs between the two passes.
  const build = (changeSatoshis: bigint): { transaction: Transaction; encoded: Uint8Array } => {
    const transaction: Transaction = {
      version: 2,
      locktime,
      inputs: spends.map(({ utxo }) => ({
        outpointIndex: utxo.vout,
        outpointTransactionHash: hexToBin(utxo.txid),
        sequenceNumber: SEQUENCE,
        unlockingBytecode: new Uint8Array(),
      })),
      outputs: [...outputs, { lockingBytecode: change, valueSatoshis: changeSatoshis }],
    };
    spends.forEach((spend, inputIndex) => {
      const sign: PoolSigner = (key, coveredBytecode) => {
        const digest = hash256(createSighashPreimage(transaction, sourceOutputs, inputIndex, coveredBytecode, SIGHASH));
        const signature = secp256k1.signMessageHashSchnorr(key, digest);
        if (typeof signature === 'string') throw new Error(`oracle pool signature failed: ${signature}`);
        return Uint8Array.from([...signature, toSigningSerializationType(SIGHASH)]);
      };
      transaction.inputs[inputIndex]!.unlockingBytecode = spend.unlock(sign);
    });
    return { transaction, encoded: encodeTransaction(transaction) };
  };
  const dust = BigInt(calculateDust({ to: change, amount: 0n }));
  const changeSatoshis = spare < dust ? spare : spare - BigInt(build(spare).encoded.length) * FEE_PER_BYTE;
  if (changeSatoshis < dust) {
    throw new Error(`the oracle pool transaction's inputs leave ${changeSatoshis} satoshis after its fee, below dust`);
  }
  const { transaction, encoded } = build(changeSatoshis);
  return { hex: binToHex(encoded), txid: binToHex(hash256(encoded).reverse()), transaction };
}

/** Output `vout` of an assembled transaction as a coin to spend next. */
export function assembledUtxo(assembled: AssembledPoolTransaction, vout: number): Utxo {
  const output = assembled.transaction.outputs[vout];
  if (output === undefined) throw new Error(`the oracle pool transaction has no output ${vout}`);
  const { token } = output;
  return {
    txid: assembled.txid,
    vout,
    satoshis: output.valueSatoshis,
    lockingBytecode: output.lockingBytecode,
    ...(token === undefined ? {} : {
      token: {
        amount: token.amount,
        category: binToHex(token.category),
        ...(token.nft === undefined ? {} : {
          nft: { capability: token.nft.capability, commitment: binToHex(token.nft.commitment) },
        }),
      },
    }),
  };
}

/** The largest token-free coin at `key`'s P2PKH, which pays a pool transaction and takes its change. */
export async function purseCoin(provider: NetworkProvider, key: Uint8Array): Promise<Utxo> {
  const lock = p2pkhLockOf(key);
  const [coin] = (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis < right.satoshis ? 1 : left.satoshis > right.satoshis ? -1 : 0));
  if (coin === undefined) throw new Error(`no token-free coin at the P2PKH ${binToHex(lock)} pays the oracle pool's fee`);
  return { ...coin, lockingBytecode: lock };
}
