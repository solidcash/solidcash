/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import './chai.js';
import { initHre } from './index.js';

await initHre(process.cwd());
