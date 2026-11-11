/**
 * The module aliases that make a Hardhat project's imports resolve to SolidCash: the test runner applies them
 * (`vitest-preset.ts`) and so does a script `solidcash run` loads (`script-hooks.ts`). It lives apart from the preset,
 * whose CJS rewrite plugin rewrites the `require` examples in its own source when a test imports the task modules.
 */
import { fileURLToPath } from 'url';

const stub = (name: string): string => fileURLToPath(new URL(`./stubs/${name}.js`, import.meta.url));

/** The Hardhat/ethers/chai -> @solidcash/testing alias map (the heart of the drop-in). */
export function hardhatAliases(): Record<string, string> {
  return {
    hardhat: '@solidcash/testing',
    'hardhat/config': '@solidcash/testing',
    'hardhat/types': stub('empty'),
    '@nomicfoundation/hardhat-toolbox/network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-network-helpers': '@solidcash/testing/network-helpers',
    '@nomicfoundation/hardhat-ethers/signers': stub('empty'),
    '@nomicfoundation/hardhat-ethers': '@solidcash/testing',
    '@nomicfoundation/hardhat-chai-matchers': '@solidcash/testing/chai',
    '@openzeppelin/hardhat-upgrades': '@solidcash/testing',
    chai: '@solidcash/testing/chai',
    'chai-subset': stub('chai-plugin'),
    'chai-as-promised': stub('chai-plugin'),
    // Redirect the EVM CREATE-address predictors to BCH (category-based) identity; re-exports the rest of ethers.
    ethers: '@solidcash/testing/ethers-shim',
    // MistSwap PairKashi: `import { defaultAbiCoder } from "ethers/lib/utils"` (v5 path).
    'ethers/lib/utils': '@solidcash/testing/ethers',
    'ethers/lib/utils.js': '@solidcash/testing/ethers',
  };
}
