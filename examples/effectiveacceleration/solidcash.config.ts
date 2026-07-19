import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  paths: { contracts: 'contracts-scash', artifacts: 'artifacts', tests: 'test' },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
  // The EA hardhat.config mnemonic + Ethereum derivation path, so getSigners() matches the project.
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0 },
});
