import { execFileSync } from 'child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { detectCompatibility, detectPackageManager, initializeProject } from '../src/init.js';
import { compatibilityAliases } from '../src/vitest-preset.js';
import { promptInitOptions } from '../src/prompt.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), `solidhat-${name}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('initializeProject', () => {
  it('creates a complete TypeScript project in a new directory', () => {
    const parent = temporaryDirectory('create');
    const result = initializeProject({ cwd: parent, target: 'counter', install: false });
    const directory = join(parent, 'counter');

    expect(result.directory).toBe(directory);
    expect(result.existingProject).toBe(false);
    expect(existsSync(join(directory, 'solidcash.config.ts'))).toBe(true);
    expect(existsSync(join(directory, 'contracts', 'Counter.scash'))).toBe(true);
    expect(existsSync(join(directory, 'test', 'Counter.test.ts'))).toBe(true);
    expect(readFileSync(join(directory, 'README.md'), 'utf8')).toContain('# counter');
    expect(readFileSync(join(directory, 'README.md'), 'utf8')).toContain('Hardhat 3 and Ethers 6');
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    expect(pkg.devDependencies['@solidcash/solidhat']).toBe('^0.13.0');
    expect(pkg.scripts['solidhat:compile']).toBe('solidhat compile');
    expect(pkg.scripts['solidhat:typegen']).toBe('solidhat typegen');
  });

  it('documents and scaffolds the JavaScript/pnpm template accurately', () => {
    const parent = temporaryDirectory('javascript');
    initializeProject({
      cwd: parent, target: 'js-app', template: 'javascript', packageManager: 'pnpm', install: false,
    });
    const directory = join(parent, 'js-app');
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    const readme = readFileSync(join(directory, 'README.md'), 'utf8');

    expect(existsSync(join(directory, 'test', 'Counter.test.js'))).toBe(true);
    expect(existsSync(join(directory, 'test', 'Counter.test.ts'))).toBe(false);
    expect(pkg.devDependencies.vitest).toBe('^4.0.15');
    expect(pkg.devDependencies.typescript).toBeUndefined();
    expect(readme).toContain('pnpm solidhat:test');
    expect(readme).toContain('solidcash.config.js');
  });

  it('injects alongside Hardhat without modifying its files or EVM artifacts', () => {
    const directory = temporaryDirectory('hardhat');
    const hardhatConfig = "export default { solidity: '0.8.28' };\n";
    writeFileSync(join(directory, 'hardhat.config.ts'), hardhatConfig);
    writeFileSync(join(directory, 'package.json'), '{"name":"evm-app","scripts":{"test":"hardhat test"}}\n');
    writeFileSync(join(directory, 'README.md'), '# Existing EVM project\n');
    mkdirSync(join(directory, 'artifacts', 'contracts'), { recursive: true });
    writeFileSync(join(directory, 'artifacts', 'contracts', 'Token.json'), '{"abi":[]}\n');

    const result = initializeProject({ cwd: directory, install: false });

    expect(result.existingProject).toBe(true);
    expect(result.hardhatDetected).toBe(true);
    expect(result.compatibility).toEqual({ hardhat: 3, ethers: 6 });
    expect(readFileSync(join(directory, 'hardhat.config.ts'), 'utf8')).toBe(hardhatConfig);
    expect(readFileSync(join(directory, 'artifacts', 'contracts', 'Token.json'), 'utf8')).toBe('{"abi":[]}\n');
    expect(existsSync(join(directory, 'solidcash.config.ts'))).toBe(true);
    expect(existsSync(join(directory, 'contracts', 'Counter.scash'))).toBe(false);
    expect(readFileSync(join(directory, 'README.md'), 'utf8')).toBe('# Existing EVM project\n');
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('hardhat test');
    expect(pkg.scripts['solidhat:test']).toBe('solidhat test');
  });

  it('is idempotent', () => {
    const directory = temporaryDirectory('repeat');
    initializeProject({ cwd: directory, install: false });
    const before = readFileSync(join(directory, 'package.json'), 'utf8');
    const result = initializeProject({ cwd: directory, install: false });

    expect(result.created).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toHaveLength(4);
    expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe(before);
  });

  it('previews without writing', () => {
    const parent = temporaryDirectory('dry-run');
    const result = initializeProject({ cwd: parent, target: 'preview', dryRun: true, install: true });

    expect(result.dryRun).toBe(true);
    expect(result.installed).toBe(false);
    expect(result.created.length).toBeGreaterThan(0);
    expect(existsSync(join(parent, 'preview'))).toBe(false);
  });

  it('plans all changes before refusing a conflicting config', () => {
    const directory = temporaryDirectory('conflict');
    writeFileSync(join(directory, 'package.json'), '{"name":"untouched"}\n');
    writeFileSync(join(directory, 'solidcash.config.ts'), '// user config\n');

    expect(() => initializeProject({ cwd: directory, install: false })).toThrow('Refusing to overwrite');
    expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe('{"name":"untouched"}\n');
    expect(readFileSync(join(directory, 'solidcash.config.ts'), 'utf8')).toBe('// user config\n');
  });

  it('replaces only SolidHat-owned conflicting files with force', () => {
    const directory = temporaryDirectory('force');
    writeFileSync(join(directory, 'package.json'), '{"name":"app"}\n');
    writeFileSync(join(directory, 'solidcash.config.ts'), '// obsolete\n');

    const result = initializeProject({ cwd: directory, force: true, install: false });

    expect(result.updated).toContain(join(directory, 'solidcash.config.ts'));
    expect(readFileSync(join(directory, 'solidcash.config.ts'), 'utf8')).toContain('defineConfig');
    expect(readFileSync(join(directory, 'solidcash.config.ts'), 'utf8')).toContain("target: 'ethers6'");
  });

  it('rolls back earlier files if an atomic replacement fails', () => {
    const directory = temporaryDirectory('rollback');
    const originalPackage = '{"name":"rollback-app"}\n';
    writeFileSync(join(directory, 'package.json'), originalPackage);
    writeFileSync(join(directory, 'solidcash.config.ts'), '// existing\n');
    mkdirSync(join(directory, `solidcash.config.ts.solidhat-backup-${process.pid}`));

    expect(() => initializeProject({ cwd: directory, force: true, install: false })).toThrow();
    expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe(originalPackage);
    expect(readFileSync(join(directory, 'solidcash.config.ts'), 'utf8')).toBe('// existing\n');
  });

  it('detects pnpm, yarn, then npm', () => {
    const directory = temporaryDirectory('manager');
    expect(detectPackageManager(directory)).toBe('npm');
    writeFileSync(join(directory, 'yarn.lock'), '');
    expect(detectPackageManager(directory)).toBe('yarn');
    writeFileSync(join(directory, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(directory)).toBe('pnpm');
  });

  it.each([
    [{ devDependencies: { hardhat: '^2.22.0', ethers: '^5.7.2' } }, { hardhat: 2, ethers: 5 }],
    [{ devDependencies: { hardhat: '^2.22.0', ethers: '^6.13.0' } }, { hardhat: 2, ethers: 6 }],
    [{ devDependencies: { hardhat: '^3.1.0', ethers: '^6.15.0' } }, { hardhat: 3, ethers: 6 }],
    [{}, { hardhat: 3, ethers: 6 }],
  ] as const)('detects installed compatibility generations', (pkg, expected) => {
    expect(detectCompatibility(pkg)).toEqual(expected);
  });

  it('generates explicit aliases for each compatibility generation', () => {
    expect(compatibilityAliases({ hardhat: 2, ethers: 5 })).toMatchObject({
      hardhat: '@solidcash/solidhat/hardhat2', ethers: '@solidcash/solidhat/ethers5',
    });
    expect(compatibilityAliases({ hardhat: 3, ethers: 6 })).toMatchObject({
      hardhat: '@solidcash/solidhat/hardhat3', ethers: '@solidcash/solidhat/ethers6',
    });
  });

  it('writes the detected generations into the isolated Vitest config', () => {
    const directory = temporaryDirectory('hardhat2');
    writeFileSync(join(directory, 'package.json'), JSON.stringify({
      devDependencies: { hardhat: '^2.22.0', ethers: '^5.7.2' },
    }));
    const result = initializeProject({ cwd: directory, install: false });
    expect(result.compatibility).toEqual({ hardhat: 2, ethers: 5 });
    expect(readFileSync(join(directory, 'vitest.solidhat.config.ts'), 'utf8'))
      .toContain('{"hardhat":2,"ethers":5}');
  });
});

