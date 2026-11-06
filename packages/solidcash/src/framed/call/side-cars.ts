/**
 * The compute side-cars a user-entered frame co-spends.
 *
 * An entry that hashes through keccak256 or recovers a signer reads one side-car per call right after its own
 * input: each recovery's own, one keccak side-car per EVM projection, then one per keccak256 call. A side-car
 * is a UTXO at its covenant's shared lock, so a call spends live ones. A provider that can mint them (the mock
 * network) is provisioned with deterministic stand-ins; a real network needs the pool deployed, and a pool that is
 * short is refused by name. A value the body computes is left to the derivation, which learns it from the body's
 * own bind (`CompositionDraftPlan.computedWitnesses`).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { SHARED_LIBRARY_SALT, ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { computeSideCarStandIn, hasOutpoint } from '../../stateful/stateful-abi-resolve.js';
import {
  buildKeccakSideCars,
  buildRecoverySideCars,
  keccakPreimagesOf,
  recoveryCallsOf,
  type KeccakAbiFunction,
  type RecoveryAbiFunction,
  type RecoverySideCars,
} from '../composer/index.js';
import { FramedLoopTurnsError } from './loop-turns.js';

/**
 * What each side-car holds. The covenant recreates it at this value, with up to three 32-byte results: it has to clear
 * the dust a 96-byte commitment's output pays, and it stays a side-car's, spent by no one.
 */
export const SIDE_CAR_SATOSHIS = 2_000n;

/** Raised when the network holds fewer side-car UTXOs than an entry co-spends. */
export class FramedSideCarPoolError extends Error {
  public readonly name = 'FramedSideCarPoolError';

  public constructor(message: string) {
    super(message);
  }
}

/** What one frame's side-cars are planned from. */
export interface EntrySideCarOptions {
  readonly provider: NetworkProvider;
  /** The master the side-cars follow, which namespaces their ids. */
  readonly master: string;
  /** The entry's ABI row, which publishes the parameter each keccak256 and recovery call reads. */
  readonly abiFunction: KeccakAbiFunction & RecoveryAbiFunction & {
    readonly name?: string;
    readonly keccakInLoop?: boolean;
  };
  /** The frame's argument pushes, in wire order. */
  readonly argumentPushes: readonly Uint8Array[];
  /** The pushes before the arguments: one when the call data leads with a dispatcher's selector. */
  readonly leadingPushes: number;
  /**
   * How many keccak256 side-cars the body reads, for a body that hashes in a loop (`entryLoopTurns`): one per call
   * its execution makes, each preimage left to the body, which binds them in the order it makes the calls.
   */
  readonly hashes?: number;
  /**
   * The keccak256 calls' jobs as a settled plan of the same frame found them (`keccakJobsToShare`): a job the call's
   * side-car states, or `null` for a call whose job another side-car holds, which then takes none. Absent for a frame
   * planned with one side-car per call.
   */
  readonly jobs?: readonly (Uint8Array | null)[];
  /**
   * The outpoints other frames of the same transaction already spend, as `txid:vout`: a side-car is a UTXO at a
   * shared covenant lock, and one transaction spends each UTXO once, so this frame's side-cars are taken past them.
   */
  readonly taken?: ReadonlySet<string>;
}

