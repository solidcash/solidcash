import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findConfigFile, loadConfig, migrateHardhatConfig,
} from '../src/config.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-config-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Hardhat config compatibility', () => {
  it('finds an opted-in Hardhat config upward and resolves paths relative to it', async () => {
    const root = tempDir();
    const child = path.join(root, 'packages', 'app');
    fs.mkdirSync(child, { recursive: true });
    const configFile = path.join(root, 'hardhat.config.mjs');
    fs.writeFileSync(configFile, `
      export default {
        paths: { sources: './evm', artifacts: './artifacts' },
        solidcash: {
          compiler: { solidityImportCompat: true, ecrecover: 'p2pkh' },
          paths: { contracts: './cash' }
        }
      };
    `);

    expect(findConfigFile(child)).toBe(configFile);
    const config = await loadConfig(child);
    expect(config.paths.contracts).toBe(path.join(root, 'cash'));
    expect(config.paths.artifacts).toBe(path.join(root, 'artifacts'));
    expect(config.compiler).toEqual({ solidityImportCompat: true, ecrecover: 'p2pkh' });
    expect(config.solc).toBe(config.compiler);
  });

  it('generates a standalone config without modifying an unopted Hardhat config', async () => {
    const root = tempDir();
    const hardhatFile = path.join(root, 'hardhat.config.mjs');
    const original = `export default {
      paths: { sources: './contracts', tests: './spec', artifacts: './artifacts' },
      networks: { hardhat: { accounts: { mnemonic: 'test words', count: 12, initialIndex: 2 } } }
    };`;
    fs.writeFileSync(hardhatFile, original);

    const generated = await migrateHardhatConfig(root);
    expect(generated).toBe(path.join(root, 'solidcash.config.ts'));
    expect(fs.readFileSync(hardhatFile, 'utf8')).toBe(original);
    const output = fs.readFileSync(generated, 'utf8');
    expect(output).toContain('contracts');
    expect(output).toContain('compiler: { solidityImportCompat: true }');
    expect(output).toContain('mnemonic: "test words"');
  });
});
