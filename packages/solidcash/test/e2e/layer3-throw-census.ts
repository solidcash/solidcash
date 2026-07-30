import { appendFileSync } from 'fs';
import { expect } from 'vitest';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

/**
 * X130/X131 THROW CENSUS. A green suite proves nothing went RED; only a census of every THROW on the changed
 * path proves nothing went VACUOUS - that a test still passes for the reason it names, rather than because a
 * different guard now speaks first (or because the guard it was asserting stopped speaking at all).
 *
 * TWO CHANGED PATHS, one instrument:
 *  - `TransactionBuilder.debug()` is what Row A changes. `StatefulContract._preflightRecursiveBuilder` calls it
 *    and rethrows, so it is the accept/reject gate for `.build()` on a `recursiveStateHandler`, and
 *    `TransactionBuilder.send()` propagates it for a standard non-covenant transaction.
 *  - `TransactionBuilder.send()` is what Row B changes. Recording its throws separately from the provider's own
 *    is what tells a GATE refusal apart from a NETWORK refusal, which is the whole distinction Row B turns on.
 *
 * NON-CIRCULAR BY CONSTRUCTION. The X126 observer figure ("0 newly refused") is circular once a site is gated:
 * a refused send never reaches the provider, so the observer stops seeing it. This records the throw itself, at
 * the site that produced it, whether or not the provider is ever reached.
 *
 * A PURE OBSERVER: every wrapper rethrows the original error unchanged and returns the original result
 * unchanged. Inert unless `L3_CENSUS_OUT` names an output file, so an ordinary `yarn test` never loads it.
 *
 *   L3_CENSUS_OUT=/tmp/census.jsonl npx vitest run -c vitest.census.config.ts test/e2e
 */

const OUT = process.env.L3_CENSUS_OUT;

/** First `src/` frame above the instrumented method: the call site that will see the throw. */
function callerFrame(stack: string): string {
  for (const raw of stack.split('\n').slice(1)) {
    const frame = raw.trim();
    if (frame.includes('layer3-throw-census')) continue;
    if (frame.includes('/src/')) return frame.match(/\/src\/([^\s)]+)/)?.[1] ?? frame;
    if (frame.includes('/test/')) return `test:${frame.match(/\/test\/([^\s)]+)/)?.[1] ?? frame}`;
  }
  return 'unattributed';
}

/** Collapse volatile substrings so a message is comparable across runs. */
function normalise(message: string): string {
  return message
    .replace(/[0-9a-f]{40,}/gi, '<hex>')
    .replace(/https:\/\/ide\.bitauth\.com\/import-template\/[^\s'"]+/g, '<bitauth>')
    .slice(0, 400);
}

const counters = new Map<string, number>();
function record(row: Record<string, unknown>): void {
  const test = expect.getState().currentTestName ?? 'unknown';
  const file = (expect.getState().testPath ?? 'unknown').replace(/^.*\/test\//, 'test/');
  const key = `${file}::${test}::${row.kind as string}`;
  const seq = (counters.get(key) ?? 0) + 1;
  counters.set(key, seq);
  appendFileSync(OUT!, `${JSON.stringify({ file, test, seq, ...row })}\n`);
}

if (OUT !== undefined) {
  Error.stackTraceLimit = 60;

  const originalDebug = TransactionBuilder.prototype.debug;
  TransactionBuilder.prototype.debug = function censusDebug(this: TransactionBuilder) {
    const caller = callerFrame(new Error().stack ?? '');
    try {
      const results = originalDebug.call(this);
      record({ kind: 'debug', caller, threw: false });
      return results;
    } catch (error) {
      record({ kind: 'debug', caller, threw: true, message: normalise((error as Error).message ?? String(error)) });
      throw error;
    }
  };

  const originalSend = TransactionBuilder.prototype.send;
  TransactionBuilder.prototype.send = async function censusSend(this: TransactionBuilder, raw?: true) {
    const caller = callerFrame(new Error().stack ?? '');
    try {
      const result = await (originalSend as (r?: true) => Promise<unknown>).call(this, raw);
      record({ kind: 'send', caller, threw: false });
      return result as never;
    } catch (error) {
      record({ kind: 'send', caller, threw: true, message: normalise((error as Error).message ?? String(error)) });
      throw error;
    }
  } as typeof TransactionBuilder.prototype.send;

  // The provider's own verdict, so a gate refusal (send throws, provider never reached) is distinguishable
  // from a network refusal (provider reached and refused) rather than both reading as "send threw".
  const originalRaw = MockNetworkProvider.prototype.sendRawTransaction;
  MockNetworkProvider.prototype.sendRawTransaction = async function censusRaw(
    this: MockNetworkProvider, txHex: string,
  ): Promise<string> {
    try {
      const txid = await originalRaw.call(this, txHex);
      record({ kind: 'provider', caller: callerFrame(new Error().stack ?? ''), threw: false });
      return txid;
    } catch (error) {
      record({
        kind: 'provider',
        caller: callerFrame(new Error().stack ?? ''),
        threw: true,
        message: normalise((error as Error).message ?? String(error)),
      });
      throw error;
    }
  };
}