/** The side-cars one frame co-spends, over live UTXOs, in the order its body reads them. */
export async function entrySideCars(options: EntrySideCarOptions): Promise<RecoverySideCars> {
  const { provider, master, abiFunction, argumentPushes, leadingPushes } = options;
  // A loop's hashes are as many as its turns, which only the frame's own planner counts.
  if (options.hashes === undefined && abiFunction.keccakInLoop === true) {
    throw new FramedLoopTurnsError(
      `entry "${abiFunction.name ?? master}" hashes inside a loop, and its frame here is laid without the turns `
      + 'that count its side-cars',
    );
  }
  const calls = recoveryCallsOf(abiFunction, argumentPushes, leadingPushes);
  const planned = options.hashes === undefined
    ? keccakPreimagesOf(abiFunction, argumentPushes, leadingPushes)
    : Array.from({ length: options.hashes }, (): Uint8Array | undefined => undefined);
  // A call another side-car serves takes none, and a call whose job is known is built over it.
  const preimages = options.jobs === undefined ? planned : planned.flatMap((preimage, call) => {
    const job = options.jobs![call];
    return job === null ? [] : [job ?? preimage];
  });
  const salt = SHARED_LIBRARY_SALT;
  const projections = calls.filter((call) => call.evm).length;
  // The EVM projections' side-cars and the keccak256 calls' side-cars share the stateful keccak covenant's lock.
  const taken = options.taken ?? new Set<string>();
  const [v, keccak] = await Promise.all([
    livePool(provider, ecrecoverComputeLockingBytecode(salt, 'V'), calls.length, 'recovery side-car', taken),
    livePool(
      provider, keccakComputeLockingBytecode(salt, true), projections + preimages.length, 'keccak256 side-car', taken,
    ),
  ]);
  const recovery = buildRecoverySideCars(master, calls, salt, { v, k: keccak.slice(0, projections) });
  const hashing = buildKeccakSideCars(master, preimages, salt, keccak.slice(projections));
  return {
    ids: [...recovery.ids, ...hashing.ids],
    inputs: { ...recovery.inputs, ...hashing.inputs },
    computedWitnesses: [...recovery.computedWitnesses, ...hashing.computedWitnesses],
    utxos: { ...recovery.utxos, ...hashing.utxos },
  };
}

/**
 * The first `count` mutable UTXOs at a side-car covenant's lock that no other frame of the transaction spends
 * (`taken`), minting stand-ins on a provider that can.
 */
async function livePool(
  provider: NetworkProvider,
  lock: Uint8Array,
  count: number,
  name: string,
  taken: ReadonlySet<string> = new Set(),
): Promise<readonly Utxo[]> {
  if (count === 0) return [];
  // The lock is public, so anyone can pay a token to it. A coin whose commitment holds no result is no side-car and
  // would abort the covenant that splits one off it, and one worth too little could not take the results it recreates
  // with past the dust limit.
  const mutable = async (): Promise<Utxo[]> => (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => utxo.token?.nft?.capability === 'mutable' && utxo.token.nft.commitment.length >= 64
      && utxo.satoshis >= SIDE_CAR_SATOSHIS && !taken.has(`${utxo.txid}:${utxo.vout}`));
  let utxos = await mutable();
  const addUtxo = (provider as { addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo> }).addUtxo;
  if (utxos.length < count && typeof addUtxo === 'function') {
    const present = await provider.getUtxosForLockingBytecode(lock);
    // Stand-ins are numbered from the first, so one another frame takes is passed over for the next. A chain that
    // keeps its history (a devnet node) refuses to mint an outpoint again once a transaction spent it, where the mock
    // overwrites it; the next number is a fresh stand-in.
    let free = utxos.length;
    let spent = 0;
    for (let index = 0; free < count && index < count + taken.size + present.length + spent; index += 1) {
      const standIn = computeSideCarStandIn(`framed ${name}`, lock, index);
      if (taken.has(`${standIn.txid}:${standIn.vout}`) || hasOutpoint(present, standIn)) continue;
      try {
        await addUtxo.call(provider, binToHex(lock), standIn);
      } catch (error) {
        if (!/already exists/.test(error instanceof Error ? error.message : String(error))) throw error;
        spent += 1;
        continue;
      }
      free += 1;
    }
    utxos = await mutable();
  }
  if (utxos.length < count) {
    throw new FramedSideCarPoolError(
      `the entry co-spends ${count} ${name}(s) at the shared covenant lock, and the network holds ${utxos.length}`,
    );
  }
  return utxos.slice(0, count);
}
