import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { findConfigFile, resolveConfig } from '../src/config.js';
import { expect as chaiExpect } from '../src/chai.js';
import { createProvider } from '../src/hre.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-boundary-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('tooling boundaries', () => {
  it('does not load a config outside the project', () => {
    const outside = tempDir();
    fs.writeFileSync(path.join(outside, 'solidcash.config.js'), 'export default { defaultNetwork: "mainnet" };\n');
    const project = path.join(outside, 'app');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, 'package.json'), '{"name":"app"}\n');
    expect(findConfigFile(project)).toBeUndefined();
  });

  it('refuses an electrum network whose name is not a known chain', () => {
    expect(() => createProvider('testnet', { type: 'electrum' })).toThrow(/not a known BCH network/);
  });

  it('throws on an unimplemented assertion property', () => {
    expect(() => (chaiExpect(1).to.be as { empty?: unknown }).empty).toThrow(/unknown assertion property 'empty'/);
  });

  it('keeps the default compile cache outside the project directory', () => {
    const resolved = resolveConfig({});
    expect(resolved.paths.cache.startsWith(path.join(os.homedir(), '.cache', 'solidcash'))).toBe(true);
    expect(resolved.paths.cache).not.toBe(path.resolve('cache'));
  });
});
