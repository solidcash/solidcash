/**
 * phase-boundary extract: STB send-phase extract — post-serialize fee caps + finalized byte gate before submit.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  assertFinalizedTransactionBytes,
  finalizedByteGateOptionsForProvider,
  inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';

export interface ValidateSendFeeCapsAndBytesHost {
  readonly funderUtxos: readonly unknown[];
  readonly embeddedFunderUtxos: readonly unknown[];
  readonly funderChangeAddress?: Uint8Array;
  readonly maximumFeeSatoshis?: bigint;
}

export type DecodedSendTransaction = {
  outputs: ReadonlyArray<{ valueSatoshis: bigint }>;
};

/**
 * After covenant convergence + serialization: optional fee-layout debug, absolute/per-byte fee
 * caps, then finalized byte-gate refusal immediately before network submit.
 */
export function validateSendFeeCapsAndBytes(
  host: ValidateSendFeeCapsAndBytesHost,
  finalBuilder: TransactionBuilder,
  provider: NetworkProvider,
  decodedTx: DecodedSendTransaction,
  totalInputSats: bigint,
  neededFee: bigint,
  rawTxBin: Uint8Array,
  sendTiming: (label: string) => void,
): { fee: bigint; txSize: bigint } {
  const totalOutputSats = decodedTx.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  const fee = totalInputSats - totalOutputSats;
  const txSize = BigInt(rawTxBin.byteLength);

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_FEE_LAYOUT === '1') {
    const describeToken = (token: Output['token']): unknown => token && ({
      category: token.category.slice(0, 16),
      amount: String(token.amount),
      capability: token.nft?.capability,
      commitment: token.nft?.commitment,
    });
    console.error('final-fee-layout', JSON.stringify({
      totalInputSats: String(totalInputSats),
      totalOutputSats: String(totalOutputSats),
      fee: String(fee),
      neededFee: String(neededFee),
      funderCount: host.funderUtxos.length,
      embeddedFunderCount: host.embeddedFunderUtxos.length,
      changeLock: host.funderChangeAddress && binToHex(host.funderChangeAddress).slice(0, 20),
      inputs: finalBuilder.inputs.map((input, index) => ({
        index, sats: String(input.satoshis), token: describeToken(input.token),
        lock: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 20),
      })),
      outputs: finalBuilder.outputs.map((output, index) => ({
        index, sats: String(output.amount), token: describeToken(output.token),
        lock: output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 20) : String(output.to),
      })),
    }));
  }

  if (host.maximumFeeSatoshis !== undefined && fee > host.maximumFeeSatoshis) {
    throw new Error(
      `Transaction fee of ${fee} satoshis exceeds the maximum fee cap of ${host.maximumFeeSatoshis} satoshis. `
      + 'Use .withMaxFee() to increase the cap, or reduce the fee.',
    );
  }

  const MAX_FEE_SATS_PER_BYTE = 1000;
  const feePerByte = Number(fee) / Number(txSize);
  if (feePerByte > MAX_FEE_SATS_PER_BYTE) {
    throw new Error(
      `Transaction fee of ${fee} satoshis is ${feePerByte.toFixed(1)} sat/byte, `
      + `exceeding the safety cap of ${MAX_FEE_SATS_PER_BYTE} sat/byte. `
      + 'This may indicate a missing change output. Use .withMaxFee() to override.',
    );
  }

  // Byte rules LAST, immediately before the network sees the bytes, and reading the DECODED broadcast bytes
  // rather than a re-derived shape. A correctness aid, not a security boundary: it refuses at
  // witness-construction time a transaction whose bytes a node would refuse anyway, so the composer learns
  // the arithmetic here instead of reading `64: dust` off a peer. Ordered after the fee checks so a missing
  // change output still reports as a fee problem rather than as whichever relay observation is also true.
  // X158: the same input subjects as site 2, read off the builder that produced these exact bytes, so an
  // over-limit refusal names the contract rather than only an index.
  assertFinalizedTransactionBytes(decodedTx as Parameters<typeof assertFinalizedTransactionBytes>[0], {
    ...finalizedByteGateOptionsForProvider(provider),
    inputSubjects: inputSubjectsOfBuilder(finalBuilder),
  });
  sendTiming('bytes-validated');
  return { fee, txSize };
}
