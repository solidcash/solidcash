/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import { beforeAll, afterAll, beforeEach, afterEach, it, test, describe } from 'vitest';
import {
  clearDeployments, clearSoftBentoTotals, takeDeploymentRegistrySnapshot, takeSoftStateSnapshot,
  type DeploymentRegistrySnapshot, type SnapshotRestorer, type SoftStateSnapshot,
} from 'solidcash';
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
const parseSnapshotSelectors = (raw: string | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) return parsed;
  } catch { /* retain compatibility with the original single-substring environment option */ }
  return [raw];
};

const globToRegExp = (glob: string): RegExp => {
  let source = '';
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];
    if (char === '*') {
      if (glob[index + 1] === '*') {
        source += '.*';
        index++;
      } else source += '[^/]*';
    } else if (char === '?') source += '[^/]';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(source);
};

const snapshotBeforeEachSelectors = parseSnapshotSelectors(process.env.SOLIDCASH_SNAPSHOT_BEFORE_EACH)
  .map((selector) => globToRegExp(selector.replaceAll('\\', '/')));
let fixtureSnapshotReady = false;
let fixtureHookRegistered = false;
let fixtureChainSnapshot: SnapshotRestorer | undefined;
let fixtureDeploymentSnapshot: DeploymentRegistrySnapshot | undefined;
let fixtureSoftStateSnapshot: SoftStateSnapshot | undefined;

const isSelectedFixtureHook = (): boolean => {
  if (snapshotBeforeEachSelectors.length === 0) return false;
  const stack = new Error().stack?.replaceAll('\\', '/') ?? '';
  return snapshotBeforeEachSelectors.some((selector) => selector.test(stack));
};

// Opt-in adapter escape hatch for very large, unmodified Hardhat suites. The selected upstream beforeEach is
// executed once; later tests retain its closure-bound contract objects and restore every mutable backing store.
globals.beforeEach = (fn: unknown, timeout?: number): unknown => {
  if (fixtureHookRegistered || !isSelectedFixtureHook()) return hook(beforeEach as never)(fn, timeout);
  fixtureHookRegistered = true;
  const bound = bindContext(fn) as AnyFn;
  // eslint-disable-next-line no-console -- intentional once-per-file proof that snapshot fixtures engaged
  console.info(
    `[solidcash] snapshot beforeEach active (selectors=${JSON.stringify(process.env.SOLIDCASH_SNAPSHOT_BEFORE_EACH)})`,
  );
  return beforeEach(async () => {
    const provider = hre.ethers?.provider as {
      takeSnapshot?: () => Promise<SnapshotRestorer>;
    } | undefined;
    if (fixtureSnapshotReady) {
      const restoreStarted = Date.now();
      await fixtureChainSnapshot?.restore();
      fixtureDeploymentSnapshot?.restore();
      fixtureSoftStateSnapshot?.restore();
      // eslint-disable-next-line no-console -- timing evidence that restore replaced full redeploy
      console.info(`[solidcash] snapshot beforeEach restore (${Date.now() - restoreStarted}ms)`);
      return;
    }
    const setupStarted = Date.now();
    await bound();
    if (!provider?.takeSnapshot) throw new Error('Snapshot beforeEach requires a snapshot-capable provider');
    fixtureChainSnapshot = await provider.takeSnapshot();
    fixtureDeploymentSnapshot = takeDeploymentRegistrySnapshot(provider as never);
    fixtureSoftStateSnapshot = takeSoftStateSnapshot();
    fixtureSnapshotReady = true;
    // eslint-disable-next-line no-console -- timing evidence that first fixture ran once
    console.info(`[solidcash] snapshot beforeEach captured after setup (${Date.now() - setupStarted}ms)`);
  }, timeout);
};
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

const hre = await initHre(process.cwd());
// ethers.Contract shim and ported suites look up methods via globalThis.hre.ethers.getContractAt.
(globalThis as { hre?: typeof hre }).hre = hre;

// Isolate mock-chain state between tests. MistSwap beforeEach redeploys from scratch, but soft-applied
// UTXOs / spent funders from a prior test otherwise leak (nftIndex tag mismatch, 0 funders).
// When snapshot fixtures are active, restore is handled above — skip the full provider reset.
beforeEach(async () => {
  const provider = hre.ethers?.provider as {
    reset?: () => void;
    getSigners?: (count?: number, opts?: { fundingUtxos?: number }) => Promise<unknown[]>;
  } | undefined;
  if (fixtureSnapshotReady) return;
  if (provider && typeof provider.reset === 'function') {
    provider.reset();
    try { clearDeployments(provider as never); } catch { /* ignore */ }
    try { clearSoftBentoTotals(); } catch { /* ignore */ }
    // Re-fund signers after reset (getSigners only funds once per key without reset of fundedSignerKeys).
    if (typeof provider.getSigners === 'function') {
      await provider.getSigners(20, { fundingUtxos: 4 });
    }
  }
});
