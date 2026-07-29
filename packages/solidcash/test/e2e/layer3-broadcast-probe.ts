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
  builds: number;
}

const captures = new Map<string, Capture>();

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
      const existing = captures.get(testName);
      // Keep the WIDEST build, matching F1's rule: a capstone builds one transaction per seeded UTXO before
      // it builds the composed graph, and the composed graph has far more inputs than any seed.
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
        const raw = encodeTransaction(capture.transaction as never);
        const hex = binToHex(raw);
        record = {
          shape: capture.testName,
          serializedBytes: raw.length,
          inputCount: capture.transaction.inputs.length,
          outputCount: capture.transaction.outputs.length,
          builds: capture.builds,
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
        record = { shape: capture.testName, error: String(error), builds: capture.builds };
      }
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);
    }
    captures.clear();
  });
}

/** Exported so a consumer can re-derive the id of bytes it read back from the capture file. */
export function txidOfHex(hex: string): string {
  return transactionId(hexToBin(hex));
}
