/**
 * phase-boundary extract: SC _createBuilder extract — collection-iteration entry inputs and
 * persisted dynamic-storage read chunk co-spends.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildEntryNftCovenantScript,
  computeCollectionHash,
  parseChunkCommitment,
  type AbiFunction,
} from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { scriptToAddress } from '../utils.js';
import {
  createReadOnlyDynamicChunkUnlocker,
  createReadOnlyEntryNftUnlocker,
  directConventionMasterLock,
  getDynamicChunkAddress,
} from './covenant-helpers.js';
import {
  SortedList,
  bytesToSlotValue,
  keyToSlotMulti,
} from './SortedList.js';

export type LoadCreateBuilderIterationInputsHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly rawIterationKeysBlob: Map<string, any> | undefined;
  readonly iterationKeys: Map<string, any> | undefined;
  /** Read the current on-chain state (lazily, only when a windowed iteration needs its cursor). */
  readonly getState?: () => Promise<Record<string, any>>;
  [key: string]: any;
};

export type LoadCreateBuilderIterationInputsResult = {
  iterationEntryInputs: UnlockableUtxo[];
  dynamicReadChunkInputs: UnlockableUtxo[];
  finalArgs: any[];
  dynamicReads: readonly string[];
};

/**
 * The contiguous window a windowed (paginated) iteration co-spends: the anchor entry whose slot equals the
 * persisted cursor (HEAD for cursor 0) followed by at most `bound` chain successors, stopped at the tail.
 */
function windowedIterationUtxos(list: SortedList, cursor: Uint8Array, bound: number): any[] {
  const zeroSlot = new Uint8Array(32);
  const anchor = bytesToSlotValue(cursor) === 0n
    ? list.find(zeroSlot) // first page: HEAD sentinel (slot 0)
    : list.find(cursor);
  if (!anchor) {
    throw new Error(`windowed iteration anchor (cursor ${binToHex(cursor)}) is not a present entry`);
  }
  const ordered = [anchor.utxo];
  let next = anchor.nextKey;
  for (let i = 0; i < bound; i++) {
    if (bytesToSlotValue(next) === 0n) break; // reached the tail
    const entry = list.find(next);
    if (!entry) throw new Error(`windowed iteration chain is broken: entry ${binToHex(next)} missing`);
    ordered.push(entry.utxo);
    next = entry.nextKey;
  }
  return ordered;
}

function cursorSlotBytes(value: unknown, name: string): Uint8Array {
  if (value instanceof Uint8Array) {
    if (value.length !== 32) throw new Error(`windowed iteration cursor '${name}' must be 32 bytes, got ${value.length}`);
    return value;
  }
  if (typeof value === 'string') {
    const bin = hexToBin(value.replace(/^0x/, ''));
    if (bin.length !== 32) throw new Error(`windowed iteration cursor '${name}' must be 32 bytes`);
    return bin;
  }
  throw new Error(`windowed iteration cursor '${name}' has unsupported state value type ${typeof value}`);
}

/**
 * Fetch collection-iteration entry NFTs and co-spend persisted dynamic-storage
 * read chunks into trailing input vectors. May append iteration count/keys
 * witnesses onto finalArgs.
 */
