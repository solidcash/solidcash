import { appendFileSync } from 'fs';
import { expect } from 'vitest';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { asmToBytecode } from '@solidcash/utils';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { assessFinalizedTransactionBytes } from '../../src/layer3/preflight.js';

/**
 * X163 ROW B - THE OVERHEAD PROBE. Measures the ONE quantity the 122-byte figure was a single sample of.
 *
 * `solidc` warns when `scriptToBytecode(script).length > 10_000` - the UN-CONSTRUCTED script. Consensus limits
 * the UNLOCKING BYTECODE, which is that script PLUS the constructor-argument pushes baked into the redeem
 * script, PLUS the redeem push prefix, PLUS every call argument. The difference is the OVERHEAD, and it is
 * exactly the width of the band in which a contract compiles with no diagnostic and cannot be spent:
 *
 *   band = (10_000 - overhead, 10_000]      so      band width == overhead
 *
 * X158 measured 125 on one contract family and stated the boundary as "122 bytes below the compiler's
 * threshold" - 122 being the distance to the first script size it actually tried, which moves in 12-byte
 * statement steps. The number that generalises is the overhead itself.
 *
 * WHAT IT READS, per contract-bearing input of every transaction built:
 *   script    `asmToBytecode(artifact.bytecode).length`  - what the compiler measures against 10,000.
 *   redeem    `contract.bytecode.length / 2`             - script + constructor pushes + any prologue.
 *   unlocking the finalized input's `unlockingBytecode`  - what consensus measures against 10,000.
 *
 * `artifact.bytecode` IS AN ASM LISTING. Its character count halved is not a byte count and reads about 2.2x
 * high; that unit error produced five wrong measurements on X158 and `asmToBytecode` is what avoids it here.
 *
 * A PURE OBSERVER: it returns the original transaction unchanged and swallows every error it could raise.
 * Inert unless `L4_OVERHEAD_OUT` names an output file, so an ordinary `yarn test` never loads it.
 *
 *   L4_OVERHEAD_OUT=/tmp/overhead.jsonl npx vitest run -c vitest.overhead.config.ts <files>
 */

const OUT = process.env.L4_OVERHEAD_OUT;

if (OUT !== undefined) {
  const original = TransactionBuilder.prototype.buildLibauthTransaction;
  TransactionBuilder.prototype.buildLibauthTransaction = function probed(
    this: TransactionBuilder, skipChecks?: boolean,
  ) {
    const transaction = original.call(this, skipChecks);
    try {
      const file = (expect.getState().testPath ?? 'unknown').replace(/^.*\/test\//, 'test/');
      const test = expect.getState().currentTestName ?? 'unknown';
      this.inputs.forEach((input, index) => {
        const unlocker = input.unlocker as {
          contract?: { name?: string; bytecode?: string; artifact?: { bytecode?: string } };
          abiFunction?: { name?: string };
        } | undefined;
        const contract = unlocker?.contract;
        if (contract === undefined || typeof contract.bytecode !== 'string') return;
        if (typeof contract.artifact?.bytecode !== 'string') return;
        const script = asmToBytecode(contract.artifact.bytecode).length;
        const redeem = contract.bytecode.length / 2;
        const unlocking = transaction.inputs[index]?.unlockingBytecode.length;
        if (unlocking === undefined) return;
        appendFileSync(OUT, `${JSON.stringify({
          file,
          test,
          contract: contract.name ?? '?',
          fn: unlocker?.abiFunction?.name ?? '?',
          script,
          redeem,
          unlocking,
          ctorOverhead: redeem - script,
          argOverhead: unlocking - redeem,
          overhead: unlocking - script,
        })}\n`);
      });
    } catch {
      // Measurement must never change the outcome of the test it is observing.
    }
    return transaction;
  } as typeof TransactionBuilder.prototype.buildLibauthTransaction;
}

/**
 * X163 ROW B - THE `.build()` BLAST RADIUS. Answers one question and only that one: if the finalized-bytes
 * gate were applied inside `TransactionBuilder.build()`, how many of the transactions the population
 * CONSTRUCTS - as opposed to broadcasts - would it refuse?
 *
 * A SEPARATE SUBJECT FROM THE SEND SITES, and that is the point. `build()` is reached by every send path in
 * `src/` that broadcasts a prebuilt hex (split, merge, destroy, `_sendRawBuilder`,
 * `sendPreflightedLayer3Transaction`), by `generateWcTransactionObject`, and by every fixture that constructs
 * bytes to inspect or to hand somewhere else. A refusal there is a refusal to CONSTRUCT, which is a strictly
 * larger claim than a refusal to broadcast.
 *
 * A PURE OBSERVER. It ASSESSES - `assessFinalizedTransactionBytes` returns a verdict and never throws - and
 * returns the original hex unchanged. Inert unless `L4_BUILD_OUT` names an output file.
 */
const BUILD_OUT = process.env.L4_BUILD_OUT;

if (BUILD_OUT !== undefined) {
  Error.stackTraceLimit = 60;
  const originalBuild = TransactionBuilder.prototype.build;
  TransactionBuilder.prototype.build = function probedBuild(this: TransactionBuilder): string {
    const hex = originalBuild.call(this);
    try {
      // The first frame above `build()`: a `src/` frame is an internal construction the SDK does on its own
      // behalf, a `test/` frame is a composer building bytes directly. A refusal means something different
      // in each case, so they must not be pooled.
      let caller = 'unattributed';
      for (const raw of (new Error().stack ?? '').split('\n').slice(1)) {
        const frame = raw.trim();
        if (frame.includes('l4-overhead-probe')) continue;
        if (frame.includes('/src/')) { caller = frame.match(/\/src\/([^\s)]+)/)?.[1] ?? frame; break; }
        if (frame.includes('/test/')) { caller = `test:${frame.match(/\/test\/([^\s)]+)/)?.[1] ?? frame}`; break; }
      }
      const verdict = assessFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(hex)));
      appendFileSync(BUILD_OUT, `${JSON.stringify({
        file: (expect.getState().testPath ?? 'unknown').replace(/^.*\/test\//, 'test/'),
        test: expect.getState().currentTestName ?? 'unknown',
        caller,
        admitted: verdict.admitted,
        refusals: verdict.refusals.map((entry) => `${entry.regime}:${entry.rule}`),
        serializedBytes: verdict.serializedBytes,
      })}\n`);
    } catch {
      // Measurement must never change the outcome of the test it is observing.
    }
    return hex;
  };
}
