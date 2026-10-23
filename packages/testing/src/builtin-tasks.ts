/**
 * Built-in tasks for the SolidCash harness CLI (HARDHAT-PARITY.md WS2): compile, test, run, clean, node.
 * Registered on import (side effect). `solidc` is imported dynamically so it stays an optional peer of the SDK.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import { task } from './tasks.js';
import type { HardhatRuntimeEnvironment } from './hre.js';
import { artifactCompilerOptions, compileSolidityProject } from './project-compiler.js';
import { solidcashArtifactsPath } from './artifact-paths.js';
import { migrateHardhatConfig } from './config.js';
import { generateTypechainTargets, watchTypechainTargets } from './typegen.js';
import { diagnoseProject } from './doctor.js';

/**
 * Project artifacts depend on emitted JavaScript implementations, not only package versions. During local
 * development versions remain stable while compiler passes, shared code-generation constants, and artifact
 * metadata change, so version-only keys can silently publish stale artifacts. Hashing emitted JavaScript trees
 * costs only a few milliseconds and avoids invalidating artifacts for declaration/source-map timestamp churn.
 */
function compilerJavaScriptFingerprint(entryFile: string): string {
  const root = path.dirname(entryFile);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
    }
  };
  visit(root);
  const digest = createHash('sha256');
  for (const file of files.sort()) {
    digest.update(path.relative(root, file));
    digest.update('\0');
    digest.update(fs.readFileSync(file));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function artifactCompileContextIdentity(
  compilerIdentity: string,
  compilerOptions: Record<string, unknown>,
  jsonArtifactModules: boolean,
): string {
  return createHash('sha256').update(JSON.stringify({
    compilerIdentity,
    compilerOptions: artifactCompilerOptions(compilerOptions),
    jsonArtifactModules,
  })).digest('hex');
}

// Recursively collect `.sol` sources, skipping vendored dependency trees (node_modules + `@scope` package dirs like
// @openzeppelin / @sablier) - those are resolved as imports by compileFileMulti, not compiled as top-level targets.
function findSolSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('@')) continue;
      findSolSources(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.sol') && (entry.isFile()
      || (entry.isSymbolicLink() && fs.statSync(path.join(dir, entry.name)).isFile()))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function selectCompileSources(available: readonly string[], requested: readonly string[], contractsDir: string): string[] {
  if (requested.length === 0) return [...available];
  const selected = new Set<string>();
  for (const request of requested) {
    const normalized = request.replaceAll('\\', '/').replace(/^\.\//, '');
    const matches = available.filter((file) => {
      const relative = path.relative(contractsDir, file).replaceAll('\\', '/');
      return relative === normalized || path.basename(file) === normalized
        || path.resolve(file) === path.resolve(request);
    });
    if (matches.length === 0) {
      throw new Error(`Compile source not found under ${contractsDir}: ${request}`);
    }
    if (matches.length > 1) {
      throw new Error(`Compile source is ambiguous; use a path relative to ${contractsDir}: ${request}`);
    }
    selected.add(matches[0]);
  }
  return [...selected];
}

function solidityDeclarations(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...source.matchAll(/\b(?:abstract\s+)?(?:contract|interface|library)\s+([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1]);
}

/**
 * Publish a fully-built artifact tree without replacing the canonical directory itself.
 *
 * Some host-backed filesystems leave existing file watchers attached to an unusable directory after a
 * remove-and-rename directory swap. On those filesystems, renaming individual files can leave the directory with
 * equally unusable ghost entries, so keep both directory and file entries stable by copying the validated staged
 * files over their destinations. Compilation failures never reach this function.
 */
function publishArtifactTree(stagingDir: string, artifactsDir: string): void {
  const stagedFiles: string[] = [];
  const collectFiles = (directory: string, root: string, out: string[]): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) collectFiles(absolute, root, out);
      else if (entry.isFile()) out.push(path.relative(root, absolute));
    }
  };
  collectFiles(stagingDir, stagingDir, stagedFiles);
  const stagedSet = new Set(stagedFiles);
  fs.mkdirSync(artifactsDir, { recursive: true });
  for (const relative of stagedFiles) {
    const target = path.join(artifactsDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(stagingDir, relative), target);
  }

  const previousFiles: string[] = [];
  collectFiles(artifactsDir, artifactsDir, previousFiles);
  for (const relative of previousFiles) {
    if (!stagedSet.has(relative)) {
      fs.rmSync(path.join(artifactsDir, relative), { force: true });
    }
  }
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

