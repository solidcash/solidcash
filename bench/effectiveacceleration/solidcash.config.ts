import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@solidcash/testing';

/**
 * The sibling `effectiveacceleration.ai` checkout. Its application sources, tests, deploy scripts and configs are
 * the literal ones and live there; this bench references them in place and mirrors nothing.
 *
 * The root is found by walking up from this file rather than written as a relative path: the repo is checked out
 * both at `/Code/cashscript` and in worktrees under `/Code/cashscript/.worktrees/<name>`, and only an absolute
 * path (or an env override) resolves the sibling from both. `vitest.config.ts` looks it up the same way.
 */
function effectiveAccelerationRoot(): string {
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
export default defineConfig({
  paths: { contracts: eaContracts, artifacts: 'artifacts', tests: 'test' },
  // The options the marketplace lane compiles with (the repo root's `solidcash.config.ts`). This project runs the
  // same fixture, so a divergence here compiles different contracts. Tagged singleton records let generated
  // proxies add their implementation-pointer record while preserving the implementation's commitment header.
  compiler: {
    tagSingletonDataNfts: true,
    evmCompat: true,
    // The suite decodes addresses itself (`decodeAddress` reads a packed identity) and compares them to
    // signer.getAddress(), so a packed address value is its 20-byte identity: `addressForm: 'hash'` (the
    // evmCompat default, ticked here so the suite states it).
    addressForm: 'hash',
    messageBus: true,
    messageBusKernel: true,
    messageBusGraphContext: true,
    // SolidCash addresses are locking bytecode. Recover the native P2PKH identity so an imported Solidity
    // `ecrecover(...) == msg.sender` comparison stays in one address domain and needs no EVM-keccak sidecar.
    ecrecover: 'p2pkh',
    optimizeForCompilationSpeed: true,
    suppressWarnings: true,
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
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
  // The lane's mock limits. Proxy __forward inspects the implementation's INPUTBYTECODE (the full p2sh32 redeem,
  // ~3.8 MB for MarketplaceV1) and that OP_SPLIT is charged to the 781-byte proxy input, so the per-byte budget
  // has to cover the introspection without tightening the input or transaction caps.
  networks: {
    mock: {
      type: 'mock',
      consensus: {
        operationCostBudgetPerByte: 1_000_000,
        maximumInputBytes: 10_000_000,
        maximumTransactionBytes: 100_000_000,
        maximumStackItemBytes: 10_000_000,
        maximumNftCommitmentBytes: 10_000_000,
      },
    },
  },
  defaultNetwork: 'mock',
});