export async function loadCreateBuilderIterationInputs(
  host: LoadCreateBuilderIterationInputsHost,
  params: {
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    stateLayout: any;
    overrides: any;
    finalArgs: any[];
    [key: string]: any;
  },
): Promise<LoadCreateBuilderIterationInputsResult> {
  const { abiFunction, entryAbiFunction, stateLayout, overrides } = params;

  let { finalArgs } = params;


  // Handle collection iteration: fetch all entry NFTs for iterated collections
  const collectionIterations = abiFunction?.collectionIterations;
  let iterationEntryInputs: UnlockableUtxo[] = [];
  // This separate identity vector excludes collection-iteration NFTs which share the physical input array.
  const dynamicReadChunkInputs: UnlockableUtxo[] = [];
  if (collectionIterations && collectionIterations.length > 0 && stateLayout.collections) {
    for (const iter of collectionIterations) {
      const coll = stateLayout.collections.find((c: any) => c.name === iter.collection);
      if (!coll) throw new Error(`Unknown collection: ${iter.collection}`);

      // Get all entry NFTs for this collection from on-chain state
      const collectionHash = computeCollectionHash(coll.signature);
      const entryCovenantScript = buildEntryNftCovenantScript(
        hexToBin(host.categoryId), collectionHash, directConventionMasterLock(host.inner as any),
      );
      const entryAddress = scriptToAddress(entryCovenantScript, host.inner.provider.network, host.inner.addressType, true);
      const utxos = await host.inner.provider.getUtxos(entryAddress);
      const entryUtxos = utxos.filter((u: any) =>
        u.token?.category === host.categoryId
        && u.token?.nft?.capability === 'mutable'
        && u.token?.nft?.commitment
        && u.token.nft.commitment.length > 0,
      );

      // For a SORTED (enumerable) collection, iteration is a trustless LINKAGE walk: the covenant co-spends
      // the HEAD sentinel (slot 0) and follows nextKey to the tail, proving completeness by the chain. So
      // co-spend the HEAD FIRST, then the entries in ASCENDING slot order (the chain order). A plain
      // (non-sorted) collection keeps the caller-window order.
      let orderedUtxos = entryUtxos;
      let sortedRest: { slot: Uint8Array }[] = [];
      if (coll.sorted) {
        const list = SortedList.fromUtxos(entryUtxos);
        if (iter.windowCursor !== undefined && iter.windowBound !== undefined) {
          // Windowed (paginated) iteration: co-spend the anchor whose slot == cursor (HEAD for cursor 0) and the
          // next K chain successors, so the covenant walks a bounded contiguous window and writes the new cursor.
          if (!host.getState) throw new Error('windowed iteration requires getState to read the cursor');
          const state = await host.getState();
          const cursor = cursorSlotBytes(state[iter.windowCursor], iter.windowCursor);
          orderedUtxos = windowedIterationUtxos(list, cursor, iter.windowBound);
        } else {
          const head = list.all.find((e: any) => bytesToSlotValue(e.slot) === 0n);
          if (!head) throw new Error(`Enumerable mapping '${coll.name}' is missing its HEAD sentinel (slot 0)`);
          const rest = list.all.filter((e: any) => bytesToSlotValue(e.slot) !== 0n); // list.all is already ascending
          orderedUtxos = [head.utxo, ...rest.map((e) => e.utxo)];
          sortedRest = rest;
        }
      }

      // Add as read-only inputs
      for (const utxo of orderedUtxos) {
        const unlocker = createReadOnlyEntryNftUnlocker(host.inner, host.categoryId, coll.name);
        const input = { ...utxo, unlocker };
        iterationEntryInputs.push(input);
      }

      // Append _collectionIterCount_<N> argument (the iteration run size = HEAD + entries when sorted; used for
      // block-layout offset accounting, not as the linkage loop bound - the chain self-terminates at the tail).
      finalArgs = [...finalArgs, BigInt(orderedUtxos.length)];

      // KEYS/ENTRIES over a sorted mapping: append the keys blob (caller-supplied via setIterationKeys, ordered
      // to the ascending chain so blob[i*W:] is the key for entry base+1+i). The covenant splits keyWidth bytes
      // per entry and verifies keyToSlot(key)==slot; a wrong key hashes elsewhere and a missing entry breaks the
      // chain, so both revert.
      if (coll.sorted && iter.mode !== 'values') {
        const rawOverride = host.rawIterationKeysBlob?.get(coll.name);
        if (rawOverride) {
          finalArgs = [...finalArgs, rawOverride]; // test hook: verbatim blob (malicious-spender simulation)
        } else {
          const callerKeys = host.iterationKeys?.get(coll.name);
          if (!callerKeys) {
            throw new Error(`Iterating keys/entries of sorted enumerable mapping '${coll.name}' requires the keys: `
              + `call setIterationKeys('${coll.name}', [...]) before the iteration (the raw key is not on-chain).`);
          }
          const keyBySlot = new Map<string, Uint8Array>();
          for (const k of callerKeys) keyBySlot.set(binToHex(keyToSlotMulti([k], coll)), k);
          // Length-prefixed blob: each entry's key as (1-byte length ++ key bytes), in ascending-chain order.
          // Supports variable-width keys (int, address) as well as bytesN; the covenant reads the prefix.
          const parts: Uint8Array[] = [];
          for (const e of sortedRest) {
            const k = keyBySlot.get(binToHex(e.slot));
            if (!k) throw new Error(`No supplied key hashes to entry slot ${binToHex(e.slot)} in '${coll.name}'`);
            if (k.length > 255) throw new Error(`Key too long to length-prefix (${k.length} B) in '${coll.name}'`);
            parts.push(Uint8Array.from([k.length]), k);
          }
          const total = parts.reduce((n, p) => n + p.length, 0);
          const blob = new Uint8Array(total);
          let off = 0;
          for (const p of parts) { blob.set(p, off); off += p.length; }
          finalArgs = [...finalArgs, blob];
        }
      }
    }
  }

  // Persisted dynamic-storage reads: co-spend the var's chunks as read-only trailing inputs (ordered by
  // chunkIndex so input blockSize+i is chunk i), preserved as outputs. Reuses iterationEntryInputs.
  // A delegated call publishes the row's dynamic-storage metadata on the entry ABI while the executing ABI
  // describes only the forwarder, so fill the reads in from the entry function. The route's published union is
  // deliberately not used here: co-spending a dispatchable collection the row does not read would shift the
  // compiled trailing band.
  const entryDynamicStorage = entryAbiFunction as
    { dynamicReads?: readonly string[]; dynamicWrites?: readonly string[] } | undefined;
  const dynamicReads = abiFunction?.dynamicReads?.length
    ? abiFunction.dynamicReads
    : [...new Set(entryDynamicStorage?.dynamicReads ?? [])];
  const dynamicWriteNames = [...new Set([
    ...(abiFunction?.dynamicWrites ?? []),
    ...(entryDynamicStorage?.dynamicWrites ?? []),
  ])];
  if (dynamicReads.length > 0) {
    for (const varName of dynamicReads) {
      // Read-modify-write var: its chunks are co-spent below by the write path (in chunkIndex order, so
      // the read loop still reads chunk i at blockSize+i). Skip here to avoid co-spending the same UTXO twice.
      if (dynamicWriteNames.includes(varName)) continue;
      const dynVar = (stateLayout.variables ?? []).find((v: any) => v.name === varName && v.dynamic);
      if (!dynVar) continue;
      const chunkAddr = getDynamicChunkAddress(host.inner, host.categoryId, dynVar.name, dynVar.type);
      const utxos = await host.inner.provider.getUtxos(chunkAddr);
      const chunks = utxos
        .filter((u: any) => u.token?.category === host.categoryId
          && u.token?.nft?.capability === 'mutable'
          && u.token?.nft?.commitment && u.token.nft.commitment.length > 0)
        .map((u: any) => ({ utxo: u, chunkIndex: parseChunkCommitment(u.token!.nft!.commitment).chunkIndex }))
        .sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      for (const { utxo } of chunks) {
        const unlocker = createReadOnlyDynamicChunkUnlocker(
          host.inner, overrides?.blockBase ?? 0, host.categoryId, dynVar.name, dynVar.type,
        );
        const input = { ...utxo, unlocker };
        iterationEntryInputs.push(input);
        dynamicReadChunkInputs.push(input);
      }
    }
  }

  return {
    iterationEntryInputs,
    dynamicReadChunkInputs,
    finalArgs,
    dynamicReads,
  };
}
