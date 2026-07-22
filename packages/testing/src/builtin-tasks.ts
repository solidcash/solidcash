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
      compileString, compileStringMulti, compileStringSplit, compileFileMulti, compileFileSplit,
    } = await import('solidc');
    const { formatArtifact, formatSplitArtifactBundle } = await import('@solidcash/utils');
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
        const split = compileStringSplit(source, hre.config.solc);
        if (split.manifest.facets.length > 0) {
          fs.writeFileSync(
            path.join(artifactsDir, `${split.manifest.logicalContractName}.split.json`),
            formatSplitArtifactBundle(split, 'json'),
          );
        }
        if (!args.quiet) console.log(`Compiled ${fn} -> ${Object.keys(map).join(', ')}`);
        ok++;
      } catch (e: any) {
        console.error(`Error compiling ${fn}: ${e.message}`);
      }
    }

    // Cross-compile `.sol` sources (Solidity porting, e.g. `../effectiveacceleration.ai/contract`). compileFileMulti
    // resolves imports (OZ, interfaces) from the source's own node_modules, so `paths.contracts` may point at the real
    // Hardhat project. solidityImportCompat is forced on for `.sol`; other solc opts (ecrecover: 'p2pkh', ...) flow
    // through. Each file's import graph yields many contracts; a name is written once (first compile wins).
    const solFiles = findSolSources(contractsDir);
    const writtenNames = new Set<string>();
    let solOk = 0;
    for (const full of solFiles) {
      const rel = path.relative(contractsDir, full);
      try {
        const map = compileFileMulti(full, { solidityImportCompat: true, ...hre.config.solc });
        const fresh: string[] = [];
        for (const [name, artifact] of Object.entries(map)) {
          if (writtenNames.has(name)) continue;
          writtenNames.add(name);
          fs.writeFileSync(path.join(artifactsDir, `${name}.json`), formatArtifact(artifact as any, 'json'));
          fresh.push(name);
          contracts++;
        }
        const split = compileFileSplit(full, { solidityImportCompat: true, ...hre.config.solc });
        if (split.manifest.facets.length > 0) {
          fs.writeFileSync(
            path.join(artifactsDir, `${split.manifest.logicalContractName}.split.json`),
            formatSplitArtifactBundle(split, 'json'),
          );
        }
        if (!args.quiet) console.log(`Compiled ${rel}${fresh.length ? ` -> ${fresh.join(', ')}` : ' (all names already emitted)'}`);
        solOk++;
      } catch (e: any) {
        console.error(`Error compiling ${rel}: ${e.message.split('\n')[0]}`);
      }
    }

    const totalFiles = files.length + solFiles.length;
    if (!args.quiet) console.log(`Compiled ${ok + solOk}/${totalFiles} file(s), ${contracts} contract artifact(s).`);
    return { compiled: ok + solOk, total: totalFiles, contracts };
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
