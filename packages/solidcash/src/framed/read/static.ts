/**
 * A transaction-less read of a framed contract's storage.
 *
 * A framed contract's values already live in UTXOs: each data NFT's commitment holds the state records, a mapping
 * value is a node of a sorted collection at that collection's entry covenant, a dynamic string's bytes sit in chunk
 * UTXOs, and the contract's native balance is the value of its satoshi containers. Reading one of those values needs
 * a snapshot of the category's UTXOs and a decode — no master, no validator, no derived transaction.
 *
 * The framed read (`readFramedEntry`) stays the general path: it runs the entry's body, which is what a computed
 * view needs. This module answers the subset whose value the chain states directly:
 *
 * - A storage getter is one the compiler publishes with `directStateReturn`: its whole body is `return <state>;`
 *   (or a tuple of state variables), in output order. A computed body (`return total * 2;`) reads the same variable
 *   but publishes no proof, so it stays on the framed read.
 * - A mapping getter is one the artifact publishes with `directMappingReturn`; its node is located by the key the
 *   call's arguments encode, exactly as the frame's own access resolves it.
 * - A getter the compiler names in `composition.balanceReaders` reads the native balance from the satoshi
 *   containers.
 *
 * A pure constant (`return 18;`) has no UTXO and no analysis read, so it stays the caller's; `read` returns
 * `undefined` for it, as it does for any entry it cannot answer.
 *
 * The caller keeps the snapshot: one load serves a page's reads, and a write invalidates it.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  bytesEqual,
  bytesToHex,
  type AbiFunction,
  type Artifact,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import { encodeFunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { StateReader } from '../../stateful/StateReader.js';
import { collectionKeyEncoding } from '../composer/mapping-plan.js';
import {
  categoryCoinsAtLocks,
  chunkRecordLockingBytecode,
  classifyFramedDeployment,
  framedCollectionLocks,
  framedRecordLocks,
  framedStateLocks,
  framedValueChunks,
  readSatoshiContainers,
} from '../deploy/records.js';

/** Raised when a storage snapshot cannot be taken or a value cannot be decoded from it. */
export class FramedStaticReadError extends Error {
  public readonly name = 'FramedStaticReadError';

  public constructor(message: string) {
    super(message);
  }
}

export interface FramedStorageOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  /**
   * Leaves a provider that lists by lock to load the mapping nodes at the first mapping read, each collection being a
   * listing of its own, so a page that wants only records asks for one lock a contract. `nodesByCollection` then holds
   * what has been loaded. A provider that indexes categories has them all in one call, and this changes nothing.
   */
  readonly lazyMappings?: boolean;
}

/**
 * One category's live storage, decoded. `read` answers the entries the UTXOs state, in the getter's output order;
 * `undefined` means the caller needs the framed read (a computed view, a pure constant, or a value the snapshot
 * cannot decode).
 */
export interface FramedStorageSnapshot {
  readonly categoryId: string;
  readonly artifact: Artifact;
  readonly records: readonly Utxo[];
  readonly nodesByCollection: ReadonlyMap<string, readonly Utxo[]>;
  /** Every record variable by name, dynamic values assembled from their chunks. */
  readonly state: Readonly<Record<string, StateValue>>;
  /** The contract's native balance, read from its satoshi containers on first use. */
  nativeBalance(): Promise<bigint>;
  read(functionName: string, args?: readonly FunctionArgument[]): Promise<readonly StateValue[] | undefined>;
}

/** The category's UTXOs: by category where the provider indexes them, else at the locks the layout derives. */
async function categoryUtxos(
  options: FramedStorageOptions, layout: StateLayout, withMappings: boolean,
): Promise<readonly Utxo[]> {
  const { provider, categoryId } = options;
  if (typeof provider.getUtxosByTokenCategory === 'function') {
    return provider.getUtxosByTokenCategory(categoryId);
  }
  const locks = withMappings ? framedStateLocks(categoryId, layout) : framedRecordLocks(categoryId, layout);
  const coins = await categoryCoinsAtLocks(provider, categoryId, locks);
  return [...coins, ...await framedValueChunks(provider, categoryId, layout, coins)];
}

