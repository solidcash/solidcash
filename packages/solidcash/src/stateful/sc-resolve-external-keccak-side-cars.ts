/**
 * phase-boundary extract: SC class-body extract — transitive external keccak256 shared side-car resolution.
 */

import type { AbiFunction } from '@solidcash/utils';
import {
  keccakComputeLockingBytecode,
} from '@solidcash/utils';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { buildKeccakComputeSidecar } from '../keccak/keccakComputeSidecar.js';

export interface ResolveExternalKeccakSideCarsHost {
  readonly provider: NetworkProvider;
  externalKeccakProbeCtx(
    bContract: unknown,
    bAbiFunc: AbiFunction,
    args: unknown[],
    externalCategoryId: string,
  ): Promise<unknown>;
  extractStatefulKeccakPreimages(
    bAbiFunc: AbiFunction,
    preimages: Array<Uint8Array | null>,
    salt: Uint8Array,
    scUtxos: Utxo[],
    bProbeCtx: unknown,
  ): Promise<void>;
}

/**
 * Resolve SHARED salt=0 stateful keccak side-cars for a transitive external call: pull direct
 * preimages from visible args, probe the callee for complex/nested ones, then unlock one mutable
 * side-car UTXO per three keccak calls.
 */
export async function resolveExternalKeccakSideCars(
  host: ResolveExternalKeccakSideCarsHost,
  bAbiFunc: AbiFunction | undefined,
  args: unknown[],
  externalCategoryId: string,
  bContract?: unknown,
): Promise<{ inputs: UnlockableUtxo[]; recreates: Output[] }> {
  const params = bAbiFunc?.keccakPreimageParams ?? [];
  if (params.length === 0 || !bAbiFunc || !externalCategoryId) return { inputs: [], recreates: [] };
  // SHARED (salt=0) stateful side-car: the branded covenant brand-checks INPUT 0, which for a transitive
  // co-spend is the OUTER caller (not B), so branding can't apply. The shared covenant skips the brand check
  // (integrity is still enforced by B's baked covenant-hash check + preimage bind; only isolation is relaxed,
  // the same tradeoff as a shared stateless side-car). INPUTINDEX self-preservation is unaffected.
  const salt = new Uint8Array(32);
  const scUtxos = (await host.provider.getUtxosForLockingBytecode(keccakComputeLockingBytecode(salt, true)))
    .filter((u) => u.token?.nft?.capability === 'mutable');
  const visible = bAbiFunc.inputs.filter((inp) => !inp.name.startsWith('__internal__'));
  // Direct-parameter preimages come straight from B's args; complex/nested args (recorded null by codegen) are
  // resolved by probing B in isolation (B at input 0 + all its data NFTs + placeholder side-cars) and reading
  // each unresolved call's argument off B's trace - the same mechanism as the direct stateful path, but on B.
  const preimages: (Uint8Array | null)[] = params.map(
    (p) => (p ? (args[visible.findIndex((x) => x.name === p)] instanceof Uint8Array
      ? args[visible.findIndex((x) => x.name === p)] as Uint8Array : null) : null),
  );
  if (preimages.some((p) => p === null)) {
    if (!bContract) {
      throw new Error('transitive keccak256 with a complex/nested argument needs the external contract '
        + 'instance to probe; call through withExternalCall()/connect-time externals.');
    }
    const bProbeCtx = await host.externalKeccakProbeCtx(bContract, bAbiFunc, args, externalCategoryId);
    await host.extractStatefulKeccakPreimages(bAbiFunc, preimages, salt, scUtxos, bProbeCtx);
  }
  const inputs: UnlockableUtxo[] = [];
  const recreates: Output[] = [];
  const batchCount = Math.ceil(params.length / 3);
  for (let batch = 0; batch < batchCount; batch++) {
    const batchPreimages = preimages.slice(batch * 3, batch * 3 + 3);
    if (batchPreimages.some((preimage) => !(preimage instanceof Uint8Array))) {
      throw new Error(`keccak256 preimage batch ${batch} could not be resolved.`);
    }
    if (!scUtxos[batch]) {
      throw new Error(`keccak256 compute side-car UTXO not found for external call (batch ${batch}); deploy one `
        + 'mutable-NFT side-car per three keccak256 calls at the shared side-car address.');
    }
    const { unlocker, recreate } = buildKeccakComputeSidecar(
      batchPreimages as Uint8Array[], salt, scUtxos[batch], true,
    );
    inputs.push({ ...scUtxos[batch], unlocker });
    recreates.push(recreate);
  }
  return { inputs, recreates };
}
