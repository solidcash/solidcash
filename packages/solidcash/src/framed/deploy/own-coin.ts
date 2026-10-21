/**
 * Proving a coin before the SDK signs for it (audit SDKFRAMED-1).
 *
 * A genesis takes its category from its funding coin's txid, and a hop binds `msg.sender` to its caller coin's
 * lock. A coin a provider lists at the signer's address but that sits at another lock would hand the category to
 * that lock's owner, so the coin is read from the transaction the provider serves for it, checked against the txid
 * it commits to. An in-process simulator, whose coins need no transaction, answers from its own ledger. Anything
 * else fails closed.
 *
 * Fee and funding pools draw on `withoutIdentityOutputs`, which holds out reserved genesis coins and every vout-0
 * coin its own transaction proves a BCMR identity output (docs/bcmr/DESIGN.md 4.4).
 */

import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import type { TokenDetails, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { LedgerOutput } from '../../network/NetworkProvider.js';
import type Signer from '../../Signer.js';
import { libauthTokenDetailsToSolidCashTokenDetails } from '../../utils.js';
import { identityOutputRefusal } from '../../bcmr/authchain.js';
import { genesisOutpointKey, isReservedGenesisOutpoint } from '../../stateful/genesis-reservations.js';

/**
 * The transaction the provider serves for `txid` (lowercase), checked against it; why the bytes served are not that
 * transaction; or undefined when none is served.
 */
export async function servedTransaction(
  provider: NetworkProvider, txid: string,
): Promise<Transaction | string | undefined> {
  let raw: string | undefined;
  try {
    raw = await provider.getRawTransaction(txid);
  } catch {
    raw = undefined;
  }
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const bytes = hexToBin(raw);
  if (binToHex(hash256(bytes).reverse()) !== txid) return `the bytes served for ${txid} do not hash to it`;
  const transaction = decodeTransaction(bytes);
  return typeof transaction === 'string'
    ? `the transaction served for ${txid} does not decode: ${transaction}` : transaction;
}

/**
 * The output at `txid:vout` as its transaction (or a simulator's ledger) holds it, or why it cannot be proven. A BCMR
 * identity output is refused here, so no role spends one as an ordinary coin.
 */
async function provenOutput(provider: NetworkProvider, txid: string, vout: number): Promise<LedgerOutput | string> {
  const transaction = await servedTransaction(provider, txid);
  if (typeof transaction === 'string') return transaction;
  if (transaction !== undefined) {
    const output = transaction.outputs[vout];
    if (output === undefined) return `transaction ${txid} has no output ${vout}`;
    const identity = vout === 0 ? identityOutputRefusal(transaction, txid) : undefined;
    if (identity !== undefined) return identity;
    return {
      lockingBytecode: output.lockingBytecode,
      satoshis: output.valueSatoshis,
      ...(output.token === undefined ? {} : { token: libauthTokenDetailsToSolidCashTokenDetails(output.token) }),
    };
  }
  if (provider.simulator === true && provider.getLedgerOutput !== undefined) {
    return await provider.getLedgerOutput(txid, vout) ?? `the simulator holds no live output ${txid}:${vout}`;
  }
  return `the provider served no transaction for ${txid}`;
}

function sameToken(left: TokenDetails | undefined, right: TokenDetails | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.category.toLowerCase() === right.category.toLowerCase()
    && BigInt(left.amount) === BigInt(right.amount)
    && left.nft?.capability === right.nft?.capability
    && (left.nft?.commitment ?? '').toLowerCase() === (right.nft?.commitment ?? '').toLowerCase();
}

/**
 * Why `utxo` cannot be signed for as a coin at `lockingBytecode`, or undefined once it is proven there with the
 * value and token the provider listed. A `tokenFree` coin (a genesis's) carries no token at all; `role` names whose
 * lock it must be in the refusal.
 */
export async function ownCoinRefusal(
  provider: NetworkProvider, utxo: Utxo, lockingBytecode: Uint8Array,
  options: { readonly role: string; readonly tokenFree?: boolean },
): Promise<string | undefined> {
  const txid = utxo.txid.toLowerCase();
  const outpoint = `${txid}:${utxo.vout}`;
  const output = await provenOutput(provider, txid, utxo.vout);
  if (typeof output === 'string') return `cannot prove coin ${outpoint} before signing for it: ${output}`;
  if (binToHex(output.lockingBytecode) !== binToHex(lockingBytecode)) {
    return `coin ${outpoint} sits at ${binToHex(output.lockingBytecode)}, not the ${options.role}'s own lock `
      + binToHex(lockingBytecode);
  }
  if (output.satoshis !== BigInt(utxo.satoshis)) {
    return `coin ${outpoint} holds ${output.satoshis} satoshis, not the ${utxo.satoshis} the provider listed`;
  }
  if (options.tokenFree === true && (output.token !== undefined || utxo.token !== undefined)) {
    return `coin ${outpoint} carries a token, so it cannot fund a genesis`;
  }
  if (!sameToken(output.token, utxo.token)) return `coin ${outpoint} carries a token other than the one listed`;
  return undefined;
}

/**
 * Why `utxo` must not pay a fee or fund anything (docs/bcmr/DESIGN.md 4.4), or undefined: it is a reserved genesis
 * outpoint, or a vout-0 coin whose own transaction makes it a BCMR identity output. A coin whose transaction the
 * provider does not serve is judged by the reservation alone.
 */
export async function identityCoinRefusal(provider: NetworkProvider, utxo: Utxo): Promise<string | undefined> {
  const txid = utxo.txid.toLowerCase();
  if (isReservedGenesisOutpoint(genesisOutpointKey(utxo.txid, utxo.vout))) {
    return `coin ${txid}:${utxo.vout} is a reserved genesis outpoint`;
  }
  if (utxo.vout !== 0) return undefined;
  const transaction = await servedTransaction(provider, txid);
  return typeof transaction === 'object' ? identityOutputRefusal(transaction, txid) : undefined;
}

/** `utxos` in their order, less the tokenless coins `identityCoinRefusal` refuses. */
export async function withoutIdentityOutputs(provider: NetworkProvider, utxos: readonly Utxo[]): Promise<Utxo[]> {
  const refusals = await Promise.all(utxos.map((utxo) => (
    utxo.token === undefined ? identityCoinRefusal(provider, utxo) : undefined)));
  return utxos.filter((_utxo, index) => refusals[index] === undefined);
}

/** The signer's coins a fee or funding may draw on: every coin it lists but an identity output or reserved coin. */
export async function signerFundingCoins(signer: Pick<Signer, 'provider' | 'getUtxos'>): Promise<Utxo[]> {
  return withoutIdentityOutputs(signer.provider, await signer.getUtxos());
}
