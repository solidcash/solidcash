/**
 * phase-boundary extract: SC extract — resolve fixed-slot keccak256 compute side-car co-spends.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH_LEGACY,
  keccakComputeLockingBytecode,
  keccakComputeLockingBytecodeLegacy,
  type AbiFunction, type Artifact,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { buildKeccakComputeSidecar } from '../keccak/keccakComputeSidecar.js';
import { addressToLockScript } from '../utils.js';
import {
  computeSideCarStandIn,
  hasOutpoint,
} from './stateful-abi-resolve.js';
import { artifactAddressForm, sortedAddressPairPacked } from './solidityAbi.js';

export interface ResolveKeccakComputeCoSpendsHost {
  readonly categoryId: string;
  readonly inner: {
    bytecode: string;
    /** The contract artifact, whose compiler options decide how `abi.encodePacked(address)` packs. */
    artifact?: Pick<Artifact, 'compiler'>;
    provider: NetworkProvider & {
      getUtxosForLockingBytecode(lockingBytecode: Uint8Array): Promise<Utxo[]>;
      addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo>;
    };
  };
  extractStatefulKeccakPreimages(
    abiFunction: AbiFunction,
    preimages: Array<Uint8Array | null>,
    salt: Uint8Array,
    scUtxos: Utxo[],
    probeCtx?: ResolveKeccakProbeCtx,
  ): Promise<void>;
  evalComputedKey(...args: any[]): Uint8Array | undefined;
}

export type ResolveKeccakProbeCtx = {
  masterUtxo: Utxo;
  stateInputUnlocker: Unlocker;
  dataNftUtxos: Utxo[];
  dataNftUnlockers: Unlocker[];
  frontRegionInputs?: UnlockableUtxo[];
  locktime?: number;
  deferUnresolved?: boolean;
  artifactBytecode?: string;
  ecrecoverPreimages?: Array<Uint8Array | null>;
  /** Compiler-selected direct parameter preimages decoded from the authenticated message-bus batch. */
  plannedPreimages?: readonly (Uint8Array | null)[];
};

export type ResolveKeccakComputeCoSpendsResult = {
  coSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }>;
  preimages: Array<Uint8Array | null>;
  salt: Uint8Array;
  legacy: boolean;
};