/** The nodes of the category's collections, with their long values' chunks, keyed by collection. */
async function mappingNodes(
  options: FramedStorageOptions, layout: StateLayout,
): Promise<ReadonlyMap<string, readonly Utxo[]>> {
  const { provider, categoryId } = options;
  const coins = await categoryCoinsAtLocks(provider, categoryId, framedCollectionLocks(categoryId, layout));
  return classifyFramedDeployment(
    [...coins, ...await framedValueChunks(provider, categoryId, layout, coins)], layout,
  ).nodesByCollection;
}

/**
 * The record variables, with each dynamic value joined from the chunks at its own covenant. The SDK's reader owns
 * the chunk commitment format, so this does not restate it.
 */
function readState(
  artifact: Artifact, layout: StateLayout, categoryId: string, utxos: readonly Utxo[], records: readonly Utxo[],
): Record<string, StateValue> {
  const dynamic = (layout.variables ?? []).filter((variable) => variable.dynamic === true);
  const byVariable: Record<string, Utxo[]> = {};
  for (const variable of dynamic) {
    const lock = bytesToHex(chunkRecordLockingBytecode(categoryId, variable.name, variable.type));
    byVariable[variable.name] = utxos.filter((utxo) =>
      utxo.lockingBytecode !== undefined && bytesToHex(utxo.lockingBytecode) === lock);
  }
  const reader = new StateReader(layout);
  return reader.readState(
    records as Utxo[],
    dynamic.length === 0 ? undefined : { categoryId, byVariable },
  );
}

/** Whether the compiler names this getter a reader of the contract's native balance (`address(this).balance`). */
function readsNativeBalance(artifact: Artifact, functionName: string): boolean {
  return (artifact.composition?.balanceReaders ?? [])
    .some((reader) => reader === `${artifact.contractName}.${functionName}()`);
}

/** The value a mapping answers for a key no node holds, as the framed read states it. */
function zeroValue(type: string | undefined): StateValue | undefined {
  if (type === undefined) return undefined;
  if (type === 'address' || type === 'address payable') return new Uint8Array(0);
  if (/^u?int\d*$/.test(type)) return 0n;
  if (type === 'bool') return false;
  if (/^bytes\d+$/.test(type)) return new Uint8Array(Number(type.slice(5)));
  return undefined;
}

/** A mapping value's tail, decoded by the collection's value type. */
function decodeValue(type: string | undefined, tail: Uint8Array): StateValue | undefined {
  if (type === undefined) return undefined;
  if (type === 'address' || type === 'address payable') {
    if (tail.length === 0) return tail;
    if (tail.length === 20 || tail.length === 23 || tail.length === 25 || tail.length === 35) return tail;
    // An ABI word whose first 12 bytes are zero is an address; other words are not one.
    if (tail.length === 32 && tail.subarray(0, 12).every((byte) => byte === 0)) return tail.subarray(12);
    return undefined;
  }
  if (/^u?int\d*$/.test(type)) {
    if (tail.length > 33) return undefined;
    try { return vmNumberToBigInt(tail); } catch { return undefined; }
  }
  if (type === 'bool') {
    if (tail.length > 2) return undefined;
    try { return vmNumberToBigInt(tail) !== 0n; } catch { return undefined; }
  }
  if (/^bytes\d+$/.test(type)) {
    return tail.length === Number(type.slice(5)) ? tail : undefined;
  }
  return undefined;
}

