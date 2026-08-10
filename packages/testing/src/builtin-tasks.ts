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
import { generateTypechainTargets, watchTypechainTargets } from './typegen.js';
import { diagnoseProject } from './doctor.js';

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
      version: compilerVersion,
    } = await import('solidc');
    const { asmToBytecode, formatArtifact, formatSplitArtifactBundle } = await import('@solidcash/utils');
    const contractsDir = path.resolve(hre.config.paths.contracts);
    const artifactsDir = solidcashArtifactsPath(hre.config.paths.artifacts);
    const outputDir = `${artifactsDir}.tmp-${process.pid}`;
    const contractsBase = path.basename(contractsDir); // mirror hardhat's `artifacts/<sources>/<File>/<Contract>.json`
    // Split when the unsplit redeem script exceeds the active provider's input-script ceiling. MistSwap's
    // mock publishes 100KB so the suite can exercise CONTRACT behaviour past the real 10KB frontier; the
    // StatefulTransactionBuilder byte gate reads the same provider limit (plain TransactionBuilder keeps
    // the real 10KB consensus gate for X158). Prefer recompiling with a strict provider (or maxShardBytes
    // override) when publishing mainnet-ready split bundles.
    const maxShardBytes = hre.network.provider.consensusLimits?.maximumInputBytes ?? 10_000;
    const maximumNftCommitmentBytes = hre.network.provider.consensusLimits?.maximumNftCommitmentBytes ?? 128;
    const compilerOptions = {
      ...hre.config.solc,
      maximumInputBytes: maxShardBytes,
      commitmentLimit: Math.min(
        (hre.config.solc?.commitmentLimit as number | undefined) ?? maximumNftCommitmentBytes,
        maximumNftCommitmentBytes,
      ),
    };
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
        const map = compileStringMulti(source, compilerOptions);
        const nestDir = path.join(outputDir, contractsBase, fn);
        fs.mkdirSync(nestDir, { recursive: true });
        for (const [name, artifact] of Object.entries(map)) {
          fs.writeFileSync(path.join(nestDir, `${name}.json`), formatArtifact(artifact, 'json'));
          fs.writeFileSync(path.join(nestDir, `${name}.artifact.ts`), formatArtifact(artifact, 'ts'));
          contracts++;
        }
        // Backward-compat flat artifact (the file's primary contract, by file name) for direct `import` usage.
        const primary = compileString(source, compilerOptions);
        fs.writeFileSync(path.join(outputDir, fn.replace('.scash', '.json')), formatArtifact(primary, 'json'));
        fs.writeFileSync(path.join(outputDir, fn.replace('.scash', '.artifact.ts')), formatArtifact(primary, 'ts'));
        // X149: `bytecode` is an ASM listing; measuring it fires on contracts that actually fit.
        if (asmToBytecode(primary.bytecode).length > maxShardBytes) {
          const split = compileStringSplit(source, { ...compilerOptions, maxShardBytes });
          fs.writeFileSync(
            path.join(outputDir, `${split.manifest.logicalContractName}.split.json`),
            formatSplitArtifactBundle(split, 'json'),
          );
        }
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
        { solidityImportCompat: true, ...compilerOptions },
        compileFileMulti,
        {
          directory: path.join(hre.config.paths.cache, 'solidcash'),
          compilerVersion,
        },
      );
      for (const [name, artifact] of Object.entries(result.artifacts)) {
        writtenNames.add(name);
        fs.writeFileSync(path.join(outputDir, `${name}.json`), formatArtifact(artifact as any, 'json'));
        fs.writeFileSync(path.join(outputDir, `${name}.artifact.ts`), formatArtifact(artifact as any, 'ts'));
        contracts++;
      }
      // Splitting is needed only for roots whose normal artifact exceeds the consensus script limit. Preserve the
      // project DAG/cache fast path for ordinary contracts rather than independently recompiling every source.
      const shardFailures: string[] = [];
      for (const full of solFiles) {
        const source = fs.readFileSync(full, 'utf8');
        const declarations = [...source.matchAll(/\b(?:abstract\s+)?contract\s+([A-Za-z_$][\w$]*)/g)]
          .map((match) => match[1]);
        const needsSplit = declarations.some((name) => {
          const artifact = result.artifacts[name];
          // The lightweight declaration scan can see prose in comments (for example, "contract constructor").
          // Artifact maps are ordinary objects, so a name like `constructor` can otherwise resolve an inherited
          // Object.prototype member and reach asmToBytecode with no bytecode string.
          return typeof artifact?.bytecode === 'string'
            && asmToBytecode(artifact.bytecode).length > maxShardBytes;
        });
        if (!needsSplit) continue;
        let split;
        try {
          split = compileFileSplit(full, {
            solidityImportCompat: true, ...compilerOptions, maxShardBytes,
          });
        } catch (error: any) {
          // Keep sharding the remaining sources. Aborting here reports one wall per run, which on a large
          // project turns wall discovery into a sequence of multi-tens-of-minutes compiles; the run still fails,
          // it just fails with the COMPLETE list.
          shardFailures.push(`${path.relative(contractsDir, full)}: ${error.message.split('\n')[0]}`);
          continue;
        }
        // Publish the bundle even when the split needed NO facets. We only get here because the unsplit artifact
        // exceeded the consensus limit, and split preparation alone can bring a root under it (SushiBar: 13,474
        // unsplit vs a 9,192-byte single root). Discarding that left the only deployable form on the floor and
        // the unusable artifact in its place.
        fs.writeFileSync(
          path.join(outputDir, `${split.manifest.logicalContractName}.split.json`),
          formatSplitArtifactBundle(split, 'json'),
        );
      }
      if (shardFailures.length > 0) {
        // Keep compile successful when ordinary artifacts already published. Unsplit oversized roots remain
        // spend-refused by the real 10KB byte gate; token-sized contracts (and any successful splits) still
        // run. Failing the whole project on an unshardable Kashi/Factory wall blocked MistSwap token tests
        // that only need SushiToken/ERC20Mock.
        console.warn(
          `Warning: failed to shard ${shardFailures.length} source(s) (unsplit artifacts kept):\n  `
          + `${shardFailures.join('\n  ')}`,
        );
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
      if (process.env.SOLIDC_DEBUG && e.stack) console.error(e.stack);
      failures.push(new Error(`Solidity project: ${e.message}`));
    }

    // Publish whatever compiled even when some sources failed. Discarding the fresh output left the PREVIOUS
    // run's artifacts in place, which is strictly more misleading than partial-but-current ones. The run still
    // fails loudly with the full failure list, so this cannot be mistaken for success.
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.renameSync(outputDir, artifactsDir);
    if (failures.length > 0) {
      console.error(`Wrote artifacts for the sources that did compile; ${failures.length} group(s) failed.`);
      throw new AggregateError(failures, `Compilation failed for ${failures.length} source group(s)`);
    }
    const typegen = generateTypechainTargets({
      artifactsDir,
      contractsDir,
      cacheDir: path.join(hre.config.paths.cache, 'solidcash'),
      targets: hre.config.typegen.targets,
    });
    const totalFiles = files.length + solFiles.length;
    if (!args.quiet) console.log(`Compiled ${ok + solOk}/${totalFiles} file(s), ${contracts} contract artifact(s).`);
    return {
      compiled: ok + solOk, total: totalFiles, contracts, compilerJobs, cacheHits, typegen,
    };
  });

