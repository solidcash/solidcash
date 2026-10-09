/**
 * phase-boundary extract: SC class-body extract — resolve ecrecover A/B compute side-car co-spends.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { ecrecoverComputeLockingBytecode, type AbiFunction } from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  buildEcrecoverComputePlaceholders, buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import {
  computeSideCarStandIn,
  hasOutpoint,
} from './stateful-abi-resolve.js';
import type { GraphEcrecoverCall } from './sc-batch-raw.js';

export interface ResolveEcrecoverCoSpendsHost {
  readonly categoryId: string;
  readonly inner: {
    readonly provider: NetworkProvider & {
      getUtxosForLockingBytecode(lockingBytecode: Uint8Array): Promise<Utxo[]>;
      addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo>;
    };
  };
}

export type ResolveEcrecoverCoSpendsResult = {
  coSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>;
  argBlobs: Array<Uint8Array | null>;
  evmPreimages: Array<Uint8Array | null>;
  salt: Uint8Array;
};

/**
 * Resolve one A+B recovery side-car pair per ecrecover call, provisioning mock UTXOs when needed and
 * optionally deferring unresolved argument blobs for graph probes.
 */
export async function resolveEcrecoverComputeCoSpends(
  host: ResolveEcrecoverCoSpendsHost,
  abiFunction: AbiFunction,
  args: any[],
  selectedCalls?: readonly GraphEcrecoverCall[],
  options: { deferUnresolved?: boolean; graphExecution?: boolean } = {},
): Promise<ResolveEcrecoverCoSpendsResult> {
  // A transitive helper has no direct ABI parameter mapping of its own. Its block layout is still authoritative:
  // every consecutive A/B pair represents one runtime recovery call to be learned from the complete VM trace.
  const layoutCallCount = Math.floor(
    (abiFunction.blockLayout?.slots.filter((slot) => slot.kind === 'ecrecoverSideCar').length ?? 0) / 2,
  );
  const calls = selectedCalls ?? abiFunction.ecrecoverArgParams
    ?? Array.from({ length: layoutCallCount }, () => [null, null, null, null] as const);
  const evmFlags = abiFunction.ecrecoverEvmFlags ?? Array.from({ length: calls.length }, () => false);
  const salt = selectedCalls || options.graphExecution
    ? new Uint8Array(32)
    : hexToBin(host.categoryId).slice().reverse();
  if (calls.length === 0 || !host.categoryId) {
    return { coSpends: [], argBlobs: [], evmPreimages: [], salt };
  }
  // A branded sidecar checks the category at absolute input 0, which is only the owning master for a direct call.
  // Atomic participants can begin later in the transaction, so graph-selected calls use the shared lock;
  // the authenticated argument blob, exact kind-6 endpoints, and A->B commitment chain retain result soundness.
  const [lockA, lockB] = [ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B')];
  const [utxosA, utxosB] = await Promise.all([
    host.inner.provider.getUtxosForLockingBytecode(lockA),
    host.inner.provider.getUtxosForLockingBytecode(lockB),
  ]);
  let freeA = utxosA.filter((u) => u.token?.nft?.capability === 'mutable');
  let freeB = utxosB.filter((u) => u.token?.nft?.capability === 'mutable');
  // Mock providers can mint test-only UTXOs directly. Match the generic keccak side-car behavior above so a
  // deferred recovery probe has real, indexed inputs to replace after it learns computed arguments. Providers
  // without this capability retain the explicit side-car deployment requirement used on real networks.
  if (freeA.length < calls.length || freeB.length < calls.length) {
    const addUtxo = host.inner.provider.addUtxo;
    if (typeof addUtxo === 'function') {
      const provision = async (lock: Uint8Array, utxos: readonly Utxo[]): Promise<void> => {
        for (let i = utxos.length; i < calls.length; i++) {
          const standIn = computeSideCarStandIn('ecrecover-sidecar', lock, i);
          if (hasOutpoint(utxos, standIn)) continue;
          await addUtxo.call(host.inner.provider, binToHex(lock), standIn);
        }
      };
      await Promise.all([provision(lockA, freeA), provision(lockB, freeB)]);
      [freeA, freeB] = await Promise.all([
        host.inner.provider.getUtxosForLockingBytecode(lockA),
        host.inner.provider.getUtxosForLockingBytecode(lockB),
      ]).then(([a, b]) => [
        a.filter((u) => u.token?.nft?.capability === 'mutable'),
        b.filter((u) => u.token?.nft?.capability === 'mutable'),
      ]);
    }
  }
  if (freeA.length < calls.length || freeB.length < calls.length) {
    throw new Error(`ecrecoverPubKey needs ${calls.length} A + ${calls.length} B recovery side-car UTXO(s) at the `
      + `branded address; found ${freeA.length} A + ${freeB.length} B. Deploy one A+B pair per call.`);
  }
  const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
  const argOf = (p: string | null): unknown => (p ? args[visible.findIndex((x) => x.name === p)] : undefined);
  const resolved: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
  const argBlobs: Array<Uint8Array | null> = [];
  const evmPreimages: Array<Uint8Array | null> = [];
  for (let i = 0; i < calls.length; i++) {
    const [hp, vp, rp, sp] = calls[i];
    const [hash, vRaw, r, s] = selectedCalls ? [hp, vp, rp, sp]
      : [argOf(hp as string | null), argOf(vp as string | null), argOf(rp as string | null), argOf(sp as string | null)];
    if (!(hash instanceof Uint8Array) || !(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
      if (options.deferUnresolved) {
        const placeholders = buildEcrecoverComputePlaceholders(salt, freeA[i], freeB[i]);
        resolved.push({ utxo: freeA[i], unlocker: placeholders.unlockerA, recreate: placeholders.recreateA });
        resolved.push({ utxo: freeB[i], unlocker: placeholders.unlockerB, recreate: placeholders.recreateB });
        argBlobs.push(null);
        if (evmFlags[i]) evmPreimages.push(null);
        continue;
      }
      throw new Error('ecrecoverPubKey in a stateful contract requires direct (hash, v, r, s) parameters.');
    }
    const wit = computeEcrecoverWitness(hash, typeof vRaw === 'bigint' ? Number(vRaw) : Number(vRaw), r, s);
    const chunkA = probeEcrecoverSplit(wit, salt, freeA[i], freeB[i]);
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
      wit, chunkA, salt, freeA[i], freeB[i],
    );
    resolved.push({ utxo: freeA[i], unlocker: unlockerA, recreate: recreateA });
    resolved.push({ utxo: freeB[i], unlocker: unlockerB, recreate: recreateB });
    argBlobs.push(wit.argBlob);
    if (evmFlags[i]) evmPreimages.push(wit.uncompressedPubkey);
  }
  return { coSpends: resolved, argBlobs, evmPreimages, salt };
}
