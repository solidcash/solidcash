import { binToHex } from '@bitauth/libauth';
import { parseChunkCommitment, type AbiFunction, type StateLayout } from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { Output } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { getDynamicChunkAddress } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

/** Returns -1 only when every compiler-written direct dynamic variable has zero output chunks. */
export function resolveMaterializedDynamicWriteOutputBase(params: {
  route: AbiFunction;
  stateLayout: StateLayout;
  contract: Contract;
  categoryId: string;
  outputs: readonly Output[];
  start?: number;
  end?: number;
}): number {
  const { route, stateLayout, contract, categoryId, outputs } = params;
  const start = params.start ?? 0;
  const end = params.end ?? outputs.length;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end < start || end > outputs.length) {
    throw new Error(`Dynamic-output route has an invalid physical output window in ${route.name}`);
  }
  const writtenNames = route.dynamicWrites ?? [];
  const writtenVariables = stateLayout.variables.filter((variable) =>
    variable.dynamic && writtenNames.includes(variable.name));
  if (writtenVariables.length !== new Set(writtenNames).size) {
    throw new Error(`Dynamic-output route references an unknown or duplicate state variable in ${route.name}`);
  }
  const orderedIndices: number[] = [];
  for (const variable of writtenVariables) {
    const chunkAddress = getDynamicChunkAddress(contract, categoryId, variable.name, variable.type);
    const expectedLock = binToHex(addressToLockScript(chunkAddress));
    const matches = outputs.slice(start, end).flatMap((output, localIndex) => {
      const lock = output.to instanceof Uint8Array
        ? binToHex(output.to) : binToHex(addressToLockScript(output.to));
      if (lock !== expectedLock) return [];
      if (output.token?.category !== categoryId) {
        throw new Error(`Dynamic-output route has a wrong owner category for ${variable.name}`);
      }
      return [{ output, index: start + localIndex }];
    });
    for (const [chunkIndex, { output, index }] of matches.entries()) {
      if (output.token?.nft?.capability !== 'mutable'
        || output.token.nft.commitment === undefined
        || parseChunkCommitment(output.token.nft.commitment).chunkIndex !== chunkIndex) {
        throw new Error(`Dynamic-output route has a noncanonical chunk for ${variable.name}`);
      }
      orderedIndices.push(index);
    }
  }
  for (let i = 1; i < orderedIndices.length; i++) {
    if (orderedIndices[i] !== orderedIndices[i - 1] + 1) {
      throw new Error(`Dynamic-output route has a noncontiguous write band in ${route.name}`);
    }
  }
  return orderedIndices[0] ?? -1;
}

/**
 * Bind a route's dynamic-write output base to its materialized chunk NFTs. Input-side trailing geometry
 * cannot establish this coordinate: output-only predecessors may be elsewhere in the same block.
 * The VM still verifies each chunk's lock, category, capability, and commitment; this check ensures
 * the SDK never publishes an ambiguous or merely guessed coordinate to that verifier.
 */
export function reconcileDynamicChunkOutputWitnesses(
  groups: readonly ExternalCallUtxoGroup[],
  lowLevelGroups: readonly ExternalCallUtxoGroup[],
  rootStateCategoryId: string,
  builder: TransactionBuilder,
): readonly ExternalCallUtxoGroup[] {
  const changed: ExternalCallUtxoGroup[] = [];
  for (const outputOwner of groups) {
    if (outputOwner.sharedGroupIndex !== undefined) continue;
    // A proxy owns the balanced output block, while its implementation delegate owns the route unlocker.
    const carrier = outputOwner.delegateCallGroupIndex === undefined
      ? outputOwner : lowLevelGroups[outputOwner.delegateCallGroupIndex];
    if (!carrier?.refreshInternalArgs) continue;
    const route = carrier.compilerRoute?.abiFunction;
    if (!route?.inputs.some((input) => input.name === '__internal__dynamicChunkOutputBase')) continue;
    const next = BigInt(resolveMaterializedDynamicWriteOutputBase({
      route,
      stateLayout: carrier.stateLayout,
      contract: carrier.externalContract.inner,
      categoryId: outputOwner.categoryId,
      outputs: builder.outputs,
    }));
    if (carrier.internalArgs?.__internal__dynamicChunkOutputBase === next) continue;
    carrier.refreshInternalArgs({ __internal__dynamicChunkOutputBase: next });
    changed.push(carrier);
  }
  const associatedDelegates = new Set(groups.flatMap((group) =>
    group.delegateCallGroupIndex === undefined ? [] : [group.delegateCallGroupIndex]));
  for (const [index, carrier] of lowLevelGroups.entries()) {
    if (associatedDelegates.has(index) || !carrier.refreshInternalArgs) continue;
    const route = carrier.compilerRoute?.abiFunction;
    if (!route?.inputs.some((input) => input.name === '__internal__dynamicChunkOutputBase')) continue;
    // A root proxy implementation has no external-call output owner. Its direct-dynamic lock/category
    // identifies the run within this local transaction; duplicate runs fail the canonical-index proof.
    const next = BigInt(resolveMaterializedDynamicWriteOutputBase({
      route,
      stateLayout: carrier.stateLayout,
      contract: carrier.externalContract.inner,
      categoryId: carrier.callMode === 'delegatecall' ? rootStateCategoryId : carrier.categoryId,
      outputs: builder.outputs,
    }));
    if (carrier.internalArgs?.__internal__dynamicChunkOutputBase === next) continue;
    carrier.refreshInternalArgs({ __internal__dynamicChunkOutputBase: next });
    changed.push(carrier);
  }
  return changed;
}
