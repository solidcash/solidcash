import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
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
  /** Assembly-only: the selected writer may still have an OTC-derived `00` chunk commitment. */
  allowProvisionalChunks?: boolean;
  /** Selected writes authorize provisional chunks; canonical preserved route-union chunks still locate the band. */
  selectedDynamicWrites?: ReadonlySet<string>;
}): number {
  const { route, stateLayout, contract, categoryId, outputs } = params;
  const start = params.start ?? 0;
  const end = params.end ?? outputs.length;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end < start || end > outputs.length) {
    throw new Error(`Dynamic-output route has an invalid physical output window in ${route.name}`);
  }
  if (params.allowProvisionalChunks && params.start === undefined) {
    throw new Error(`Dynamic-output route ${route.name} has no owned window for provisional chunks`);
  }
  const routeWrittenNames = route.dynamicWrites ?? [];
  if (params.selectedDynamicWrites !== undefined
    && [...params.selectedDynamicWrites].some((name) => !routeWrittenNames.includes(name))) {
    throw new Error(`Dynamic-output route ${route.name} omits a selected dynamic writer`);
  }
  const writtenNames = routeWrittenNames;
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
    // A route publishes the union of handlers. Even an inactive writer can have real, preserved
    // pre-state chunks in the trailing band; their canonical run still anchors the route's output
    // coordinate. An inactive empty writer can instead leave only speculative `00` stubs, which
    // have no owned run and must not become an output-base witness.
    if (params.selectedDynamicWrites !== undefined
      && !params.selectedDynamicWrites.has(variable.name)
      && matches.length > 0
      && matches.every(({ output }) => output.token?.nft?.commitment === '00')) continue;
    for (const [chunkIndex, { output, index }] of matches.entries()) {
      const commitment = output.token?.nft?.commitment;
      // The selected dynamic writer reserves its trailing output run before OTC has supplied the
      // commitment bytes. `00` is a location candidate only, never a canonical chunk. The final
      // composition convergence gate refuses unresolved owned placeholders before VM admission.
      if (params.allowProvisionalChunks && commitment === '00'
        && (params.selectedDynamicWrites === undefined || params.selectedDynamicWrites.has(variable.name))
        && output.token?.nft?.capability === 'mutable' && output.token.amount === 0n) {
        orderedIndices.push(index);
        continue;
      }
      let parsed: ReturnType<typeof parseChunkCommitment> | undefined;
      if (commitment !== undefined) {
        try {
          parsed = parseChunkCommitment(commitment);
        } catch (error) {
          throw new Error(
            `Dynamic-output route ${route.name} has an undecodable ${variable.name} chunk at output ${index} `
            + `(commitment ${commitment.slice(0, 48)}, provisional ${params.allowProvisionalChunks === true}, `
            + `window ${start}-${end}, capability ${output.token?.nft?.capability ?? 'none'}, `
            + `token amount ${String(output.token?.amount)}): `
            + `${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (output.token?.nft?.capability !== 'mutable'
        || output.token.nft.commitment === undefined
        || parsed?.chunkIndex !== chunkIndex) {
        throw new Error(`Dynamic-output route ${route.name} has a noncanonical ${variable.name} chunk `
          + `at output ${index} (expected index ${chunkIndex}, found ${parsed?.chunkIndex ?? 'none'})`);
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
