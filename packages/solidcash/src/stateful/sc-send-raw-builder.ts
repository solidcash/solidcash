/**
 * phase-boundary extract: SC class-body extract — _sendRawBuilder fee/byte-gate/submit path for split/merge/unsafe.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { applyExternalSignatures } from '../external-signing.js';
import type { TransactionDetails } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { attachWait } from '../wait.js';
import {
  assertFinalizedBytesWithCovenant,
  inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';

export interface SendRawBuilderHost {
  readonly parentProvider: NetworkProvider;
}

/**
 * The bytes to broadcast for a judged, built `transaction`: each input whose key a wallet holds signed by that wallet
 * (../external-signing.ts), or `transaction` as it was built when there is none. The lifecycle-admin sites (this
 * file's `sendRawBuilder`, split, merge) fund from a caller-supplied unlocker, which may be `Signer.external`'s, and
 * call this after their fee and byte gates, so a wallet is asked to sign only bytes the SDK would broadcast. The
 * placeholder has the signature's size, so those verdicts hold for the signed bytes.
 */
export async function signExternallySignedInputs(
  builder: TransactionBuilder, transaction: Transaction, rawTx: string,
): Promise<{ transaction: Transaction; rawTx: string; rawTxBin: Uint8Array }> {
  const signed = await applyExternalSignatures(
    builder.inputs.map((input) => ('unlocker' in input ? input.unlocker : undefined)),
    transaction, generateLibauthSourceOutputs(builder.inputs),
  );
  if (signed === transaction) return { transaction, rawTx, rawTxBin: hexToBin(rawTx) };
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');
  const rawTxBin = encodeTransaction(signed);
  return { transaction: signed, rawTx: binToHex(rawTxBin), rawTxBin };
}

/**
 * Build, fee-cap, finalized-byte-gate, broadcast, and txid-verify a TransactionBuilder without
 * the debug VM step used by ordinary stateful submits.
 */
export async function sendRawBuilder(
  host: SendRawBuilderHost,
  builder: TransactionBuilder,
): Promise<TransactionDetails> {
  const { hash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
  const { encodeTransaction, decodeTransactionUnsafe } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const rawTx = builder.build();
  const rawTxBin = hexToBin(rawTx);

  // Fee sanity check: per-byte cap prevents accidentally sending excessive fees
  const decoded = decodeTransactionUnsafe(rawTxBin);
  const totalInputSats = builder.inputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
  const totalOutputSats = (decoded as { outputs: Array<{ valueSatoshis: bigint }> }).outputs
    .reduce((sum, out) => sum + out.valueSatoshis, 0n);
  const fee = totalInputSats - totalOutputSats;
  const txSize = BigInt(encodeTransaction(decoded).byteLength);
  const MAX_FEE_SATS_PER_BYTE = 1000;
  const feePerByte = Number(fee) / Number(txSize);
  if (feePerByte > MAX_FEE_SATS_PER_BYTE) {
    throw new Error(
      `Transaction fee of ${fee} satoshis (${feePerByte.toFixed(1)} sat/byte) exceeds the `
      + `safety cap of ${MAX_FEE_SATS_PER_BYTE} sat/byte for a ${txSize}-byte transaction.`,
    );
  }

  // X163, the finalized-bytes gate at `_sendRawBuilder`. This is the `sc.call.fork(...)` /
  // `sc.call.consolidate(...)`
  // route into the SAME two builders the static `split`/`merge` use, so it inherits their change arithmetic
  // exactly: measured at 100 satoshis of change against a 576-satoshi threshold through
  // `withSplitFunding(...).withSplitFee(...)`, accepted by the mock.
  //
  // Ordered after the fee-per-byte cap above so a missing change output still reports as a fee problem
  // rather than as whichever relay observation happens to be true of the same bytes - the same ordering the
  // stateful submit path uses.
  //
  // X175. Like split and merge, nothing debugs ahead of this, so the gate carries the covenant's objection
  // with it instead of arriving before it.
  assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

  const signed = await signExternallySignedInputs(builder, decoded, rawTx);
  const provider = host.parentProvider;
  const txid = await provider.sendRawTransaction(signed.rawTx);

  // Verify txid matches locally computed hash to detect compromised providers
  const expectedTxid = binToHex(hash256(signed.rawTxBin).reverse());
  if (txid !== expectedTxid) {
    throw new Error(
      `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
      + 'The network provider may be compromised.',
    );
  }

  return attachWait({ ...signed.transaction, txid, hex: signed.rawTx } as TransactionDetails, builder.provider);
}
