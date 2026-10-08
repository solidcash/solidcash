/**
 * phase-boundary extract: STB build-phase extract — debugAtomicOutputStage + debugOwnMutableOutputs helpers.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { FunctionBlockLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export type PendingReturnEventLike = {
  identity: string;
  categoryId: string;
  commitment: Uint8Array;
};

export interface CreateBuildDebugStagesHost {
  readonly categoryId: string;
  readonly blockLayout?: FunctionBlockLayout;
  readonly pendingReturnEventOutputs: readonly PendingReturnEventLike[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly loopEntryVars: ReadonlyArray<{ categoryId?: string }>;
}

export interface BuildDebugStages {
  debugAtomicOutputStage: (stage: string) => void;
  debugOwnMutableOutputs: (stage: string) => void;
}

/**
 * Build the optional debug stage dumpers used throughout `build()`.
 */
export function createBuildDebugStages(
  host: CreateBuildDebugStagesHost,
  builder: TransactionBuilder,
  buildTiming: (stage: string, builder?: TransactionBuilder) => void,
): BuildDebugStages {
  let debugOutputFingerprint: string | undefined;
  const debugAtomicOutputStage = (stage: string): void => {
    buildTiming(stage, builder);
    const debugOutputIndexRaw = (globalThis as {
      process?: { env?: Record<string, string> };
    }).process?.env?.SOLIDC_DEBUG_OUTPUT_INDEX;
    const debugOutputIndex = debugOutputIndexRaw === undefined
      ? undefined : Number.parseInt(debugOutputIndexRaw, 10);
    const debugOutputCategory = (globalThis as {
      process?: { env?: Record<string, string> };
    }).process?.env?.SOLIDC_DEBUG_OUTPUT_CATEGORY?.toLowerCase();
    if (debugOutputIndex !== undefined && Number.isInteger(debugOutputIndex) && debugOutputIndex >= 0
    && (!debugOutputCategory || host.categoryId.toLowerCase().startsWith(debugOutputCategory))) {
      const output = builder.outputs[debugOutputIndex];
      const fingerprint = output === undefined ? 'missing' : JSON.stringify({
        amount: String(output.amount),
        lock: output.to instanceof Uint8Array ? binToHex(output.to) : output.to,
        category: output.token?.category,
        tokenAmount: String(output.token?.amount ?? 0n),
        capability: output.token?.nft?.capability,
        commitment: output.token?.nft?.commitment,
      });
      if (fingerprint !== debugOutputFingerprint) {
        console.error('stateful-output-transition', JSON.stringify({
          stage,
          index: debugOutputIndex,
          rootCategory: host.categoryId.slice(0, 16),
          output: fingerprint === 'missing' ? undefined : JSON.parse(fingerprint),
        }));
        debugOutputFingerprint = fingerprint;
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1' && (host.blockLayout?.blockSize ?? 0) > 100 && stage === 'final') {
      const returnSlot = host.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
      const output = returnSlot ? builder.outputs[returnSlot.offset] : undefined;
      console.error('atomic-stateful-return-stage', JSON.stringify({
        stage,
        returnSlot,
        output: output && {
          lock: output.to instanceof Uint8Array ? binToHex(output.to) : output.to,
          category: output.token?.category,
          capability: output.token?.nft?.capability,
          commitment: output.token?.nft?.commitment,
        },
        pending: host.pendingReturnEventOutputs.map((event) => ({
          identity: event.identity,
          category: event.categoryId,
          commitment: binToHex(event.commitment),
        })),
      }));
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1' && (host.blockLayout?.blockSize ?? 0) > 100) {
      console.error('atomic-stateful-output-stage', stage, builder.outputs.length);
      const sidecars = host.blockLayout?.slots.filter((slot) =>
        slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar') ?? [];
      if (sidecars.length > 0) {
        console.error('atomic-stateful-sidecar-stage', stage, sidecars.map((slot) => {
          const input = host.allInputs[slot.offset];
          const output = builder.outputs[slot.offset];
          return {
            slot,
            inputLock: input?.unlocker ? binToHex(input.unlocker.generateLockingBytecode()) : undefined,
            inputCategory: input?.token?.category,
            outputLock: output?.to instanceof Uint8Array ? binToHex(output.to) : output?.to,
            outputCategory: output?.token?.category,
          };
        }));
      }
    }
  };
  const debugOwnMutableOutputs = (stage: string): void => {
    buildTiming(stage, builder);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FAILURE_RING !== '1') return;
    console.error('builder-own-mutable-outputs', {
      stage,
      outputs: builder.outputs.map((output, index) => ({ output, index }))
        .filter(({ output }) => (output.token?.category === host.categoryId
        || host.loopEntryVars.some((value) => value.categoryId === output.token?.category))
        && output.token?.nft?.capability === 'mutable')
        .map(({ output, index }) => ({
          index,
          lockingBytecode: typeof output.to === 'string' ? output.to : binToHex(output.to),
          commitment: output.token?.nft?.commitment,
        })),
    });
  };

  return { debugAtomicOutputStage, debugOwnMutableOutputs };
}
