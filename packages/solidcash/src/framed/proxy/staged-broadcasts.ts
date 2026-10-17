/**
 * Holding a deployment's transactions until every one of them is built and accepted (audit SDKFRAMED-2).
 *
 * A proxy deployment derives `initialize` against its geneses, so they are signed before anything is known about
 * the initializer; broadcasting them first would leave an uninitialized proxy on chain whenever it is then refused.
 * The overlay lets the pipeline run unchanged: a broadcast through it is held, not relayed, and its reads serve the
 * held transactions on top of the provider's own (their outputs listed, the coins they spend hidden). `release`
 * relays them in the order they were handed in. An overlay that is never released is a probe: what it held is
 * discarded, as a proxy's uninitialized probe genesis is once its initialized genesis is signed.
 *
 * Every other property read is forwarded to the wrapped provider and writes land on it, so the deployment registry
 * (kept on the provider under a symbol) is the wrapped provider's own through the overlay. After `release` the
 * overlay forwards everything, so a handle built on it during the deployment keeps working.
 */

import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { LedgerOutput, PreparedTransaction } from '../../network/NetworkProvider.js';
import { addressToLockScript, libauthTokenDetailsToSolidCashTokenDetails } from '../../utils.js';

interface HeldTransaction {
  readonly txid: string;
  readonly prepared: PreparedTransaction;
  /** Handed in through `sendPreparedTransaction`, which `release` then uses too when the provider has it. */
  readonly viaPrepared: boolean;
}

type HeldOutput = PreparedTransaction['transaction']['outputs'][number];

export interface StagedBroadcasts {
  /** The overlay to run the deployment through. */
  readonly provider: NetworkProvider;
  /** Relays every held transaction to the wrapped provider in order, then forwards everything. */
  readonly release: () => Promise<readonly string[]>;
  /** Relays the first `count` held transactions in order; the rest stay held until `release`. */
  readonly releaseFirst: (count: number) => Promise<readonly string[]>;
}

function outpointKey(txid: string, vout: number): string {
  return `${txid.toLowerCase()}:${vout}`;
}

function ledgerOutputOf(output: HeldOutput): LedgerOutput {
  return {
    lockingBytecode: output.lockingBytecode.slice(), satoshis: output.valueSatoshis,
    ...(output.token === undefined ? {} : { token: libauthTokenDetailsToSolidCashTokenDetails(output.token) }),
  };
}

