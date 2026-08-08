/**
 * Reusable Vitest preset that turns a Hardhat/ethers/chai project into a SolidCash drop-in with NO test edits.
 * A ported project's vitest.config.ts becomes:
 *
 *   import { defineConfig } from 'vitest/config';
 *   import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';
 *   export default defineConfig(solidcashHardhatPreset({ test: { include: ['test/**\/*.test.ts'] } }));
 *
 * It aliases `hardhat`/`chai`/`@nomicfoundation/*`/`@openzeppelin/hardhat-upgrades` to our code, registers the
 * matchers + loads solidcash.config.ts via a setup file, and excludes the source-linked workspace packages from
 * Vite's optimizer. Project-specific aliases (e.g. app-dep version shims) are merged from the passed config.
 *
 * Hardhat-era suites also do CJS `require("hardhat")` (MistSwap's `test/utilities/time.ts`). Vite `resolve.alias`
 * only rewrites ESM imports, so bare require hits the real Hardhat package and throws HH1. The preset installs a
 * transform that rewrites those requires into ESM imports against the same alias targets - including absolute
 * paths the project config may have already resolved.
 */
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';

/** Minimal structural Vite/Vitest config shape (version-agnostic; `defineConfig` accepts it structurally). */
export interface ViteLikeConfig {
  test?: { setupFiles?: string | string[]; env?: Record<string, string>; [k: string]: unknown };
  resolve?: { alias?: Record<string, string>; [k: string]: unknown };
  optimizeDeps?: { exclude?: string[]; [k: string]: unknown };
  plugins?: unknown[];
  solidcash?: {
    /** Glob(s) selecting modules whose first root beforeEach is a reusable chain fixture. */
    snapshotBeforeEach?: string | string[];
  };
  [k: string]: unknown;
}

const stub = (name: string): string => fileURLToPath(new URL(`./stubs/${name}.js`, import.meta.url));

/** The Hardhat/ethers/chai -> @solidcash/testing alias map (the heart of the drop-in). */
export function hardhatAliases(): Record<string, string> {
  return {
    hardhat: '@solidcash/testing',
    'hardhat/config': '@solidcash/testing',
    'hardhat/types': stub('empty'),
    '@nomicfoundation/hardhat-toolbox/network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-ethers/signers': stub('empty'),
    '@nomicfoundation/hardhat-ethers': '@solidcash/testing',
    '@nomicfoundation/hardhat-chai-matchers': '@solidcash/testing/chai',
    '@openzeppelin/hardhat-upgrades': '@solidcash/testing',
    chai: '@solidcash/testing/chai',
    'chai-subset': stub('chai-plugin'),
    'chai-as-promised': stub('chai-plugin'),
    // Redirect the EVM CREATE-address predictors to BCH (category-based) identity; re-exports the rest of ethers.
    ethers: '@solidcash/testing/ethers-shim',
  };
}

/**
 * Rewrite top-level CJS requires that Hardhat-era suites still use into ESM imports Vite can resolve:
 *
 * 1. `require("hardhat")` / related drop-in specs -> our alias targets.
 *    MistSwap's `test/utilities/time.ts` is the canonical consumer. Without this, Node resolves the real
 *    Hardhat package under the upstream checkout and throws HH1.
 * 2. Relative `require("./kashipair")` (no extension) -> ESM import of the same specifier so Vite can attach
 *    `.ts`. Node's CJS resolver cannot load TypeScript siblings when the suite is executed through Vite.
 *
 * Bare package requires (`ethers`, `bn.js`, `ethereumjs-util`) stay as `require()` so an upstream
 * checkout's own node_modules continues to supply them.
 */
