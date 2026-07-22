import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  // The marketplace fixture runs against the contracts-scash STUBS (artifacts/) - the setup the deploy-wall
  // debugging expects (see PROGRESS.md "runtime" + memory ea_deploy_wall). All 15 REAL contracts DO cross-compile
  // (`tasks/compile-real.mjs` -> artifacts-real/, 28 artifacts), but the real Unicrow is ~32 KB and real Marketplace
  // is bigger - both exceed BCH's 10 KB per-script / stack-item limit, so a real-artifact deploy is a separate
  // (fundamental) constraint from the stub deploy path. Switch paths.artifacts to artifacts-real/ once large-contract
  // deploy (script splitting / raised local VM limit) lands.
  paths: { contracts: 'contracts-scash', artifacts: 'artifacts', tests: 'test' },
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
