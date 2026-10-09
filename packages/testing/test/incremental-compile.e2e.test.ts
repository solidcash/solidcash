import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/builtin-tasks.js';
import { resolveConfig } from '../src/config.js';
import { createHardhatRuntimeEnvironment, loadArtifactByName } from '../src/hre.js';
import { runTask } from '../src/tasks.js';

const dirs: string[] = [];
function tempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-compile-e2e-'));
  dirs.push(root);
  fs.mkdirSync(path.join(root, 'contracts'));
  fs.writeFileSync(path.join(root, 'contracts', 'Dependency.sol'), 'contract Dependency {}');
  fs.writeFileSync(
    path.join(root, 'contracts', 'Root.sol'),
    'import "./Dependency.sol"; contract Root {}',
  );
  return root;
}

function jobFiles(root: string): string[] {
  return fs.readdirSync(path.join(root, 'cache', 'solidcash', 'jobs')).sort();
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('incremental compile task', () => {
  it('bypasses both compiler and project caches when SOLIDC_COMPILE_CACHE=0', async () => {
    const root = tempProject();
    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      paths: { contracts: './contracts', artifacts: './artifacts', cache: './cache', tests: './test' },
      compiler: { evmCompat: true },
    }, root));
    const previous = process.env.SOLIDC_COMPILE_CACHE;
    try {
      process.env.SOLIDC_COMPILE_CACHE = '1';
      const cold = await runTask('compile', { quiet: true }, hre) as {
        compilerJobs: number; cacheHits: number;
      };
      const warm = await runTask('compile', { quiet: true }, hre) as {
        compilerJobs: number; cacheHits: number;
      };
      expect(cold.compilerJobs).toBe(2);
      expect(warm.cacheHits).toBe(2);

      process.env.SOLIDC_COMPILE_CACHE = '0';
      const uncached = await runTask('compile', { quiet: true }, hre) as {
        compilerJobs: number; cacheHits: number;
      };
      expect(uncached.compilerJobs).toBe(2);
      expect(uncached.cacheHits).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
      else process.env.SOLIDC_COMPILE_CACHE = previous;
    }
  });

  it('supports the ethers v6 HDNodeWallet.fromMnemonic compatibility constructor', () => {
    const root = tempProject();
    const hre = createHardhatRuntimeEnvironment(resolveConfig({}, root));
    const phrase = 'test test test test test test test test test test test junk';
    const wallet = hre.ethers.HDNodeWallet.fromMnemonic({ phrase }, "m/44'/60'/0'/0/7");
    expect(wallet.derivationPath).toBe("m/44'/60'/0'/0/7");
    expect(wallet.connect(hre.ethers.provider).address).toBe(wallet.address);
  });

  it('runs cold, warm, invalidated, factory-resolution, and clean paths end to end', async () => {
    const root = tempProject();
    const config = resolveConfig({
      paths: {
        contracts: './contracts',
        artifacts: './artifacts',
        cache: './cache',
        tests: './test',
      },
      compiler: { evmCompat: true },
    }, root);
    const hre = createHardhatRuntimeEnvironment(config);

    const cold = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(cold.compilerJobs).toBe(2);
    expect(cold.cacheHits).toBe(0);
    expect(jobFiles(root)).toHaveLength(2);
    expect(loadArtifactByName(config.paths.artifacts, 'Root').contractName).toBe('Root');
    expect(loadArtifactByName(config.paths.artifacts, 'contracts/Root.sol:Root').contractName).toBe('Root');

    const warm = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(warm.compilerJobs).toBe(0);
    expect(warm.cacheHits).toBe(2);
    expect(jobFiles(root)).toHaveLength(2);

    fs.appendFileSync(path.join(root, 'contracts', 'Dependency.sol'), '\n// invalidate root');
    const invalidated = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(invalidated.compilerJobs).toBe(2);
    expect(invalidated.cacheHits).toBe(0);
    expect(jobFiles(root)).toHaveLength(4);

    const liveArtifact = path.join(root, 'artifacts', 'solidcash', 'Root.json');
    const lastKnownGood = fs.readFileSync(liveArtifact, 'utf8');
    fs.writeFileSync(path.join(root, 'contracts', 'Root.sol'), 'contract Root {');
    await expect(runTask('compile', { quiet: true }, hre)).rejects.toThrow('Compilation failed');
    expect(fs.readFileSync(liveArtifact, 'utf8')).toBe(lastKnownGood);
    expect(fs.existsSync(`${path.join(root, 'artifacts', 'solidcash')}.tmp-${process.pid}`)).toBe(false);

    await runTask('clean', {}, hre);
    expect(fs.existsSync(path.join(root, 'artifacts', 'solidcash'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'cache', 'solidcash'))).toBe(false);
  });

  it('recompiles selected declarations without replacing unrelated canonical artifacts', async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'contracts', 'Unrelated.sol'), 'contract Unrelated {}');
    const config = resolveConfig({
      paths: {
        contracts: './contracts',
        artifacts: './artifacts',
        cache: './cache',
        tests: './test',
      },
      compiler: { evmCompat: true },
    }, root);
    const hre = createHardhatRuntimeEnvironment(config);
    await runTask('compile', { quiet: true, 'skip-split': true }, hre);

    const artifactDir = path.join(root, 'artifacts', 'solidcash');
    const artifactDirectoryInode = fs.statSync(artifactDir).ino;
    const dependencyBefore = fs.readFileSync(path.join(artifactDir, 'Dependency.json'), 'utf8');
    const rootBefore = fs.readFileSync(path.join(artifactDir, 'Root.json'), 'utf8');
    const unrelatedBefore = fs.readFileSync(path.join(artifactDir, 'Unrelated.json'), 'utf8');
    fs.writeFileSync(
      path.join(root, 'contracts', 'Dependency.sol'),
      'contract Dependency { function changedDependency() public {} }',
    );
    fs.writeFileSync(
      path.join(root, 'contracts', 'Root.sol'),
      'import "./Dependency.sol"; contract Root { function changed() public {} }',
    );

    const result = await runTask('compile', {
      quiet: true,
      'skip-split': true,
      sources: ['Root.sol'],
    }, hre) as { compilerJobs: number; total: number };
    expect(result.compilerJobs).toBe(1);
    expect(result.total).toBe(1);
    // A focused root compile publishes only declarations owned by that source. Recompile Dependency.sol
    // explicitly when its canonical artifact is also required in the iteration.
    expect(fs.readFileSync(path.join(artifactDir, 'Dependency.json'), 'utf8')).toBe(dependencyBefore);
    expect(fs.readFileSync(path.join(artifactDir, 'Root.json'), 'utf8')).not.toBe(rootBefore);
    expect(fs.readFileSync(path.join(artifactDir, 'Unrelated.json'), 'utf8')).toBe(unrelatedBefore);
    expect(fs.statSync(artifactDir).ino).toBe(artifactDirectoryInode);
    expect(fs.statSync(path.join(artifactDir, 'Dependency.json')).mode & 0o400).not.toBe(0);
  });

  it('expands a focused request when the published artifact compile context changed', async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'contracts', 'Unrelated.sol'), 'contract Unrelated {}');
    const configured = (extra: Record<string, unknown>): ReturnType<typeof resolveConfig> => resolveConfig({
      paths: {
        contracts: './contracts', artifacts: './artifacts', cache: './cache', tests: './test',
      },
      compiler: { evmCompat: true, ...extra },
    }, root);
    await runTask('compile', { quiet: true, 'skip-split': true },
      createHardhatRuntimeEnvironment(configured({ ecrecover: 'p2sh32' })));

    const result = await runTask('compile', {
      quiet: true, 'skip-split': true, sources: ['Root.sol'],
    }, createHardhatRuntimeEnvironment(configured({ ecrecover: 'p2pkh' }))) as {
      compilerJobs: number; total: number;
    };

    expect(result.total).toBe(3);
    expect(result.compilerJobs).toBeGreaterThan(1);
  });

  it('keeps iteration compiles focused while leaving changed compiler context stale', async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'contracts', 'Unrelated.sol'), 'contract Unrelated {}');
    const configured = (extra: Record<string, unknown>): ReturnType<typeof resolveConfig> => resolveConfig({
      paths: {
        contracts: './contracts', artifacts: './artifacts', cache: './cache', tests: './test',
      },
      compiler: { evmCompat: true, ...extra },
    }, root);
    await runTask('compile', { quiet: true, 'skip-split': true },
      createHardhatRuntimeEnvironment(configured({ ecrecover: 'p2sh32' })));

    const contextFile = path.join(root, 'cache', 'solidcash', 'artifact-context');
    const oldContext = fs.readFileSync(contextFile, 'utf8');
    const nextHre = createHardhatRuntimeEnvironment(configured({ ecrecover: 'p2pkh' }));
    const iteration = await runTask('compile', {
      quiet: true, iteration: true, 'skip-split': true, sources: ['Root.sol'],
    }, nextHre) as { artifactContextStale: boolean; compilerJobs: number; total: number };

    expect(iteration.total).toBe(1);
    expect(iteration.compilerJobs).toBe(1);
    expect(iteration.artifactContextStale).toBe(true);
    expect(fs.readFileSync(contextFile, 'utf8')).toBe(oldContext);

    // Because the iteration build did not claim a coherent artifact context, an ordinary focused request still
    // expands to the complete authoritative build.
    const authoritative = await runTask('compile', {
      quiet: true, 'skip-split': true, sources: ['Root.sol'],
    }, nextHre) as { artifactContextStale: boolean; compilerJobs: number; total: number };
    expect(authoritative.total).toBe(3);
    expect(authoritative.compilerJobs).toBeGreaterThan(1);
    expect(authoritative.artifactContextStale).toBe(false);
    expect(fs.readFileSync(contextFile, 'utf8')).not.toBe(oldContext);
  });
});
