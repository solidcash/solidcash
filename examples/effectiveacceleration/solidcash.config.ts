import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // The unchanged upstream test runs against BCH-native simplified ports while `tasks/compile-real.mjs` keeps the
  // verbatim Solidity/sharding benchmark separate in artifacts-real. This avoids changing either upstream source
  // tree while runtime compatibility and finer-grained (>10KB single-entry) sharding advance independently.
  paths: { contracts: 'contracts-scash', artifacts: 'artifacts', tests: 'test' },
  // The marketplace compatibility fixture only needs keyed lookup, not ordered mapping iteration. The compact
  // entry backend also avoids paying the sorted-list predecessor covenant cost for these simplified contracts.
  solc: { solidityImportCompat: true, ecrecover: 'p2pkh', sortedMappingsAll: false },
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
