/**
 * phase-boundary extract: SC class-body extract — resolve ecrecover A/B compute side-car co-spends.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  ecrecoverComputeLockingBytecode, type AbiFunction,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  buildEcrecoverComputePlaceholders, buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3,
  computeEcrecoverWitness, probeEcrecoverSplit, probeEcrecoverSplit3,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import {
  computeSideCarStandIn,
  hasOutpoint,
} from './stateful-abi-resolve.js';
import type { GraphEcrecoverCall } from './sc-batch-raw.js';

// A plain balanced funder for the M slot of a normal (2-way) signature. Its input/output carry no token, matching
// the balanced-slot funder family; the A and B covenants on either side self-preserve their own categories.
const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const inertFunderUnlocker: Unlocker = {
  generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
  generateUnlockingBytecode: () => new Uint8Array([0x01, 0x51]),
};
const inertFunder = async (
  index: number,
  provider: ResolveEcrecoverCoSpendsHost['inner']['provider'],
): Promise<{ utxo: UnlockableUtxo; recreate: Output }> => {
  const utxo: UnlockableUtxo = {
    txid: (0xe000 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 10000n,
    unlocker: inertFunderUnlocker,
  };
  // Mock providers track every input's outpoint; register the synthetic funder so the final preflight can find it.
  if (provider.addUtxo !== undefined) {
    await provider.addUtxo.call(provider, binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), utxo);
  }
  return { utxo, recreate: { to: DUMMY_FUNDER_LOCKING_BYTECODE, amount: 10000n } };
};

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
  // every consecutive A/M/B triple represents one runtime recovery call to be learned from the complete VM trace.
  const layoutCallCount = Math.floor(
    (abiFunction.blockLayout?.slots.filter((slot) => slot.kind === 'ecrecoverSideCar').length ?? 0) / 3,
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
  // the authenticated argument blob, exact kind-6 endpoints, and the A->M->B commitment chain retain soundness.
  const [lockA, lockB, lockM, lockB3] = [
    ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B2'),
    ecrecoverComputeLockingBytecode(salt, 'M'), ecrecoverComputeLockingBytecode(salt, 'B3'),
  ];
  const [utxosA, utxosB, utxosM, utxosB3] = await Promise.all([
    host.inner.provider.getUtxosForLockingBytecode(lockA),
    host.inner.provider.getUtxosForLockingBytecode(lockB),
    host.inner.provider.getUtxosForLockingBytecode(lockM),
    host.inner.provider.getUtxosForLockingBytecode(lockB3),
  ]);
  const mutable = (us: readonly Utxo[]): Utxo[] => us.filter((u) => u.token?.nft?.capability === 'mutable');
  let freeA = mutable(utxosA), freeB = mutable(utxosB), freeM = mutable(utxosM), freeB3 = mutable(utxosB3);
  // Mock providers can mint test-only UTXOs directly. Match the generic keccak side-car behavior above so a
  // deferred recovery probe has real, indexed inputs to replace after it learns computed arguments. Providers
  // without this capability retain the explicit side-car deployment requirement used on real networks.
  const addUtxo = host.inner.provider.addUtxo;
  if (typeof addUtxo === 'function'
    && (freeA.length < calls.length || freeB.length < calls.length || freeM.length < calls.length
      || freeB3.length < calls.length)) {
    const provision = async (lock: Uint8Array, utxos: readonly Utxo[]): Promise<Utxo[]> => {
      for (let i = utxos.length; i < calls.length; i++) {
        const standIn = computeSideCarStandIn('ecrecover-sidecar', lock, i);
        if (hasOutpoint(utxos, standIn)) continue;
        await addUtxo.call(host.inner.provider, binToHex(lock), standIn);
      }
      const fetched = await host.inner.provider.getUtxosForLockingBytecode(lock);
      return mutable(fetched);
    };
    [freeA, freeB, freeM, freeB3] = await Promise.all([
      provision(lockA, freeA), provision(lockB, freeB), provision(lockM, freeM), provision(lockB3, freeB3),
    ]);
  }
  if (freeA.length < calls.length || freeB.length < calls.length
    || freeM.length < calls.length || freeB3.length < calls.length) {
    throw new Error(`ecrecoverPubKey needs ${calls.length} A + B (2-way) + M + B3 (width-0 3-way) recovery `
      + `side-car UTXO(s) at the branded address; found ${freeA.length} A + ${freeB.length} B + `
      + `${freeM.length} M + ${freeB3.length} B3. Deploy one A/B/M/B3 set per call.`);
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
        const placeholders = buildEcrecoverComputePlaceholders(salt, freeA[i], freeB[i], 'B2');
        const funder = await inertFunder(i, host.inner.provider);
        resolved.push({ utxo: freeA[i], unlocker: placeholders.unlockerA, recreate: placeholders.recreateA });
        resolved.push({ utxo: funder.utxo, unlocker: funder.utxo.unlocker, recreate: funder.recreate });
        resolved.push({ utxo: freeB[i], unlocker: placeholders.unlockerB, recreate: placeholders.recreateB });
        argBlobs.push(null);
        if (evmFlags[i]) evmPreimages.push(null);
        continue;
      }
      throw new Error('ecrecoverPubKey in a stateful contract requires direct (hash, v, r, s) parameters.');
    }
    const wit = computeEcrecoverWitness(hash, typeof vRaw === 'bigint' ? Number(vRaw) : Number(vRaw), r, s);
    let chunkA: number;
    try {
      chunkA = probeEcrecoverSplit(wit, salt, freeA[i], freeB[i]);
    } catch {
      // width-0: the 2-covenant window is empty; fall back to the A/M/B3 3-covenant split.
      const split = probeEcrecoverSplit3(wit, salt, freeA[i], freeM[i], freeB3[i]);
      const built = buildEcrecoverComputeSidecars3(wit, split.chunkA, split.chunkM, salt, freeA[i], freeM[i], freeB3[i]);
      resolved.push({ utxo: freeA[i], unlocker: built.unlockerA, recreate: built.recreateA });
      resolved.push({ utxo: freeM[i], unlocker: built.unlockerM, recreate: built.recreateM });
      resolved.push({ utxo: freeB3[i], unlocker: built.unlockerB, recreate: built.recreateB });
      argBlobs.push(wit.argBlob);
      if (evmFlags[i]) evmPreimages.push(wit.uncompressedPubkey);
      continue;
    }
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
      wit, chunkA, salt, freeA[i], freeB[i], undefined, 'B2',
    );
    const funder = await inertFunder(i, host.inner.provider);
    resolved.push({ utxo: freeA[i], unlocker: unlockerA, recreate: recreateA });
    resolved.push({ utxo: funder.utxo, unlocker: funder.utxo.unlocker, recreate: funder.recreate });
    resolved.push({ utxo: freeB[i], unlocker: unlockerB, recreate: recreateB });
    argBlobs.push(wit.argBlob);
    if (evmFlags[i]) evmPreimages.push(wit.uncompressedPubkey);
  }
  return { coSpends: resolved, argBlobs, evmPreimages, salt };
}