task('typegen', 'Generate TypeChain-compatible contract bindings from compiled artifacts')
  .addFlag('watch', 'Regenerate bindings when sources or artifacts change')
  .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
    const options = {
      artifactsDir: solidcashArtifactsPath(hre.config.paths.artifacts),
      contractsDir: path.resolve(hre.config.paths.contracts),
      cacheDir: path.join(hre.config.paths.cache, 'solidcash'),
      targets: hre.config.typegen.targets,
    };
    if (_args.watch) {
      const watcher = watchTypechainTargets(options, (generated) => generated.forEach((result) => {
        console.log(`${result.skipped ? 'Reused' : 'Generated'} ${result.target} bindings in ${result.outDir}`);
      }));
      console.log('Watching SolidCash sources and artifacts for type changes.');
      await new Promise<void>((resolve) => process.once('SIGINT', () => { watcher.close(); resolve(); }));
      return [];
    }
    const results = generateTypechainTargets(options);
    for (const result of results) {
      console.log(`${result.skipped ? 'Reused' : 'Generated'} ${result.target} bindings in ${result.outDir}`);
    }
    return results;
  });

task('doctor', 'Check SolidHat configuration, artifacts, generated files, and migration readiness')
  .addFlag('json', 'Print machine-readable JSON')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const findings = diagnoseProject(hre.config);
    if (args.json) console.log(JSON.stringify(findings, null, 2));
    else findings.forEach((finding) => console.log(
      `${finding.severity.toUpperCase()} [${finding.code}] ${finding.message}${finding.path ? ` (${finding.path})` : ''}`,
    ));
    if (findings.some((finding) => finding.severity === 'error')) process.exitCode = 1;
    return findings;
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
      .map((candidate) => path.resolve(candidate))
      .find((candidate) => fs.existsSync(candidate));
    // Pass the config and root as ABSOLUTE paths. Vitest resolves a relative --config against its own inferred
    // root, which in a monorepo is not necessarily this project, and it then fails to load the config at all.
    const configArgs = solidhatConfig ? ['--config', solidhatConfig, '--root', process.cwd()] : [];
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
    for (const target of hre.config.typegen.targets) fs.rmSync(target.outDir, { recursive: true, force: true });
    console.log(`Removed ${artifactsDir}, ${cacheDir}, and configured generated bindings`);
  });

task('node', 'Info about the in-process mock network (no separate server needed)')
  .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
    console.log(`SolidCash mock network "${hre.network.name}" runs in-process.`);
    console.log('Use `const [owner] = await hre.ethers.getSigners()` in tests/scripts; no daemon required.');
  });
