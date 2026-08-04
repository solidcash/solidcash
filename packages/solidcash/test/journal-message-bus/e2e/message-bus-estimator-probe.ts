import { appendFileSync } from 'fs';
import { afterAll, expect } from 'vitest';
import { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { assessEnvelope, densityKnobControl, formatEnvelope, knobControlBudgetFor } from './message-bus-envelope-f1.js';
import { classifyInputs, redeemScriptLength } from './message-bus-estimator-f2.js';

/**
 * F2 MEASUREMENT PROBE. A sibling of F1's `message-bus-envelope-probe.ts`, deliberately NOT an edit of it: F1's
 * probe is the recorded basis of an integrated row and another worker is re-measuring against it this round,
 * so this adds a file rather than moving one.
 *
 * What it records beyond F1: the per-input REDEEM SCRIPT length, recovered by parsing the last pushdata of
 * each unlocking bytecode, and the input classification derived from it. The redeem length is the estimator's
 * declared compile-time input - `contract.bytecode.length` - so recovering it exactly from the transaction is
 * what lets the capstones be calibration samples without their builders being exported.
 *
 * Inert unless `L3_ESTIMATOR_OUT` names an output file. Activate with the sibling config, which the root
 * project glob does not match, so a normal `yarn test` is unaffected:
 *
 *   L3_ESTIMATOR_OUT=/tmp/estimator.jsonl yarn vitest run -c packages/solidcash/vitest.estimator.config.ts \
 *     test/journal-message-bus/e2e/MessageBusDefiCapstoneC1.test.ts -t 'MEASURED'
 *
 * The probe is a pure observer: it forwards to the original method and returns its result unchanged.
 */

const OUT = process.env.L3_ESTIMATOR_OUT;

interface Capture {
  testName: string;
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
  builds: number;
}

const captures = new Map<string, Capture>();

if (OUT !== undefined) {
  const original = TransactionBuilder.prototype.buildLibauthTransaction;
  TransactionBuilder.prototype.buildLibauthTransaction = function patched(
    this: TransactionBuilder, skipChecks?: boolean,
  ): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
    const transaction = original.call(this, skipChecks);
    try {
      const testName = expect.getState().currentTestName ?? 'unknown';
      const existing = captures.get(testName);
      // KEEP THE WIDEST BUILD. Every `setupStatefulUtxos` seed is also a build and they come first; the
      // composed graph is wider than any of them by a wide margin, so input count identifies it.
      if (existing === undefined || transaction.inputs.length > existing.transaction.inputs.length) {
        captures.set(testName, {
          testName,
          transaction,
          sourceOutputs: generateLibauthSourceOutputs(this.inputs),
          builds: (existing?.builds ?? 0) + 1,
        });
      } else {
        existing.builds += 1;
      }
    } catch {
      // Capture must never change the outcome of the test it is observing.
    }
    return transaction;
  } as typeof original;

  afterAll(() => {
    for (const capture of captures.values()) {
      let record: Record<string, unknown>;
      try {
        const envelope = assessEnvelope(capture.testName, capture.transaction as never, capture.sourceOutputs);
        const redeemBytes = capture.transaction.inputs.map(
          (input) => redeemScriptLength(input.unlockingBytecode),
        );
        const worst = envelope.worstCostInput.input;
        const controlBudget = knobControlBudgetFor(envelope.worstCostInput);
        const control = densityKnobControl(
          capture.transaction as never, capture.sourceOutputs, worst, controlBudget,
        );
        record = {
          shape: capture.testName,
          builds: capture.builds,
          inputCount: envelope.inputCount,
          outputCount: envelope.outputCount,
          serializedBytes: envelope.serializedBytes,
          standardSizeRatio: envelope.standardSizeRatio,
          maximumLockingBytes: envelope.maximumLockingBytes,
          inputSerializedBytes: envelope.inputSerializedBytes,
          outputSerializedBytes: envelope.outputSerializedBytes,
          redeemBytes,
          classification: classifyInputs(envelope, redeemBytes),
          inputs: envelope.inputs,
          binding: envelope.binding,
          refusedAtConsensus: envelope.refusedAtConsensus,
          refusedAtStandard: envelope.refusedAtStandard,
          knobControlInput: worst,
          knobControlBudget: controlBudget,
          knobControlError: control ?? null,
          knobControlBites: control !== undefined && /density|operation cost/i.test(control),
        };
        console.log(`[F2] ${formatEnvelope(envelope)}`);
        console.log(`[F2] classes: ${JSON.stringify(classifyInputs(envelope, redeemBytes))}`);
      } catch (error) {
        record = { shape: capture.testName, error: String(error), builds: capture.builds };
        console.log(`[F2] ${capture.testName}: ${String(error)}`);
      }
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);
    }
    captures.clear();
  });
}
