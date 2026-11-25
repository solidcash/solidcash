/**
 * Finalized-transaction byte and covenant gates used by the direct send path.
 *
 * The byte rules come from {@link ./finalization-byte-gate.ts}; the covenant objection is the same per-input
 * BCH-2026 evaluation the mock provider judges a broadcast against.
 */

import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { generateLibauthSourceOutputs } from './utils.js';
import { createVirtualMachineBch2026ForProvider } from './network/createVirtualMachine.js';
import { isExternallySignedUnlocker } from './external-signing.js';
import type { Unlocker } from './interfaces.js';
import type { TransactionBuilder } from './TransactionBuilder.js';
import {
  assessFinalizedTransactionBytes, assertFinalizedTransactionBytes, enforcedFinalizedByteRefusals,
  type FinalizedByteGateOptions, type FinalizedByteSubject,
} from './finalization-byte-gate.js';

export {
  inputSubjectsOfBuilder, finalizedByteGateReceiptOf, assertFinalizedTransactionBytes,
  finalizedByteGateOptionsForProvider,
} from './finalization-byte-gate.js';
export type { FinalizedByteSubject } from './finalization-byte-gate.js';

/** The covenant's own objection to a finalized transaction, or undefined when every input evaluates. */
export function covenantObjectionOf(
  builder: TransactionBuilder, transaction: Transaction,
): string | undefined {
  try {
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      // A wallet signs this input at broadcast; its placeholder unlocking bytecode cannot be judged here.
      if (isExternallySignedUnlocker((builder.inputs[inputIndex] as { unlocker?: Unlocker } | undefined)?.unlocker)) {
        continue;
      }
      const objection = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
      if (objection !== true) return `input ${inputIndex}: ${objection}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Refuse finalized bytes that break a consensus/relay rule or the covenant, naming both when both object. */
export function assertFinalizedBytesWithCovenant(
  builder: TransactionBuilder, transaction: Transaction,
  subjects: readonly (FinalizedByteSubject | undefined)[],
  options: Omit<FinalizedByteGateOptions, 'inputSubjects'> = {},
): void {
  const verdict = assessFinalizedTransactionBytes(transaction, subjects, options.consensusLimits);
  const enforced = enforcedFinalizedByteRefusals(verdict, options.allowNonRelayable);
  if (enforced.length === 0) return;
  const covenant = covenantObjectionOf(builder, transaction);
  if (covenant === undefined) {
    assertFinalizedTransactionBytes(transaction, {
      inputSubjects: subjects,
      consensusLimits: options.consensusLimits,
      allowNonRelayable: options.allowNonRelayable,
    });
  }
  throw new Error(
    `finalized transaction refused by its covenant and ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n  [covenant] ${covenant}\n`
    + enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`).join('\n'),
  );
}

/** Refuse any covenant failure in an exact, fully assembled transaction. */
export function assertFinalizedTransactionCovenants(
  builder: TransactionBuilder, transaction: Transaction,
): void {
  const objection = covenantObjectionOf(builder, transaction);
  if (objection !== undefined) {
    throw new Error(`finalized transaction refused by its covenant: ${objection}`);
  }
}
