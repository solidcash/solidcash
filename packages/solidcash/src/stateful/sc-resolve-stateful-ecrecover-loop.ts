/**
 * The recovery triples of a stateful function whose recoveries all run in a loop (`ecrecoverTrailingLoop`).
 *
 * The compiled loop reads iteration k's triple at master + blockSize + 3k, after the block, and checks each input's
 * lock against the shared (salt 0) covenant locks: A, then M or B2 or B3 for a native projection, or A, B and the
 * stateful keccak side-car for `ecrecoverEvm`. It binds A's argument blob to its own (hash, v, r, s) and reads the
 * recovered key from B's recreation, and the keccak digest from the keccak side-car's. The number of iterations and
 * each argument blob are learned from the master's own run: each probe lays out the triples learned so far and one
 * placeholder, and the run's read of the placeholder's A names the next argument blob.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3.js';
import {
  buildEcrecoverComputeRedeem, ecrecoverComputeLockingBytecode, ecrecoverComputeResultCommitment,
  keccakComputeLockingBytecode, type AbiFunction,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3, extractEcrecoverArgBlobsFromTrace,
  probeEcrecoverSplit, probeEcrecoverSplit3,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import { computeEcrecoverWitness, type EcrecoverWitness } from '../ecrecover/ecrecoverRecovery.js';
import { buildKeccakComputeSidecar, pushDataBytes } from '../keccak/keccakComputeSidecar.js';
import { computeSideCarStandIn } from './stateful-abi-resolve.js';

/** The most iterations a probe follows; the transaction's size bounds a real loop far below it. */
const MAX_RECOVERY_LOOP_ITERATIONS = 64;

/** One input before the loop's triples, with the output the run reads at its index. */
export type RecoveryLoopFrontInput = { input: UnlockableUtxo; recreate: Output };

export interface ResolveStatefulEcrecoverLoopHost {
  /** The pool the triples come from: the compiled loop checks the shared covenant locks (salt 0). */
  readonly provider: NetworkProvider & {
    getUtxosForLockingBytecode(lockingBytecode: Uint8Array): Promise<Utxo[]>;
    addUtxo?: (addressOrLockingBytecode: string, utxo: Utxo) => Promise<Utxo>;
  };
  /** The provider the master's run is debugged on. */
  readonly vmProvider: NetworkProvider;
  createVirtualMachine(provider: NetworkProvider): { debug(input: unknown): unknown };
  generateLibauthSourceOutputs(inputs: readonly unknown[]): unknown;
  /**
   * A coin for a 2-way recovery's middle input, which no covenant reads, and the output that returns its value at the
   * same index. Undefined when the caller has none.
   */
  takeMiddleCoin(): Promise<RecoveryLoopFrontInput | undefined>;
}

export type ResolveStatefulEcrecoverLoopResult = { sideCars: UnlockableUtxo[]; recreates: Output[] };

const SHARED_SALT = new Uint8Array(32);

/** A coin no network holds, for a probe that runs the master alone: only its lock and token are read. */
const probeCoin = (
  role: number, index: number, lock: Uint8Array, unlocking: Uint8Array, nft = true,
): UnlockableUtxo => ({
  txid: `${'ec'.repeat(27)}${role.toString(16).padStart(2, '0')}${(index + 1).toString(16).padStart(8, '0')}`,
  vout: 0,
  satoshis: 100_000n,
  ...(nft ? { token: { category: 'ec'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } } } : {}),
  unlocker: { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => unlocking },
});

const nftOutput = (lock: Uint8Array, commitment: Uint8Array): Output => ({
  to: lock, amount: 100_000n,
  token: { category: 'ec'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } },
});

/**
 * Lay out every iteration's triple of a recovery loop in a stateful function. `front` holds the inputs between the
 * data NFTs and the end of the block, so the triples start at blockSize; the master is input 0.
 */
