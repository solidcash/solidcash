/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import { beforeAll, afterAll, beforeEach, afterEach, it, test, describe } from 'vitest';
import './chai.js';
import { initHre } from './index.js';

/* ---------------------------------------------------------------------------------------------------------- */
/* Mocha compatibility                                                                                          */
/*                                                                                                              */
/* Hardhat projects run on Mocha. Conventions absent from Vitest that stop an UNMODIFIED Hardhat suite at       */
/* collection time, before a single contract is exercised:                                                      */
/*                                                                                                              */
/*   1. `before` / `after` (Vitest names them `beforeAll` / `afterAll`)                                          */
/*   2. the shared `this` context a hook writes and a test reads (`this.token = ...`)                           */
/*   3. Mocha suite aliases: `context` (= describe), `xdescribe`/`xit` (= skip)                                 */
/*      MistSwap MasterChef.test.ts uses `context("With ERC/LP token ...")` - without this:                     */
/*      "ReferenceError: context is not defined" at collection time.                                            */
/*                                                                                                              */
/* This setup file is evaluated once per test file, so one module-level object gives each file its own context,  */
/* matching Mocha's per-file root suite. Arrow-function callbacks ignore the binding, so this is additive.       */
/* ---------------------------------------------------------------------------------------------------------- */

type AnyFn = (...args: unknown[]) => unknown;

const mochaContext: Record<string, unknown> = {
  // Mocha exposes these on the context; make them harmless no-ops rather than a TypeError mid-suite.
  timeout: () => mochaContext,
  slow: () => mochaContext,
  retries: () => mochaContext,
};

const bindContext = (fn: unknown): unknown => (typeof fn === 'function'
  ? function boundToMochaContext(this: unknown, ...args: unknown[]): unknown {
    return (fn as AnyFn).apply(mochaContext, args);
  }
  : fn);

const hook = (register: (fn: never, timeout?: number) => unknown) =>
  (fn: unknown, timeout?: number): unknown => register(bindContext(fn) as never, timeout);

/**
 * Wrap a Vitest runner (`it`/`test`/`describe`) so callbacks see the shared context.
 * Preserve `.skip` / `.only` / `.each` (often non-enumerable). One-level only: do NOT recurse
 * `runner(it.skip)` into `it.skip.skip…` (that overflows the stack).
 */
const runner = (original: unknown): unknown => {
  const src = original as AnyFn & Record<string, unknown>;
  const wrapCb = (fn: AnyFn): AnyFn =>
    ((name: unknown, body: unknown, timeout?: number): unknown =>
      fn(name, bindContext(body), timeout)) as AnyFn;
  const wrapped = wrapCb(src) as AnyFn & Record<string, unknown>;
  for (const key of ['skip', 'only', 'each', 'todo', 'concurrent', 'fails'] as const) {
    const nested = src[key];
    if (typeof nested !== 'function') continue;
    if (key === 'skip' || key === 'only') {
      // Bind mocha `this` on skipped/focused callbacks without re-entering runner().
      wrapped[key] = wrapCb(nested as AnyFn);
      Object.assign(wrapped[key] as object, nested);
    } else {
      wrapped[key] = nested;
    }
  }
  return wrapped;
};

const globals = globalThis as Record<string, unknown>;
globals.before ??= hook(beforeAll as never);
globals.after ??= hook(afterAll as never);
globals.beforeEach = hook(beforeEach as never);
globals.afterEach = hook(afterEach as never);
globals.it = runner(it);
globals.test = runner(test);
globals.specify ??= globals.it;
// Mocha suite aliases used by unmodified Hardhat/MistSwap suites.
const suite = runner(describe);
globals.describe ??= suite;
globals.context = suite; // Mocha: context === describe (MasterChef nested suite)
// Skipped suite / test shorthands (Mocha xdescribe / xit).
const itSkip = (it as unknown as { skip?: unknown }).skip ?? ((name: unknown, _fn?: unknown) =>
  (it as AnyFn)(String(name), () => { /* skipped */ }));
const describeSkip = (describe as unknown as { skip?: unknown }).skip ?? ((name: unknown, _fn?: unknown) =>
  (describe as AnyFn)(String(name), () => { /* skipped */ }));
globals.xit = typeof itSkip === 'function' ? runner(itSkip) : globals.it;
globals.xdescribe = typeof describeSkip === 'function' ? runner(describeSkip) : suite;
globals.xcontext = globals.xdescribe;

await initHre(process.cwd());