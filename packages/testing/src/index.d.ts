/**
 * SolidCash Hardhat-parity entry point (HARDHAT-PARITY.md). Aliased to `hardhat` in a project's Vitest config so
 * ported suites' `import { ethers, upgrades, network } from 'hardhat'` resolve here, plus `loadFixture`, the task
 * system, config helpers and the ethers-utils. Backed by a default mock-network HRE (built lazily on import).
 */
import './builtin-tasks.js';
import { getActiveHre, getDefaultHre, createHardhatRuntimeEnvironment, initHre, type HardhatRuntimeEnvironment, type SolidcashEthers, type HardhatNetwork } from './hre.js';
import { upgrades } from 'solidcash';
import type { TaskArguments } from './tasks.js';
/** The active Hardhat Runtime Environment (config-loaded if `initHre` ran, else default mock network). */
declare const hre: HardhatRuntimeEnvironment;
export default hre;
export { hre };
/** `hre.ethers` - forwarded ethers utils + BCH-native getSigners/getContractFactory/getContractAt/deployContract. */
export declare const ethers: SolidcashEthers;
/** `hre.network` - active connection with a v3 `create()` seam. */
export declare const network: HardhatNetwork;
/** hardhat-shaped resolved config (`config.networks.<name>.accounts.{mnemonic,path}`). */
export declare const config: Record<string, unknown>;
/** `hre.run(taskName, args?)`. */
export declare const run: (taskName: string, args?: TaskArguments) => Promise<unknown>;
/** OpenZeppelin-style upgradeable-proxy deploy/upgrade helpers. */
export { upgrades };
export { createHardhatRuntimeEnvironment, initHre, getDefaultHre, getActiveHre };
export type { HardhatRuntimeEnvironment, SolidcashEthers, HardhatNetwork, NetworkConnection, } from './hre.js';
export { task, subtask, runTask, getTask, getTasks, parseTaskArgs, clearTasks, TaskBuilder, } from './tasks.js';
export type { TaskDefinition, TaskArguments, ActionFn } from './tasks.js';
export { defineConfig, solidcashConfigSchema, resolveConfig, loadConfig, findConfigFile, findHardhatConfigFile, migrateHardhatConfig, } from './config.js';
export type { SolidcashConfig, ResolvedConfig, NetworkConfig, AccountsConfig, TypegenConfig, } from './config.js';
export { generateTypechainTargets, watchTypechainTargets } from './typegen.js';
export type { TypegenTarget, TypegenTargetConfig, GenerateTypechainOptions, TypegenResult, TypegenWatcher, } from './typegen.js';
export { diagnoseProject } from './doctor.js';
export type { DoctorFinding } from './doctor.js';
export { loadFixture, takeSnapshot, mine, mineUpTo, time, duration, setBalance, clearSnapshots, setActiveProvider, getActiveProvider, impersonateAccount, getImpersonatedSigner, } from './network-helpers.js';
export * from './ethers-utils.js';
export { mockBlockOracleRpc, BlockOracleUpdater, fetchBlockOracleFields } from './oracle-helpers.js';
export type { RpcLike, BlockOracleFields } from './oracle-helpers.js';
