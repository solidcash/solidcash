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
import { compileSolidityProject } from './project-compiler.js';
import { solidcashArtifactsPath } from './artifact-paths.js';
import { migrateHardhatConfig } from './config.js';

// Recursively collect `.sol` sources, skipping vendored dependency trees (node_modules + `@scope` package dirs like
// @openzeppelin / @sablier) - those are resolved as imports by compileFileMulti, not compiled as top-level targets.
function findSolSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('@')) continue;
      findSolSources(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.sol')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

task('compile', 'Compile .scash and .sol contracts to artifacts (per-contract, Hardhat-style layout)')
  .addFlag('quiet', 'Suppress per-file output')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const {
      compileString, compileStringMulti, compileFileMulti, version: compilerVersion,
    } = await import('solidc');
    const { formatArtifact } = await import('@solidcash/utils');
    const contractsDir = path.resolve(hre.config.paths.contracts);
    const artifactsDir = solidcashArtifactsPath(hre.config.paths.artifacts);
    const outputDir = `${artifactsDir}.tmp-${process.pid}`;
    const contractsBase = path.basename(contractsDir); // mirror hardhat's `artifacts/<sources>/<File>/<Contract>.json`
    if (!fs.existsSync(contractsDir)) throw new Error(`Contracts dir not found: ${contractsDir}`);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const files = fs.readdirSync(contractsDir).filter((f) => f.endsWith('.scash'));
    const failures: Error[] = [];
    let ok = 0;
    let contracts = 0;
    for (const fn of files) {
      try {
        const source = fs.readFileSync(path.join(contractsDir, fn), 'utf-8');
        // Hardhat mirror: one artifact JSON per CONTRACT (by contract name), nested under the source file dir.
        // This is what `getContractFactory("Name")` resolves against.
        const map = compileStringMulti(source, hre.config.solc);
        const nestDir = path.join(outputDir, contractsBase, fn);
        fs.mkdirSync(nestDir, { recursive: true });
        for (const [name, artifact] of Object.entries(map)) {
          fs.writeFileSync(path.join(nestDir, `${name}.json`), formatArtifact(artifact, 'json'));
          fs.writeFileSync(path.join(nestDir, `${name}.artifact.ts`), formatArtifact(artifact, 'ts'));
          contracts++;
        }
        // Backward-compat flat artifact (the file's primary contract, by file name) for direct `import` usage.
        const primary = compileString(source, hre.config.solc);
        fs.writeFileSync(path.join(outputDir, fn.replace('.scash', '.json')), formatArtifact(primary, 'json'));
        fs.writeFileSync(path.join(outputDir, fn.replace('.scash', '.artifact.ts')), formatArtifact(primary, 'ts'));
        if (!args.quiet) console.log(`Compiled ${fn} -> ${Object.keys(map).join(', ')}`);
        ok++;
      } catch (e: any) {
        console.error(`Error compiling ${fn}: ${e.message}`);
        failures.push(new Error(`${fn}: ${e.message}`));
      }
    }

    // Cross-compile `.sol` sources (Solidity porting, e.g. `../effectiveacceleration.ai/contract`). compileFileMulti
    // resolves imports (OZ, interfaces) from the source's own node_modules, so `paths.contracts` may point at the real
    // Hardhat project. solidityImportCompat is forced on for `.sol`; other solc opts (ecrecover: 'p2pkh', ...) flow
    // through. Each file's import graph yields many contracts; a name is written once (first compile wins).
    const solFiles = findSolSources(contractsDir);
    const writtenNames = new Set<string>();
    let solOk = 0;
    let compilerJobs = 0;
    let cacheHits = 0;
    try {
      const result = compileSolidityProject(
        solFiles,
        { solidityImportCompat: true, ...hre.config.solc },
        compileFileMulti,
        {
          directory: path.join(hre.config.paths.cache, 'solidcash'),
          compilerVersion,
        },
      );
      for (const [name, artifact] of Object.entries(result.artifacts)) {
        writtenNames.add(name);
        fs.writeFileSync(path.join(outputDir, `${name}.json`), formatArtifact(artifact as any, 'json'));
        contracts++;
      }
      solOk = solFiles.length;
      compilerJobs = result.compiledRoots.length;
      cacheHits = result.cacheHits.length;
      if (!args.quiet && solFiles.length > 0) {
        console.log(
          `Compiled ${solFiles.length} Solidity source(s) in ${result.compiledRoots.length} compiler job(s)`
          + ` (${result.cacheHits.length} cache hit(s))`
          + ` -> ${writtenNames.size} artifact(s)`,
        );
      }
    } catch (e: any) {
      console.error(`Error compiling Solidity project: ${e.message.split('\n')[0]}`);
      failures.push(new Error(`Solidity project: ${e.message}`));
    }

    if (failures.length > 0) {
      fs.rmSync(outputDir, { recursive: true, force: true });
      throw new AggregateError(failures, `Compilation failed for ${failures.length} source group(s)`);
    }
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.renameSync(outputDir, artifactsDir);
    const totalFiles = files.length + solFiles.length;
    if (!args.quiet) console.log(`Compiled ${ok + solOk}/${totalFiles} file(s), ${contracts} contract artifact(s).`);
    return {
      compiled: ok + solOk, total: totalFiles, contracts, compilerJobs, cacheHits,
    };
  });

task('init', 'Create SolidCash configuration')
  .addFlag('from-hardhat', 'Generate solidcash.config.ts from the nearest Hardhat config')
  .setAction(async (args) => {
    if (!args['from-hardhat']) throw new Error('Use `solidcash init --from-hardhat`.');
    const target = await migrateHardhatConfig(process.cwd());
    console.log(`Created ${target}`);
    return { config: target };
  });

task('test', 'Run the test suite (Vitest)')
  .addVariadicPositionalParam('paths', 'Optional test file paths/globs')
  .setAction(async (args) => {
    const extra = (args.paths as string[]) ?? [];
    const solidhatConfig = ['vitest.solidhat.config.ts', 'vitest.solidhat.config.js']
      .find((candidate) => fs.existsSync(path.resolve(candidate)));
    const configArgs = solidhatConfig ? ['--config', solidhatConfig] : [];
    const res = spawnSync('npx', ['vitest', 'run', ...configArgs, ...extra], { stdio: 'inherit' });
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
    const artifactsDir = solidcashArtifactsPath(hre.config.paths.artifacts);
    const cacheDir = path.join(hre.config.paths.cache, 'solidcash');
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log(`Removed ${artifactsDir} and ${cacheDir}`);
  });

task('node', 'Info about the in-process mock network (no separate server needed)')
  .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
    console.log(`SolidCash mock network "${hre.network.name}" runs in-process.`);
    console.log('Use `const [owner] = await hre.ethers.getSigners()` in tests/scripts; no daemon required.');
  });
