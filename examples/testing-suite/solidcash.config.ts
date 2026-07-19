import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    artifacts: 'artifacts',
    tests: 'test',
  },
  networks: {
    mock: { type: 'mock' },
  },
  defaultNetwork: 'mock',
  // The hardhat dev mnemonic; getSigners() derives pre-funded accounts from it.
  mnemonic: 'test test test test test test test test test test test junk',
});
