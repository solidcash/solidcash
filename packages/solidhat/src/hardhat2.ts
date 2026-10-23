/** Hardhat 2-compatible module shape: `hre.ethers` and the singleton `network` are available directly. */
import { hre } from './runtime-shim.js';

export { config, ethers, hre, network, run } from './runtime-shim.js';

// Lazy `upgrades`: importing it would otherwise evaluate the heavy StatefulContract graph at hardhat-import time.
type UpgradesNamespace = typeof import('@solidcash/solidcash/dist/stateful/upgrades.js').upgrades;
const upgradesModule = (): Promise<typeof import('@solidcash/solidcash/dist/stateful/upgrades.js')> =>
  import('@solidcash/solidcash/dist/stateful/upgrades.js');
export const upgrades = {
  deployProxy: (...args: Parameters<UpgradesNamespace['deployProxy']>) =>
    upgradesModule().then((m) => m.deployProxy(...args)),
  upgradeProxy: (...args: Parameters<UpgradesNamespace['upgradeProxy']>) =>
    upgradesModule().then((m) => m.upgradeProxy(...args)),
} as UpgradesNamespace;

export default hre;
