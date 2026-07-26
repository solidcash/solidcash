import {
  binToHex, decodeTransactionUnsafe, hash256, hexToBin,
  type AuthenticationProgramStateCommon, type Transaction,
} from '@bitauth/libauth';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

const evaluateEveryInput = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);

  transaction.inputs.forEach((_input, inputIndex) => {
    const state = vm.evaluate({
      inputIndex,
      sourceOutputs,
      transaction,
    }) as AuthenticationProgramStateCommon;
    if (state.error !== undefined) {
      throw new Error(`layer3: BCH-2026 preflight failed at input ${inputIndex}: ${state.error}`);
    }
  });
};

/**
 * Evaluate every input of a fully assembled Layer-3 transaction on the BCH-2026 VM.
 *
 * Layer-3 derivation is an untrusted witness-construction step. This gate is not a
 * substitute for covenant checks; it ensures the exact final transaction satisfies
 * every covenant before it is handed to a provider.
 */
export const preflightLayer3Transaction = (builder: TransactionBuilder): Transaction => {
  const transaction = builder.buildLibauthTransaction();
  evaluateEveryInput(builder, transaction);
  return transaction;
};

/**
 * Build and fee-check once, evaluate that exact byte sequence, then broadcast it unchanged.
 *
 * Layer-3 assembly must explicitly include every sidecar and funding input before this call;
 * unlike the general TransactionBuilder send path, this function never mutates the shape
 * between preflight and broadcast.
 */
export async function sendPreflightedLayer3Transaction(
  builder: TransactionBuilder,
): Promise<string> {
  const raw = builder.build();
  const transaction = decodeTransactionUnsafe(hexToBin(raw));
  evaluateEveryInput(builder, transaction);
  const txid = await builder.provider.sendRawTransaction(raw);
  const expected = binToHex(hash256(hexToBin(raw)).reverse());
  if (txid !== expected) {
    throw new Error(`layer3: provider returned txid '${txid}', expected '${expected}'`);
  }
  return txid;
}
