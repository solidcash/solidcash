// Register the SolidCash chai/vitest matchers, then load solidcash.config.ts into the active HRE so that
// `import { ethers, config } from 'hardhat'` (aliased to @solidcash/testing) reflects the project config.
import '@solidcash/testing/chai';
import { initHre } from '@solidcash/testing';

await initHre(process.cwd());
