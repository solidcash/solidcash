/**
 * phase-boundary extract: SC _createBuilder extract — the collection walk a direct callee's iteration reads.
 */

import type { AbiFunction, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { loadCreateBuilderIterationInputs } from './sc-load-create-builder-iteration-inputs.js';

/** The callee contract, as the walk is listed for it: its covenant inner and the hooks a caller set on it. */
export interface NestedCalleeIterationContract {
  readonly inner: any;
  getState(): Promise<Record<string, any>>;
  readonly _iterationKeys?: Map<string, Uint8Array[]>;
  readonly _rawIterationKeysBlob?: Map<string, Uint8Array>;
  readonly _rawWindowUtxos?: Map<string, Utxo[]>;
}

/**
 * The block slots that hold no input of their own: a callee's covenant reads its first walk entry past only its input
 * slots, and past every slot once it publishes its record (`emitCollectionIterInputIndex`).
 */
const NO_INPUT_SLOT_KINDS: ReadonlySet<string> = new Set(['returnEvent', 'event', 'eventChunk', 'transfer', 'tcTransfer']);

/**
 * Append the walk a direct callee's collection iteration reads to its block: each iterated collection's entries (the
 * HEAD then the chain, for a sorted collection) as read-only inputs that its run keeps at their own indexes, and set
 * the iteration's run-size witness (`__internal__collectionIterCount_<n>`, and the keys blob of a keys walk).
 *
 * The callee reads the walk right after its block: past the block's input slots, and past every slot of the block when
 * its run publishes its record, which the builder then holds open with an input. A block assembled to another width
 * cannot place the walk where the callee reads it, so the call is refused before anything is built. The callee's run
 * checks each entry (its lock, its category, the chain from the HEAD to the tail, and its recreation at its own index),
 * so a walk laid out wrongly fails at the callee's input and never settles.
 */
export async function appendCreateBuilderNestedCalleeIterations(input: {
  bBlockInputs: UnlockableUtxo[] | undefined;
  bAbiFunc: AbiFunction;
  bStatelayout: StateLayout;
  bSc: NestedCalleeIterationContract;
  externalCategoryId: string;
  /** The callee's run publishes its record (its `__internal__returnOutputIdx` names an output). */
  publishesRecord: boolean;
  bCompilerInternalArgs: Record<string, FunctionArgument>;
  functionLabel: string;
}): Promise<UnlockableUtxo[]> {
  const { bAbiFunc, bStatelayout, bSc, externalCategoryId, publishesRecord, bCompilerInternalArgs, functionLabel } = input;
  const refuse = (what: string): never => {
    throw new Error(`The call of ${functionLabel} cannot be laid out: ${what}`);
  };
  const layout = bAbiFunc.blockLayout;
  const blockSize = layout?.blockSize ?? 1;
  const noInputSlots = (layout?.slots ?? [])
    .filter((slot) => NO_INPUT_SLOT_KINDS.has(slot.kind) && slot.offset < blockSize).length;
  const hasRecordSlot = (layout?.slots ?? []).some((slot) => slot.kind === 'returnEvent' && slot.offset < blockSize);
  const expected = blockSize - noInputSlots
    + (noInputSlots > 0 && hasRecordSlot && layout?.trailingBase === undefined && publishesRecord ? noInputSlots : 0);
  const block = input.bBlockInputs ?? refuse(`its iteration reads the walk ${expected} inputs past its master, and its `
    + 'call lays out no block');
  if (block.length !== expected) {
    refuse(`its iteration reads the walk ${expected} inputs past its master, and its block holds ${block.length}`);
  }
  // The walk only: the dynamic state the callee reads follows it, and is co-spent by the read-chunk pass.
  const loaded = await loadCreateBuilderIterationInputs(
    {
      categoryId: externalCategoryId,
      inner: bSc.inner,
      rawIterationKeysBlob: bSc._rawIterationKeysBlob,
      iterationKeys: bSc._iterationKeys,
      rawWindowUtxos: bSc._rawWindowUtxos,
      getState: () => bSc.getState(),
    },
    {
      abiFunction: { ...bAbiFunc, dynamicReads: [] },
      entryAbiFunction: undefined,
      stateLayout: bStatelayout,
      overrides: undefined,
      finalArgs: [],
    },
  );
  // The loader appends each iteration's count, then a sorted keys walk's keys blob, in iteration order.
  const witnesses = [...loaded.finalArgs];
  (bAbiFunc.collectionIterations ?? []).forEach((iteration, index) => {
    bCompilerInternalArgs[`__internal__collectionIterCount_${index}`] = witnesses.shift() as FunctionArgument;
    const collection = bStatelayout.collections?.find((candidate) => candidate.name === iteration.collection);
    if (collection?.sorted === true && iteration.mode !== 'values') {
      bCompilerInternalArgs[`__internal__collectionIterKeys_${index}`] = witnesses.shift() as FunctionArgument;
    }
  });
  return [...block, ...loaded.iterationEntryInputs];
}
