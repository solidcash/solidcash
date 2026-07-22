import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // Compile and execute the upstream EACC Solidity sources verbatim. Oversized contracts are emitted as
  // `<Contract>.split.json`; Hardhat-compatible factory lookup transparently prefers those bundles.
  paths: {
    contracts: '../../../../../effectiveacceleration.ai/contract/contracts',
    artifacts: 'artifacts-real',
    tests: 'test',
  },
  solc: { solidityImportCompat: true, ecrecover: 'p2pkh' },
  typegen: {
    targets: [{
      target: 'ethers6', layout: 'typechain', outDir: 'typechain-types', sourceDir: 'contracts',
    }],
  },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
});
