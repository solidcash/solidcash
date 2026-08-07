/** Hardhat 2-compatible module shape: `hre.ethers` and the singleton `network` are available directly. */
import { hre } from './runtime-shim.js';

export { config, ethers, hre, network, run } from './runtime-shim.js';
export { upgrades } from 'solidcash';
export default hre;