/** Wraps `provider` so that broadcasts are held until `release`, and reads see the held transactions. */
export function stageBroadcasts(provider: NetworkProvider): StagedBroadcasts {
  const held: HeldTransaction[] = [];
  let released = false;

  const spentByHeld = (): Set<string> => new Set(held.flatMap(({ prepared }) => prepared.transaction.inputs
    .map((input) => outpointKey(binToHex(input.outpointTransactionHash), input.outpointIndex))));
  const hold = (prepared: PreparedTransaction, viaPrepared: boolean): string => {
    const txid = binToHex(hash256(prepared.rawBytes).reverse());
    if (held.some((entry) => entry.txid === txid)) return txid;
    const spent = spentByHeld();
    const conflict = prepared.transaction.inputs.find((input) => spent.has(
      outpointKey(binToHex(input.outpointTransactionHash), input.outpointIndex)));
    if (conflict !== undefined) {
      throw new Error(`transaction ${txid} spends ${binToHex(conflict.outpointTransactionHash)}:`
        + `${conflict.outpointIndex}, which a held transaction already spends`);
    }
    held.push({ txid, prepared, viaPrepared });
    return txid;
  };
  /** The provider's answer without the coins a held transaction spends, then the held outputs `keep` admits. */
  const overlaid = (live: readonly Utxo[], keep: (utxo: Utxo) => boolean): Utxo[] => {
    const spent = spentByHeld();
    const unspentHeld = held.flatMap(({ txid, prepared }) => prepared.transaction.outputs.flatMap((output, vout) => (
      spent.has(outpointKey(txid, vout)) ? [] : [{ txid, vout, ...ledgerOutputOf(output) }])));
    return [...live.filter((utxo) => !spent.has(outpointKey(utxo.txid, utxo.vout))), ...unspentHeld.filter(keep)];
  };
  const atLock = (lock: string): ((utxo: Utxo) => boolean) => (utxo) => binToHex(utxo.lockingBytecode!) === lock;
  const heldNamed = (txid: string): HeldTransaction | undefined => held
    .find((entry) => entry.txid === txid.toLowerCase());

  const overrides = new Map<PropertyKey, unknown>([
    ['getUtxos', async (address: string): Promise<Utxo[]> => overlaid(
      await provider.getUtxos(address), atLock(binToHex(addressToLockScript(address))))],
    ['getUtxosForLockingBytecode', async (lockingBytecode: Uint8Array | string): Promise<Utxo[]> => overlaid(
      await provider.getUtxosForLockingBytecode(lockingBytecode),
      atLock(typeof lockingBytecode === 'string' ? lockingBytecode.toLowerCase() : binToHex(lockingBytecode)))],
    ['getRawTransaction', async (txid: string): Promise<string> => (
      heldNamed(txid)?.prepared.rawHex ?? provider.getRawTransaction(txid))],
    ['sendRawTransaction', async (txHex: string): Promise<string> => {
      const rawBytes = hexToBin(txHex);
      const transaction = decodeTransaction(rawBytes);
      if (typeof transaction === 'string') throw new Error(`a transaction to hold does not decode: ${transaction}`);
      return hold({ rawHex: txHex, rawBytes, transaction: transaction as PreparedTransaction['transaction'] }, false);
    }],
    ['sendPreparedTransaction', async (prepared: PreparedTransaction): Promise<string> => hold(prepared, true)],
  ]);
  // The optional reads are overlaid only where the provider has them, so the overlay claims no capability it lacks.
  const byCategory = provider.getUtxosByTokenCategory;
  if (typeof byCategory === 'function') {
    overrides.set('getUtxosByTokenCategory', async (categoryId: string): Promise<Utxo[]> => {
      const wanted = new Set([categoryId.toLowerCase()]);
      if (/^(?:[0-9a-f]{2})+$/iu.test(categoryId)) wanted.add(binToHex(hexToBin(categoryId).reverse()));
      return overlaid(await byCategory.call(provider, categoryId),
        (utxo) => utxo.token !== undefined && wanted.has(utxo.token.category.toLowerCase()));
    });
  }
  const ledgerOutput = provider.getLedgerOutput;
  if (typeof ledgerOutput === 'function') {
    overrides.set('getLedgerOutput', async (txid: string, vout: number): Promise<LedgerOutput | undefined> => {
      if (spentByHeld().has(outpointKey(txid, vout))) return undefined;
      const entry = heldNamed(txid);
      if (entry === undefined) return ledgerOutput.call(provider, txid, vout);
      const output = entry.prepared.transaction.outputs[vout];
      return output === undefined ? undefined : ledgerOutputOf(output);
    });
  }

  const staged = new Proxy(provider, {
    get(target, property): unknown {
      if (!released && overrides.has(property)) return overrides.get(property);
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  const sendOne = async (entry: HeldTransaction, index: number, sent: readonly string[]): Promise<string> => {
    const { txid, prepared, viaPrepared } = entry;
    let returned: string;
    try {
      returned = viaPrepared && provider.sendPreparedTransaction !== undefined
        ? await provider.sendPreparedTransaction(prepared)
        : await provider.sendRawTransaction(prepared.rawHex);
    } catch (error) {
      throw new Error(`the provider refused held transaction ${index + 1} of ${held.length} (${txid}) after `
        + `broadcasting ${sent.length === 0 ? 'none' : sent.join(', ')}: `
        + `${error instanceof Error ? error.message : String(error)}`);
    }
    if (returned !== txid) {
      throw new Error(`the provider returned txid ${returned} for held transaction ${txid}, not the txid its bytes `
        + 'hash to');
    }
    return txid;
  };

  const releaseFirst = async (count: number): Promise<readonly string[]> => {
    const sent: string[] = [];
    for (let index = 0; index < count && held.length > 0; index += 1) {
      sent.push(await sendOne(held.shift()!, index, sent));
    }
    return sent;
  };

  const release = async (): Promise<readonly string[]> => {
    const sent: string[] = [];
    while (held.length > 0) {
      sent.push(await sendOne(held.shift()!, sent.length, sent));
    }
    released = true;
    return sent;
  };

  return { provider: staged, release, releaseFirst };
}