export async function resolveStatefulEcrecoverLoop(
  host: ResolveStatefulEcrecoverLoopHost,
  abiFunction: AbiFunction,
  masterUtxo: Utxo,
  stateInputUnlocker: Unlocker,
  dataNftUtxos: readonly Utxo[],
  dataNftUnlockers: readonly Unlocker[],
  front: readonly RecoveryLoopFrontInput[],
  locktime = 0,
): Promise<ResolveStatefulEcrecoverLoopResult> {
  const blockSize = abiFunction.blockLayout?.blockSize ?? 1;
  if (blockSize !== 1 + dataNftUtxos.length + front.length) {
    throw new Error('stateful ecrecover loop: the inputs before the loop do not fill the block, so its recovery '
      + 'triples cannot start at the end of the block');
  }
  const flags = abiFunction.ecrecoverEvmFlags ?? [];
  const evm = flags.length > 0 && flags.every(Boolean);
  if (!evm && flags.some(Boolean)) {
    throw new Error('stateful ecrecover loop: the loop makes both ecrecoverEvm and another recovery; their triples '
      + 'differ, and the SDK lays out one shape per loop');
  }
  const salt = SHARED_SALT;
  const lockA = ecrecoverComputeLockingBytecode(salt, 'A');
  const lockB = ecrecoverComputeLockingBytecode(salt, evm ? 'B' : 'B2');
  const lockM = ecrecoverComputeLockingBytecode(salt, 'M');
  const lockB3 = ecrecoverComputeLockingBytecode(salt, 'B3');
  const lockK = keccakComputeLockingBytecode(salt, true);
  const redeemA = buildEcrecoverComputeRedeem(salt, 'A');
  const empty = new Uint8Array(0);

  // A probe triple: A carries the argument blob (a learned one, or zeros for the next read), B commits the key the
  // blob recovers, and an ecrecoverEvm's keccak side-car carries the uncompressed key and commits its digest. The
  // master's run reads only these; the covenants' own inputs are not run by the probe.
  const probeTriple = (index: number, witness: EcrecoverWitness | undefined): RecoveryLoopFrontInput[] => {
    const argBlob = witness?.argBlob ?? new Uint8Array(97);
    const a = probeCoin(1, index, lockA, Uint8Array.from([
      ...pushDataBytes(empty), ...pushDataBytes(argBlob), ...pushDataBytes(empty), ...pushDataBytes(empty),
      ...pushDataBytes(redeemA),
    ]));
    const q = witness === undefined ? new Uint8Array(34) : ecrecoverComputeResultCommitment(witness.compressedQ);
    const b = probeCoin(2, index, lockB, Uint8Array.from(pushDataBytes(empty)));
    if (evm) {
      const key = witness?.uncompressedPubkey ?? new Uint8Array(64);
      const k = probeCoin(3, index, lockK, Uint8Array.from([
        ...pushDataBytes(empty), ...pushDataBytes(key), ...pushDataBytes(Uint8Array.of(1)),
      ]));
      return [
        { input: a, recreate: nftOutput(lockA, new Uint8Array(32)) },
        { input: b, recreate: nftOutput(lockB, q) },
        { input: k, recreate: nftOutput(lockK, keccak256(key)) },
      ];
    }
    const m = probeCoin(4, index, Uint8Array.of(0x51), Uint8Array.of(0x51), false);
    return [
      { input: a, recreate: nftOutput(lockA, new Uint8Array(32)) },
      { input: m, recreate: { to: Uint8Array.of(0x51), amount: m.satoshis } },
      { input: b, recreate: nftOutput(lockB, q) },
    ];
  };

  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = host.createVirtualMachine(host.vmProvider);
  const witnesses: EcrecoverWitness[] = [];
  for (let round = 0; round <= MAX_RECOVERY_LOOP_ITERATIONS; round++) {
    const probe = new CovenantTransactionBuilder({ provider: host.vmProvider });
    if (locktime > 0) probe.setLocktime(locktime);
    probe.addInput(masterUtxo, stateInputUnlocker);
    dataNftUtxos.forEach((utxo, index) => probe.addInput(utxo, dataNftUnlockers[index]));
    const triples = [...witnesses, undefined].flatMap((witness, index) => probeTriple(index, witness));
    for (const { input } of [...front, ...triples]) probe.addInputs([input]);
    probe.addOutput({
      to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
    });
    dataNftUtxos.forEach((utxo, index) => probe.addOutput({
      to: dataNftUnlockers[index].generateLockingBytecode(), amount: utxo.satoshis, token: utxo.token,
    }));
    for (const { recreate } of [...front, ...triples]) probe.addOutput(recreate);
    const transaction = probe.buildLibauthTransaction();
    const sourceOutputs = host.generateLibauthSourceOutputs(probe.inputs);
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
    const next = witnesses.length;
    const reads = extractEcrecoverArgBlobsFromTrace(trace, new Map([[blockSize + 3 * next, next]]));
    const argBlob = reads.get(next);
    // The run ends, or fails before it, without reading another triple: the loop has made every recovery it makes.
    if (argBlob === undefined) break;
    if (round === MAX_RECOVERY_LOOP_ITERATIONS) {
      throw new Error(`stateful ecrecover loop: more than ${MAX_RECOVERY_LOOP_ITERATIONS} recoveries`);
    }
    witnesses.push(computeEcrecoverWitness(
      argBlob.slice(0, 32), argBlob[32], argBlob.slice(33, 65), argBlob.slice(65, 97),
    ));
  }
  if (witnesses.length === 0) return { sideCars: [], recreates: [] };

  // The shared pool's coins, each taken once. A provider that can mint (a mock) mints the ones it lacks.
  const pools = new Map<string, Utxo[]>();
  const taken = new Map<string, number>();
  const take = async (role: string, lock: Uint8Array): Promise<Utxo> => {
    const key = binToHex(lock);
    let pool = pools.get(key);
    if (pool === undefined) {
      pool = (await host.provider.getUtxosForLockingBytecode(lock))
        .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
      pools.set(key, pool);
    }
    const index = taken.get(key) ?? 0;
    if (index >= pool.length && typeof host.provider.addUtxo === 'function') {
      await host.provider.addUtxo.call(host.provider, key, computeSideCarStandIn('ecrecover-loop-sidecar', lock, index));
      pool = (await host.provider.getUtxosForLockingBytecode(lock))
        .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
      pools.set(key, pool);
    }
    const coin = pool[index];
    if (coin === undefined) {
      throw new Error(`ecrecoverPubKey needs ${witnesses.length} ${role} recovery side-car UTXO(s) in the shared `
        + `pool for its loop; found ${pool.length}. Deploy one recovery set per loop iteration.`);
    }
    taken.set(key, index + 1);
    return coin;
  };

  const sideCars: UnlockableUtxo[] = [];
  const recreates: Output[] = [];
  for (const witness of witnesses) {
    const coinA = await take('A', lockA);
    if (evm) {
      const coinB = await take('B', lockB);
      let chunkA: number;
      try {
        chunkA = probeEcrecoverSplit(witness, salt, coinA, coinB);
      } catch (error) {
        throw new Error(`stateful ecrecover loop: an ecrecoverEvm recovery has no two-input split (${
          (error as Error).message})`);
      }
      const built = buildEcrecoverComputeSidecars(witness, chunkA, salt, coinA, coinB);
      const coinK = await take('keccak', lockK);
      const hashed = buildKeccakComputeSidecar(witness.uncompressedPubkey, salt, coinK, true);
      sideCars.push({ ...coinA, unlocker: built.unlockerA }, { ...coinB, unlocker: built.unlockerB },
        { ...coinK, unlocker: hashed.unlocker });
      recreates.push(built.recreateA, built.recreateB, hashed.recreate);
      continue;
    }
    // Two covenants where the ladder fits them, the middle input a coin no covenant reads; three otherwise. A split's
    // cost depends on the covenants and the witness alone, so the probe needs no B coin of its own.
    let chunkA: number | undefined;
    try {
      chunkA = probeEcrecoverSplit(witness, salt, coinA, coinA);
    } catch {
      chunkA = undefined;
    }
    if (chunkA === undefined) {
      const coinM = await take('M', lockM);
      const coinB3 = await take('B3', lockB3);
      const split = probeEcrecoverSplit3(witness, salt, coinA, coinM, coinB3);
      const built = buildEcrecoverComputeSidecars3(witness, split.chunkA, split.chunkM, salt, coinA, coinM, coinB3);
      sideCars.push({ ...coinA, unlocker: built.unlockerA }, { ...coinM, unlocker: built.unlockerM },
        { ...coinB3, unlocker: built.unlockerB });
      recreates.push(built.recreateA, built.recreateM, built.recreateB);
      continue;
    }
    const coinB = await take('B2', lockB);
    const built = buildEcrecoverComputeSidecars(witness, chunkA, salt, coinA, coinB, undefined, 'B2');
    const middle = await host.takeMiddleCoin();
    if (middle === undefined) {
      throw new Error('stateful ecrecover loop: a two-covenant recovery takes a wallet coin for its middle input, '
        + 'and the call has none; connect a signer with a spare coin');
    }
    sideCars.push({ ...coinA, unlocker: built.unlockerA }, middle.input, { ...coinB, unlocker: built.unlockerB });
    recreates.push(built.recreateA, middle.recreate, built.recreateB);
  }
  return { sideCars, recreates };
}
