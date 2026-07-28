import {
  binToHex, decodeTransactionUnsafe, hash256, hexToBin,
  type AuthenticationProgramStateCommon, type Transaction,
} from '@bitauth/libauth';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../stateful/balancedBlocks.js';
import type { BalancedAssembly, BalancedAssemblyOptions } from '../stateful/balancedBlocks.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * Structural block-assembly gate, run BEFORE any unlocker is asked for bytecode.
 *
 * The assembly is read off the builder's own inputs (each participant's master input carries the compiler-
 * published block layout), so this fires without the caller opting in. Only a transaction where NO input
 * publishes a participant master is left alone; a transaction that publishes one but cannot be described is
 * refused - see `deriveBalancedAssemblyFromInputs`.
 *
 * Returns the assembly it checked, or undefined when the transaction is out of the block model's scope.
 */
export const preflightLayer3BlockAssembly = (
  builder: TransactionBuilder, options?: BalancedAssemblyOptions,
): BalancedAssembly | undefined => {
  const assembly = deriveBalancedAssemblyFromInputs(
    builder.inputs as never, builder.inputs.length,
  );
  if (!assembly) return undefined;
  preflightBalancedBlockAssembly(builder, assembly, options);
  return assembly;
};

/**
 * Run the structural gate on a transaction whose caller has already declared it a Layer-3 composition.
 *
 * `preflightLayer3BlockAssembly` stays silent on a transaction no input describes, because it is also a
 * standalone capability that may be pointed at anything. The two Layer-3 send paths below are not: reaching
 * them means the caller asserts this transaction IS a participant composition, so "nothing was checkable" is a
 * refusal rather than a pass. Without this, stripping `abiFunction` from every master input silences the gate
 * completely while the transaction bytes stay identical.
 */
const requireLayer3BlockAssembly = (builder: TransactionBuilder): void => {
  if (preflightLayer3BlockAssembly(builder) !== undefined) return;
  throw new Error(
    'layer3: no participant master block could be derived from this transaction, so the balanced block '
    + 'assembly gate cannot run; every participant master input must expose its contract unlocker',
  );
};

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
  // Structural gate first: a malformed or unbalanced block assembly is rejected before any signature is taken.
  requireLayer3BlockAssembly(builder);
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
  // Structural gate first: this runs before build() takes a single signature.
  requireLayer3BlockAssembly(builder);
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
