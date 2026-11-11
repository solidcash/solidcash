/**
 * Runs a suite's mock network as a Fulcrum server answers. The category index is gone rather than guarded, so a reader
 * that needs it fails the way it would on Electrum. A listing by lock takes the live set, mempool included, as a
 * server's does; the mock's own holds confirmed coins, and a keeper's transactions wait in its mempool.
 * `vitest.bylock.config.ts` loads this before every framed suite it runs.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

interface LiveEntry {
  readonly outpoint: { readonly txid: string; readonly vout: number };
  readonly satoshis: bigint;
  readonly lockingBytecode: Uint8Array;
  readonly tokenData?: Utxo['token'];
}

const prototype = MockNetworkProvider.prototype as unknown as {
  getUtxosByTokenCategory?: unknown;
  getUtxosForLockingBytecode(lock: Uint8Array | string): Promise<Utxo[]>;
  liveUtxoEntries(): readonly LiveEntry[];
};

delete prototype.getUtxosByTokenCategory;

prototype.getUtxosForLockingBytecode = async function listByLock(lock) {
  const wanted = typeof lock === 'string' ? lock.toLowerCase() : binToHex(lock);
  return this.liveUtxoEntries()
    .filter((entry) => binToHex(entry.lockingBytecode) === wanted)
    .map((entry) => ({
      txid: entry.outpoint.txid,
      vout: entry.outpoint.vout,
      satoshis: entry.satoshis,
      lockingBytecode: hexToBin(wanted),
      ...(entry.tokenData === undefined ? {} : { token: entry.tokenData }),
    }));
};
