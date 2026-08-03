import { appendFileSync } from 'fs';
import { afterAll, expect } from 'vitest';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  assessEnvelope, densityKnobControl, formatEnvelope, knobControlBudgetFor,
} from './message-bus-envelope-f1.js';

/**
 * OPT-IN F1 PROBE. Records the transactions the existing capstone tests actually build, and measures them
 * against the real BCH-2026 consensus and standard limits, WITHOUT editing a single fixture.
 *
 * Why a probe rather than a copy of each builder: the capstone builders are not exported, and a byte-copy of
 * roughly three thousand lines would measure a copy rather than the subject. This observes the subject.
 *
 * Inert unless `L3_ENVELOPE_OUT` names an output file. Activate with the sibling config, which is not matched
 * by the root project glob and so never runs by accident:
 *
 *   L3_ENVELOPE_OUT=/tmp/envelope.jsonl yarn vitest run -c packages/solidcash/vitest.envelope.config.ts \
 *     test/journal-message-bus/e2e/MessageBusDefiCapstoneC1.test.ts -t 'MEASURED'
 *
 * The probe is a pure observer: it forwards to the original method and returns its result unchanged.
 */

const OUT = process.env.L3_ENVELOPE_OUT;

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
      // KEEP THE WIDEST BUILD, not the first. A capstone builds many transactions per test - every
      // `setupStatefulUtxos` seed is one - and the seeds come FIRST. The composed graph is the widest by a
      // wide margin (108 inputs against 2), so input count identifies it without reading any fixture.
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
        const worst = envelope.worstCostInput.input;
        const controlBudget = knobControlBudgetFor(envelope.worstCostInput);
        const control = densityKnobControl(
          capture.transaction as never, capture.sourceOutputs, worst, controlBudget,
        );
        record = {
          ...envelope,
          builds: capture.builds,
          knobControlInput: worst,
          knobControlBudget: controlBudget,
          knobControlError: control ?? null,
          knobControlBites: control !== undefined && /density|operation cost/i.test(control),
          txid: binToHex(encodeTransaction(capture.transaction as never)).slice(0, 32),
        };
        console.log(`[F1] ${formatEnvelope(envelope)}`);
      } catch (error) {
        record = { shape: capture.testName, error: String(error), builds: capture.builds };
        console.log(`[F1] ${capture.testName}: ${String(error)}`);
      }
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);
    }
    captures.clear();
  });
}
