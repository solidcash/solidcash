import { defineConfig } from '@solidcash/testing';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function findEaccContracts(): string {
  if (process.env.EACC_CONTRACTS_DIR) return resolve(process.env.EACC_CONTRACTS_DIR);
  let current = process.cwd();
  while (true) {
    const project = join(current, 'effectiveacceleration.ai', 'contract');
    if (existsSync(join(project, 'contracts')) && existsSync(join(project, 'node_modules'))) {
      return join(project, 'contracts');
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // The checked-in mirror is still useful for editor navigation, but package imports require the upstream
  // Hardhat project's node_modules. The compiler will report that actionable missing dependency if unavailable.
  return 'contracts';
}

export default defineConfig({
  // Compile and run the unmodified upstream EACC Solidity contracts. `contracts-scash` is retained only as
  // historical fixture material; it is not part of the canonical compile or test path.
  paths: { contracts: findEaccContracts(), artifacts: 'artifacts', tests: 'test' },
  solc: {
    solidityImportCompat: true,
    // Preserve production-compatible state partitioning while mocknet relaxes the commitment itself for large
    // fixed packed values (for example OpenZeppelin storage gaps).
    commitmentLimit: 128,
    ecrecover: 'p2pkh',
    // Keep the Hardhat-compatible harness on the uniform fixed-entry backend.
    // Mocknet's relaxed limits remove the former need to selectively switch
    // large mappings to the vmap trailing-output protocol.
    sortedMappingsAll: false,
    sortedMappings: ['EACCToken._balances', 'whitelistWorkers'],
  },
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