export function cjsHardhatRequirePlugin(aliases: Record<string, string>): Plugin {
  // Specs we own. Longer names first so `hardhat/config` wins over `hardhat`.
  const specs = Object.keys(aliases)
    .filter((name) => name === 'hardhat' || name.startsWith('hardhat/')
      || name.startsWith('@nomicfoundation/hardhat')
      || name.startsWith('@nomiclabs/hardhat')
      || name === '@openzeppelin/hardhat-upgrades')
    .sort((a, b) => b.length - a.length);
  const alt = specs.length === 0
    ? '(?!)'
    : specs.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // const { a, b: c } = require("hardhat")
  const destructureRe = new RegExp(
    String.raw`(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*(['"])(${alt})\2\s*\)\s*;?`,
    'g',
  );
  // const hh = require("hardhat")
  const simpleRe = new RegExp(
    String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])(${alt})\2\s*\)\s*;?`,
    'g',
  );
  // Relative siblings: const { KashiPair } = require("./kashipair")
  const relativeDestructureRe = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*(['"])(\.\.?\/[^'"]+)\2\s*\)\s*;?/g;
  const relativeSimpleRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])(\.\.?\/[^'"]+)\2\s*\)\s*;?/g;

  return {
    name: 'solidcash-cjs-hardhat-require',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Project / suite sources only - never rewrite inside a real hardhat install.
      if (id.includes(`${'node_modules'}/hardhat`) || id.includes(`${'node_modules'}\\hardhat`)) {
        return null;
      }
      // Skip package contents generally; suite sources live outside node_modules.
      if (id.includes(`${'node_modules'}/`) || id.includes(`${'node_modules'}\\`)) {
        return null;
      }
      if (!code.includes('require(')) return null;

      const imports: string[] = [];
      let n = 0;
      const take = (target: string, kind: 'ns' | 'default'): string => {
        const idName = `__solidcashHardhat${n++}`;
        imports.push(`import * as ${idName} from ${JSON.stringify(target)};`);
        return kind === 'default' ? `${idName}.default ?? ${idName}` : idName;
      };

      let next = code;
      if (specs.length > 0 && new RegExp(String.raw`require\(\s*['"](?:${alt})['"]`).test(code)) {
        next = next.replace(destructureRe, (_m, binding: string, _q: string, name: string) => {
          const target = aliases[name];
          if (!target) return _m;
          return `const {${binding}} = ${take(target, 'ns')};`;
        });
        next = next.replace(simpleRe, (_m, binding: string, _q: string, name: string) => {
          const target = aliases[name];
          if (!target) return _m;
          // Default-export-aware: hardhat drop-in has both named exports and `export default hre`.
          return `const ${binding} = ${take(target, 'default')};`;
        });
      }
      // Relative requires: only rewrite when the source looks like a TS/JS suite file.
      if (/\.[cm]?[jt]sx?$/.test(id) && /require\(\s*['"]\.\.?[/]/.test(next)) {
        next = next.replace(relativeDestructureRe, (_m, binding: string, _q: string, rel: string) => (
          `const {${binding}} = ${take(rel, 'ns')};`
        ));
        next = next.replace(relativeSimpleRe, (_m, binding: string, _q: string, rel: string) => (
          `const ${binding} = ${take(rel, 'default')};`
        ));
      }
      if (imports.length === 0) return null;
      return { code: `${imports.join('\n')}\n${next}`, map: null };
    },
  };
}

/** Merge the SolidCash Hardhat-drop-in settings into a user Vitest config. */
export function solidcashHardhatPreset(userConfig: ViteLikeConfig = {}): ViteLikeConfig {
  const { solidcash: solidcashOptions, ...viteConfig } = userConfig;
  const userAlias = (userConfig.resolve?.alias ?? {}) as Record<string, string>;
  const mergedAlias = { ...hardhatAliases(), ...userAlias };
  const userExclude = userConfig.optimizeDeps?.exclude ?? [];
  const userSetup = userConfig.test?.setupFiles;
  const setupList = Array.isArray(userSetup) ? userSetup : userSetup ? [userSetup] : [];
  const userPlugins = Array.isArray(userConfig.plugins) ? userConfig.plugins : [];
  const snapshotSelectors = solidcashOptions?.snapshotBeforeEach;
  const fixtureEnv: Record<string, string> = {};
  if (snapshotSelectors !== undefined) {
    fixtureEnv.SOLIDCASH_SNAPSHOT_BEFORE_EACH = JSON.stringify(
      Array.isArray(snapshotSelectors) ? snapshotSelectors : [snapshotSelectors],
    );
  }
  return {
    ...viteConfig,
    plugins: [cjsHardhatRequirePlugin(mergedAlias), ...userPlugins],
    optimizeDeps: {
      ...userConfig.optimizeDeps,
      exclude: ['solidc', 'solidcash', '@solidcash/testing', '@solidcash/utils', ...userExclude],
    },
    resolve: {
      ...userConfig.resolve,
      alias: mergedAlias,
    },
    test: {
      globals: true,
      environment: 'node',
      ...userConfig.test,
      env: { ...userConfig.test?.env, ...fixtureEnv },
      setupFiles: ['@solidcash/testing/vitest-setup', ...setupList],
    },
  };
}
