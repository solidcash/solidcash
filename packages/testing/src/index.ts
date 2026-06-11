// Configuration
export { defineConfig, loadConfig, resolveConfig } from './config.js';
export type { SolidCashConfig, NetworkConfig, ResolvedConfig, ResolvedPaths } from './config.js';

// Signers
export { getSigners, type Signer } from './accounts.js';

// Fixtures
export { loadFixture, createFixtureFromConfig, type Fixture } from './environment.js';

// Contract Factory
export { getContractFactory, getContractFactoryFromConfig } from './factory.js';
export type { ContractFactory, FactoryDeployOptions, FactoryDeployResult } from './factory.js';

// Compilation
export { compile, compileContract, compileAll, compileAllWithConfig, type CompileOptions } from './compile.js';

// Re-export commonly used SDK types for convenience
export {
  Contract,
  TransactionBuilder,
  MockNetworkProvider,
  ElectrumNetworkProvider,
  SignatureTemplate,
  StatefulContract,
  randomUtxo,
  randomToken,
  randomNFT,
} from 'solidcash';

export type { Artifact, AbiFunction, AbiInput } from '@solidcash/utils';
