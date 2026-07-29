import { appendFileSync } from 'fs';
import { afterAll, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * X49 BROADCAST CAPTURE. Records the COMPLETE serialized bytes of the transactions the existing capstone
 * tests build, so those exact bytes can be offered to a real BCHN node.
 *
 * This is F1's envelope probe with one difference: F1 recorded a 32-character txid prefix, which is enough
 * to identify a transaction but not to broadcast it. Broadcasting needs every byte.
 *
 * WHAT A REPLAY OF THESE BYTES CAN AND CANNOT SETTLE. The outpoints these transactions spend were minted by
 * MockNetworkProvider and do not exist on any chain, so the node cannot execute their input scripts. It was
 * measured separately (see the X49 calibration) that BCHN applies the standard SIZE policy BEFORE it looks
 * up inputs, so a replay does return the node's truthful verdict on transaction size, and on nothing else.
 * Script validity has to be earned by building against a real provider instead.
 *
 * Inert unless `L3_BROADCAST_OUT` names an output file. Activate with the sibling config, which the root
 * project glob does not match, so an ordinary `yarn test` never loads it:
 *
 *   L3_BROADCAST_OUT=/tmp/raw.jsonl yarn vitest run -c packages/solidcash/vitest.broadcast.config.ts \
 *     test/e2e/Layer3DefiCapstoneC1.test.ts
 *
 * A pure observer: it forwards to the original method and returns its result unchanged.
 */

const OUT = process.env.L3_BROADCAST_OUT;

interface Capture {
  testName: string;
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
}

/**
 * How many builds to keep per test, widest first. F1 kept one, which is right for a capstone: the composed
 * graph dwarfs every seed. The participant sweep is the exception - it builds N=2, N=4 and N=8 inside a
 * SINGLE test - and keeping only the widest would discard the two smaller shapes, which are precisely the
 * ones to put on a node first.
 */
const KEEP_PER_TEST = 3;

const captures = new Map<string, { rows: Capture[]; builds: number }>();

/** Bitcoin txid: double SHA-256 of the serialization, displayed in reverse byte order. */
function transactionId(raw: Uint8Array): string {
  return binToHex(sha256.hash(sha256.hash(raw)).slice().reverse());
}

if (OUT !== undefined) {
  const original = TransactionBuilder.prototype.buildLibauthTransaction;
  TransactionBuilder.prototype.buildLibauthTransaction = function patched(
    this: TransactionBuilder, skipChecks?: boolean,
  ): ReturnType<TransactionBuilder['buildLibauthTransaction']> {
    const transaction = original.call(this, skipChecks);
    try {
      const testName = expect.getState().currentTestName ?? 'unknown';
      let entry = captures.get(testName);
      if (entry === undefined) {
        entry = { rows: [], builds: 0 };
        captures.set(testName, entry);
      }
      entry.builds += 1;
      entry.rows.push({
        testName, transaction, sourceOutputs: generateLibauthSourceOutputs(this.inputs),
      });
      // Widest first, then truncate: a capstone's seeds are far narrower than its composed graph, so this
      // keeps the graph without needing to know anything about the fixture that built it.
      entry.rows.sort((left, right) => right.transaction.inputs.length - left.transaction.inputs.length);
      entry.rows.length = Math.min(entry.rows.length, KEEP_PER_TEST);
    } catch {
      // Capture must never change the outcome of the test it is observing.
    }
    return transaction;
  } as typeof original;

  afterAll(() => {
    for (const entry of captures.values()) {
      for (const capture of entry.rows) {
        let record: Record<string, unknown>;
        try {
          const raw = encodeTransaction(capture.transaction as never);
          const hex = binToHex(raw);
          record = {
            shape: capture.testName,
            serializedBytes: raw.length,
            inputCount: capture.transaction.inputs.length,
            outputCount: capture.transaction.outputs.length,
            builds: entry.builds,
            txid: transactionId(raw),
            // The source outputs record what these inputs WOULD have spent, so the reason a node cannot
            // execute them stays visible next to the bytes rather than being inferred later.
            sourceOutputs: capture.sourceOutputs.map((output) => ({
              valueSatoshis: String(output.valueSatoshis),
              lockingBytecodeBytes: output.lockingBytecode.length,
              token: output.token === undefined ? null : {
                category: binToHex(output.token.category),
                amount: String(output.token.amount),
                commitmentBytes: output.token.nft?.commitment.length ?? null,
                capability: output.token.nft?.capability ?? null,
              },
            })),
            unlockingBytes: capture.transaction.inputs.map((input) => input.unlockingBytecode.length),
            rawHex: hex,
          };
        } catch (error) {
          record = { shape: capture.testName, error: String(error), builds: entry.builds };
        }
        appendFileSync(OUT, `${JSON.stringify(record)}\n`);
      }
    }
    captures.clear();
  });
}

/** Exported so a consumer can re-derive the id of bytes it read back from the capture file. */
export function txidOfHex(hex: string): string {
  return transactionId(hexToBin(hex));
}
