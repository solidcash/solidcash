/**
 * phase-boundary extract: SC class-body extract — stateful dynamic keccak256 side-car loop via VM probe.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { keccakComputeLockingBytecode, type AbiFunction } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../keccak/keccakComputeSidecar.js';

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
export async function resolveStatefulKeccakLoop(
  host: ResolveStatefulKeccakLoopHost,
  abiFunction: AbiFunction,
  masterUtxo: Utxo,
  stateInputUnlocker: Unlocker,
  dataNftUtxos: Utxo[],
  dataNftUnlockers: Unlocker[],
  frontRegionInputs: UnlockableUtxo[] = [],
  locktime = 0,
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
  const lock = keccakComputeLockingBytecode(salt, true);
  const scUtxos = (await host.inner.provider.getUtxosForLockingBytecode(lock))
    .filter((u) => u.token?.nft?.capability === 'mutable');
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const vm = host.createVirtualMachine(host.inner.provider);
  const MAX_ITERS = 64; // budget/standardness cap on runtime keccak side-cars per tx
  const preimages: Uint8Array[] = [];
  for (let k = 1; k <= MAX_ITERS + 1; k++) {
    if (scUtxos.length < k) {
      throw new Error(`stateful dynamic keccak256 loop needs >= ${k} compute side-car UTXOs at the branded `
        + `address; found ${scUtxos.length}. Deploy more mutable-NFT side-cars.`);
    }
    const probe = new CovenantTransactionBuilder({ provider: host.inner.provider });
    if (locktime) probe.setLocktime(locktime);
    probe.addInput(masterUtxo, stateInputUnlocker);
    dataNftUtxos.forEach((u, i) => probe.addInput(u, dataNftUnlockers[i]));
    frontRegionInputs.forEach((u) => probe.addInputs([u])); // unlockable form: u already carries its unlocker
    const recreates: Output[] = [];
    for (let j = 0; j < k; j++) {
      const { unlocker, recreate } = buildKeccakComputeSidecar(
        j < preimages.length ? preimages[j] : new Uint8Array(0), salt, scUtxos[j], true,
      );
      probe.addInput(scUtxos[j], unlocker);
      recreates.push(recreate);
    }
    probe.addOutput({
      to: stateInputUnlocker.generateLockingBytecode(), amount: masterUtxo.satoshis, token: masterUtxo.token,
    });
    dataNftUtxos.forEach((u, i) => probe.addOutput({
      to: dataNftUnlockers[i].generateLockingBytecode(), amount: u.satoshis, token: u.token,
    }));
    frontRegionInputs.forEach((u) => probe.addOutput(host.frontRegionRecreate(u))); // self-preserving recreate
    for (const rec of recreates) probe.addOutput({ ...rec, to: lock });
    const transaction = probe.buildLibauthTransaction();
    const sourceOutputs = host.generateLibauthSourceOutputs(probe.inputs);
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as unknown[];
    const { callIndex, preimage } = extractKeccakPreimageFromTrace(trace, sidecarBase, k);
    if (callIndex === preimages.length) {
      preimages.push(preimage); // the k-th placeholder was read+aborted -> a new iteration
    } else {
      break; // the placeholder was never read -> the loop exited -> N = preimages.length
    }
    if (k > MAX_ITERS) throw new Error(`stateful dynamic keccak256 loop exceeds ${MAX_ITERS} iterations.`);
  }
  const sideCars: UnlockableUtxo[] = [];
  const recreates: Output[] = [];
  for (let j = 0; j < preimages.length; j++) {
    const { unlocker, recreate } = buildKeccakComputeSidecar(preimages[j], salt, scUtxos[j], true);
    sideCars.push({ ...scUtxos[j], unlocker });
    recreates.push(recreate);
  }
  return { sideCars, recreates };
}
