/**
 * phase-boundary extract: SC _createBuilder extract — sorted-insert loop predecessor co-spends
 * and exact P'/NEW commitment pairs for vmap diff-key INSERT loops.
 */

import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import {
  encodePushdataValue,
  type AbiFunction,
  type StateValue,
} from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import {
  createEntryNftUnlocker,
  getEntryNftAddress,
} from './covenant-helpers.js';
import {
  SortedList,
  bytesToSlotValue,
  encodeEntryCommitment,
  keyToSlotMulti,
} from './SortedList.js';

export type LoadCreateBuilderSortedInsertLoopsHost = {
  readonly categoryId: string;
  readonly inner: any;
  [key: string]: any;
};

export type LoadCreateBuilderSortedInsertLoopsResult = {
  sortedLoopCommitments: Map<string, string[]>;
  insertLoopPredecessors: UnlockableUtxo[];
  iterationEntryInputs: UnlockableUtxo[];
  finalArgs: any[];
};

/**
 * Co-spend sorted-insert loop predecessors and record exact P'/NEW commitment
 * pairs. Mutates the commitment/predecessor bags via the returned result.
 */
export async function loadCreateBuilderSortedInsertLoops(
  host: LoadCreateBuilderSortedInsertLoopsHost,
  params: {
    entryAbiFunction: AbiFunction | undefined;
    stateLayout: any;
    overrides: any;
    entryArgs: any[];
    finalArgs: any[];
    iterationEntryInputs: UnlockableUtxo[];
    sortedLoopCommitments: Map<string, string[]>;
    insertLoopPredecessors: UnlockableUtxo[];
    [key: string]: any;
  },
): Promise<LoadCreateBuilderSortedInsertLoopsResult> {
  let {
    iterationEntryInputs, finalArgs, sortedLoopCommitments, insertLoopPredecessors,
  } = params;
  const { entryAbiFunction, stateLayout, overrides, entryArgs } = params;

  for (const info of entryAbiFunction?.sortedInsertLoopInfo ?? []) {
    const collection = (stateLayout.collections ?? []).find((c: any) => c.name === info.collection);
    if (!collection) continue;
    const entryAddr = getEntryNftAddress(host.inner, host.categoryId, collection.signature);
    const entries = (await host.inner.provider.getUtxos(entryAddr)).filter((u: any) => (
      u.token?.category === host.categoryId && u.token?.nft?.capability === 'mutable'
      && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
    ));
    const list = SortedList.fromUtxos(entries);
    const argOf = (name: string | undefined): unknown => {
      if (!name) return undefined;
      const i = entryAbiFunction!.inputs.findIndex((p: any) => p.name === name);
      return i >= 0 ? entryArgs[i] : undefined;
    };
    const keyTypes = collection.keyTypes ?? [collection.keyType];
    const encKey = (v: unknown, keyType: string): Uint8Array => (
      keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
        : typeof v === 'bigint' ? bigIntToVmNumber(v)
          : v instanceof Uint8Array ? v
            : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
              : encodePushdataValue(v as StateValue, keyType, stateLayout.structs));
    const fixedBins = info.fixedKeyParams.map((p: any, i: any) => encKey(argOf(p), keyTypes[i] ?? collection.keyType));
    const varyType = keyTypes[info.fixedKeyParams.length] ?? collection.keyType;
    let arr = argOf(info.varyingArrayParam);
    if (!Array.isArray(arr)) continue;
    let valueTail: Uint8Array;
    if (info.valueBool !== undefined) valueTail = info.valueBool ? new Uint8Array([1]) : new Uint8Array(0);
    else {
      const vv = argOf(info.valueParam);
      valueTail = typeof vv === 'boolean' ? (vv ? new Uint8Array([1]) : new Uint8Array(0))
        : typeof vv === 'bigint' ? bigIntToVmNumber(vv) : vv instanceof Uint8Array ? vv : new Uint8Array(0);
    }
    // RANGE-SPLICE: all N keys must fall in ONE gap (share the bracketing predecessor P). Co-spend P once and mint
    // the sorted chain P' -> k1 -> k2 -> .. -> kN -> P.oldNext (P' = P re-pointed to the smallest new key). N+1
    // trailing entry outputs, ONE predecessor input. The covenant verifies the chain is sorted + bracketed by P.
    let slots = (arr as unknown[]).map((elem: any) => keyToSlotMulti([...fixedBins, encKey(elem, varyType)], collection));
    if (slots.length === 0) continue;
    // The covenant walks the linked outputs in ascending slot order and now also proves each node's slot equals
    // H(the runtime key). Reorder the invariant-value key array itself so source-loop evaluation follows that same
    // order. This is semantics-preserving because every iteration assigns the same value and keys are rejected when
    // duplicated or already present. Write through to finalArgs so the unlocking bytecode carries this exact order.
    const order = slots.map((_, i) => i).sort((a, b) => (
      bytesToSlotValue(slots[a]) < bytesToSlotValue(slots[b]) ? -1 : 1
    ));
    arr = order.map((i) => (arr as unknown[])[i]);
    slots = order.map((i) => slots[i]);
    const arrIdx = entryAbiFunction!.inputs.findIndex((p: any) => p.name === info.varyingArrayParam);
    if (arrIdx >= 0) { entryArgs[arrIdx] = arr; finalArgs[arrIdx] = arr; }
    const sorted = slots;
    for (let i = 1; i < sorted.length; i++) {
      if (bytesToSlotValue(sorted[i]) === bytesToSlotValue(sorted[i - 1])) throw new Error(`vmap insert loop ${info.collection}: duplicate key`);
    }
    for (const s of sorted) if (list.has(s)) throw new Error(`vmap insert loop ${info.collection}: key already present (update-in-loop unsupported)`);
    const P = list.predecessorOf(sorted[0]);
    const pNextV = bytesToSlotValue(P.nextKey);
    const pSlotV = bytesToSlotValue(P.slot);
    for (const s of sorted) {
      const sv = bytesToSlotValue(s);
      if (!(pSlotV < sv && (pNextV === 0n || sv < pNextV))) {
        throw new Error(`vmap insert loop ${info.collection}: keys span multiple gaps (range-splice needs one gap)`);
      }
    }
    const wUnlocker = createEntryNftUnlocker(
      host.inner, overrides?.blockBase ?? 0, host.categoryId, info.collection,
    );
    const commitments: string[] = [binToHex(encodeEntryCommitment(P.slot, sorted[0], P.value))]; // P'
    for (let j = 0; j < sorted.length; j++) {
      const next = j < sorted.length - 1 ? sorted[j + 1] : P.nextKey;
      commitments.push(binToHex(encodeEntryCommitment(sorted[j], next, valueTail)));
    }
    insertLoopPredecessors.push({ ...P.utxo, unlocker: wUnlocker }); // ONE bracketing predecessor
    sortedLoopCommitments.set(info.collection, commitments);
  }


  return {
    sortedLoopCommitments,
    insertLoopPredecessors,
    iterationEntryInputs,
    finalArgs,
  };
}
