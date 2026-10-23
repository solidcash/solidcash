import { existsSync } from 'node:fs';
import { compatibilityAliases, solidhatPreset } from '../src/vitest-preset.js';

describe('solidhatPreset', () => {
  it('resolves the installed solidcash package aliases to real files', () => {
    const aliases = compatibilityAliases({ hardhat: 3, ethers: 6 });
    expect(existsSync(aliases.solidcash)).toBe(true);
    expect(existsSync(aliases['solidcash/vitest'])).toBe(true);
  });

  it('maps every Hardhat and Ethers entry point onto a compatibility shim', () => {
    const aliases = compatibilityAliases({ hardhat: 2, ethers: 6 });
    expect(aliases.hardhat).toContain('hardhat2.js');
    expect(aliases.ethers).toContain('ethers6.js');
    expect(aliases['@openzeppelin/hardhat-upgrades']).toContain('hardhat2.js');
    expect(aliases['@solidcash/testing']).toContain('testing/dist/index.js');
    // Hardhat 3 / Ethers 5 select the other shims without touching the rest of the mapping.
    expect(compatibilityAliases({ hardhat: 3, ethers: 5 }).hardhat).toContain('hardhat3.js');
    expect(compatibilityAliases({ hardhat: 3, ethers: 5 }).ethers).toContain('ethers5.js');
  });

  it('runs the testing setup first and the offline runtime immediately after it', () => {
    const config = solidhatPreset(
      { hardhat: 2, ethers: 6 },
      { test: { setupFiles: ['custom-setup.ts'] } },
      { offline: true },
    );
    const setupFiles = config.test?.setupFiles as string[];
    expect(setupFiles).toHaveLength(3);
    expect(setupFiles[0]).toContain('testing/dist/vitest-setup.js');
    expect(setupFiles[1]).toContain('solidhat/dist/offline-setup.js');
    expect(setupFiles[2]).toBe('custom-setup.ts');
  });

  it('leaves the offline runtime out unless requested', () => {
    const config = solidhatPreset({ hardhat: 2, ethers: 6 });
    expect(config.test?.setupFiles).toHaveLength(1);
  });

  it('keeps user aliases and dedupe entries alongside the generated ones', () => {
    const config = solidhatPreset({ hardhat: 2, ethers: 6 }, {
      resolve: { alias: { '@noble/ciphers/crypto': '/tmp/utils.js' }, dedupe: ['viem'] },
    });
    const alias = config.resolve?.alias as { find: string | RegExp; replacement: string }[];
    expect(alias.some((rule) => rule.replacement === '/tmp/utils.js')).toBe(true);
    expect(config.resolve?.dedupe).toEqual(['@solidcash/testing', 'solidcash', 'viem']);
    expect(config.test?.globals).toBe(true);
  });
});
