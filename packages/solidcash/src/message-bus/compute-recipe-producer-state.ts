/** Deterministic pre-state operands for exact compiler-published collection-length returns. */
import { binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import { selectMappingEntryByKeys } from '../stateful/StatefulContract.js';
import { getEntries as getEntriesImpl } from '../stateful/sc-get-entries.js';

export async function deriveDirectCollectionLengthResult(input: {
  readonly artifact: Artifact;
  readonly abiFunction: AbiFunction;
  readonly args: readonly FunctionArgument[];
  /** Physical owner selected by the runtime graph, never a statically pinned address. */
  readonly owner: StatefulContract;
  /** Execution artifact handle, if this owner is a forwarding proxy. */
  readonly executor?: StatefulContract;
  /** Source-order guard: a prior write to this owner invalidates a pre-state replay. */
  readonly hasPriorOwnerWrite: boolean;
}): Promise<bigint | undefined> {
  const proof = input.abiFunction.directCollectionLengthReturn;
  if (!proof || input.hasPriorOwnerWrite || input.abiFunction.writesState === true
    || (input.abiFunction.externalCalls?.length ?? 0) !== 0) return undefined;
  const collection = input.artifact.stateLayout?.collections?.find((candidate) =>
    candidate.name === proof.collection);
  if (!collection || collection.kind !== 'mapping' || !collection.valueType.endsWith('[]')) {
    throw new Error('messageBus: collection-length return has no matching typed mapping');
  }
  const visible = input.abiFunction.inputs.filter((candidate) => !candidate.name.startsWith('__internal__'));
  const keys = proof.keyParams.map((name) => {
    const index = visible.findIndex((candidate) => candidate.name === name);
    if (index < 0 || index >= input.args.length) {
      throw new Error('messageBus: collection-length return has no exact key argument');
    }
    return input.args[index];
  });
  if (keys.some((value) => typeof value !== 'bigint' && typeof value !== 'boolean'
    && typeof value !== 'string' && !(value instanceof Uint8Array))) {
    throw new Error('messageBus: collection-length return key is not a scalar');
  }
  const selected = input.executor ?? input.owner;
  const selectedCollection = selected.inner.artifact.stateLayout?.collections?.find((candidate) =>
    candidate.signature === collection.signature);
  if (!selectedCollection) {
    throw new Error('messageBus: selected runtime callee does not publish the collection-length layout');
  }
  const entries = await getEntriesImpl({ inner: selected.inner, categoryId: input.owner.categoryId },
    collection.signature);
  const matched = selectMappingEntryByKeys(
    entries, keys as Array<bigint | boolean | Uint8Array | string>,
    collection.keyType ? [collection.keyType] : undefined, collection,
  );
  if (matched === undefined) return 0n;
  if (!Array.isArray(matched.value)) {
    throw new Error('messageBus: collection-length return entry is not a decoded array');
  }
  // Every entry selected by getEntries is category- and covenant-filtered. The graph's own read co-spend
  // and final VM still prove that this candidate is the exact entry consumed in this transaction.
  if (matched.slot !== undefined && entries.filter((candidate) => candidate.slot
    && binsAreEqual(candidate.slot, matched.slot!)).length !== 1) {
    throw new Error('messageBus: collection-length return has an ambiguous entry slot');
  }
  return BigInt(matched.value.length);
}