export async function resolveKeccakComputeCoSpends(
  host: ResolveKeccakComputeCoSpendsHost,
  abiFunction: AbiFunction,
  args: any[],
  probeCtx?: ResolveKeccakProbeCtx,
): Promise<ResolveKeccakComputeCoSpendsResult> {
  const params = abiFunction.keccakPreimageParams ?? [];
  const recoveryPreimages = probeCtx?.ecrecoverPreimages ?? [];
  const totalCallCount = params.length + recoveryPreimages.length;
  if (totalCallCount === 0 || !host.categoryId) {
    return { coSpends: [], preimages: [], salt: new Uint8Array(32), legacy: false };
  }
  // A stateful DYNAMIC keccak loop (keccakLoopReads) reads N runtime trailing side-cars - resolved by the
  // separate _resolveStatefulKeccakLoop progressive-probe path, not the fixed-slot path here. Reaching this
  // with keccakLoopReads set is an internal routing bug (the caller should branch on keccakLoopReads first).
  if (abiFunction.keccakLoopReads) {
    throw new Error('internal: stateful dynamic keccak256 loop must resolve via _resolveStatefulKeccakLoop.');
  }
  // Branded to the contract's category. The covenant brand-checks the master's OP_UTXOTOKENCATEGORY, which
  // the VM returns in INTERNAL (reversed) byte order, so the baked salt must be the reversed category.
  const salt = hexToBin(host.categoryId).slice().reverse();
  const legacy = (probeCtx?.artifactBytecode ?? host.inner.bytecode)
    .includes(KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH_LEGACY);
  const lock = legacy
    ? keccakComputeLockingBytecodeLegacy(salt, true)
    : keccakComputeLockingBytecode(salt, true);
  let scUtxos = (await host.inner.provider.getUtxosForLockingBytecode(lock))
    .filter((u) => u.token?.nft?.capability === 'mutable');
  const batchCount = legacy ? totalCallCount : Math.ceil(totalCallCount / 3);
  // Mock providers can mint the branded compute side-cars on demand. Production providers do not expose
  // addUtxo, so real networks retain the explicit deployment requirement below.
  if (scUtxos.length < batchCount) {
    const addUtxo = (host.inner.provider as { addUtxo?: (a: string, u: Utxo) => Promise<Utxo> }).addUtxo;
    if (typeof addUtxo === 'function') {
      for (let i = scUtxos.length; i < batchCount; i++) {
        const standIn = computeSideCarStandIn('keccak-sidecar', lock, i);
        if (hasOutpoint(scUtxos, standIn)) continue;
        await addUtxo.call(host.inner.provider, binToHex(lock), standIn);
      }
      scUtxos = (await host.inner.provider.getUtxosForLockingBytecode(lock))
        .filter((u) => u.token?.nft?.capability === 'mutable');
    }
  }
  if (scUtxos.length < batchCount) {
    throw new Error(`keccak256 needs ${batchCount} compute side-car UTXO(s) at the branded address; `
      + `found ${scUtxos.length}. Deploy one mutable-NFT side-car per keccak256 call.`);
  }
  const visible = abiFunction.inputs.filter((i) => !i.name.startsWith('__internal__'));
  // Direct-parameter preimages come straight from the args; complex/nested args (recorded null by codegen)
  // are resolved by a VM probe of the master (mirrors the stateless resolveKeccakPreimages, but positioned
  // at the block-layout keccakSideCar slots).
  if (probeCtx?.plannedPreimages && probeCtx.plannedPreimages.length !== params.length) {
    throw new Error('message-bus keccak recipe count does not match the selected compute calls');
  }
  const preimages: (Uint8Array | null)[] = params.map((p, index) => {
    const planned = probeCtx?.plannedPreimages?.[index];
    if (planned instanceof Uint8Array) return planned.slice();
    const value = p ? args[visible.findIndex((x) => x.name === p)] : undefined;
    return value instanceof Uint8Array ? value : null;
  });
  // If the digest is itself a vmap key, its published expression can be evaluated without a circular probe.
  if (preimages.length === 1 && preimages[0] === null) {
    const inners = new Set(
      (abiFunction.entryAccesses ?? [])
        .flatMap((access) => (access.keyParams ?? []) as readonly string[])
        .map((label) => /^call:keccak256\((.*)\)$/.exec(label)?.[1])
        .filter((inner): inner is string => Boolean(inner)),
    );
    if (inners.size === 1) {
      const computed = host.evalComputedKey([...inners][0], args as FunctionArgument[], visible);
      if (computed) preimages[0] = computed;
    }
  }
  // Uniswap-style createPair hashes the sorted pair of visible address arguments.
  if (preimages.length === 1 && preimages[0] === null) {
    const addressIndices = visible
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => input.type === 'address' || input.type.startsWith('address '))
      .map(({ index }) => index);
    const toLbc = (value: unknown): Uint8Array | undefined => {
      if (value instanceof Uint8Array) return value;
      if (typeof value === 'string' && value.includes(':')) return addressToLockScript(value);
      if (typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)) {
        return hexToBin(value.replace(/^0x/i, ''));
      }
      return undefined;
    };
    if (addressIndices.length >= 2) {
      const a = toLbc(args[addressIndices[0]]);
      const b = toLbc(args[addressIndices[1]]);
      // The covenant's own ordering and packing rules; the source's `addressForm` decides whether each address
      // packs as its 20-byte identity ('hash') or as its locking bytecode ('bytecode').
      if (a && b) {
        const hashAddresses = host.inner.artifact !== undefined
          && artifactAddressForm(host.inner.artifact) === 'hash';
        const packed = sortedAddressPairPacked(a, b, hashAddresses);
        if (!packed) throw new Error('Solidity ABI keccak preimage needs canonical address arguments.');
        preimages[0] = packed;
      }
    }
  }
  preimages.push(...recoveryPreimages.map((preimage) =>
    preimage === null ? null : Uint8Array.from(preimage)));
  if (preimages.some((p) => p === null) && probeCtx?.deferUnresolved !== true) {
    await host.extractStatefulKeccakPreimages(abiFunction, preimages, salt, scUtxos, probeCtx);
  }
  const resolved: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }> = [];
  for (let batch = 0; batch < batchCount; batch++) {
    const batchPreimages = preimages.slice(batch * 3, batch * 3 + 3);
    if (legacy) {
      const preimage = preimages[batch];
      if (!(preimage instanceof Uint8Array) && probeCtx?.deferUnresolved !== true) {
        throw new Error(`keccak256 preimage ${batch} could not be resolved.`);
      }
      const built = buildKeccakComputeSidecar(preimage ?? new Uint8Array(), salt, scUtxos[batch], true, true);
      resolved.push({ utxo: scUtxos[batch], ...built });
      continue;
    }
    if (batchPreimages.some((preimage) => !(preimage instanceof Uint8Array))
      && probeCtx?.deferUnresolved !== true) {
      throw new Error(`keccak256 preimage batch ${batch} could not be resolved.`);
    }
    const { unlocker, recreate, commitment } = buildKeccakComputeSidecar(
      batchPreimages.map((preimage) => preimage ?? new Uint8Array()), salt, scUtxos[batch], true,
    );
    resolved.push({ utxo: scUtxos[batch], unlocker, recreate, commitment });
  }
  return { coSpends: resolved, preimages, salt, legacy };
}
