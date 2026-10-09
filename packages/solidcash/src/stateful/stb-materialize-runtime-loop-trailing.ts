/**
 * phase-boundary extract: STB build-phase extract — runtime-loop trailing entry/event/transfer materialization.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output } from '../interfaces.js';
import { calculateDust } from '../utils.js';
import type { KernelEntryJournalOutputLayoutPlan } from './KernelEntryJournal.js';
import type { RuntimeLoopTransferOutput } from './external-call-utxo-group.js';

export type LoopEntryVar = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
};

export type RuntimeLoopEventOutput = {
  lockingBytecode: Uint8Array;
  categoryId?: string;
  commitment: string;
};

export type RuntimeLoopTrailingSegment = {
  kind: string;
  collection?: string;
  offset: number;
  count: number;
};

export interface MaterializeRuntimeLoopTrailingHost {
  readonly categoryId: string;
  readonly runtimeLoopTrailingSegments: readonly RuntimeLoopTrailingSegment[];
  readonly runtimeLoopEventOutputs: readonly RuntimeLoopEventOutput[];
  readonly runtimeLoopTransferOutputs: readonly RuntimeLoopTransferOutput[];
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  readonly kernelJournalSettlementOutputPlan: readonly unknown[];
  readonly kernelJournalEagerOutputPlan: readonly unknown[];
  readonly loopEntriesBeforeDynamicChunks: boolean;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  trailingLoopEntryVars(): readonly LoopEntryVar[];
  delegateLoopEntryVars(): readonly LoopEntryVar[];
  validateKernelJournalSettlementOutputPlan(): void;
  kernelJournalOutputLayout(): KernelEntryJournalOutputLayoutPlan;
  trailingLoopEntryOutputCount(): number;
  loopEntryTransitionSatoshis(variable: LoopEntryVar, commitment: string): bigint | undefined;
  getRequiredLoopEntryCount(collection: string): number;
  getLoopEntryOutputBase(): number;
}

/**
 * Emit segmented or legacy runtime-loop trailing entry/event/transfer outputs after iteration entries.
 */
