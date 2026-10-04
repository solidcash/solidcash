import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';
import { ethers, network } from '../src/hardhat2.js';
import { runPortedScript } from '../src/ported-script.js';

// A Hardhat-era script that mixes ESM imports with module-scope CommonJS requires, as Hardhat runs through ts-node.
const SCRIPT = `import { basename } from 'node:path';

const { ethers } = require('hardhat');
const hre = require('hardhat');
const upgradesPlugin = require('@openzeppelin/hardhat-upgrades');
const config = require('./config.json');
const helper = require('./helper.cjs');
const { sep } = require('node:path');

export const seen = { ethers, hre, upgradesPlugin, config, helper, sep, file: basename(__filename) };

async function main(): Promise<void> {
  console.log(ethers === undefined ? 'ethers missing' : 'ethers present');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

interface Seen {
  ethers: unknown;
  hre: { network: unknown };
  upgradesPlugin: unknown;
  config: unknown;
  helper: { hardhat: unknown };
  sep: string;
  file: string;
}

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('runPortedScript CommonJS requires', () => {
  it('serves a module-scope require of hardhat the runtime an ESM import of it gets', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'solidhat-ported-require-'));
    temporaryDirectories.push(directory);
    const script = join(directory, 'deploy.ts');
    writeFileSync(script, SCRIPT);
    writeFileSync(join(directory, 'config.json'), JSON.stringify({ marketplace: '0x1234' }));
    writeFileSync(join(directory, 'helper.cjs'), "module.exports = { hardhat: require('hardhat') };\n");
    let exported: { seen?: Seen } = {};

    const result = await runPortedScript(script, {
      load: async () => { exported = await import(/* @vite-ignore */ script); },
      timeoutMs: 60_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toEqual(['ethers present']);
    const seen = exported.seen as Seen;
    // The script's `require`, for `hardhat` and a plugin id alike, and a CommonJS module it requires all receive the
    // solidhat Hardhat module, whose bindings are the ones an ESM `import { ethers } from 'hardhat'` gets.
    expect(seen.ethers === ethers).toBe(true);
    expect(seen.hre.network === network).toBe(true);
    expect(seen.upgradesPlugin === seen.hre).toBe(true);
    expect(seen.helper.hardhat === seen.hre).toBe(true);
    // JSON, relative and builtin requires still go through the normal resolver.
    expect(seen.config).toEqual({ marketplace: '0x1234' });
    expect(seen.sep).toBe(sep);
    expect(seen.file).toBe('deploy.ts');
  }, 120_000);
});
