/**
 * phase-boundary extract: SC class-body extract — stateful dynamic keccak256 side-car loop via VM probe.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccakComputeLockingBytecode, keccakComputeLockingBytecodeShifted, type AbiFunction } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../keccak/keccakComputeSidecar.js';
import { computeSideCarStandIn } from './stateful-abi-resolve.js';

export interface ResolveStatefulKeccakLoopHost {
  readonly categoryId: string;
  readonly inner: {
    readonly provider: NetworkProvider & {
      getUtxosForLockingBytecode(lockingBytecode: Uint8Array): Promise<Utxo[]>;
    };
  };
  frontRegionRecreate(input: UnlockableUtxo): Output;
  createVirtualMachine(provider: NetworkProvider): { debug(input: unknown): unknown };
  generateLibauthSourceOutputs(inputs: readonly unknown[]): unknown;
}

/**
 * Probe the master covenant with increasing numbers of keccak side-cars until the dynamic loop exits,
 * then return the authenticated side-car unlockables + recreates.
 */
export interface KeccakLoopTrailingPredecessors {
  /** Co-spent mapping-loop inputs (sorted-upsert predecessors) that precede the keccak side-cars. */
  inputs: UnlockableUtxo[];
  /** Their recreated outputs (P' + new chain nodes), in trailing output order. */
  outputs: Output[];
}

