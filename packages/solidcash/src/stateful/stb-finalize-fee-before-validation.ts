/**
 * phase-boundary extract: STB send-phase extract — Phase-4 fee finalization before exact covenant validation.
 */

import { binToHex, binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { calculateDust } from '../utils.js';
import { FILLER_SATOSHIS } from '@solidcash/utils';

export interface FinalizeFeeBeforeValidationHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly checkMinRelayFee: boolean;
  computeMinFee(size: bigint): bigint;
}

export type LibauthTransactionLike = {
  inputs: readonly unknown[];
  outputs: ReadonlyArray<{
    valueSatoshis: bigint;
    lockingBytecode: Uint8Array;
    token?: {
      category: Uint8Array;
      nft?: { capability?: string; commitment: Uint8Array };
    };
  }>;
};

/**
 * Build the fee-finalizer used by `_assertConvergedFinalTransaction`: reduce a configured change
 * output when under the relay minimum, or throw with actionable funding guidance.
 */
export function createFinalizeFeeBeforeValidation(
  host: FinalizeFeeBeforeValidationHost,
  finalBuilder: TransactionBuilder,
  totalInputSats: bigint,
  configuredChangeLocks: readonly Uint8Array[],
): (transaction: LibauthTransactionLike) => boolean {
  const findChangeIndex = (requiredReduction: bigint): number | undefined => [...finalBuilder.outputs]
    .map((output, index) => ({ output, index }))
    .reverse()
    .find(({ output }) => {
      const lock = output.to instanceof Uint8Array ? output.to : undefined;
      return !!lock && configuredChangeLocks.some((candidate) => binsAreEqual(candidate, lock)) && !output.token
        && (output.amount ?? 0n) >= requiredReduction;
    })?.index;

  return (transaction: LibauthTransactionLike): boolean => {
    const totalOutputSats = transaction.outputs
      .reduce((sum, output) => sum + output.valueSatoshis, 0n);
    const fee = totalInputSats - totalOutputSats;
    const txSize = BigInt(encodeTransaction(transaction as Parameters<typeof encodeTransaction>[0]).byteLength);
    const minFee = host.checkMinRelayFee ? host.computeMinFee(txSize) : 0n;
    const requiredFee = minFee;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FEE_BALANCE === '1') {
      // Print both sides on EVERY finalize pass, not only when the fee is short: a layout change has to be
      // compared between two configurations (before/after a placement change), and the short-fee throw also
      // requires `findChangeIndex` to fail, so it never fires for the passing configuration.
      console.error('fee-balance', JSON.stringify({
        totalInputSats: String(totalInputSats),
        totalOutputSats: String(totalOutputSats),
        fee: String(fee),
        requiredFee: String(requiredFee),
        inputs: transaction.inputs.map((_input, index) => ({
          index,
          value: String(host.allInputs[index]?.satoshis ?? 0n),
          outpoint: `${String(host.allInputs[index]?.txid ?? '').slice(0, 8)}:${host.allInputs[index]?.vout}`,
        })),
        outputs: transaction.outputs.map((output, index) => ({
          index,
          value: String(output.valueSatoshis),
          lock: binToHex(output.lockingBytecode).slice(0, 24),
          // Category and commitment identify WHICH resource an output is (master / data NFT / entry), which a
          // locking bytecode cannot do across runs: addresses are randomized per run, so two frames can only be
          // compared structurally.
          category: output.token === undefined ? undefined : binToHex(output.token.category).slice(0, 12),
          capability: output.token?.nft?.capability,
          // Full commitment: the batch's two nodes differ in it, and a 20-character prefix made them
          // indistinguishable (both began `0000..`), which is how round 89's conclusion went wrong.
          commitment: output.token?.nft === undefined
            ? undefined : binToHex(output.token.nft.commitment),
        })),
      }));
    }
    if (fee >= requiredFee) return false;
    // Re-signing after a change-output adjustment can move a DER signature across a one-byte length boundary.
    // When adjustment is necessary, take a small serialization margin; transactions already at
    // the relay minimum remain untouched, including those whose only remaining change is protected dust.
    const reduction = requiredFee - fee + (host.checkMinRelayFee ? 2n : 0n);
    const changeIndex = findChangeIndex(reduction);
    if (changeIndex === undefined) {
      if (fee < 0n) {
        throw new Error(
          `Transaction outputs (${totalOutputSats} sats) exceed inputs (${totalInputSats} sats). `
          + 'This transaction is invalid. Add more funding inputs or reduce outputs.',
        );
      }
      const fpb = Number(minFee) / Number(txSize);
      throw new Error(
        `Transaction fee of ${fee} satoshis is below the minimum relay fee `
        + `(${minFee} satoshis for a ${txSize}-byte transaction at ${fpb.toFixed(1)} sat/byte). `
        + 'Add more funding inputs or reduce outputs.',
      );
    }
    const current = finalBuilder.outputs[changeIndex];
    const remaining = (current.amount ?? 0n) - reduction;
    if (remaining >= BigInt(calculateDust(current))) {
      finalBuilder.outputs[changeIndex] = { ...current, amount: remaining };
    } else if (changeIndex === finalBuilder.outputs.length - 1) {
      // A sub-dust remainder goes to the fee. The change is the last output, so dropping it moves no index.
      finalBuilder.outputs.pop();
    } else {
      // Authenticated suffix indices follow the change, so its index stays, and only a filler may hold it there.
      throw new Error(
        `The change left after the fee (${remaining} sats) is below dust, and later outputs keep its index. `
        + `A filler there needs ${FILLER_SATOSHIS} sats: add at least ${FILLER_SATOSHIS - remaining} sats of funding.`,
      );
    }
    return true;
  };
}
