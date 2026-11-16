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
  buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3, buildEcrecoverPlaceholderSidecars,
  computeEcrecoverWitness, probeEcrecoverSplit, probeEcrecoverSplit3,
} from '../ecrecover/ecrecoverComputeSidecar.js';
import { ecrecoverRefusal } from '../ecrecover/ecrecoverRecovery.js';
import {
  computeSideCarStandIn,
  hasOutpoint,
} from './stateful-abi-resolve.js';
import type { GraphEcrecoverCall } from './sc-batch-raw.js';

// A neutral coin, P2SH32(OP_TRUE) with no token, for a slot no covenant reads, where the host has no coin of its own:
// a probe that is never sent, or a message-bus graph whose composer funds such slots with this lock. Only a mock
// provider can register it; a real network holds no such coin.
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

/** An input of the block and the output that returns its value at the same index. */
export type RecoverySlotCoin = { input: UnlockableUtxo; recreate: Output };

export interface ResolveEcrecoverCoSpendsHost {
  readonly categoryId: string;
  /** A14 item 6: a shared-pool salt (all zeros for Deploy<C>) replaces the category-branded one. */
  readonly sidecarSalt?: Uint8Array;
  readonly inner: {
    readonly provider: NetworkProvider & {
      getUtxosForLockingBytecode(lockingBytecode: Uint8Array): Promise<Utxo[]>;
      addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo>;
    };
  };
  /**
   * A coin for a slot of the block no covenant reads, and the output that returns its value at the same index: the
   * middle input of a two-covenant recovery, and each of the three slots of a recovery whose arguments recover no key.
   * The call's wallet fills it; a mock mints a neutral coin where the call has no signer. Undefined when the call has
   * none. Without this member, a host whose transaction is never sent (a probe) or whose composer funds the slot (a
   * message-bus graph) takes the neutral P2SH32(OP_TRUE) coin.
   */
  readonly takeMiddleCoin?: () => Promise<RecoverySlotCoin | undefined>;
}

export type ResolveEcrecoverCoSpendsResult = {
  coSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>;
  argBlobs: Array<Uint8Array | null>;
  evmPreimages: Array<Uint8Array | null>;
  salt: Uint8Array;
  /** Per call, the M and B3 coins a deferred call takes if its learned recovery is width-0; null for any other. */
  width0Coins: Array<{ m: Utxo; b3: Utxo } | null>;
};