export async function resolveStatefulKeccakLoop(
  host: ResolveStatefulKeccakLoopHost,
  abiFunction: AbiFunction,
  masterUtxo: Utxo,
  stateInputUnlocker: Unlocker,
  dataNftUtxos: Utxo[],
  dataNftUnlockers: Unlocker[],
  frontRegionInputs: UnlockableUtxo[] = [],
  locktime = 0,
  trailingPredecessors: KeccakLoopTrailingPredecessors = { inputs: [], outputs: [] },
): Promise<{ sideCars: UnlockableUtxo[]; recreates: Output[] }> {
  const blockSize = abiFunction.blockLayout?.blockSize ?? 1;
  const sidecarBase = abiFunction.blockLayout?.trailingBase
    ?? abiFunction.blockLayout?.slots.find((slot) => slot.kind === 'keccakSideCar')?.offset
    ?? blockSize;
  // The trailing side-cars start at blockSize = 1 + dataNftCount + front-region slots (read-only NFTs then
  // blockhash oracles). Position the front-region inputs + self-preserving recreations so the trailing region
  // lands at the right base even when the contract also reads external state / blockhashes.
  if (sidecarBase !== 1 + dataNftUtxos.length + frontRegionInputs.length) {
    throw new Error('stateful dynamic keccak256 loop: the front-region inputs (external reads / blockhash '
      + 'oracles) do not fill the slots before the trailing side-car region; cannot position the loop.');
  }
  const salt = hexToBin(host.categoryId).slice().reverse();
  // A preceding mapping loop whose input and output widths differ forces the shifted side-car covenant: the
  // recreated side-car output must land past the mapping outputs (delta = outputCount - inputCount).
  const outputDelta = trailingPredecessors.outputs.length - trailingPredecessors.inputs.length;
  const shifted = outputDelta !== 0;
  const lock = shifted ? keccakComputeLockingBytecodeShifted(salt) : keccakComputeLockingBytecode(salt, true);
  let scUtxos = (await host.inner.provider.getUtxosForLockingBytecode(lock))
    .filter((u) => u.token?.nft?.capability === 'mutable');
  // A probe may need to execute a path that aborts before the keccak band (an expired deadline, a failed
  // amount guard). Start with a synthetic placeholder so the trace can prove the loop is never reached; a
  // reached loop still requires the real mutable-NFT side-cars, refused below.
  const syntheticSidecar = (index: number): Utxo => ({
    txid: `${'00'.repeat(28)}${(index + 1).toString(16).padStart(8, '0')}`,
    vout: 0,
    satoshis: 1000n,
    token: {
      category: host.categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: '00' },
    },
  });
  const sidecarAt = (index: number): Utxo => scUtxos[index] ?? syntheticSidecar(index);
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = host.createVirtualMachine(host.inner.provider);
  const MAX_ITERS = 64; // budget/standardness cap on runtime keccak side-cars per tx
  const preimages: Uint8Array[] = [];
  for (let k = 1; k <= MAX_ITERS + 1; k++) {
    const probe = new CovenantTransactionBuilder({ provider: host.inner.provider });
    if (locktime) probe.setLocktime(locktime);
    probe.addInput(masterUtxo, stateInputUnlocker);
    dataNftUtxos.forEach((u, i) => probe.addInput(u, dataNftUnlockers[i]));
    frontRegionInputs.forEach((u) => probe.addInputs([u])); // unlockable form: u already carries its unlocker
    // A mapping loop that precedes the keccak loop in source order consumes its predecessors first; co-spend them
    // ahead of the side-cars so the master's trailing reads land on the keccak side-cars, not the mapping inputs.
    trailingPredecessors.inputs.forEach((u) => probe.addInputs([u]));
    const keccakInputBase = sidecarBase + trailingPredecessors.inputs.length;
    const recreates: Output[] = [];
    for (let j = 0; j < k; j++) {
      const utxo = sidecarAt(j);
      const { unlocker, recreate } = buildKeccakComputeSidecar(
        j < preimages.length ? preimages[j] : new Uint8Array(0), salt, utxo, !shifted, false, outputDelta,
      );
      probe.addInput(utxo, unlocker);
      recreates.push(recreate);
    }
    probe.addOutput({
      to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
    });
    dataNftUtxos.forEach((u, i) => probe.addOutput({
      to: dataNftUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
    }));
    frontRegionInputs.forEach((u) => probe.addOutput(host.frontRegionRecreate(u))); // self-preserving recreate
    trailingPredecessors.outputs.forEach((out) => probe.addOutput(out));
    for (const rec of recreates) probe.addOutput({ ...rec, to: lock });
    const transaction = probe.buildLibauthTransaction();
    const sourceOutputs = host.generateLibauthSourceOutputs(probe.inputs);
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
    let read: ReturnType<typeof extractKeccakPreimageFromTrace>;
    try {
      read = extractKeccakPreimageFromTrace(trace, keccakInputBase, k);
    } catch (error) {
      // With no resolved preimage yet, a trace that reads no side-car means the first iteration never ran:
      // either the loop is empty (N = 0) or the covenant aborted earlier (an expired deadline, a failed amount
      // guard). Both need no side-cars; the final transaction executes the same path and reverts for its own
      // reason. A later probe always has reads from its resolved side-cars.
      if (k === 1 && preimages.length === 0
        && error instanceof Error && /no side-car read found/.test(error.message)) {
        break;
      }
      throw error;
    }
    const { callIndex, preimage } = read;
    if (callIndex === preimages.length) {
      preimages.push(preimage); // the k-th placeholder was read+aborted -> a new iteration
    } else {
      break; // the placeholder was never read -> the loop exited -> N = preimages.length
    }
    if (k > MAX_ITERS) throw new Error(`stateful dynamic keccak256 loop exceeds ${MAX_ITERS} iterations.`);
  }
  const sideCars: UnlockableUtxo[] = [];
  const recreates: Output[] = [];
  // The fixed-slot resolver mints deterministic stand-ins on a provider that supports it (the mock network) and
  // requires explicitly deployed side-cars on a real one. The dynamic loop learned its iteration count only now,
  // so it must provision the same way instead of failing a mock build that the fixed path would have served.
  if (preimages.length > scUtxos.length) {
    const addUtxo = (host.inner.provider as {
      addUtxo?: (addressOrLockingBytecode: string, utxo: Utxo) => Promise<Utxo>;
    }).addUtxo;
    if (typeof addUtxo === 'function') {
      for (let i = scUtxos.length; i < preimages.length; i++) {
        const standIn = computeSideCarStandIn('keccak-sidecar', lock, i);
        await addUtxo.call(host.inner.provider, binToHex(lock), standIn);
      }
      scUtxos = (await host.inner.provider.getUtxosForLockingBytecode(lock))
        .filter((u) => u.token?.nft?.capability === 'mutable');
    }
  }
  if (preimages.length > scUtxos.length) {
    throw new Error(`stateful dynamic keccak256 loop needs >= ${preimages.length} compute side-car UTXOs at `
      + `the branded address; found ${scUtxos.length}. Deploy more mutable-NFT side-cars.`);
  }
  for (let j = 0; j < preimages.length; j++) {
    const { unlocker, recreate } = buildKeccakComputeSidecar(
      preimages[j], salt, scUtxos[j], !shifted, false, outputDelta,
    );
    sideCars.push({ ...scUtxos[j], unlocker });
    recreates.push(recreate);
  }
  return { sideCars, recreates };
}
