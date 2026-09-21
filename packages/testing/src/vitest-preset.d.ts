import type { Plugin } from 'vite';
/** Minimal structural Vite/Vitest config shape (version-agnostic; `defineConfig` accepts it structurally). */
export interface ViteLikeConfig {
    test?: {
        setupFiles?: string | string[];
        env?: Record<string, string>;
        [k: string]: unknown;
    };
    resolve?: {
        alias?: Record<string, string>;
        [k: string]: unknown;
    };
    optimizeDeps?: {
        exclude?: string[];
        [k: string]: unknown;
    };
    plugins?: unknown[];
    solidcash?: {
        /**
         * Glob(s) selecting test modules whose first root beforeEach is a reusable chain fixture. The hook runs
         * once, then the provider, deployment registry, and mock soft state are restored before each subsequent
         * test. Additional beforeEach hooks continue to run normally.
         */
        snapshotBeforeEach?: string | string[];
    };
    [k: string]: unknown;
}
/** The Hardhat/ethers/chai -> @solidcash/testing alias map (the heart of the drop-in). */
export declare function hardhatAliases(): Record<string, string>;
/**
 * Rewrite top-level CJS requires that Hardhat-era suites still use into ESM imports Vite can resolve:
 *
 * 1. `require("hardhat")` / related drop-in specs -> our alias targets.
 *    MistSwap's `test/utilities/time.ts` is the canonical consumer. Without this, Node resolves the real
 *    Hardhat package under the upstream checkout and throws HH1.
 * 2. Relative `require("./kashipair")` (no extension) -> ESM import of the same specifier so Vite can attach
 *    `.ts`. Node's CJS resolver cannot load TypeScript siblings when the suite is executed through Vite.
 *
 * Bare package requires (`bn.js`, `ethereumjs-util`) stay as `require()` so an upstream
 * checkout's own node_modules continues to supply them. `ethers` is rewritten when aliased so
 * CashAddress-aware AbiCoder / create-address redirects apply to CJS utilities (kashipair).
 */
export declare function cjsHardhatRequirePlugin(aliases: Record<string, string>): Plugin;
/** Merge the SolidCash Hardhat-drop-in settings into a user Vitest config. */
export declare function solidcashHardhatPreset(userConfig?: ViteLikeConfig): ViteLikeConfig;
