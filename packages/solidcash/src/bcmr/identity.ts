/**
 * The identity output: output 0 of a genesis, which holds the BCMR authority of the categories the genesis creates
 * (CHIP-BCMR, "Zeroth-Descendant Transaction Chains").
 *
 * Whoever spends an identity output moves that authority, so it is never a master: every call spends a master,
 * which would end a published registry and let any caller publish another. Every genesis the SDK builds therefore
 * leads with the authhead contract of the contract's category (authhead.ts), owned by a lock that is no part of the
 * contract's state (docs/bcmr/DESIGN.md, 4.2).
 */

import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { servedTransaction } from '../framed/deploy/own-coin.js';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript, getNetworkPrefix } from '../utils.js';
import {
  authheadLockingBytecode, authheadOutput, identityStatusOf, ownerLockRefusal, type IdentityStatus,
} from './authhead.js';
import { BcmrError } from './publication.js';

/** Who owns a deployment's identity. */
export interface IdentityOptions {
  /** The owner's lock, P2PKH, P2SH20 or P2SH32, as bytecode or a CashAddress; the deployer's lock when omitted. */
  readonly owner?: Uint8Array | string;
}

/** Where an identity output sits, who owns it, and whether it is still active. */
export interface IdentityRecord {
  readonly txid: string;
  readonly vout: 0;
  readonly satoshis: bigint;
  /** The category whose authhead NFT the output holds. */
  readonly category: string;
  readonly status: IdentityStatus;
  readonly lockingBytecode: Uint8Array;
  /** The owner's lock: the NFT's commitment. */
  readonly owner: Uint8Array;
}

/** A lock stated as locking bytecode or as a CashAddress. */
export function lockOf(lock: Uint8Array | string): Uint8Array {
  return typeof lock === 'string' ? addressToLockScript(lock) : lock;
}

/** True when `lockingBytecode` is a P2PKH lock. */
export function isP2pkhLock(lockingBytecode: Uint8Array): boolean {
  return lockingBytecode.length === 25 && lockingBytecode[0] === 0x76 && lockingBytecode[1] === 0xa9
    && lockingBytecode[2] === 0x14 && lockingBytecode[23] === 0x88 && lockingBytecode[24] === 0xac;
}

/** The identity part of a genesis: its output 0, the authhead contract of `category` owned by `owner`. */
export interface GenesisIdentity {
  readonly category: string;
  readonly owner: Uint8Array;
  readonly output: Output;
}

/** Plans a genesis's identity output, owned by `identity.owner` or else `deployerLock`. */
export function planGenesisIdentity(options: {
  readonly category: string;
  readonly identity?: IdentityOptions;
  readonly deployerLock: Uint8Array;
}): GenesisIdentity {
  const category = options.category.toLowerCase();
  const owner = options.identity?.owner === undefined ? options.deployerLock : lockOf(options.identity.owner);
  const refusal = ownerLockRefusal(category, owner);
  if (refusal !== undefined) throw new BcmrError(refusal);
  return { category, owner, output: authheadOutput(category, owner) };
}

/** The record of the identity output a genesis `txid` created. */
export function identityRecord(identity: GenesisIdentity, txid: string): IdentityRecord {
  return {
    txid,
    vout: 0,
    satoshis: identity.output.amount,
    category: identity.category,
    status: 'active',
    lockingBytecode: identity.output.to as Uint8Array,
    owner: identity.owner,
  };
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
}

/**
 * True when the authchain from output 0 of `txid` leads back to the genesis of `category`: each step back is an
 * authhead spend, which spends an output 0 holding the identity NFT at `authhead`, until a transaction spends
 * `category:0`. A look-alike's chain reaches a transaction that does neither, or one the provider does not serve.
 */
async function leadsToGenesis(
  provider: NetworkProvider, category: string, txid: string, authhead: Uint8Array,
): Promise<boolean> {
  const holdsIdentity = (output: Transaction['outputs'][number] | undefined): boolean => output !== undefined
    && equal(output.lockingBytecode, authhead) && output.token !== undefined
    && binToHex(output.token.category) === category && output.token.nft?.capability === 'mutable';
  const seen = new Set<string>();
  let current = txid;
  while (!seen.has(current)) {
    seen.add(current);
    const transaction = await servedTransaction(provider, current);
    if (transaction === undefined || typeof transaction === 'string' || !holdsIdentity(transaction.outputs[0])) {
      return false;
    }
    const spent = transaction.inputs.filter((input) => input.outpointIndex === 0)
      .map((input) => binToHex(input.outpointTransactionHash));
    if (spent.includes(category)) return true;
    let previous: string | undefined;
    for (const candidate of spent) {
      const source = await servedTransaction(provider, candidate);
      if (source !== undefined && typeof source !== 'string' && holdsIdentity(source.outputs[0])) previous = candidate;
    }
    if (previous === undefined) return false;
    current = previous;
  }
  return false;
}

/**
 * The active identity of `category`: the output at its authhead contract that holds the category's identity NFT and
 * whose authchain leads back to the genesis, or undefined when there is none (a frozen or burned identity, a category
 * the SDK did not create, or a chain the provider does not serve). A look-alike at the contract is passed over.
 */
export async function resolveIdentity(provider: NetworkProvider, category: string): Promise<IdentityRecord | undefined> {
  const lower = category.toLowerCase();
  const lockingBytecode = authheadLockingBytecode(lower);
  const address = lockingBytecodeToCashAddress({
    bytecode: lockingBytecode, prefix: getNetworkPrefix(provider.network), tokenSupport: true,
  });
  if (typeof address === 'string') throw new BcmrError(`the authhead of ${lower} has no address: ${address}`);
  const candidates = (await provider.getUtxos(address.address)).filter((utxo) => utxo.vout === 0
    && utxo.token?.category.toLowerCase() === lower && utxo.token.nft?.capability === 'mutable'
    && utxo.token.amount === 0n);
  for (const utxo of candidates) {
    if (!await leadsToGenesis(provider, lower, utxo.txid.toLowerCase(), lockingBytecode)) continue;
    return {
      txid: utxo.txid,
      vout: 0,
      satoshis: utxo.satoshis,
      category: lower,
      status: identityStatusOf(lower, lockingBytecode)!,
      lockingBytecode,
      owner: hexToBin(utxo.token!.nft!.commitment),
    };
  }
  return undefined;
}
