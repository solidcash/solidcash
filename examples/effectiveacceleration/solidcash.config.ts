import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@solidcash/testing';

/**
 * The sibling `effectiveacceleration.ai` checkout. Its application sources, tests and deploy scripts are the
 * literal ones and live there; this project references them in place and mirrors nothing.
 *
 * The root is found by walking up from this file rather than written as a relative path: the repo is checked out
 * both at `/Code/cashscript` and in worktrees under `/Code/cashscript/.worktrees/<name>`, and only an absolute
 * path (or an env override) resolves the sibling from both. `tasks/compile-real.mjs` looks it up the same way.
 */
export function effectiveAccelerationRoot(): string {
  const fromEnv = process.env.EACC_ROOT;
  if (fromEnv !== undefined && fromEnv !== '') return path.resolve(fromEnv);
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, 'effectiveacceleration.ai');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('effectiveacceleration.ai was not found above this config; set EACC_ROOT to its checkout.');
    }
    dir = parent;
  }
}

const eaRoot = effectiveAccelerationRoot();
/** The sibling project's Solidity tree: the compile root and the typegen source dir, referenced, never copied. */
const eaContracts = path.join(eaRoot, 'contract', 'contracts');
/**
 * The sibling project's own marketplace test. It is linked into `test/` at run time (see `vitest.config.ts`), not
 * copied: only its location under this project makes its relative imports read this project's BCH-aware `src/` and
 * generated `typechain-types/` instead of the sibling's.
 */
export const eaMarketplaceTest = path.join(eaRoot, 'contract', 'test', 'marketplace.test.ts');

export default defineConfig({
  // The EA Solidity tree is the compile root. `contracts-scash` is retained only as historical fixture material;
  // it is not part of the canonical compile or test path.
  paths: { contracts: eaContracts, artifacts: 'artifacts', tests: 'test' },
  solc: {
    evmCompat: true,
    // Keep the production state-partitioning layout while the mock VM relaxes execution ceilings.
    commitmentLimit: 128,
    maximumInputBytes: 10_000_000,
    // This compatibility run exercises authenticated multi-contract call DAGs. Graph-free leaf contracts (the
    // ERC-20 in particular) still need their route emitted because a routed parent can reach them repeatedly.
    messageBus: true,
    optimizeForCompilationSpeed: true,
    suppressWarnings: true,
    ecrecover: 'p2pkh',
    // Keep the Hardhat-compatible harness on the uniform fixed-entry backend.
    // Mocknet's relaxed limits remove the former need to selectively switch
    // large mappings to the vmap trailing-output protocol.
    sortedMappingsAll: false,
  },
  // Compile the framed composition convention: every entry point is a master program, so a transaction that
  // reaches one contract several times settles its state exactly once.
  composition: 'framed',
  typegen: {
    jsonArtifactModules: true,
    targets: [{
      target: 'ethers6', layout: 'typechain', outDir: 'typechain-types', sourceDir: eaContracts,
    }],
  },
  // The largest Marketplace entry is still an indivisible ~75KB call closure,
  // so the strict splitter cannot produce a 10KB bundle. Keep the compatibility
  // network permissive while exercising the unmodified application contracts.
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        maximumInputBytes: 10_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumTransactionBytes: 10_000_000,
        maximumNftCommitmentBytes: 1_000_000,
        operationCostBudgetPerByte: 10_000_000,
        hashDigestIterationsPerByte: 10_000_000,
      },
    },
  },
  defaultNetwork: 'mock',
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
});
