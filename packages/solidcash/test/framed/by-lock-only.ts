import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { Utxo } from '../../src/interfaces.js';

/** What a lock-only view counts, and a test holds it to. */
export interface LockListings {
  /** Each locking bytecode or address the view was asked to list, as asked. */
  readonly asked: string[];
}

const strip = ({ lockingBytecode: _lock, ...utxo }: Utxo): Utxo => utxo;

/**
 * `provider` as an Electrum server shows it: coins are listed by lock alone, and a listing does not repeat the lock.
 *
 * The category index is gone rather than guarded, so a reader that would use it finds what a Fulcrum server offers: no
 * such method. Everything else forwards, and writes (a deployment's registrations among them) land on `provider`.
 */
export function byLockOnly<T extends NetworkProvider>(provider: T, listings: LockListings = { asked: [] }): T {
  return new Proxy(provider, {
    has: (target, property) => property !== 'getUtxosByTokenCategory' && Reflect.has(target, property),
    get(target, property): unknown {
      if (property === 'getUtxosByTokenCategory') return undefined;
      if (property === 'getUtxos') {
        return async (address: string): Promise<Utxo[]> => {
          listings.asked.push(address);
          return (await target.getUtxos(address)).map(strip);
        };
      }
      if (property === 'getUtxosForLockingBytecode') {
        return async (lock: Uint8Array | string): Promise<Utxo[]> => {
          listings.asked.push(typeof lock === 'string' ? lock : Buffer.from(lock).toString('hex'));
          return (await target.getUtxosForLockingBytecode(lock)).map(strip);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