describe('CLI entry points', () => {
  const solidhatCli = resolve('dist/cli.js');
  const createCli = resolve('../create-solidhat/dist/cli.js');

  it('injects the current directory with solidhat --init', () => {
    const directory = temporaryDirectory('cli-init');
    writeFileSync(join(directory, 'package.json'), '{"name":"existing"}\n');
    const output = execFileSync(process.execPath, [solidhatCli, '--init', '--no-install'], {
      cwd: directory, encoding: 'utf8',
    });
    expect(output).toContain('Initialized SolidHat');
    expect(existsSync(join(directory, 'solidcash.config.ts'))).toBe(true);
  });

  it('creates a named directory with create-solidhat', () => {
    const parent = temporaryDirectory('cli-create');
    const output = execFileSync(process.execPath, [createCli, 'hello', '--no-install'], {
      cwd: parent, encoding: 'utf8',
    });
    expect(output).toContain('Initialized SolidHat');
    expect(existsSync(join(parent, 'hello', 'contracts', 'Counter.scash'))).toBe(true);
  });

  it('compiles and tests a generated project end to end', () => {
    const parent = temporaryDirectory('generated-e2e');
    initializeProject({ cwd: parent, target: 'app', install: false });
    const directory = join(parent, 'app');
    symlinkSync(resolve('../../node_modules'), join(directory, 'node_modules'), 'dir');

    const output = execFileSync(process.execPath, [solidhatCli, 'test'], {
      cwd: directory, encoding: 'utf8',
    });

    expect(output).toContain('Compiled');
    expect(existsSync(join(directory, 'artifacts', 'solidcash', 'contracts', 'Counter.scash', 'Counter.json')))
      .toBe(true);
    // Budget was 20s. This spawns a child process running the whole CLI compile-and-test cycle: measured
    // 10,069 ms on a quiet box (half the old budget) but 63,152 ms and 76,982 ms under concurrent
    // parallel-worker rounds. A hang is unbounded, so 180s still catches one; 20s only caught a busy box.
  }, 180_000);
});

describe('interactive setup', () => {
  it('collects create-project choices without performing filesystem work', async () => {
    const answers = ['my-app', 'javascript', 'pnpm', 'n', 'y'];
    const options = await promptInitOptions({}, {
      createMode: true,
      interactive: true,
      ask: async () => answers.shift()!,
    });
    expect(options).toEqual({
      target: 'my-app', template: 'javascript', packageManager: 'pnpm', sample: false, install: true,
    });
  });

  it('does not prompt in noninteractive mode', async () => {
    const options = { dryRun: true };
    await expect(promptInitOptions(options, {
      interactive: false,
      ask: async () => { throw new Error('must not prompt'); },
    })).resolves.toBe(options);
  });
});
