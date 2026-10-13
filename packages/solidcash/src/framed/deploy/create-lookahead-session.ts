/**
 * Process-local registry of create look-aheads.
 *
 * A create address is `addrV(category)`, and a category is the txid of the genesis-eligible UTXO the create will
 * spend, so an address can only be answered while that UTXO is reserved. A caller that has only a signer or an
 * address needs to reach the same reservation, so a look-ahead is registered under the funding account's lock-script
 * hex: a signer and the account's cashaddr name the same entry. The registry is process-local and its reservations
 * are dropped when the mock chain is reset.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type Signer from '../../Signer.js';
import { onMockNetworkProviderReset } from '../../network/MockNetworkProvider.js';
import { addressToLockScript } from '../../utils.js';
import { genesisOutpointKey, releaseGenesisOutpoint } from '../../stateful/genesis-reservations.js';
import { CreateAddressError, CreateLookahead } from './create-lookahead.js';

interface CreateSession {
  readonly lookahead: CreateLookahead;
  /** The reserved UTXOs (indexed by nonce - base) a deployment has already taken. */
  readonly consumed: Set<number>;
}

const sessions = new Map<string, CreateSession>();

/** The session key of a funding account: its lock-script hex, which both a signer and its address produce. */
function keyForLockScript(bytecode: Uint8Array): string {
  return binToHex(bytecode);
}

/** The session key a cashaddr or a lock-script hex names, or undefined when the string names neither. */
function keyForAddress(address: string): string | undefined {
  const bare = /^0x/i.test(address) ? address.slice(2) : address;
  if (/^[0-9a-f]+$/i.test(bare) && bare.length % 2 === 0) return bare.toLowerCase();
  try {
    return keyForLockScript(addressToLockScript(address));
  } catch {
    return undefined;
  }
}

/**
 * The look-ahead for `signer`'s account, opening one when the account has none. A second call for the same account
 * returns the look-ahead already open, so the same reservation answers both.
 */
export function openCreateLookahead(signer: Signer, artifact?: Artifact): CreateLookahead {
  const key = keyForLockScript(signer.getLockingBytecode());
  const existing = sessions.get(key);
  if (existing !== undefined) return existing.lookahead;
  const lookahead = CreateLookahead.open({ signer, ...(artifact === undefined ? {} : { artifact }) });
  sessions.set(key, { lookahead, consumed: new Set() });
  return lookahead;
}

/** The look-ahead for an account named by a cashaddr or a lock-script hex, when one is open. */
export function createLookaheadForAddress(address: string): CreateLookahead | undefined {
  const key = keyForAddress(address);
  return key === undefined ? undefined : sessions.get(key)?.lookahead;
}

/**
 * Reserves up to `wanted` genesis-eligible UTXOs for `signer`'s account. Best-effort: a pool that holds fewer coins
 * than are wanted leaves what it has reserved and returns, so a caller that only predicts addresses is never
 * interrupted by a short pool.
 */
export async function topUpCreateLookahead(signer: Signer, wanted: number): Promise<void> {
  const lookahead = openCreateLookahead(signer);
  try {
    await lookahead.reserve(wanted, { fanOut: false });
  } catch {
    // The look-ahead keeps whatever it reserved before the pool ran out; the caller is told when it predicts past it.
  }
}

/**
 * The create address for account `from` at `nonce`: `addrV` of the i-th reserved UTXO's category. Throws
 * {@link CreateAddressError} when the account has no reserved creates.
 */
export function predictCreateAddress(from: string, nonce: number | bigint): Uint8Array {
  const key = keyForAddress(from);
  const session = key === undefined ? undefined : sessions.get(key);
  if (session === undefined) {
    throw new CreateAddressError(
      `No creates are reserved for ${from}, so no create address can be predicted. Reserve the genesis-eligible `
      + 'UTXOs first (read the funding account\'s nonce with getNonce()). See '
      + 'packages/solidc/docs/contract-creation.md.',
    );
  }
  return session.lookahead.getCreateAddress(nonce);
}

/**
 * The genesis funding UTXO reserved for `signer`'s current nonce, marked taken so a second call cannot hand out the
 * same coin. The outpoint's genesis reservation is released, because the coin is about to be spent and no longer
 * holds selection. Returns undefined when no session covers the nonce.
 */
export function takeReservedGenesisFunding(signer: Signer): Utxo | undefined {
  const session = sessions.get(keyForLockScript(signer.getLockingBytecode()));
  if (session === undefined) return undefined;
  const { lookahead, consumed } = session;
  if (lookahead.getReservedCount() === 0) return undefined;
  const nonce = signer._getTransactionNonceState();
  const index = Number(nonce) - lookahead.getBaseNonce();
  if (!Number.isInteger(index) || index < 0 || index >= lookahead.getReservedCount()) return undefined;
  if (consumed.has(index)) return undefined;
  consumed.add(index);
  const utxo = lookahead.getFundingUtxo(nonce);
  releaseGenesisOutpoint(genesisOutpointKey(utxo.txid, utxo.vout));
  return utxo;
}

// A reservation names a coin's outpoint, so it is only meaningful for the chain it was made against: once the mock
// chain is rewound or wiped, the sessions describe coins a different chain's, and keeping them would answer with an
// address no deployment can land at.
onMockNetworkProviderReset(() => {
  sessions.clear();
});
