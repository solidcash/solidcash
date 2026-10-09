/**
 * phase-boundary extract: SC _createBuilder extract — cross-contract nested-callee LOOP write co-spends.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AbiFunction, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import {
  createEntryNftUnlocker,
  getEntryNftAddress,
} from './covenant-helpers.js';
import { SortedList, keyToSlotMulti, encodeEntryCommitment } from './SortedList.js';

export interface AppendCreateBuilderNestedCalleeLoopWritesHost {
  getUtxos(address: string): Promise<Utxo[]>;
}

export interface AppendCreateBuilderNestedCalleeLoopWritesResult {
  bBlockInputs: UnlockableUtxo[];
  bEntryLoopCommitments: string[] | undefined;
  bEntryLoopStart: number | undefined;
  bEntryLoopCollection: string | undefined;
}

/**
 * Append trailing UPDATE-only loop entry co-spends for a nested callee whose ABI
 * publishes `sortedUpsertLoopInfo`. Inserts and multi-collection loops fail closed.
 */
export async function appendCreateBuilderNestedCalleeLoopWrites(
  host: AppendCreateBuilderNestedCalleeLoopWritesHost,
  input: {
    bBlockInputs: UnlockableUtxo[];
    bAbiFunc: AbiFunction;
    bBlockLayout: NonNullable<AbiFunction['blockLayout']> | undefined;
    bStatelayout: StateLayout;
    bSc: { inner: any };
    callInfoArgs: FunctionArgument[];
    externalCategoryId: string;
  },
): Promise<AppendCreateBuilderNestedCalleeLoopWritesResult> {
  const {
    bAbiFunc, bBlockLayout, bStatelayout, bSc, callInfoArgs, externalCategoryId,
  } = input;
  const bBlockInputs = [...input.bBlockInputs];
  let bEntryLoopCommitments: string[] | undefined;
  let bEntryLoopStart: number | undefined;
  let bEntryLoopCollection: string | undefined;

  const bLoopInfos = bAbiFunc.sortedUpsertLoopInfo!;
  if (bLoopInfos.length > 1) {
    throw new Error('cross-contract callee loop over multiple collections is not supported (fails closed).');
  }
  const bCore = bBlockInputs.length; // loop entries begin here (== B's blockSize for a dense block)
  if (bCore !== (bBlockLayout?.blockSize ?? bCore) || bCore > 1) {
    // The callee loop function must touch ONLY the looped mapping (block = master alone). A callee that also
    // reads/writes OTHER state (a data NFT slot) needs its data-NFT derivation interleaved with the loop
    // co-spend; not yet wired, so fail closed cleanly rather than emitting a mispositioned block.
    throw new Error('cross-contract callee loop: the callee loop function must access only the looped mapping '
      + '(a callee that also reads/writes other state is not yet supported cross-contract; fails closed).');
  }
  const bLoopCommitments: string[] = [];
  const bArgOf = (name: string | undefined): unknown => {
    if (!name) return undefined;
    const i = bAbiFunc.inputs.findIndex((p) => p.name === name);
    return i >= 0 ? callInfoArgs[i] : undefined;
  };
  const encK = (v: unknown, keyType: string): Uint8Array => (
    keyType === 'address' && typeof v === 'string' && v.includes(':') ? addressToLockScript(v)
      : typeof v === 'bigint' ? bigIntToVmNumber(v)
        : v instanceof Uint8Array ? v
          : typeof v === 'boolean' ? bigIntToVmNumber(v ? 1n : 0n)
            : bigIntToVmNumber(BigInt(v as string)));
  const toB = (v: unknown): bigint => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number' || typeof v === 'string') return BigInt(v);
    throw new Error('cross-contract callee loop: non-int value is not supported cross-contract (fails closed).');
  };
  for (const li of bLoopInfos) {
    if (li.op !== '+' && li.op !== 'set') {
      throw new Error(`cross-contract callee loop op '${li.op}' on '${li.collection}' is not supported `
        + '(fails closed).');
    }
    const bColl = (bStatelayout.collections ?? []).find((c) => c.name === li.collection);
    if (!bColl) {
      throw new Error(`cross-contract callee loop: collection '${li.collection}' not in callee layout.`);
    }
    const keyTypes = bColl.keyTypes ?? [bColl.keyType];
    const varyType = keyTypes[li.fixedKeyParams.length] ?? bColl.keyType;
    const fixedBins = li.fixedKeyParams.map((p, i) => encK(bArgOf(p), keyTypes[i] ?? bColl.keyType));
    const ks = bArgOf(li.varyingArrayParam);
    if (!Array.isArray(ks)) {
      throw new Error(`cross-contract callee loop: key array '${li.varyingArrayParam}' missing.`);
    }
    const vs = li.valueArrayParam ? bArgOf(li.valueArrayParam) : undefined;
    const scalarV = li.valueScalarParam !== undefined ? toB(bArgOf(li.valueScalarParam))
      : li.valueConst !== undefined ? BigInt(li.valueConst) : undefined;
    const bEntryAddr = getEntryNftAddress(bSc.inner, externalCategoryId, bColl.signature);
    const bList = SortedList.fromUtxos((await host.getUtxos(bEntryAddr)).filter((u) => (
      u.token?.category === externalCategoryId && u.token?.nft?.capability === 'mutable'
      && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0)));
    const seen = new Set<string>();
    for (let i = 0; i < ks.length; i++) {
      const slot = keyToSlotMulti([...fixedBins, encK(ks[i], varyType)], bColl);
      const slotHex = binToHex(slot);
      if (seen.has(slotHex)) {
        throw new Error(`cross-contract callee loop on '${li.collection}': duplicate key (fails closed).`);
      }
      seen.add(slotHex);
      const entry = bList.find(slot);
      if (!entry) {
        throw new Error(`cross-contract callee loop on '${li.collection}': key ${i} has no entry - a `
          + 'cross-contract insert is not supported (fails closed).');
      }
      const oldVal = vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint;
      const add = vs ? toB((vs as unknown[])[i]) : scalarV!;
      const newVal = li.op === 'set' ? add : oldVal + add;
      bLoopCommitments.push(
        binToHex(encodeEntryCommitment(entry.slot, entry.nextKey, bigIntToVmNumber(newVal))),
      );
      // Co-spend the entry (write mode). masterInputIndex is patched to B's real master at derive time.
      bBlockInputs.push({
        ...entry.utxo,
        unlocker: createEntryNftUnlocker(bSc.inner, 0, externalCategoryId, bColl.signature),
      });
    }
    bEntryLoopCollection = bColl.signature;
  }
  if (bLoopCommitments.length > 0) { bEntryLoopCommitments = bLoopCommitments; bEntryLoopStart = bCore; }

  return {
    bBlockInputs,
    bEntryLoopCommitments,
    bEntryLoopStart,
    bEntryLoopCollection,
  };
}
