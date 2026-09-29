/**
 * The compute side-cars a user-entered frame co-spends.
 *
 * An entry that hashes through keccak256 or recovers a signer reads one side-car per call right after its own
 * input: each recovery's A/B pair, one keccak side-car per EVM projection, then one per keccak256 call. A side-car
 * is a UTXO at its covenant's shared lock, so a call spends live ones. A provider that can mint them (the mock
 * network) is provisioned with deterministic stand-ins; a real network needs the pool deployed, and a pool that is
 * short is refused by name. A value the body computes is left to the derivation, which learns it from the body's
 * own bind (`CompositionDraftPlan.computedWitnesses`).
 */

import { binToHex } from '@bitauth/libauth';
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

/** Raised when the network holds fewer side-car UTXOs than an entry co-spends. */
export class PerCallSideCarPoolError extends Error {
  public readonly name = 'PerCallSideCarPoolError';

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
  readonly abiFunction: KeccakAbiFunction & RecoveryAbiFunction;
  /** The frame's argument pushes, in wire order. */
  readonly argumentPushes: readonly Uint8Array[];
  /** The pushes before the arguments: one when the call data leads with a dispatcher's selector. */
  readonly leadingPushes: number;
}

/** The side-cars one frame co-spends, over live UTXOs, in the order its body reads them. */
export async function entrySideCars(options: EntrySideCarOptions): Promise<RecoverySideCars> {
  const { provider, master, abiFunction, argumentPushes, leadingPushes } = options;
  const calls = recoveryCallsOf(abiFunction, argumentPushes, leadingPushes);
  const preimages = keccakPreimagesOf(abiFunction, argumentPushes, leadingPushes);
  const salt = SHARED_LIBRARY_SALT;
  const projections = calls.filter((call) => call.evm).length;
  // The EVM projections' side-cars and the keccak256 calls' side-cars share the stateful keccak covenant's lock.
  const [a, b, keccak] = await Promise.all([
    livePool(provider, ecrecoverComputeLockingBytecode(salt, 'A'), calls.length, 'recovery side-car A'),
    livePool(provider, ecrecoverComputeLockingBytecode(salt, 'B'), calls.length, 'recovery side-car B'),
    livePool(provider, keccakComputeLockingBytecode(salt, true), projections + preimages.length, 'keccak256 side-car'),
  ]);
  const recovery = buildRecoverySideCars(master, calls, salt, { a, b, k: keccak.slice(0, projections) });
  const hashing = buildKeccakSideCars(master, preimages, salt, keccak.slice(projections));
  return {
    ids: [...recovery.ids, ...hashing.ids],
    inputs: { ...recovery.inputs, ...hashing.inputs },
    computedWitnesses: [...recovery.computedWitnesses, ...hashing.computedWitnesses],
    utxos: { ...recovery.utxos, ...hashing.utxos },
  };
}

/** The first `count` mutable UTXOs at a side-car covenant's lock, minting stand-ins on a provider that can. */
async function livePool(
  provider: NetworkProvider,
  lock: Uint8Array,
  count: number,
  name: string,
): Promise<readonly Utxo[]> {
  if (count === 0) return [];
  const mutable = async (): Promise<Utxo[]> => (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
  let utxos = await mutable();
  const addUtxo = (provider as { addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo> }).addUtxo;
  if (utxos.length < count && typeof addUtxo === 'function') {
    for (let index = utxos.length; index < count; index += 1) {
      const standIn = computeSideCarStandIn(`per-call ${name}`, lock, index);
      if (!hasOutpoint(utxos, standIn)) await addUtxo.call(provider, binToHex(lock), standIn);
    }
    utxos = await mutable();
  }
  if (utxos.length < count) {
    throw new PerCallSideCarPoolError(
      `the entry co-spends ${count} ${name}(s) at the shared covenant lock, and the network holds ${utxos.length}`,
    );
  }
  return utxos.slice(0, count);
}
