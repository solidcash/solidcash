/**
 * The compute side-car pool a real network needs before a body can hash through keccak256 or recover a signer.
 *
 * A frame co-spends a side-car: a mutable NFT at a covenant's shared lock, which it spends and recreates with the
 * result. A simulator mints stand-ins when a call asks (`framed/call/side-cars.ts`), and a real network holds only what
 * someone deployed, so every entry that hashes refuses until a deployment leaves a pool there. The covenants read no
 * category, so one genesis of any funding coin serves, and the pool is shared by every contract on the network: this
 * tops it up to the size asked for and mints nothing when it is there already.
 */

import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import {
  SHARED_LIBRARY_SALT, ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode,
} from '@solidcash/utils';
import type { Output, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type Signer from '../../Signer.js';
import { TransactionBuilder } from '../../TransactionBuilder.js';
import { SIDE_CAR_SATOSHIS } from '../call/side-cars.js';
import { signerFundingCoins } from './own-coin.js';

/** Raised when a side-car pool cannot be deployed. */
export class FramedSideCarDeployError extends Error {
  public readonly name = 'FramedSideCarDeployError';

  public constructor(message: string) {
    super(message);
  }
}

/** A side-car's covenant splits a result off its commitment, so a new one holds a zero result. */
const EMPTY_RESULT = '00'.repeat(32);

/** A pool of this many serves the entries that hash most, and that many transactions in one block's time. */
export const DEFAULT_KECCAK_SIDE_CARS = 8;

export interface ComputeSideCarPoolOptions {
  readonly provider: NetworkProvider;
  /** Pays for the pool. Its genesis spends one of its coins at an output 0. */
  readonly signer: Pick<Signer, 'provider' | 'getUtxos' | 'unlockP2PKH' | 'getAddress'>;
  /** The keccak256 side-cars the pool should hold; `DEFAULT_KECCAK_SIDE_CARS` by default. */
  readonly keccak?: number;
  /** The recovery side-cars the pool should hold, one per `ecrecover`; none by default. */
  readonly recovery?: number;
}

export interface ComputeSideCarPool {
  /** The transaction that minted the missing side-cars, or undefined when the pool held enough. */
  readonly txid?: string;
  /** How many it minted. */
  readonly minted: number;
}

const mutableCoins = (coins: readonly Utxo[]): readonly Utxo[] => coins
  .filter((coin) => coin.token?.nft?.capability === 'mutable');

/** Tops the network's shared side-car pools up to the sizes asked for, in one genesis. */
export async function deployComputeSideCarPool(options: ComputeSideCarPoolOptions): Promise<ComputeSideCarPool> {
  const { provider, signer } = options;
  const wanted = [
    { lock: keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true), count: options.keccak ?? DEFAULT_KECCAK_SIDE_CARS },
    { lock: ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'V'), count: options.recovery ?? 0 },
  ];
  const missing = await Promise.all(wanted.map(async ({ lock, count }) => (count === 0 ? [] : Array.from(
    { length: Math.max(0, count - mutableCoins(await provider.getUtxosForLockingBytecode(lock)).length) },
    () => lock,
  ))));
  const locks = missing.flat();
  if (locks.length === 0) return { minted: 0 };

  const value = BigInt(locks.length) * SIDE_CAR_SATOSHIS;
  const coin = (await signerFundingCoins(signer)).find((candidate) => candidate.vout === 0
    && candidate.token === undefined && candidate.satoshis >= value + 100_000n);
  if (coin === undefined) {
    throw new FramedSideCarDeployError(
      `${signer.getAddress()} holds no token-free coin at an output 0 of at least ${value + 100_000n} satoshis, which `
      + 'a side-car genesis spends',
    );
  }
  const outputs: Output[] = locks.map((lock) => ({
    to: lock,
    amount: SIDE_CAR_SATOSHIS,
    token: { category: coin.txid, amount: 0n, nft: { capability: 'mutable', commitment: EMPTY_RESULT } },
  }));
  const build = (change: bigint): TransactionBuilder => {
    const builder = new TransactionBuilder({ provider });
    builder.addInput(coin, signer.unlockP2PKH());
    for (const output of outputs) builder.addOutput(output);
    builder.addOutput({ to: signer.getAddress(), amount: change });
    return builder;
  };
  const size = BigInt(encodeTransaction(build(coin.satoshis - value).buildLibauthTransaction()).byteLength);
  const sent = await build(coin.satoshis - value - size).send();
  return { txid: sent.txid, minted: locks.length };
}