/** The values a mapping getter returns: the node its key names, or the value type's zero. */
function readMapping(
  artifact: Artifact,
  layout: StateLayout,
  nodesByCollection: ReadonlyMap<string, readonly Utxo[]>,
  entry: AbiFunction,
  args: readonly FunctionArgument[],
): readonly StateValue[] | undefined {
  const request = entry.directMappingReturn;
  if (request === undefined) return undefined;
  const collection = (layout.collections ?? []).find((candidate) => candidate.name === request.collection);
  if (collection === undefined || collection.valueType === undefined) return undefined;
  const keys: Uint8Array[] = [];
  for (const name of request.keyParams) {
    const index = (entry.inputs ?? []).findIndex((input) => input.name === name);
    if (index < 0 || index >= args.length) return undefined;
    const encoded = encodeFunctionArgument(args[index]!, entry.inputs[index]!.type, artifact.structs);
    if (!(encoded instanceof Uint8Array)) return undefined;
    keys.push(encoded);
  }
  // A live collection always holds its head sentinel, so no nodes at all is no answer: Fulcrum lists a lock past its
  // `max_history` as empty, and reading that as a key nobody set would state a zero the chain does not hold.
  const nodes = nodesByCollection.get(collection.name) ?? [];
  if (nodes.length === 0) return undefined;
  const slot = keyToSlotMulti(keys, collectionKeyEncoding(artifact, collection.name));
  const node = nodes.find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined
      && bytesEqual(decodeEntryCommitment(hexToBin(commitment)).slot, slot);
  });
  if (node === undefined) {
    const zero = zeroValue(collection.valueType);
    return zero === undefined ? undefined : [zero];
  }
  const commitment = node.token?.nft?.commitment;
  if (commitment === undefined) return undefined;
  const tail = decodeEntryCommitment(hexToBin(commitment)).value;
  const value = decodeValue(collection.valueType, tail);
  return value === undefined ? undefined : [value];
}

/** Loads one category's storage from its UTXOs. The caller caches the snapshot for a page's reads. */
export async function readFramedStorage(options: FramedStorageOptions): Promise<FramedStorageSnapshot> {
  const { provider, artifact, categoryId } = options;
  const layout = artifact.stateLayout;
  if (layout === undefined) {
    throw new FramedStaticReadError(`contract "${artifact.contractName}" publishes no state layout`);
  }
  // Only a provider that lists by lock pays per collection, and only where its caller has no use for them yet.
  const deferMappings = options.lazyMappings === true && typeof provider.getUtxosByTokenCategory !== 'function';
  const utxos = await categoryUtxos(options, layout, !deferMappings);
  const deployment = classifyFramedDeployment(utxos, layout);
  const state = readState(artifact, layout, categoryId, utxos, deployment.records);
  let nodes: Promise<ReadonlyMap<string, readonly Utxo[]>> | undefined;
  const nodesLoaded = new Map(deployment.nodesByCollection);
  const loadNodes = (): Promise<ReadonlyMap<string, readonly Utxo[]>> => {
    if (!deferMappings) return Promise.resolve(nodesLoaded);
    nodes ??= mappingNodes(options, layout).then((found) => {
      for (const [name, collection] of found) nodesLoaded.set(name, collection);
      return nodesLoaded;
    });
    return nodes;
  };

  let balance: Promise<bigint> | undefined;
  const nativeBalance = (): Promise<bigint> => (balance ??= readSatoshiContainers(provider, categoryId)
    .then((containers) => containers.reduce((sum, container) => sum + container.satoshis, 0n)));

  return {
    categoryId,
    artifact,
    records: deployment.records,
    nodesByCollection: nodesLoaded,
    state,
    nativeBalance,
    async read(functionName, args = []) {
      const entry = artifact.abi.find((candidate) => candidate.name === functionName);
      if (entry === undefined || entry.writesState === true) return undefined;
      if (entry.directMappingReturn !== undefined) {
        return readMapping(artifact, layout, await loadNodes(), entry, args);
      }
      if (readsNativeBalance(artifact, functionName)) return [await nativeBalance()];
      // The compiler proves the whole body returns these state variables, in the declared output order. A `null`
      // is a named return the body never assigns, so that output is its type's zero.
      const direct = entry.directStateReturn;
      const outputs = entry.outputs ?? [];
      if (direct === undefined || direct.variables.length !== outputs.length) return undefined;
      const values = direct.variables.map((variable, index) => (variable === null
        ? zeroValue(outputs[index]?.type)
        : state[variable]));
      if (values.some((value) => value === undefined)) return undefined;
      return values as StateValue[];
    },
  };
}
