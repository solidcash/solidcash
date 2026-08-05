/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import { beforeAll, afterAll, beforeEach, afterEach, it, test } from 'vitest';
import './chai.js';
import { initHre } from './index.js';

/* ---------------------------------------------------------------------------------------------------------- */
/* Mocha compatibility                                                                                          */
/*                                                                                                              */
/* Hardhat projects run on Mocha. Two of its conventions are absent from Vitest and stop an UNMODIFIED Hardhat   */
/* suite at collection time, before a single contract is exercised:                                             */
/*                                                                                                              */
/*   1. `before` / `after` (Vitest names them `beforeAll` / `afterAll`)                                          */
/*      -> "ReferenceError: before is not defined"                                                              */
/*   2. the shared `this` context a hook writes and a test reads (`this.token = ...`). Vitest callbacks run with */
/*      `this` undefined in ESM strict mode                                                                      */
/*      -> "TypeError: Cannot set properties of undefined (setting 'token')"                                     */
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

/** Wrap a Vitest runner (`it`/`test`) so its callback sees the shared context, keeping `.skip`/`.only`/`.each`. */
const runner = (original: unknown): unknown => {
  const wrapped = (name: unknown, fn: unknown, timeout?: number): unknown =>
    (original as AnyFn)(name, bindContext(fn), timeout);
  return Object.assign(wrapped, original);
};

const globals = globalThis as Record<string, unknown>;
globals.before ??= hook(beforeAll as never);
globals.after ??= hook(afterAll as never);
globals.beforeEach = hook(beforeEach as never);
globals.afterEach = hook(afterEach as never);
globals.it = runner(it);
globals.test = runner(test);
globals.specify ??= globals.it;

await initHre(process.cwd());
