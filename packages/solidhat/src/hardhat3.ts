/** Hardhat 3-compatible module shape. Use `await network.connect()` for a fresh network connection. */
import { hre } from './runtime-shim.js';

export { config, ethers, hre, network, run } from './runtime-shim.js';
export { upgrades } from 'solidcash';
export default hre;
