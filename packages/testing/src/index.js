/**
 * SolidCash Hardhat-parity entry point (HARDHAT-PARITY.md). Aliased to `hardhat` in a project's Vitest config so
 * ported suites' `import { ethers, upgrades, network } from 'hardhat'` resolve here, plus `loadFixture`, the task
 * system, config helpers and the ethers-utils. Backed by a default mock-network HRE (built lazily on import).
 */
import './builtin-tasks.js';
import { getActiveHre, getDefaultHre, createHardhatRuntimeEnvironment, initHre, hardhatCompatConfig, } from './hre.js';
import { upgrades } from 'solidcash';
// LAZY proxies over the active HRE singleton. `import { ethers, config } from 'hardhat'` binds at module load,
// but a Vitest setup file can `await initHre()` first to load solidcash.config.ts; these proxies then reflect it
// at property-access (test-runtime) time.
function lazy(pick) {
    return new Proxy({}, {
        get: (_t, prop) => pick(getActiveHre())[prop],
        has: (_t, prop) => prop in pick(getActiveHre()),
    });
}
/** The active Hardhat Runtime Environment (config-loaded if `initHre` ran, else default mock network). */
const hre = lazy((h) => h);
export default hre;
export { hre };
/** `hre.ethers` - forwarded ethers utils + BCH-native getSigners/getContractFactory/getContractAt/deployContract. */
export const ethers = lazy((h) => h.ethers);
/** `hre.network` - active connection with a v3 `create()` seam. */
export const network = lazy((h) => h.network);
/** hardhat-shaped resolved config (`config.networks.<name>.accounts.{mnemonic,path}`). */
export const config = lazy((h) => hardhatCompatConfig(h.config));
/** `hre.run(taskName, args?)`. */
export const run = (taskName, args) => getActiveHre().run(taskName, args);
/** OpenZeppelin-style upgradeable-proxy deploy/upgrade helpers. */
export { upgrades };
export { createHardhatRuntimeEnvironment, initHre, getDefaultHre, getActiveHre };
// Task system
export { task, subtask, runTask, getTask, getTasks, parseTaskArgs, clearTasks, TaskBuilder, } from './tasks.js';
// Config
export { defineConfig, solidcashConfigSchema, resolveConfig, loadConfig, findConfigFile, findHardhatConfigFile, migrateHardhatConfig, } from './config.js';
export { generateTypechainTargets, watchTypechainTargets } from './typegen.js';
export { diagnoseProject } from './doctor.js';
// Network helpers (also available at solidcash/network-helpers)
export { loadFixture, takeSnapshot, mine, mineUpTo, time, duration, setBalance, clearSnapshots, setActiveProvider, getActiveProvider, impersonateAccount, getImpersonatedSigner, } from './network-helpers.js';
// ethers utils (forwarded to ethers v6) + v5-compat shims
export * from './ethers-utils.js';
// block.* oracle bridge: drive Solidity block.timestamp/block.number from the harness time-travel
export { mockBlockOracleRpc, BlockOracleUpdater, fetchBlockOracleFields } from './oracle-helpers.js';
//# sourceMappingURL=index.js.map