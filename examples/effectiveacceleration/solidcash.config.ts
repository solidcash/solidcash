import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // Cross-compile the REAL Solidity source (../effectiveacceleration.ai/contract) verbatim and resolve those
  // artifacts. `solidcash compile` (or tasks/compile-real.mjs) emits all 15 contracts into artifacts-real/ - every
  // EACC contract now cross-compiles for real. The contracts-scash stubs + artifacts/ are KEPT (per "do not delete
  // the shims") as the fallback the marketplace fixture used before real deploy lands (see PROGRESS.md "runtime").
  paths: { contracts: '../../../effectiveacceleration.ai/contract/contracts', artifacts: 'artifacts-real', tests: 'test' },
  solc: { solidityImportCompat: true, ecrecover: 'p2pkh' },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
});
