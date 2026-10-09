/**
 * phase-boundary extract: SC class-body extract — _sendRawBuilder fee/byte-gate/submit path for split/merge/unsafe.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { TransactionDetails } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { attachWait } from '../wait.js';

export interface SendRawBuilderHost {
  readonly parentProvider: NetworkProvider;
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
  // Load the message-bus preflight gate lazily so the stateful graph does not pull it for non-broadcast flows.
  const { assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder } = await import('../message-bus/preflight.js');

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

  const provider = host.parentProvider;
  const txid = await provider.sendRawTransaction(rawTx);

  // Verify txid matches locally computed hash to detect compromised providers
  const expectedTxid = binToHex(hash256(rawTxBin).reverse());
  if (txid !== expectedTxid) {
    throw new Error(
      `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
      + 'The network provider may be compromised.',
    );
  }

  return attachWait({ ...decoded, txid, hex: rawTx } as TransactionDetails, builder.provider);
}
