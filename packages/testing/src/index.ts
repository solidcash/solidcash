/**
 * SolidCash Hardhat-parity entry point (HARDHAT-PARITY.md). Aliased to `hardhat` in a project's Vitest config so
 * ported suites' `import { ethers, upgrades, network } from 'hardhat'` resolve here, plus `loadFixture`, the task
 * system, config helpers and the ethers-utils. Backed by a default mock-network HRE (built lazily on import).
 */
import './builtin-tasks.js';
import {
  getActiveHre, getDefaultHre, createHardhatRuntimeEnvironment, initHre, hardhatCompatConfig,
  type HardhatRuntimeEnvironment, type SolidcashEthers, type HardhatNetwork,
} from './hre.js';
import { upgrades } from 'solidcash';
import type { TaskArguments } from './tasks.js';

// LAZY proxies over the active HRE singleton. `import { ethers, config } from 'hardhat'` binds at module load,
// but a Vitest setup file can `await initHre()` first to load solidcash.config.ts; these proxies then reflect it
// at property-access (test-runtime) time.
function lazy<T extends object>(pick: (hre: HardhatRuntimeEnvironment) => any): T {
  return new Proxy({}, {
    get: (_t, prop) => (pick(getActiveHre()) as any)[prop],
    has: (_t, prop) => prop in (pick(getActiveHre()) as any),
  }) as T;
}

/** The active Hardhat Runtime Environment (config-loaded if `initHre` ran, else default mock network). */
const hre = lazy<HardhatRuntimeEnvironment>((h) => h);
export default hre;
export { hre };

/** `hre.ethers` - forwarded ethers utils + BCH-native getSigners/getContractFactory/getContractAt/deployContract. */
export const ethers = lazy<SolidcashEthers>((h) => h.ethers);
/** `hre.network` - active connection with a v3 `create()` seam. */
export const network = lazy<HardhatNetwork>((h) => h.network);
/** hardhat-shaped resolved config (`config.networks.<name>.accounts.{mnemonic,path}`). */
export const config = lazy<Record<string, unknown>>((h) => hardhatCompatConfig(h.config));
/** `hre.run(taskName, args?)`. */
export const run = (taskName: string, args?: TaskArguments): Promise<unknown> => getActiveHre().run(taskName, args);
/** OpenZeppelin-style upgradeable-proxy deploy/upgrade helpers. */
export { upgrades };

export { createHardhatRuntimeEnvironment, initHre, getDefaultHre, getActiveHre };
export type {
  HardhatRuntimeEnvironment, SolidcashEthers, HardhatNetwork, NetworkConnection,
} from './hre.js';

// Task system
export {
  task, subtask, runTask, getTask, getTasks, parseTaskArgs, clearTasks, TaskBuilder,
} from './tasks.js';
export type { TaskDefinition, TaskArguments, ActionFn } from './tasks.js';

// Config
export {
  defineConfig, solidcashConfigSchema, resolveConfig, loadConfig, findConfigFile, findHardhatConfigFile,
  migrateHardhatConfig,
} from './config.js';
export type {
  SolidcashConfig, ResolvedConfig, NetworkConfig, AccountsConfig, TypegenConfig,
} from './config.js';

export { generateTypechainTargets, watchTypechainTargets } from './typegen.js';
export type {
  TypegenTarget, TypegenTargetConfig, GenerateTypechainOptions, TypegenResult, TypegenWatcher,
} from './typegen.js';
export { diagnoseProject } from './doctor.js';
export type { DoctorFinding } from './doctor.js';

// Network helpers (also available at solidcash/network-helpers)
export {
  loadFixture, takeSnapshot, mine, mineUpTo, time, duration, setBalance, clearSnapshots,
  setActiveProvider, getActiveProvider, impersonateAccount, getImpersonatedSigner,
} from './network-helpers.js';

// ethers utils (forwarded to ethers v6) + v5-compat shims
export * from './ethers-utils.js';

// block.* oracle bridge: drive Solidity block.timestamp/block.number from the harness time-travel
export { mockBlockOracleRpc, BlockOracleUpdater, fetchBlockOracleFields } from './oracle-helpers.js';
export type { RpcLike, BlockOracleFields } from './oracle-helpers.js';
