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
  it('runs cold, warm, invalidated, factory-resolution, and clean paths end to end', async () => {
    const root = tempProject();
    const config = resolveConfig({
      paths: {
        contracts: './contracts',
        artifacts: './artifacts',
        cache: './cache',
        tests: './test',
      },
      compiler: { solidityImportCompat: true },
    }, root);
    const hre = createHardhatRuntimeEnvironment(config);

    const cold = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(cold.compilerJobs).toBe(1);
    expect(cold.cacheHits).toBe(0);
    expect(jobFiles(root)).toHaveLength(1);
    expect(loadArtifactByName(config.paths.artifacts, 'Root').contractName).toBe('Root');

    const warm = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(warm.compilerJobs).toBe(0);
    expect(warm.cacheHits).toBe(1);
    expect(jobFiles(root)).toHaveLength(1);

    fs.appendFileSync(path.join(root, 'contracts', 'Dependency.sol'), '\n// invalidate root');
    const invalidated = await runTask('compile', { quiet: true }, hre) as {
      compilerJobs: number; cacheHits: number;
    };
    expect(invalidated.compilerJobs).toBe(1);
    expect(invalidated.cacheHits).toBe(0);
    expect(jobFiles(root)).toHaveLength(2);

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
});
