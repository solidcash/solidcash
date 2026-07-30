import { appendFileSync } from 'fs';
import { afterAll, expect } from 'vitest';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { assessFinalizedTransactionBytes } from '../../src/layer3/preflight.js';

/**
 * X126 BLAST-RADIUS MEASUREMENT. Answers one question and only that one: if the finalized-bytes gate
 * (`assertFinalizedTransactionBytes`) were applied at a given `sendRawTransaction` call site, what fraction of
 * the transactions the existing green tests broadcast through THAT site would it newly refuse?
 *
 * A PURE OBSERVER. It ASSESSES rather than asserts - `assessFinalizedTransactionBytes` returns a verdict and
 * never throws - and it forwards to the original method and returns its result unchanged. Landing the gate on
 * a measurement taken by a gate that was already refusing would be circular, and a red suite measures nothing.
 *
 * ATTRIBUTION IS BY STACK FRAME, not by patching eight call sites. Patching the sites would mean editing four
 * source files to measure them, which is both outside one worker's lease and a change to the thing being
 * measured. The synchronous frame directly above `sendRawTransaction` is the site, and this reads it.
 *
 * WHY THE MOCK PROVIDER IS THE HOOK. Every send path in `src/` ends at `provider.sendRawTransaction(raw)`, and
 * on this suite every provider is a `MockNetworkProvider`. Wrapping the provider therefore sees every
 * broadcast exactly once, with the finalized bytes the network is actually handed.
 *
 * Inert unless `L3_GATESITE_OUT` names an output file. Activate with the sibling config, which the root
 * project glob does not match, so an ordinary `yarn test` never loads it:
 *
 *   L3_GATESITE_OUT=/tmp/sites.jsonl npx vitest run -c vitest.gatesite.config.ts test/e2e/Layer3Cycle.test.ts
 */

const OUT = process.env.L3_GATESITE_OUT;

/** The eight broadcast sites in `src/`, keyed by the frame text that identifies each. */
const SITE_PATTERNS: readonly { site: string; match: RegExp }[] = [
  { site: 'layer3/preflight.ts sendPreflightedLayer3Transaction', match: /layer3\/preflight\.ts/ },
  { site: 'StatefulTransactionBuilder.ts submit', match: /StatefulTransactionBuilder\.ts/ },
  { site: 'StatefulContract.ts', match: /StatefulContract\.ts/ },
  { site: 'TransactionBuilder.ts send', match: /TransactionBuilder\.ts/ },
];

/**
 * The first frame above the provider. A `src/` frame names one of the eight sites (with its line, so the five
 * in StatefulContract split); a `test/` frame means the fixture called `sendRawTransaction` itself and no gate
 * at any of the eight sites could ever see those bytes, which is a category the fractions must not absorb.
 */
function attribute(stack: string): { site: string; frame: string } {
  const frames = stack.split('\n').slice(1);
  for (const raw of frames) {
    const frame = raw.trim();
    if (frame.includes('MockNetworkProvider.ts') || frame.includes('layer3-gatesite-probe')) continue;
    if (frame.includes('/src/')) {
      const hit = SITE_PATTERNS.find((candidate) => candidate.match.test(frame));
      return { site: hit?.site ?? 'other', frame: frame.match(/\/src\/([^\s)]+)/)?.[1] ?? frame };
    }
    if (frame.includes('/test/')) {
      return { site: 'test-direct', frame: frame.match(/\/test\/([^\s)]+)/)?.[1] ?? frame };
    }
  }
  return { site: 'unattributed', frame: frames.slice(0, 3).join(' | ') };
}

if (OUT !== undefined) {
  // The default 10 frames can end before the `src/` frame on a deep async chain, which would silently move
  // rows into `unattributed` rather than onto the site that produced them.
  Error.stackTraceLimit = 60;
  const original = MockNetworkProvider.prototype.sendRawTransaction;
  MockNetworkProvider.prototype.sendRawTransaction = async function patched(
    this: MockNetworkProvider, txHex: string,
  ): Promise<string> {
    let row: Record<string, unknown> | undefined;
    try {
      const { site, frame } = attribute(new Error().stack ?? '');
      const verdict = assessFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(txHex)));
      row = {
        test: expect.getState().currentTestName ?? 'unknown',
        file: expect.getState().testPath ?? 'unknown',
        site,
        frame,
        admitted: verdict.admitted,
        refusals: verdict.refusals.map((entry) => `${entry.regime}:${entry.rule}`),
        serializedBytes: verdict.serializedBytes,
        inputCount: verdict.inputCount,
        outputCount: verdict.outputCount,
        binding: verdict.readings[0] === undefined ? null
          : { rule: verdict.readings[0].rule, ratio: verdict.readings[0].ratio },
      };
    } catch {
      // Measurement must never change the outcome of the test it is observing.
    }
    // The NETWORK's own verdict on the same bytes. Without it a gate refusal cannot be told apart from a
    // shape the mock was going to refuse anyway - and only the first of those is a regression.
    try {
      const txid = await original.call(this, txHex);
      if (row !== undefined) appendFileSync(OUT, `${JSON.stringify({ ...row, network: 'accept' })}\n`);
      return txid;
    } catch (error) {
      if (row !== undefined) appendFileSync(OUT, `${JSON.stringify({ ...row, network: 'refuse' })}\n`);
      throw error;
    }
  };

  afterAll(() => { /* nothing buffered: every row is appended as it happens */ });
}