export function materializeRuntimeLoopTrailing(
  host: MaterializeRuntimeLoopTrailingHost,
  builder: { outputs: Output[]; addOutput(output: Output): unknown },
): void {
  let fixedLoopOutputIndex = host.getLoopEntryOutputBase();
  const appendLoopEntry = (
    lv: LoopEntryVar, commitment: string,
  ): void => {
    const entryOutput = {
      to: lv.lockingBytecode, amount: 1200n,
      token: { amount: 0n, category: lv.categoryId ?? host.categoryId,
        nft: { capability: 'mutable' as const, commitment } },
    };
    entryOutput.amount = host.loopEntryTransitionSatoshis(lv, commitment)
      ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
    if (host.runtimeLoopTrailingSegments.length === 0 && host.loopEntriesBeforeDynamicChunks) {
      while (builder.outputs.length <= fixedLoopOutputIndex) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      builder.outputs[fixedLoopOutputIndex++] = entryOutput;
    } else {
      builder.addOutput(entryOutput);
    }
  };
  const appendRuntimeLoopEvent = (eventIndex: number): void => {
    const event = host.runtimeLoopEventOutputs[eventIndex];
    if (!event) throw new Error(`Runtime loop event segment references missing event ${eventIndex}`);
    builder.addOutput({
      to: event.lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: event.categoryId ?? host.categoryId,
        nft: { capability: 'none', commitment: event.commitment },
      },
    });
  };
  const appendRuntimeLoopTransfer = (transferIndex: number): void => {
    const transfer = host.runtimeLoopTransferOutputs[transferIndex];
    if (!transfer) throw new Error(`Runtime loop transfer segment references missing transfer ${transferIndex}`);
    if (transfer.kind === 'token' || transfer.kind === 'nft') {
      if (!transfer.tokenContainerCategoryId) {
        throw new Error(`Runtime loop token transfer ${transferIndex} has no token category`);
      }
      builder.addOutput({
        to: transfer.lockingBytecode,
        amount: 1200n,
        token: {
          amount: transfer.kind === 'nft' ? 0n : transfer.amount,
          category: transfer.tokenContainerCategoryId,
          ...(transfer.kind === 'nft' && {
            nft: {
              capability: transfer.capability ?? 'none',
              commitment: binToHex(transfer.commitment ?? new Uint8Array()),
            },
          }),
        },
      });
    } else {
      builder.addOutput({ to: transfer.lockingBytecode, amount: transfer.amount });
    }
  };
  if (host.runtimeLoopTrailingSegments.length > 0) {
    const variables = new Map(host.trailingLoopEntryVars().map((variable) => [variable.collection, variable]));
    const hasKernelSettlementOutputPlan = host.kernelJournalSettlementOutputPlan.length > 0
      || host.kernelJournalEagerOutputPlan.length > 0;
    if (hasKernelSettlementOutputPlan) host.validateKernelJournalSettlementOutputPlan();
    // Fixed-batch predecessor rewrites occupy the leading trailing coordinates, before the source-ordered
    // runtime row stream. They share `loopEntryCommitments` with runtime mapping outputs but deliberately have
    // no runtime segment: a segment describes a source-row occurrence, while these outputs authenticate the
    // fixed entry transition surrounding that row. Previously, entering segmented mode omitted every such
    // collection and let the first runtime output occupy its advertised PredOut coordinate.
    for (const segment of host.runtimeLoopTrailingSegments) {
      if (!Number.isSafeInteger(segment.offset) || !Number.isSafeInteger(segment.count)
        || segment.offset < 0 || segment.count <= 0) {
        throw new Error('Runtime loop trailing segment has an invalid offset or count');
      }
    }
    const entrySegments = host.runtimeLoopTrailingSegments.filter((segment) => segment.kind === 'entries');
    const prefixCounts = new Map<string, number>();
    for (const collection of new Set(entrySegments.map((segment) => segment.collection!))) {
      const commitments = host.loopEntryCommitments.get(collection) ?? [];
      const intervals = entrySegments.filter((segment) => segment.collection === collection)
        .sort((left, right) => left.offset - right.offset);
      let expected = intervals[0]!.offset;
      prefixCounts.set(collection, expected);
      for (const interval of intervals) {
        if (interval.offset !== expected) {
          throw new Error(`Runtime loop entry segments for '${collection}' overlap or have a gap`);
        }
        expected += interval.count;
      }
      if (expected !== commitments.length) {
        throw new Error(
          `Runtime loop entry segments for '${collection}' cover ${expected} of ${commitments.length} commitments`,
        );
      }
    }
    for (const [kind, length] of [
      ['events', host.runtimeLoopEventOutputs.length],
      ['transfers', host.runtimeLoopTransferOutputs.length],
    ] as const) {
      const intervals = host.runtimeLoopTrailingSegments.filter((segment) => segment.kind === kind)
        .sort((left, right) => left.offset - right.offset);
      let expected = 0;
      for (const interval of intervals) {
        if (interval.offset !== expected) {
          throw new Error(`Runtime loop ${kind} segments overlap or have a gap`);
        }
        expected += interval.count;
      }
      if (expected !== length) {
        throw new Error(`Runtime loop ${kind} segments cover ${expected} of ${length} outputs`);
      }
    }
    if (hasKernelSettlementOutputPlan) {
      const layout = host.kernelJournalOutputLayout();
      if (layout.finalOutputCursorDelta !== host.trailingLoopEntryOutputCount()) {
        throw new Error(
          `Kernel journal output layout covers ${layout.finalOutputCursorDelta} of `
          + `${host.trailingLoopEntryOutputCount()} trailing entry commitments`,
        );
      }
      for (const entry of layout.outputs) {
        const variable = variables.get(entry.collection);
        const commitment = host.loopEntryCommitments.get(entry.collection)?.[entry.offset];
        if (!variable || commitment === undefined) {
          throw new Error(`Kernel journal settlement plan references missing ${entry.collection}[${entry.offset}]`);
        }
        appendLoopEntry(variable, commitment);
      }
    } else {
      for (const variable of host.trailingLoopEntryVars()) {
        const commitments = host.loopEntryCommitments.get(variable.collection) ?? [];
        const prefixCount = prefixCounts.get(variable.collection) ?? commitments.length;
        for (let index = 0; index < prefixCount; index++) {
          appendLoopEntry(variable, commitments[index]!);
        }
      }
    }
    for (const segment of host.runtimeLoopTrailingSegments) {
      if (segment.kind === 'events') {
        for (let index = 0; index < segment.count; index++) {
          appendRuntimeLoopEvent(segment.offset + index);
        }
        continue;
      }
      if (segment.kind === 'transfers') {
        for (let index = 0; index < segment.count; index++) {
          appendRuntimeLoopTransfer(segment.offset + index);
        }
        continue;
      }
      if (hasKernelSettlementOutputPlan) continue;
      const variable = variables.get(segment.collection!);
      if (!variable) throw new Error(`Runtime loop segment references unknown collection '${segment.collection}'`);
      const commitments = host.loopEntryCommitments.get(segment.collection!) ?? [];
      for (let index = 0; index < segment.count; index++) {
        const commitment = commitments[segment.offset + index];
        if (commitment === undefined) {
          throw new Error(
            `Runtime loop segment for '${segment.collection}' exceeds its commitment plan `
            + `(${segment.offset + segment.count} > ${commitments.length}; `
            + `required=${host.getRequiredLoopEntryCount(segment.collection!)})`,
          );
        }
        appendLoopEntry(variable, commitment);
      }
    }
  } else {
    if (host.loopEntriesBeforeDynamicChunks || host.delegateEntriesAfterLowLevel) {
      // Legacy delegated upsert collections are restored at transaction-suffix coordinates by
      // `_reassertDelegateLoopEntries`. Appending them here as well would duplicate their outputs and shift
      // the indexed P'/NEW lane. Compiler-routed delegates instead own these entries inside their authenticated
      // participant frame, so they must be emitted here exactly once.
      const delegateCollections = new Set((host.compilerRouteDelegateBlock
        ? [] : host.delegateLoopEntryVars()).map((variable) => variable.collection));
      for (const lv of host.trailingLoopEntryVars()) {
        if (delegateCollections.has(lv.collection)) continue;
        for (const commitment of host.loopEntryCommitments.get(lv.collection) ?? []) {
          appendLoopEntry(lv, commitment);
        }
      }
    }

    // Runtime-loop events and their fixed peers are source-ordered records, independent of the permutation used
    // to settle mapping keys. Their exact count is known from the event plan, while commitments are learned
    // progressively from the covenant trace.
    for (let eventIndex = 0; eventIndex < host.runtimeLoopEventOutputs.length; eventIndex++) {
      appendRuntimeLoopEvent(eventIndex);
    }
    for (let transferIndex = 0; transferIndex < host.runtimeLoopTransferOutputs.length; transferIndex++) {
      appendRuntimeLoopTransfer(transferIndex);
    }
  }
}
