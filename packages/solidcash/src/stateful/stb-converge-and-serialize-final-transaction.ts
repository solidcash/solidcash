/**
 * phase-boundary extract: STB send-phase extract — Phase-4 fee finalize, converge, serialize.
 */

import { binToHex, encodeTransaction } from '@bitauth/libauth';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  createFinalizeFeeBeforeValidation,
  type FinalizeFeeBeforeValidationHost,
} from './stb-finalize-fee-before-validation.js';

// Matches TransactionBuilder.buildLibauthTransaction() without importing STB circularly.
export type ConvergedLibauthTransaction = Parameters<typeof encodeTransaction>[0];

export interface ConvergeAndSerializeFinalTransactionHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly funderChangeAddress?: Uint8Array;
  readonly checkMinRelayFee: boolean;
  readonly pendingReturnEventOutputs: ReadonlyArray<{
    identity: string;
    categoryId: string;
    commitment: Uint8Array;
    provisional?: boolean;
  }>;
  readonly builtReturnEventOutputIndices: ReadonlyMap<string, number>;
  computeMinFee(size: bigint): bigint;
  assertConvergedFinalTransaction(
    builder: TransactionBuilder,
    reassertFinalLayout: () => void,
    finalizeFeeBeforeValidation: (transaction: ConvergedLibauthTransaction) => boolean,
  ): ConvergedLibauthTransaction;
}

/**
 * Fee-finalize before each validation attempt, converge the exact covenant transaction, then
 * serialize. Optional return-layout debug dumps pending/built carriers on refuse paths.
 */
export function convergeAndSerializeFinalTransaction(
  host: ConvergeAndSerializeFinalTransactionHost,
  finalBuilder: TransactionBuilder,
  serializedAccountingFunders: readonly UnlockableUtxo[],
  reassertFinalLayout: () => void,
  sendTiming: (label: string) => void,
): {
    finalizedTransaction: ConvergedLibauthTransaction;
    rawTxBin: Uint8Array;
    rawTx: string;
    totalInputSats: bigint;
  } {
  // Fee accounting must use the inputs which produce the finalized transaction.
  // `allInputs` is the logical candidate set and can retain a funder or
  // participant displaced by fixed block assembly; counting that stale input
  // reports a fictitious surplus even though it is absent from the bytes.
  const totalInputSats = finalBuilder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
  const configuredChangeLocks = [
    host.funderChangeAddress,
    ...serializedAccountingFunders.map((funder) => funder.unlocker.generateLockingBytecode()),
  ].filter((lock): lock is Uint8Array => lock instanceof Uint8Array);
  const feeHost: FinalizeFeeBeforeValidationHost = {
    allInputs: host.allInputs,
    checkMinRelayFee: host.checkMinRelayFee,
    computeMinFee: (size) => host.computeMinFee(size),
  };
  const finalizeFeeBeforeValidation = createFinalizeFeeBeforeValidation(
    feeHost,
    finalBuilder,
    totalInputSats,
    configuredChangeLocks,
  );

  // Validate the exact transaction which will be serialized. Fee adjustment runs before each validation
  // attempt, including after computed-output repairs, so the successful VM receipt remains bound to the exact
  // transaction object submitted to the provider. Token conservation depends only on input/output assets.
  finalBuilder.validateTokenConservation();
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1') {
    // A frame's event epilogue scans EVERY own-category immutable NFT in the transaction and admits only its own
    // event run plus the return indices its ABI publishes. Name the materialized carriers here so a refusal can
    // be attributed to a specific call/return slot instead of an anonymous index.
    console.error('return-carriers', JSON.stringify({
      pending: host.pendingReturnEventOutputs.map((event) => ({
        identity: event.identity,
        categoryId: event.categoryId.slice(0, 12),
        commitmentLength: event.commitment.length,
        commitmentHead: binToHex(event.commitment).slice(0, 16),
        provisional: event.provisional === true,
      })),
      built: [...host.builtReturnEventOutputIndices.entries()],
      outputs: finalBuilder.outputs.map((output, index) => (
        output.token === undefined ? undefined : {
          index,
          lock: output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 12) : String(output.to),
          category: output.token.category.slice(0, 12),
          capability: output.token.nft?.capability,
          commitment: String(output.token.nft?.commitment ?? '').slice(0, 20),
        })).filter((entry) => entry !== undefined),
    }));
  }
  const finalizedTransaction = host.assertConvergedFinalTransaction(
    finalBuilder,
    reassertFinalLayout,
    finalizeFeeBeforeValidation,
  );
  sendTiming('covenants-converged');

  const rawTxBin = encodeTransaction(finalizedTransaction);
  const rawTx = binToHex(rawTxBin);
  sendTiming('serialized');
  return { finalizedTransaction, rawTxBin, rawTx, totalInputSats };
}
