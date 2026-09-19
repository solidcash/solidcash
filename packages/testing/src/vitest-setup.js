/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import { beforeAll, afterAll, beforeEach, afterEach, it, test, describe } from 'vitest';
import { clearDeployments, clearSoftBentoTotals, takeDeploymentRegistrySnapshot, takeSoftStateSnapshot, } from 'solidcash';
import './chai.js';
import { initHre } from './index.js';
const mochaContext = {
    // Mocha exposes these on the context; make them harmless no-ops rather than a TypeError mid-suite.
    timeout: () => mochaContext,
    slow: () => mochaContext,
    retries: () => mochaContext,
};
const bindContext = (fn) => (typeof fn === 'function'
    ? function boundToMochaContext(...args) {
        return fn.apply(mochaContext, args);
    }
    : fn);
const hook = (register) => (fn, timeout) => register(bindContext(fn), timeout);
/**
 * Wrap a Vitest runner (`it`/`test`/`describe`) so callbacks see the shared context.
 * Preserve `.skip` / `.only` / `.each` (often non-enumerable). One-level only: do NOT recurse
 * `runner(it.skip)` into `it.skip.skip…` (that overflows the stack).
 */
const runner = (original) => {
    const src = original;
    const wrapCb = (fn) => ((name, body, timeout) => fn(name, bindContext(body), timeout));
    const wrapped = wrapCb(src);
    for (const key of ['skip', 'only', 'each', 'todo', 'concurrent', 'fails']) {
        const nested = src[key];
        if (typeof nested !== 'function')
            continue;
        if (key === 'skip' || key === 'only') {
            // Bind mocha `this` on skipped/focused callbacks without re-entering runner().
            wrapped[key] = wrapCb(nested);
            Object.assign(wrapped[key], nested);
        }
        else {
            wrapped[key] = nested;
        }
    }
    return wrapped;
};
const globals = globalThis;
globals.before ??= hook(beforeAll);
globals.after ??= hook(afterAll);
const parseSnapshotSelectors = (raw) => {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string'))
            return parsed;
    }
    catch { /* retain compatibility with the original single-substring environment option */ }
    return [raw];
};
const globToRegExp = (glob) => {
    let source = '';
    for (let index = 0; index < glob.length; index++) {
        const char = glob[index];
        if (char === '*') {
            if (glob[index + 1] === '*') {
                source += '.*';
                index++;
            }
            else
                source += '[^/]*';
        }
        else if (char === '?')
            source += '[^/]';
        else
            source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
    return new RegExp(source);
};
const snapshotBeforeEachSelectors = parseSnapshotSelectors(process.env.SOLIDCASH_SNAPSHOT_BEFORE_EACH)
    .map((selector) => globToRegExp(selector.replaceAll('\\', '/')));
let fixtureSnapshotReady = false;
let fixtureHookRegistered = false;
let fixtureChainSnapshot;
let fixtureDeploymentSnapshot;
let fixtureSoftStateSnapshot;
const isSelectedFixtureHook = () => {
    if (snapshotBeforeEachSelectors.length === 0)
        return false;
    const stack = new Error().stack?.replaceAll('\\', '/') ?? '';
    return snapshotBeforeEachSelectors.some((selector) => selector.test(stack));
};
// Opt-in adapter escape hatch for very large, unmodified Hardhat suites. The selected upstream beforeEach is
// executed once; later tests retain its closure-bound contract objects and restore every mutable backing store.
globals.beforeEach = (fn, timeout) => {
    if (fixtureHookRegistered || !isSelectedFixtureHook())
        return hook(beforeEach)(fn, timeout);
    fixtureHookRegistered = true;
    const bound = bindContext(fn);
    // eslint-disable-next-line no-console -- intentional once-per-file proof that snapshot fixtures engaged
    console.info(`[solidcash] snapshot beforeEach active (selectors=${JSON.stringify(process.env.SOLIDCASH_SNAPSHOT_BEFORE_EACH)})`);
    return beforeEach(async () => {
        const provider = hre.ethers?.provider;
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
        if (!provider?.takeSnapshot)
            throw new Error('Snapshot beforeEach requires a snapshot-capable provider');
        fixtureChainSnapshot = await provider.takeSnapshot();
        fixtureDeploymentSnapshot = takeDeploymentRegistrySnapshot(provider);
        fixtureSoftStateSnapshot = takeSoftStateSnapshot();
        fixtureSnapshotReady = true;
        // eslint-disable-next-line no-console -- timing evidence that first fixture ran once
        console.info(`[solidcash] snapshot beforeEach captured after setup (${Date.now() - setupStarted}ms)`);
    }, timeout);
};
globals.afterEach = hook(afterEach);
globals.it = runner(it);
globals.test = runner(test);
globals.specify ??= globals.it;
// Mocha suite aliases used by unmodified Hardhat/MistSwap suites.
const suite = runner(describe);
globals.describe ??= suite;
globals.context = suite; // Mocha: context === describe (MasterChef nested suite)
// Skipped suite / test shorthands (Mocha xdescribe / xit).
const itSkip = it.skip ?? ((name, _fn) => it(String(name), () => { }));
const describeSkip = describe.skip ?? ((name, _fn) => describe(String(name), () => { }));
globals.xit = typeof itSkip === 'function' ? runner(itSkip) : globals.it;
globals.xdescribe = typeof describeSkip === 'function' ? runner(describeSkip) : suite;
globals.xcontext = globals.xdescribe;
// Vitest's `root` changes discovery/resolution but deliberately leaves process.cwd() unchanged. A harness config
// hosted above the ported project can provide its real root so the matching solidcash.config.ts is loaded.
const hre = await initHre(process.env.SOLIDCASH_PROJECT_ROOT ?? process.cwd());
// ethers.Contract shim and ported suites look up methods via globalThis.hre.ethers.getContractAt.
globalThis.hre = hre;
// Isolate mock-chain state between tests. MistSwap beforeEach redeploys from scratch, but soft-applied
// UTXOs / spent funders from a prior test otherwise leak (nftIndex tag mismatch, 0 funders).
// When snapshot fixtures are active, restore is handled above — skip the full provider reset.
beforeEach(async () => {
    const provider = hre.ethers?.provider;
    if (fixtureSnapshotReady)
        return;
    if (provider && typeof provider.reset === 'function') {
        provider.reset();
        try {
            const { StatefulTransactionBuilder } = await import('solidcash');
            StatefulTransactionBuilder.clearPersistedJobEvents();
        }
        catch { /* persist module not loaded in this suite */ }
        try {
            clearDeployments(provider);
        }
        catch { /* ignore */ }
        try {
            clearSoftBentoTotals();
        }
        catch { /* ignore */ }
        // Re-fund signers after reset (getSigners only funds once per key without reset of fundedSignerKeys).
        if (typeof provider.getSigners === 'function') {
            await provider.getSigners(20, { fundingUtxos: 4 });
        }
    }
});
//# sourceMappingURL=vitest-setup.js.map