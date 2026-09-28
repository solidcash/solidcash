/**
 * phase-boundary extract: STB send-phase extract — Phase-5 submit, failure diagnostics, receipt event decode.
 */

import {
  binToHex, hash256, hexToBin,
} from '@bitauth/libauth';
import type {
  LibauthOutput, ReceiptEvent, TransactionDetails, UnlockableUtxo, Utxo,
} from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { PreparedTransaction } from '../network/NetworkProvider.js';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { attachWait } from '../wait.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';

export interface SubmitFinalTransactionHost {
  readonly dynamicChunkVars: ReadonlyArray<{ lockingBytecode: Uint8Array }>;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallEntryOutputsByIndex: ReadonlyMap<number, { categoryId: string; commitment: string }>;
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly builderOptions: TransactionBuilderOptions;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  getLowLevelCallMasterInputIndex(index: number): number;
  logCovenantFailureTrace(builder: TransactionBuilder, reason: string): void;
  persistPlacedJobEventsBand(builder: TransactionBuilder, txid: string): void;
  decodeEmittedEvents(outputs: readonly LibauthOutput[]): ReceiptEvent[];
}

export type DecodedTransactionLike = PreparedTransaction['transaction'] & {
  outputs: readonly unknown[];
};

/**
 * Submit the finalized transaction bytes, emit optional diagnostics, verify txid,
 * attach wait/receipt events, and return TransactionDetails.
 */
