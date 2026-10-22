import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeProject } from '../../solidhat/src/init.js';
import { findConfigFile, loadConfig, resolveConfig } from '../src/config.js';
import { expect as chaiExpect } from '../src/chai.js';
import { createProvider } from '../src/hre.js';

const posix = typeof process.getuid === 'function';
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

  it.skipIf(!posix)('skips a config in a world-writable directory without the sticky bit', () => {
    const shared = tempDir();
    const config = path.join(shared, 'solidcash.config.js');
    fs.writeFileSync(path.join(shared, 'package.json'), '{"name":"shared"}\n');
    fs.writeFileSync(config, 'export default {};\n');
    const work = path.join(shared, 'x');
    fs.mkdirSync(work);
    fs.chmodSync(shared, 0o777);
    expect(findConfigFile(work)).toBeUndefined();
    // With the sticky bit only the owner can replace a file, and this user owns both.
    fs.chmodSync(shared, 0o1777);
    expect(findConfigFile(work)).toBe(config);
  });

  // Handing a file to another uid needs root.
  it.skipIf(!posix || process.getuid!() !== 0)('skips a package root and a config that another user owns', () => {
    const outside = tempDir();
    const marker = path.join(outside, 'package.json');
    const config = path.join(outside, 'solidcash.config.js');
    fs.writeFileSync(marker, '{"name":"planted"}\n');
    fs.writeFileSync(config, 'export default {};\n');
    const work = path.join(outside, 'x');
    fs.mkdirSync(work);
    expect(findConfigFile(work)).toBe(config);
    fs.chownSync(config, 4242, 4242);
    expect(findConfigFile(work)).toBeUndefined();
    // A foreign package root no longer stretches the search up to this user's own config.
    fs.chownSync(config, 0, 0);
    fs.chownSync(marker, 4242, 4242);
    expect(findConfigFile(work)).toBeUndefined();
  });

  it('scaffolds no project cache, and ignores one the config does not trust', async () => {
    const parent = tempDir();
    initializeProject({ cwd: parent, target: 'app', install: false });
    expect(fs.readFileSync(path.join(parent, 'app', 'solidcash.config.ts'), 'utf8')).not.toMatch(/\bcache\s*:/);
    const project = (trusted: boolean): string => {
      const dir = tempDir();
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app"}\n');
      fs.writeFileSync(
        path.join(dir, 'solidcash.config.mjs'),
        `export default { paths: { cache: 'cache' }, trustProjectCache: ${trusted} };\n`,
      );
      return dir;
    };
    expect((await loadConfig(project(false))).paths.cache).toBe(path.join(os.homedir(), '.cache', 'solidcash'));
    const trusted = project(true);
    expect((await loadConfig(trusted)).paths.cache).toBe(path.join(trusted, 'cache'));
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
