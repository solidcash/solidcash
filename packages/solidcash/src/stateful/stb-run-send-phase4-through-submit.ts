/**
 * phase-boundary extract: STB send-phase extract — Phase-4 converge/serialize/fee-bytes through Phase-5 submit.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { applyExternalSignatures, isExternallySignedUnlocker } from '../external-signing.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import type { TransactionDetails, UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  convergeAndSerializeFinalTransaction,
  type ConvergeAndSerializeFinalTransactionHost,
} from './stb-converge-and-serialize-final-transaction.js';
import {
  validateSendFeeCapsAndBytes,
  type ValidateSendFeeCapsAndBytesHost,
} from './stb-validate-send-fee-caps-and-bytes.js';
import {
  submitFinalTransaction,
  type SubmitFinalTransactionHost,
} from './stb-submit-final-transaction.js';

export interface RunSendPhase4ThroughSubmitHost {
  convergeAndSerializeFinalTransactionHost(): ConvergeAndSerializeFinalTransactionHost;
  validateSendFeeCapsAndBytesHost(): ValidateSendFeeCapsAndBytesHost;
  submitFinalTransactionHost(): SubmitFinalTransactionHost;
}

/**
 * After Phase-3 rebuild: converge + serialize, enforce fee caps/byte gate, then submit.
 */
export async function runSendPhase4ThroughSubmit(
  host: RunSendPhase4ThroughSubmitHost,
  finalBuilder: TransactionBuilder,
  serializedAccountingFunders: readonly UnlockableUtxo[],
  reassertFinalLayout: () => void,
  provider: NetworkProvider,
  neededFee: bigint,
  sendTiming: (label: string) => void,
): Promise<TransactionDetails> {
  const converged = convergeAndSerializeFinalTransaction(
    host.convergeAndSerializeFinalTransactionHost(),
    finalBuilder,
    serializedAccountingFunders,
    reassertFinalLayout,
    sendTiming,
  );
  const { finalizedTransaction, totalInputSats } = converged;
  let { rawTxBin, rawTx } = converged;

  const { decodeTransactionUnsafe, encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  // A wallet that holds an input's key signs it now, over the transaction the covenants judged with its placeholder.
  // The signature has the placeholder's size, so the fee stands, and it changes the txid, so the provider judges the
  // signed transaction in full (../external-signing.ts).
  const unlockers = finalBuilder.inputs.map((input) => ('unlocker' in input ? input.unlocker : undefined));
  let decodedTx = finalizedTransaction;
  if (unlockers.some(isExternallySignedUnlocker)) {
    decodedTx = await applyExternalSignatures(unlockers, finalizedTransaction, generateLibauthSourceOutputs(finalBuilder.inputs));
    rawTxBin = encodeTransaction(decodedTx);
    rawTx = binToHex(rawTxBin);
    sendTiming('externally-signed');
  }

  validateSendFeeCapsAndBytes(
    host.validateSendFeeCapsAndBytesHost(),
    finalBuilder,
    provider,
    decodedTx,
    totalInputSats,
    neededFee,
    rawTxBin,
    sendTiming,
  );

  return submitFinalTransaction(
    host.submitFinalTransactionHost(),
    finalBuilder,
    provider,
    rawTx,
    rawTxBin,
    decodedTx,
    decodeTransactionUnsafe,
    sendTiming,
  );
}

/** Optional builder-timing logger used across send phases. */
export function createSendTiming(): (stage: string) => void {
  const sendTimingEnabled = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
  const sendStartedAt = Date.now();
  let sendLastTimingAt = sendStartedAt;
  return (stage: string): void => {
    if (!sendTimingEnabled) return;
    const now = Date.now();
    console.error('send-timing', {
      stage,
      deltaMs: now - sendLastTimingAt,
      totalMs: now - sendStartedAt,
    });
    sendLastTimingAt = now;
  };
}