export async function submitFinalTransaction(
  host: SubmitFinalTransactionHost,
  finalBuilder: TransactionBuilder,
  provider: NetworkProvider,
  rawTx: string,
  rawTxBin: Uint8Array,
  decodedTx: PreparedTransaction['transaction'],
  decodeTransactionUnsafe: (bytes: Uint8Array) => DecodedTransactionLike,
  sendTiming: (stage: string) => void,
): Promise<TransactionDetails> {
// -- Phase 5: submit --
const debugRepairConvergence = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
  ?.SOLIDC_DEBUG_REPAIR_CONVERGENCE === '1';
const rootDynamicLocks = new Set(host.dynamicChunkVars.map((variable) => (
  binToHex(variable.lockingBytecode)
)));
const submittedDynamicChunks = debugRepairConvergence
  ? finalBuilder.outputs.flatMap((output, index) => {
    const commitment = String(output.token?.nft?.commitment ?? '');
    const lockingBytecode = output.to instanceof Uint8Array
      ? output.to : addressToLockScript(output.to);
    if (!rootDynamicLocks.has(binToHex(lockingBytecode))) return [];
    return [{
      index,
      lockingBytecode: binToHex(lockingBytecode),
      category: output.token?.category,
      commitment,
    }];
  }) : [];
if (debugRepairConvergence) console.error(
  'submit-dynamic-chunks', JSON.stringify(submittedDynamicChunks),
);
if (debugRepairConvergence) console.error('submit-call-groups', JSON.stringify({
  external: host.externalCallUtxoGroups.map((group, index) => ({
    index,
    functionName: group.functionName,
    logicalFunctionName: group.logicalFunctionName,
    logicalFunctionArgs: group.logicalFunctionArgs,
    sharedGroupIndex: group.sharedGroupIndex,
    delegateCallGroupIndex: group.delegateCallGroupIndex,
    route: group.compilerRoute?.abiFunction.name,
    rows: group.compilerRoute?.rowArguments?.map((row) => ({
      functionName: row.handler.name,
      args: row.args,
    })),
  })),
  lowLevel: host.lowLevelCallUtxoGroups.map((group, index) => ({
    index,
    functionName: group.functionName,
    logicalFunctionName: group.logicalFunctionName,
    functionArgs: group.functionArgs,
    route: group.compilerRoute?.abiFunction.name,
    rows: group.compilerRoute?.rowArguments?.map((row) => ({
      functionName: row.handler.name,
      args: row.args,
    })),
  })),
}, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
  ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
  const lockOf = (value: Uint8Array | string | undefined): string => {
    if (!value) return '';
    return typeof value === 'string' ? binToHex(addressToLockScript(value)) : binToHex(value);
  };
  const scidInputs = host.allInputs.map((input, index) => ({ input, index }))
    .filter(({ input }) => isScidIdentityCommitment(input.token?.nft?.commitment));
  const identityLocks = new Set(scidInputs.map(({ input }) => (
    'unlocker' in input && input.unlocker
      ? binToHex(input.unlocker.generateLockingBytecode()) : ''
  )));
  console.error('submit-outputs-8-40', finalBuilder.outputs.slice(8, 41).map((output, offset) => ({
    index: 8 + offset,
    lock: lockOf(output.to).slice(0, 20),
    cap: output.token?.nft?.capability ?? 'plain',
    commit: String(output.token?.nft?.commitment ?? '').slice(0, 24),
  })));
  console.error('submit-return-outputs', finalBuilder.outputs.flatMap((output, index) => (
    isViewReturnTailOutput(output) ? [{
      index,
      category: output.token?.category.slice(0, 16),
      commitment: String(output.token?.nft?.commitment ?? ''),
    }] : []
  )));
  console.error('submit-inputs-10-16', finalBuilder.inputs.slice(10, 17).map((input, offset) => ({
    index: 10 + offset,
    name: (input.unlocker as { abiFunction?: { name?: string } } | undefined)?.abiFunction?.name
      ?? (input.unlocker as { contract?: { artifact?: { contractName?: string } } } | undefined)
        ?.contract?.artifact?.contractName,
    cap: input.token?.nft?.capability ?? 'plain',
    commit: String(input.token?.nft?.commitment ?? '').slice(0, 24),
    lock: 'unlocker' in input && input.unlocker
      ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
  })));
  console.error('scid-submit', {
    scidInputs: scidInputs.map(({ input, index }) => ({
      index,
      outpoint: `${input.txid}:${input.vout}`,
      commitment: input.token?.nft?.commitment?.slice(0, 24),
      lock: 'unlocker' in input && input.unlocker
        ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
    })),
    identityOutputs: finalBuilder.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => isScidIdentityCommitment(output.token?.nft?.commitment)
        || identityLocks.has(lockOf(output.to)))
      .map(({ output, index }) => ({
        index,
        lock: lockOf(output.to).slice(0, 20),
        capability: output.token?.nft?.capability ?? 'plain',
        commitment: (output.token?.nft?.commitment ?? '').slice(0, 24),
      })),
  });
}
let txid: string;
try {
txid = provider.sendPreparedTransaction
    ? await provider.sendPreparedTransaction({
      rawHex: rawTx,
      rawBytes: rawTxBin,
      transaction: decodedTx,
    })
    : await provider.sendRawTransaction(rawTx);
  sendTiming('provider-accepted');
  if (debugRepairConvergence) {
    const locks = [...new Set(submittedDynamicChunks.map((chunk) => chunk.lockingBytecode))];
    console.error('accepted-dynamic-chunks', JSON.stringify(await Promise.all(locks.map(async (lock) => ({
      lockingBytecode: lock,
      utxos: (await provider.getUtxosForLockingBytecode(hexToBin(lock))).map((utxo: Utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        category: utxo.token?.category,
        commitment: utxo.token?.nft?.commitment,
      })),
    })))));
  }
} catch (submitErr) {
  // On a covenant script failure, emit an accurate op-level trace of the actual submitted tx using the
  // 2026 VM (the one mocknet uses). The source-map best-effort above mis-attributes on optimised
  // subroutine bytecode; this points at the exact failing opcode + stack. Diagnostic only - rethrow as-is.
  const reason = (submitErr as Error)?.message ?? '';
  if (/script-verify|OP_[A-Z]|evaluating input/.test(reason)) {
    try {
      const lockOfFail = (value: Uint8Array | string | undefined): string => {
        if (!value) return '';
        return typeof value === 'string' ? binToHex(addressToLockScript(value)) : binToHex(value);
      };
      console.error('submit-fail-inputs-5-8', finalBuilder.inputs.slice(5, 9).map((input, offset) => {
        const index = 5 + offset;
        const unlocker = input && 'unlocker' in input ? input.unlocker as {
          abiFunction?: { name?: string };
          contract?: { artifact?: { contractName?: string } };
          generateLockingBytecode?: () => Uint8Array;
        } | undefined : undefined;
        const output = finalBuilder.outputs[index];
        return {
          index,
          inName: unlocker?.abiFunction?.name
            ?? unlocker?.contract?.artifact?.contractName
            ?? (unlocker?.constructor?.name ?? typeof unlocker),
          inLock: unlocker?.generateLockingBytecode
            ? binToHex(unlocker.generateLockingBytecode()).slice(0, 24) : '',
          inCap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
          inCat: String(input?.token?.category ?? '').slice(0, 16),
          inCommit: String(input?.token?.nft?.commitment ?? '').slice(0, 24),
          outLock: output
            ? (typeof output.to === 'string' ? output.to : binToHex(output.to as Uint8Array)).slice(0, 24)
            : '',
          outCap: output?.token?.nft?.capability ?? (output ? 'plain' : 'missing'),
          outCommit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
          lockMatch: !!(unlocker?.generateLockingBytecode && output?.to
            && binToHex(unlocker.generateLockingBytecode())
              === (typeof output.to === 'string' ? output.to : binToHex(output.to as Uint8Array))),
        };
      }));
      console.error('submit-fail-layout', {
        reason,
        outputCount: finalBuilder.outputs.length,
        jobEventsBand: host.getChunkableValueWriteBand(),
        derivedEntries: [...host.externalCallEntryOutputsByIndex.entries()].map(([index, placed]) => ({
          index, cat: placed.categoryId.slice(0, 8), commit: placed.commitment.slice(0, 24),
          len: placed.commitment.length,
        })),
        calls: [
          ...host.externalCallUtxoGroups.map((group, index) => ({
            kind: 'ext',
            index,
            fn: group.logicalFunctionName ?? group.functionName,
            ret: group.returnOutputIndex,
            chunks: group.valueChunkOutputCount,
            cat: group.categoryId?.slice(0, 16),
          })),
          ...host.lowLevelCallUtxoGroups.map((group, index) => ({
            kind: 'llc',
            index,
            fn: group.functionName,
            mode: group.callMode,
            master: host.getLowLevelCallMasterInputIndex(index),
            chunks: group.valueChunkOutputCount,
            cat: group.categoryId?.slice(0, 16),
          })),
        ],
        input5: {
          name: (finalBuilder.inputs[5]?.unlocker as { abiFunction?: { name?: string } } | undefined)
            ?.abiFunction?.name,
          contract: (finalBuilder.inputs[5]?.unlocker as { contract?: { artifact?: { contractName?: string } } }
            | undefined)?.contract?.artifact?.contractName,
          category: finalBuilder.inputs[5]?.token?.category?.slice(0, 16),
        },
        around: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 33, 34, 35].map((index) => {
          const output = finalBuilder.outputs[index];
          const input = finalBuilder.inputs[index];
          return {
            index,
            inLock: input && 'unlocker' in input && input.unlocker
              ? binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20) : '',
            inCap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
            inCat: String(input?.token?.category ?? '').slice(0, 16),
            lock: lockOfFail(output?.to).slice(0, 20),
            cap: output?.token?.nft?.capability ?? (output ? 'plain' : 'missing'),
            cat: String(output?.token?.category ?? '').slice(0, 16),
            commit: String(output?.token?.nft?.commitment ?? '').slice(0, 24),
            commitLen: String(output?.token?.nft?.commitment ?? '').length,
            lockMatch: input && 'unlocker' in input && input.unlocker && output?.to
              ? binToHex(input.unlocker.generateLockingBytecode()) === lockOfFail(output.to) : false,
          };
        }),
        bandSlots: (() => {
          const band = host.getChunkableValueWriteBand();
          if (!band) return [];
          return Array.from({ length: band.nNew }, (_u, offset) => {
            const index = band.start + offset;
            const output = finalBuilder.outputs[index];
            return {
              index,
              lock: lockOfFail(output?.to),
              commit: String(output?.token?.nft?.commitment ?? ''),
              cap: output?.token?.nft?.capability,
            };
          });
        })(),
        identity: {
          hasLogical: !!host.logicalIdentityUtxo,
          logicalCat: host.logicalIdentityUtxo?.token?.category?.slice(0, 16),
          logicalCap: host.logicalIdentityUtxo?.token?.nft?.capability,
          logicalCommit: String(host.logicalIdentityUtxo?.token?.nft?.commitment ?? '').slice(0, 16),
          externalAnchors: host.externalIdentityAnchorUtxos.length,
        },
        inputs: finalBuilder.inputs.map((input, index) => ({
          index,
          cap: input?.token?.nft?.capability ?? (input ? 'plain' : 'missing'),
          cat: String(input?.token?.category ?? '').slice(0, 16),
          commit: String(input?.token?.nft?.commitment ?? '').slice(0, 16),
          scid: String(input?.token?.nft?.commitment ?? '').toLowerCase().startsWith('53434944'),
        })),
        lockHits: (() => {
          const counts = new Map<string, number>();
          for (const output of finalBuilder.outputs) {
            const lock = lockOfFail(output?.to).slice(0, 20);
            if (!lock.startsWith('aa20')) continue;
            counts.set(lock, (counts.get(lock) ?? 0) + 1);
          }
          return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
        })(),
      });
    } catch { /* dump is best-effort */ }
    try { host.logCovenantFailureTrace(finalBuilder, reason); } catch { /* trace is best-effort */ }
  }
  throw submitErr;
}

const expectedTxid = binToHex(hash256(rawTxBin).reverse());
if (txid !== expectedTxid) {
  throw new Error(
    `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
    + 'The network provider may be compromised.',
  );
}
host.persistPlacedJobEventsBand(finalBuilder, txid);

const decoded = decodeTransactionUnsafe(rawTxBin);
const details = attachWait({ ...decoded, txid, hex: rawTx } as TransactionDetails, host.builderOptions.provider);
// ethers-v5 receipt.events: decode this tx's own event NFT outputs against the artifact event ABI so a ported
// suite can do `(await tx.wait()).events[0].args.pair`. Runtime-computed fields (a factory's deployed-child
// address) come from the real on-chain commitment, not the emit-time placeholder args.
const emitted = host.decodeEmittedEvents(decoded.outputs as readonly LibauthOutput[]);
details.events = emitted;
details.logs = emitted;
sendTiming('complete');
return details;

}