/** Copy the last-known-good tree into staging without `fs.cpSync`'s mode corruption on fake-owner mounts. */
function copyArtifactTree(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyArtifactTree(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}

task('compile', 'Compile .scash and .sol contracts to artifacts (per-contract, Hardhat-style layout)')
  .addFlag('quiet', 'Suppress per-file output')
  .addFlag('suppress-warnings', 'Suppress non-fatal compiler warnings')
  .addFlag('skip-split', 'Skip split-bundle attempts for oversized contracts')
  .addOptionalParam(
    'jobs',
    'Compile Solidity roots in N worker threads (default 1, one process). Only a cold project build can '
    + 'benefit: warm builds are cache hits. Measured on the marketplace corpus, 2 jobs is ~1.35x faster in wall '
    + 'time for ~1.3x the CPU; more jobs buy less wall time for a much larger CPU and memory multiplier.',
  )
  .addFlag(
    'iteration',
    'Compile only requested sources after compiler changes, leaving the artifact tree marked stale',
  )
  .addVariadicPositionalParam(
    'sources',
    'Optional source paths to recompile while preserving artifacts from the last complete build',
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const {
      compileString, compileStringMulti, compileStringSplit, compileFileMulti, compileFileSplit,
      version: compilerVersion,
    } = await import('@solidcash/solidc');
    const compilerEntry = createRequire(import.meta.url).resolve('@solidcash/solidc');
    const compilerUtilsEntry = createRequire(import.meta.url).resolve('@solidcash/utils');
    const compilerCacheIdentity = `${compilerVersion}:${compilerJavaScriptFingerprint(compilerEntry)}`
      + `:${compilerJavaScriptFingerprint(compilerUtilsEntry)}`
      + (process.env.SOLIDCASH_NO_OUTLINE ? ':no-outline' : '');
    const { asmToBytecode, formatArtifact, formatSplitArtifactBundle } = await import('@solidcash/utils');
    const contractsDir = path.resolve(hre.config.paths.contracts);
    const artifactsDir = solidcashArtifactsPath(hre.config.paths.artifacts);
    const outputDir = `${artifactsDir}.tmp-${process.pid}`;
    const requestedSources = (args.sources as string[] | undefined) ?? [];
    const iterationCompile = args.iteration === true;
    if (iterationCompile && requestedSources.length === 0) {
      throw new Error('The compile --iteration flag requires at least one requested source.');
    }
    const contractsBase = path.basename(contractsDir); // mirror hardhat's `artifacts/<sources>/<File>/<Contract>.json`
    // Split when the unsplit redeem script exceeds the active provider's input-script ceiling. MistSwap's
    // mock publishes 100KB so the suite can exercise CONTRACT behaviour past the real 10KB frontier; the
    // StatefulTransactionBuilder byte gate reads the same provider limit (plain TransactionBuilder keeps
    // the real 10KB consensus gate for X158). Prefer recompiling with a strict provider (or maxShardBytes
    // override) when publishing mainnet-ready split bundles.
    const maxShardBytes = hre.network.provider.consensusLimits?.maximumInputBytes ?? 10_000;
    const maximumNftCommitmentBytes = hre.network.provider.consensusLimits?.maximumNftCommitmentBytes ?? 128;
    const suppressWarnings = args['suppress-warnings'] === true
      || hre.config.solc?.suppressWarnings === true;
    // Reuse compiled artifacts across CLI invocations. A cache entry is keyed by the compiler build id, the root
    // source, the contents of the whole transitive import closure, the primary declaration and every published
    // option, so a hit is equivalent to recompiling; editing an imported file or rebuilding the compiler misses.
    // `SOLIDC_COMPILE_CACHE=0` forces a full compile.
    // TODO(remove SOLIDC_COMPILE_CACHE): replace this environment check with a `--no-cache` flag once the
    // variable is gone from the compiler (`packages/solidc/src/compiler.ts`, `artifactCacheEnabled`).
    const artifactCache = process.env.SOLIDC_COMPILE_CACHE !== '0';
    const compilerOptions = {
      ...hre.config.solc,
      // A project config may pin the composition convention directly; it overrides the free-form solc map.
      ...(hre.config.composition !== undefined && { composition: hre.config.composition }),
      suppressWarnings,
      maximumInputBytes: maxShardBytes,
      commitmentLimit: Math.min(
        (hre.config.solc?.commitmentLimit as number | undefined) ?? maximumNftCommitmentBytes,
        maximumNftCommitmentBytes,
      ),
      ...(artifactCache && { __artifactCache: true }),
    };
    const cacheDir = path.join(hre.config.paths.cache, 'solidcash');
    // The disk layer is what makes the cache survive between CLI invocations; without it only one process would
    // benefit. An explicitly configured directory always wins.
    if (artifactCache) {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
      process.env.SOLIDC_COMPILE_CACHE_DIR ??= cacheDir;
    }
    const artifactContextFile = path.join(cacheDir, 'artifact-context');
    const artifactContext = artifactCompileContextIdentity(
      compilerCacheIdentity,
      compilerOptions,
      hre.config.typegen?.jsonArtifactModules === true,
    );
    let publishedArtifactContext: string | undefined;
    try {
      publishedArtifactContext = fs.readFileSync(artifactContextFile, 'utf8').trim();
    } catch { /* A legacy or empty artifact tree has no published context. */ }
    const hasPublishedArtifacts = fs.existsSync(artifactsDir);
    const contextChanged = hasPublishedArtifacts && publishedArtifactContext !== artifactContext;
    // Preserving unrelated artifacts is safe only when they were emitted by the same compiler implementation and
    // artifact-affecting options. After compiler work, expand the first apparently-focused request to a complete
    // compile: otherwise the copied tree mixes fresh and stale contracts while publishArtifactTree refreshes every
    // file timestamp, hiding the mismatch from both humans and later tooling.
    const focused = requestedSources.length > 0 && (!contextChanged || iterationCompile);
    const leaveArtifactContextStale = contextChanged && iterationCompile;
    if (leaveArtifactContextStale && !args.quiet) {
      console.warn(
        'Iteration compile is publishing only the requested sources; run a normal compile before handoff '
        + 'to rebuild the complete artifact tree.',
      );
    }
    const effectiveRequestedSources = focused ? requestedSources : [];
    const formatArtifactModule = (artifact: unknown, jsonFilename: string): string => (
      hre.config.typegen?.jsonArtifactModules
        ? "import { readFileSync } from 'node:fs';\n"
          + `const artifact = JSON.parse(readFileSync(new URL('./${jsonFilename}', import.meta.url), 'utf8'));\n`
          + 'export default artifact;\n'
        : formatArtifact(artifact as any, 'ts')
    );
    if (!fs.existsSync(contractsDir)) throw new Error(`Contracts dir not found: ${contractsDir}`);
    fs.rmSync(outputDir, { recursive: true, force: true });
    if (focused && fs.existsSync(artifactsDir)) copyArtifactTree(artifactsDir, outputDir);
    else fs.mkdirSync(outputDir, { recursive: true });

    const allScashFiles = fs.readdirSync(contractsDir)
      .filter((file) => file.endsWith('.scash'))
      .map((file) => path.join(contractsDir, file));
    const allSolFiles = findSolSources(contractsDir);
    const selectedSources = selectCompileSources(
      [...allScashFiles, ...allSolFiles], effectiveRequestedSources, contractsDir,
    );
    const files = selectedSources.filter((file) => file.endsWith('.scash'));
    const failures: Error[] = [];
    let ok = 0;
    let contracts = 0;
    for (const full of files) {
      const fn = path.basename(full);
      try {
        const source = fs.readFileSync(full, 'utf-8');
        // Hardhat mirror: one artifact JSON per CONTRACT (by contract name), nested under the source file dir.
        // This is what `getContractFactory("Name")` resolves against.
        const map = compileStringMulti(source, compilerOptions);
        const nestDir = path.join(outputDir, contractsBase, fn);
        fs.mkdirSync(nestDir, { recursive: true });
        for (const [name, artifact] of Object.entries(map)) {
          fs.writeFileSync(path.join(nestDir, `${name}.json`), formatArtifact(artifact, 'json'));
          fs.writeFileSync(
            path.join(nestDir, `${name}.artifact.ts`), formatArtifactModule(artifact, `${name}.json`),
          );
          contracts++;
        }
        // Backward-compat flat artifact (the file's primary contract, by file name) for direct `import` usage.
        const primary = compileString(source, compilerOptions);
        fs.writeFileSync(path.join(outputDir, fn.replace('.scash', '.json')), formatArtifact(primary, 'json'));
        fs.writeFileSync(
          path.join(outputDir, fn.replace('.scash', '.artifact.ts')),
          formatArtifactModule(primary, fn.replace('.scash', '.json')),
        );
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
    // Hardhat project. evmCompat is forced on for `.sol`; other solc opts (ecrecover: 'p2pkh', ...) flow
    // through. Each file's import graph yields many contracts; a name is written once (first compile wins).
    const solFiles = selectedSources.filter((file) => file.endsWith('.sol'));
    // Opt-in worker fan-out. Keep the default single-process path: the fan-out trades CPU and memory per worker
    // for wall time, which only pays on a cold build of a project with several expensive roots.
    const compileJobs = args.jobs === undefined ? 1 : Number(args.jobs);
    if (!Number.isInteger(compileJobs) || compileJobs < 1) {
      throw new Error(`The compile --jobs flag expects a positive integer, got "${String(args.jobs)}".`);
    }
    const writtenNames = new Set<string>();
    let solOk = 0;
    let compilerJobs = 0;
    let cacheHits = 0;
    try {
      const result = await compileSolidityProject(
        solFiles,
        { evmCompat: true, ...compilerOptions },
        compileFileMulti,
        artifactCache ? {
          directory: path.join(hre.config.paths.cache, 'solidcash'),
          compilerVersion: compilerCacheIdentity,
        } : undefined,
        compileJobs > 1
          ? { jobs: compileJobs, module: compilerEntry, exportName: 'compileFileMulti' }
          : undefined,
      );
      for (const [name, artifact] of Object.entries(result.artifacts)) {
        writtenNames.add(name);
        fs.writeFileSync(path.join(outputDir, `${name}.json`), formatArtifact(artifact as any, 'json'));
        fs.writeFileSync(
          path.join(outputDir, `${name}.artifact.ts`), formatArtifactModule(artifact, `${name}.json`),
        );
        contracts++;
      }
      // Splitting is needed only for roots whose normal artifact exceeds the consensus script limit. Preserve the
      // project DAG/cache fast path for ordinary contracts rather than independently recompiling every source.
      const shardFailures: string[] = [];
      for (const full of args['skip-split'] ? [] : solFiles) {
        const declarations = solidityDeclarations(full);
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
            evmCompat: true, ...compilerOptions, maxShardBytes,
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

    if (failures.length > 0) {
      // Artifact publication is transactional. A failed project build must not replace the coherent last-known-
      // good artifact set with a partial graph: consumers and type generation cannot distinguish missing output
      // caused by a compile error from a contract that was intentionally removed. The command fails loudly and
      // the temporary output is discarded; a later successful build publishes the complete current graph.
      fs.rmSync(outputDir, { recursive: true, force: true });
      throw new AggregateError(failures, `Compilation failed for ${failures.length} source group(s)`);
    }
    publishArtifactTree(outputDir, artifactsDir);
    fs.mkdirSync(cacheDir, { recursive: true });
    // An iteration build intentionally publishes a mixed-context tree for a shorter local loop. Preserve the old
    // marker so the next ordinary compile cannot mistake it for a complete build with the current compiler.
    if (!leaveArtifactContextStale) fs.writeFileSync(artifactContextFile, artifactContext);
    const typegen = generateTypechainTargets({
      artifactsDir,
      contractsDir,
      cacheDir,
      targets: hre.config.typegen.targets,
    });
    const totalFiles = files.length + solFiles.length;
    if (!args.quiet) console.log(`Compiled ${ok + solOk}/${totalFiles} file(s), ${contracts} contract artifact(s).`);
    return {
      compiled: ok + solOk, total: totalFiles, contracts, compilerJobs, cacheHits, typegen,
      artifactContextStale: leaveArtifactContextStale,
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
  .addFlag('no-compile', 'Skip compilation before running tests')
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

async function runScript(
  scriptValue: unknown, hre: HardhatRuntimeEnvironment, defaults: string[] = [],
): Promise<void> {
  const requested = scriptValue === undefined ? undefined : String(scriptValue);
  const script = requested
    ? path.resolve(requested)
    : defaults.map((candidate) => path.resolve(candidate)).find((candidate) => fs.existsSync(candidate));
  if (!script) {
    throw new Error(`Script not found. Tried: ${defaults.map((candidate) => path.resolve(candidate)).join(', ')}`);
  }
  if (!fs.existsSync(script)) throw new Error(`Script not found: ${script}`);
  (globalThis as any).hre = hre;
  await import(pathToFileURL(script).href);
}

task('run', 'Run a script with the SolidCash HRE available as the `hre` global')
  .addPositionalParam('script', 'Path to the script to run')
  .addFlag('no-compile', 'Skip compilation before running the script')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    if (args['no-compile'] !== true) await hre.run('compile');
    await runScript(args.script, hre);
  });

task('deploy', 'Compile and run the conventional deployment script')
  .addPositionalParam('script', 'Deployment script path (defaults to scripts/deploy.ts or .js)')
  .addFlag('no-compile', 'Skip compilation before running the deployment script')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    if (args['no-compile'] !== true) await hre.run('compile');
    await runScript(args.script, hre, ['scripts/deploy.ts', 'scripts/deploy.js']);
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
