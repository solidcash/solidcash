/**
 * Built-in tasks for the SolidCash harness CLI (HARDHAT-PARITY.md WS2): compile, test, run, clean, node.
 * Registered on import (side effect). `solidc` is imported dynamically so it stays an optional peer of the SDK.
 */
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import { task } from './tasks.js';
import type { HardhatRuntimeEnvironment } from './hre.js';

task('compile', 'Compile all .scash contracts to artifacts (per-contract, Hardhat-style layout)')
  .addFlag('quiet', 'Suppress per-file output')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const { compileString, compileStringMulti } = await import('solidc');
    const { formatArtifact } = await import('@solidcash/utils');
    const contractsDir = path.resolve(hre.config.paths.contracts);
    const artifactsDir = path.resolve(hre.config.paths.artifacts);
    const contractsBase = path.basename(contractsDir); // mirror hardhat's `artifacts/<sources>/<File>/<Contract>.json`
    if (!fs.existsSync(contractsDir)) throw new Error(`Contracts dir not found: ${contractsDir}`);
    fs.mkdirSync(artifactsDir, { recursive: true });

    const files = fs.readdirSync(contractsDir).filter((f) => f.endsWith('.scash'));
    let ok = 0;
    let contracts = 0;
    for (const fn of files) {
      try {
        const source = fs.readFileSync(path.join(contractsDir, fn), 'utf-8');
        // Hardhat mirror: one artifact JSON per CONTRACT (by contract name), nested under the source file dir.
        // This is what `getContractFactory("Name")` resolves against.
        const map = compileStringMulti(source, hre.config.solc);
        const nestDir = path.join(artifactsDir, contractsBase, fn);
        fs.mkdirSync(nestDir, { recursive: true });
        for (const [name, artifact] of Object.entries(map)) {
          fs.writeFileSync(path.join(nestDir, `${name}.json`), formatArtifact(artifact, 'json'));
          fs.writeFileSync(path.join(nestDir, `${name}.artifact.ts`), formatArtifact(artifact, 'ts'));
          contracts++;
        }
        // Backward-compat flat artifact (the file's primary contract, by file name) for direct `import` usage.
        const primary = compileString(source, hre.config.solc);
        fs.writeFileSync(path.join(artifactsDir, fn.replace('.scash', '.json')), formatArtifact(primary, 'json'));
        fs.writeFileSync(path.join(artifactsDir, fn.replace('.scash', '.artifact.ts')), formatArtifact(primary, 'ts'));
        if (!args.quiet) console.log(`Compiled ${fn} -> ${Object.keys(map).join(', ')}`);
        ok++;
      } catch (e: any) {
        console.error(`Error compiling ${fn}: ${e.message}`);
      }
    }
    if (!args.quiet) console.log(`Compiled ${ok}/${files.length} file(s), ${contracts} contract artifact(s).`);
    return { compiled: ok, total: files.length, contracts };
  });

task('test', 'Run the test suite (Vitest)')
  .addVariadicPositionalParam('paths', 'Optional test file paths/globs')
  .setAction(async (args) => {
    const extra = (args.paths as string[]) ?? [];
    const res = spawnSync('npx', ['vitest', 'run', ...extra], { stdio: 'inherit' });
    if (res.status !== 0) process.exitCode = res.status ?? 1;
    return { status: res.status };
  });

task('run', 'Run a script with the SolidCash HRE available as the `hre` global')
  .addPositionalParam('script', 'Path to the script to run')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const script = path.resolve(String(args.script));
    (globalThis as any).hre = hre;
    await import(pathToFileURL(script).href);
  });

task('clean', 'Delete the artifacts directory')
  .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
    const artifactsDir = path.resolve(hre.config.paths.artifacts);
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    console.log(`Removed ${artifactsDir}`);
  });

task('node', 'Info about the in-process mock network (no separate server needed)')
  .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
    console.log(`SolidCash mock network "${hre.network.name}" runs in-process.`);
    console.log('Use `const [owner] = await hre.ethers.getSigners()` in tests/scripts; no daemon required.');
  });
