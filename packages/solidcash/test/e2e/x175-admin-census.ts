import { appendFileSync } from 'fs';
import { expect } from 'vitest';
import { StatefulContract, StatefulFunctionCall } from '../../src/stateful/StatefulContract.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

/**
 * X175 THROW CENSUS, for the four stateful lifecycle-admin broadcast sites.
 *
 * WHY A SEPARATE INSTRUMENT FROM `layer3-throw-census.ts`. That one wraps `TransactionBuilder.debug/send` and
 * the provider. These four sites call NEITHER: they call `builder.build()` and hand the hex straight to
 * `provider.sendRawTransaction`, so a refusal at one of them never reaches any method that census observes -
 * the gate throws first and the provider is never called. Their throws are only visible at the public entry
 * points, which is what this wraps.
 *
 * A PURE OBSERVER. Every wrapper rethrows the original error unchanged and returns the original result
 * unchanged. Inert unless `L3_X175_OUT` names an output file, so an ordinary `yarn test` never loads it.
 *
 *   L3_X175_OUT=/tmp/after.jsonl npx vitest run -c vitest.x175.config.ts <files>
 *
 * WHAT A GREEN SUITE DOES NOT PROVE. A green run says nothing went RED. Only a census says nothing went
 * VACUOUS - that every test still fails for the reason it names rather than because a different decider now
 * speaks first. Diff two runs by `file::test::kind::seq`.
 */

const OUT = process.env.L3_X175_OUT;

/** Collapse volatile substrings so a message is comparable across runs. */
const normalise = (message: string): string => message
  .replace(/[0-9a-f]{40,}/gi, '<hex>')
  .replace(/https:\/\/ide\.bitauth\.com\/import-template\/[^\s'"]+/g, '<bitauth>')
  .slice(0, 500);

const counters = new Map<string, number>();
const record = (kind: string, threw: boolean, message?: string): void => {
  const test = expect.getState().currentTestName ?? 'unknown';
  const file = (expect.getState().testPath ?? 'unknown').replace(/^.*\/test\//, 'test/');
  const key = `${file}::${test}::${kind}`;
  const seq = (counters.get(key) ?? 0) + 1;
  counters.set(key, seq);
  appendFileSync(OUT!, `${JSON.stringify({ file, test, kind, seq, threw, message })}\n`);
};

/** Wrap one async function so its throw - and only its throw - is recorded. */
const observe = <A extends unknown[], R>(
  kind: string, original: (...args: A) => Promise<R>,
) => async function observed(this: unknown, ...args: A): Promise<R> {
    try {
      const result = await original.apply(this, args);
      record(kind, false);
      return result;
    } catch (error) {
      record(kind, true, normalise((error as Error).message ?? String(error)));
      throw error;
    }
  };

if (OUT !== undefined) {
  Error.stackTraceLimit = 60;
  // `selfdestructTo` delegates to `destroy`, so wrapping destroy covers both entry points.
  StatefulContract.destroy = observe('destroy', StatefulContract.destroy) as typeof StatefulContract.destroy;
  StatefulContract.split = observe('split', StatefulContract.split) as typeof StatefulContract.split;
  StatefulContract.merge = observe('merge', StatefulContract.merge) as typeof StatefulContract.merge;
  // `sc.call.X().send()` reaches `_sendRawBuilder` for a split/merge/unsafe tier and the stateful submit path
  // otherwise. Recording both is deliberate: a blast into the ordinary path would be invisible if this only
  // recorded the admin route.
  StatefulFunctionCall.prototype.send = observe(
    'call.send', StatefulFunctionCall.prototype.send,
  ) as typeof StatefulFunctionCall.prototype.send;

  // The provider's own verdict, so a GATE refusal (the entry point throws, the provider is never reached) is
  // distinguishable from a NETWORK refusal rather than both reading as "the entry point threw".
  const originalRaw = MockNetworkProvider.prototype.sendRawTransaction;
  MockNetworkProvider.prototype.sendRawTransaction = observe(
    'provider', originalRaw,
  ) as typeof MockNetworkProvider.prototype.sendRawTransaction;
}