/**
 * Resolve one A+B recovery side-car pair per ecrecover call, provisioning mock UTXOs when needed and
 * optionally deferring unresolved argument blobs for graph probes.
 *
 * Each call takes three block slots. A two-covenant recovery reads A and B2 and leaves the middle slot to a coin no
 * covenant reads; a width-0 recovery reads A, M and B3. Arguments that recover no key (`ecrecoverRefusal`) have no
 * side-car of their own, and the keccak preimage of an `ecrecoverEvm` call is 64 zero bytes. For arguments the
 * precompile's range rules refuse, all three slots take coins the function does not read: an address projection
 * answers the zero address without reading them. For an `r` no curve point has, the first slot takes a coin of the A
 * pool over the placeholder recovery, whose pad carries the proof an address projection reads before it answers the
 * zero address, and the other two take coins the function does not read. For a key at infinity, the slots take the
 * pair over the digest shifted by -2^128 r mod n, which recovers 2^128 G. A branch the run skips reads none of them,
 * and a recovery that reads them for a recovery (`ecrecoverPubKey`) refuses the call, as no side-car can serve it.
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
  const salt = host.sidecarSalt?.slice() ?? (selectedCalls || options.graphExecution
    ? new Uint8Array(32)
    : hexToBin(host.categoryId).slice().reverse());
  if (calls.length === 0 || !host.categoryId) {
    return { coSpends: [], argBlobs: [], evmPreimages: [], salt, width0Coins: [] };
  }
  // Each call's arguments: learned later from the run (deferred), recovering no key (refused), or a witness.
  const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
  const argOf = (p: string | null): unknown => (p ? args[visible.findIndex((x) => x.name === p)] : undefined);
  type CallPlan =
    | { kind: 'deferred' }
    | { kind: 'refused'; refusal: string; argBlob: Uint8Array; proof?: Uint8Array }
    // `atInfinity` holds the call's own argument blob where the witness recovers from the shifted digest.
    | { kind: 'recover'; wit: ReturnType<typeof computeEcrecoverWitness>; atInfinity?: Uint8Array };
  const plans = calls.map(([hp, vp, rp, sp]): CallPlan => {
    const [hash, vRaw, r, s] = selectedCalls ? [hp, vp, rp, sp]
      : [argOf(hp as string | null), argOf(vp as string | null), argOf(rp as string | null), argOf(sp as string | null)];
    if (!(hash instanceof Uint8Array) || !(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
      if (options.deferUnresolved) return { kind: 'deferred' };
      throw new Error('ecrecoverPubKey in a stateful contract requires direct (hash, v, r, s) parameters.');
    }
    const v = typeof vRaw === 'bigint' ? Number(vRaw) : Number(vRaw);
    const refusal = ecrecoverRefusal(hash, v, r, s);
    if (refusal?.kind === 'atInfinity') {
      return {
        kind: 'recover', wit: computeEcrecoverWitness(refusal.shiftedHash, v, r, s),
        atInfinity: Uint8Array.from([...hash, v & 0xff, ...r, ...s]),
      };
    }
    if (refusal !== undefined) {
      return {
        kind: 'refused', refusal: refusal.reason, argBlob: Uint8Array.from([...hash, v & 0xff, ...r, ...s]),
        ...(refusal.kind === 'offCurve' ? { proof: refusal.proof } : {}),
      };
    }
    return { kind: 'recover', wit: computeEcrecoverWitness(hash, v, r, s) };
  });
  // Only the calls with a side-car take coins of the pool: a recovery, and the A that carries an off-curve proof.
  const poolCalls = plans.filter((plan) => plan.kind !== 'refused' || plan.proof !== undefined).length;
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
    && (freeA.length < poolCalls || freeB.length < poolCalls || freeM.length < poolCalls
      || freeB3.length < poolCalls)) {
    const provision = async (lock: Uint8Array, utxos: readonly Utxo[]): Promise<Utxo[]> => {
      for (let i = utxos.length; i < poolCalls; i++) {
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
  if (freeA.length < poolCalls || freeB.length < poolCalls
    || freeM.length < poolCalls || freeB3.length < poolCalls) {
    throw new Error(`ecrecoverPubKey needs ${poolCalls} A + B (2-way) + M + B3 (width-0 3-way) recovery `
      + `side-car UTXO(s) at the branded address; found ${freeA.length} A + ${freeB.length} B + `
      + `${freeM.length} M + ${freeB3.length} B3. Deploy one A/B/M/B3 set per call.`);
  }
  // A slot no covenant reads: the host's coin, or the neutral coin where the host has none of its own.
  const unreadSlot = async (fallbackIndex: number, purpose: string): Promise<{ utxo: UnlockableUtxo; recreate: Output }> => {
    if (host.takeMiddleCoin === undefined) return inertFunder(fallbackIndex, host.inner.provider);
    const coin = await host.takeMiddleCoin();
    if (coin === undefined) {
      throw new Error(`ecrecover: ${purpose} takes a wallet coin, returned at its own index, and the call has none `
        + 'left; connect a signer with a spare coin');
    }
    return { utxo: coin.input, recreate: coin.recreate };
  };
  const middle = (i: number): string => `recovery ${i}'s middle input, which no covenant reads,`;
  const resolved: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
  const argBlobs: Array<Uint8Array | null> = [];
  const evmPreimages: Array<Uint8Array | null> = [];
  const width0Coins: Array<{ m: Utxo; b3: Utxo } | null> = [];
  let p = 0;
  for (let i = 0; i < calls.length; i++) {
    const plan = plans[i]!;
    width0Coins.push(plan.kind === 'deferred' ? { m: freeM[p]!, b3: freeB3[p]! } : null);
    if (plan.kind === 'refused') {
      // No side-car recovers a key from these arguments. The slots take coins the function does not read: the
      // compiled recovery answers the zero address without reading them, or its branch is not run, or it reads them
      // and the call fails closed. For an `r` no point has, the first slot takes the A that carries the proof.
      for (let slot = 0; slot < 3; slot++) {
        if (slot === 0 && plan.proof !== undefined) {
          const carrierA = freeA[p]!;
          p += 1;
          const carrier = buildEcrecoverPlaceholderSidecars(salt, carrierA, carrierA, plan.proof, 'B2');
          resolved.push({ utxo: carrierA, unlocker: carrier.unlockerA, recreate: carrier.recreateA });
          continue;
        }
        const coin = await unreadSlot(0x100 + 3 * i + slot, `slot ${slot} of recovery ${i}, whose arguments recover `
          + `no key (${plan.refusal}) and which therefore holds coins its function does not read,`);
        resolved.push({ utxo: coin.utxo, unlocker: coin.utxo.unlocker, recreate: coin.recreate });
      }
      argBlobs.push(plan.argBlob);
      if (evmFlags[i]) evmPreimages.push(new Uint8Array(64));
      continue;
    }
    const [coinA, coinB, coinM, coinB3] = [freeA[p], freeB[p], freeM[p], freeB3[p]];
    p += 1;
    if (plan.kind === 'deferred') {
      // The placeholder recovery's genuine pair: a run that never reads the call (arguments the range rules refuse, or
      // a branch it skips) sends it as it is, and a run that reads it names the arguments the pair is rebuilt over.
      const placeholders = buildEcrecoverPlaceholderSidecars(salt, coinA, coinB, undefined, 'B2');
      const funder = await unreadSlot(i, middle(i));
      resolved.push({ utxo: coinA, unlocker: placeholders.unlockerA, recreate: placeholders.recreateA });
      resolved.push({ utxo: funder.utxo, unlocker: funder.utxo.unlocker, recreate: funder.recreate });
      resolved.push({ utxo: coinB, unlocker: placeholders.unlockerB, recreate: placeholders.recreateB });
      argBlobs.push(null);
      if (evmFlags[i]) evmPreimages.push(null);
      continue;
    }
    const { wit } = plan;
    // A key at infinity: the call binds its own arguments and reads no keccak preimage.
    const ownArgBlob = plan.atInfinity ?? wit.argBlob;
    const evmPreimage = plan.atInfinity === undefined ? wit.uncompressedPubkey : new Uint8Array(64);
    let chunkA: number;
    try {
      chunkA = probeEcrecoverSplit(wit, salt, coinA, coinB);
    } catch {
      // width-0: the 2-covenant window is empty; fall back to the A/M/B3 3-covenant split.
      const split = probeEcrecoverSplit3(wit, salt, coinA, coinM, coinB3);
      const built = buildEcrecoverComputeSidecars3(wit, split.chunkA, split.chunkM, salt, coinA, coinM, coinB3);
      resolved.push({ utxo: coinA, unlocker: built.unlockerA, recreate: built.recreateA });
      resolved.push({ utxo: coinM, unlocker: built.unlockerM, recreate: built.recreateM });
      resolved.push({ utxo: coinB3, unlocker: built.unlockerB, recreate: built.recreateB });
      argBlobs.push(ownArgBlob);
      if (evmFlags[i]) evmPreimages.push(evmPreimage);
      continue;
    }
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
      wit, chunkA, salt, coinA, coinB, undefined, 'B2',
    );
    const funder = await unreadSlot(i, middle(i));
    resolved.push({ utxo: coinA, unlocker: unlockerA, recreate: recreateA });
    resolved.push({ utxo: funder.utxo, unlocker: funder.utxo.unlocker, recreate: funder.recreate });
    resolved.push({ utxo: coinB, unlocker: unlockerB, recreate: recreateB });
    argBlobs.push(ownArgBlob);
    if (evmFlags[i]) evmPreimages.push(evmPreimage);
  }
  return { coSpends: resolved, argBlobs, evmPreimages, salt, width0Coins };
}
