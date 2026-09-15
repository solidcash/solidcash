import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { deserialize, serialize } from 'v8';
import type { ArtifactMap } from '@solidcash/utils';

interface ProjectSource {
  path: string;
  imports: string[];
  declarations: string[];
  dependencies: string[];
  hash: string;
}

interface FileCacheEntry {
  mtimeMs: number;
  size: number;
  hash: string;
}

interface CacheManifest {
  version: 1;
  files: Record<string, FileCacheEntry>;
}

export interface ProjectCompileCacheOptions {
  directory: string;
  compilerVersion: string;
}

export interface ProjectCompileResult {
  artifacts: ArtifactMap;
  compiledRoots: string[];
  cacheHits: string[];
}

/** Opt-in worker-thread fan-out for the per-source compiler jobs. */
export interface ProjectCompileParallelism {
  /** Worker threads which may run compiler jobs at once. `1` keeps every job in this process. */
  jobs: number;
  /** Module exporting the worker-loadable equivalent of `compileFile` (for Solidity roots: `solidc`). */
  module: string;
  /** Named export of {@link ProjectCompileParallelism.module} with the `CompileFile` signature. */
  exportName: string;
}

type CompileFile = (file: string, options: Record<string, unknown>) => ArtifactMap;

interface CompilerJob {
  source: ProjectSource;
  /** The file's own stem is one of its declarations, so it always compiles and owns those artifacts. */
  canonical: boolean;
  jobFile: string | undefined;
  /** Cache hit or worker result; `undefined` means this job still needs a compile. */
  compiled: ArtifactMap | undefined;
  cached: boolean;
  /** Compile duration reported by the worker, for the `SOLIDC_PROFILE` file log. */
  workerMs: number | undefined;
}

interface CompileWorkerResult {
  path: string;
  ms?: number;
  payload?: Uint8Array;
  error?: string;
}

interface CompileWorkerMessage {
  results?: CompileWorkerResult[];
  failure?: string;
}

/**
 * Worker body for the parallel path. `eval: true` keeps it independent of how this module was built, so the same
 * code runs from `src/*.ts` under vitest and from `dist/*.js` in a published package; the compiler module is
 * loaded by URL, exactly as the caller resolved it.
 */
const COMPILE_WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const { serialize } = require('node:v8');
import(workerData.compilerModule).then((compiler) => {
  const compileFile = compiler[workerData.exportName];
  if (typeof compileFile !== 'function') {
    parentPort.postMessage({
      failure: workerData.compilerModule + ' has no exported ' + workerData.exportName + '()',
    });
    return;
  }
  const results = workerData.jobs.map((job) => {
    const startedAt = Date.now();
    try {
      return { path: job.path, ms: Date.now() - startedAt, payload: serialize(compileFile(job.path, job.options)) };
    } catch (error) {
      return { path: job.path, error: String((error && error.message) || error) };
    }
  });
  parentPort.postMessage({ results });
}, (error) => {
  parentPort.postMessage({ failure: String((error && error.stack) || error) });
});
`;

/**
 * Pre-pass for the parallel path: which sources would the sequential loop compile?
 *
 * The sequential rule is "skip a non-canonical source whose declarations are already published", and the
 * published set only grows by declarations, so the decision does not depend on compiler output - except for a
 * scanned declaration the compiler never emits (prose inside a string literal, say), where this prediction skips
 * a job the sequential loop would run. That case is a fallback, not a difference: {@link
 * compileSolidityProject} re-evaluates the real rule in order and compiles anything this plan left out.
 */
function planWorkerCompiles(jobs: CompilerJob[]): number[] {
  const provided = new Set<string>();
  const planned: number[] = [];
  for (const [index, job] of jobs.entries()) {
    const skip = !job.canonical && job.source.declarations.length > 0
      && job.source.declarations.every((name) => provided.has(name));
    if (!skip && job.compiled === undefined) planned.push(index);
    for (const name of job.source.declarations) provided.add(name);
  }
  return planned;
}

/** Reject options a worker cannot receive, with a message which names the flag rather than a DataCloneError. */
function assertWorkerTransferableOptions(options: Record<string, unknown>, jobs: number): void {
  try {
    structuredClone(options);
  } catch (error) {
    throw new Error(
      `Compiling with ${jobs} jobs requires compiler options a worker thread can receive: `
      + `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Run `planned` compiler jobs across at most `parallel.jobs` worker threads and attach the results. */
async function runCompileWorkerPool(
  planned: number[],
  jobs: CompilerJob[],
  options: Record<string, unknown>,
  parallel: ProjectCompileParallelism,
): Promise<void> {
  const workerCount = Math.max(1, Math.min(parallel.jobs, planned.length));
  if (process.env.SOLIDC_PROFILE === '1') {
    console.error('[solidc-profile]', JSON.stringify({
      label: 'project-parallel',
      workers: workerCount,
      planned: planned.length,
      jobs: jobs.length,
    }));
  }
  // Round-robin over the ordered list. The list is big-first (roots precede their dependencies), so every worker
  // receives one of the expensive roots before it reaches the shared dependencies.
  const chunks: number[][] = Array.from({ length: workerCount }, () => []);
  planned.forEach((index, position) => chunks[position % workerCount].push(index));

  await Promise.all(chunks.map(async (chunk) => {
    const worker = new Worker(COMPILE_WORKER_SOURCE, {
      eval: true,
      workerData: {
        compilerModule: pathToFileURL(parallel.module).href,
        exportName: parallel.exportName,
        jobs: chunk.map((index) => ({
          path: jobs[index].source.path,
          options: { ...options, compileDeclarations: jobs[index].source.declarations },
        })),
      },
    });
    const message = await new Promise<CompileWorkerMessage>((resolve, reject) => {
      worker.once('message', (value: CompileWorkerMessage) => resolve(value));
      worker.once('error', reject);
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error(`Project compile worker exited with code ${code}`));
      });
    });
    if (message.failure !== undefined) throw new Error(message.failure);
    const indexByPath = new Map(chunk.map((index) => [jobs[index].source.path, index]));
    for (const result of message.results ?? []) {
      const index = indexByPath.get(result.path);
      if (index === undefined) continue;
      if (result.error !== undefined) {
        throw new Error(`Failed to compile project root ${result.path}: ${result.error}`);
      }
      if (result.payload === undefined) {
        throw new Error(`Project compile worker returned no artifacts for ${result.path}`);
      }
      jobs[index].compiled = deserialize(Buffer.from(result.payload)) as ArtifactMap;
      jobs[index].workerMs = result.ms;
    }
  }));
}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableStringify(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Compiler switches which only affect diagnostics must not invalidate bytecode jobs or published artifacts. */
export function artifactCompilerOptions(options: Record<string, unknown>): Record<string, unknown> {
  const affecting = { ...options };
  delete affecting.suppressWarnings;
  return affecting;
}

function loadManifest(directory: string | undefined): CacheManifest {
  if (!directory) return { version: 1, files: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as CacheManifest;
    return parsed.version === 1 ? parsed : { version: 1, files: {} };
  } catch {
    return { version: 1, files: {} };
  }
}

function resolveImport(importPath: string, importer: string): string | undefined {
  const candidatesFor = (base: string): string[] => (
    path.extname(base) ? [base] : [`${base}.scash`, `${base}.sol`]
  );
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return candidatesFor(path.resolve(path.dirname(importer), importPath)).find(fs.existsSync);
  }
  let current = path.dirname(importer);
  while (true) {
    const dependency = candidatesFor(path.join(current, 'node_modules', importPath)).find(fs.existsSync);
    if (dependency) return dependency;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return candidatesFor(path.resolve(path.dirname(importer), importPath)).find(fs.existsSync);
}

function readSource(
  file: string,
  manifest: CacheManifest,
  memo: Map<string, ProjectSource>,
): ProjectSource {
  const absolute = path.resolve(file);
  const existing = memo.get(absolute);
  if (existing) return existing;
  const stat = fs.statSync(absolute);
  // Content is authoritative. mtime+size remain useful diagnostics, but cannot safely suppress hashing: tools
  // such as archive extractors and `cp -p` can change bytes while preserving both metadata fields.
  const source = fs.readFileSync(absolute, 'utf8');
  const sourceHash = hash(source);
  manifest.files[absolute] = { mtimeMs: stat.mtimeMs, size: stat.size, hash: sourceHash };
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const imports = [...code.matchAll(/\bimport\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']\s*;/g)]
    .map((match) => match[1]);
  const declarations = [...code.matchAll(/\b(?:abstract\s+)?(?:contract|interface|library)\s+([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1]);
  const metadata: ProjectSource = {
    path: absolute, imports, declarations, dependencies: [], hash: sourceHash,
  };
  memo.set(absolute, metadata);
  metadata.dependencies = imports
    .map((importPath) => resolveImport(importPath, absolute))
    .filter((dependency): dependency is string => dependency !== undefined)
    .map((dependency) => readSource(dependency, manifest, memo).path);
  return metadata;
}

function dependencyHashes(root: ProjectSource, sources: Map<string, ProjectSource>): string {
  const visited = new Set<string>();
  const entries: string[] = [];
  const visit = (source: ProjectSource): void => {
    if (visited.has(source.path)) return;
    visited.add(source.path);
    entries.push(`${source.path}\0${source.hash}`);
    for (const dependency of source.dependencies) visit(sources.get(dependency)!);
  };
  visit(root);
  return entries.sort().join('\0');
}

function writeAtomic(file: string, contents: string | Uint8Array): void {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, file);
}

/** Compile a Solidity-compatible source set as one Hardhat-style project compilation job.
 *
 * The import DAG selects roots. Persistent job keys include every transitive dependency hash, compiler options,
 * and compiler version. Content hashes are authoritative; mtime+size are recorded only as cache diagnostics.
 * `parallel` is opt-in and only changes where a job runs, never which jobs run or in what order their artifacts
 * are published.
 */
export async function compileSolidityProject(
  sourceFiles: string[],
  options: Record<string, unknown>,
  compileFile: CompileFile,
  cache?: ProjectCompileCacheOptions,
  parallel?: ProjectCompileParallelism,
): Promise<ProjectCompileResult> {
  const manifest = loadManifest(cache?.directory);
  const allSources = new Map<string, ProjectSource>();
  const sources = sourceFiles.map((file) => readSource(file, manifest, allSources));
  const projectPaths = new Set(sources.map((source) => source.path));
  const imported = new Set<string>();
  for (const source of sources) {
    for (const dependency of source.dependencies) if (projectPaths.has(dependency)) imported.add(dependency);
  }

  const roots = sources.filter((source) => !imported.has(source.path));
  const ordered = [...roots, ...sources.filter((source) => imported.has(source.path))];
  const artifacts: ArtifactMap = {};
  const compiledRoots: string[] = [];
  const cacheHits: string[] = [];
  if (cache) fs.mkdirSync(path.join(cache.directory, 'jobs'), { recursive: true });

  const jobs: CompilerJob[] = ordered.map((source) => {
    const stem = path.basename(source.path).replace(/\.(sol|scash)$/i, '');
    const jobId = hash(stableStringify({
      // `artifactCacheVersion` 4 adds `declarations`: the transitive closure alone is ambiguous for two files in
      // an import cycle, which share every member of it. Two such files then shared one job file, so the warm run
      // read whichever payload was written last and silently dropped the other file's artifact.
      artifactCacheVersion: 4,
      compilerVersion: cache?.compilerVersion ?? '',
      options: artifactCompilerOptions(options),
      root: source.path,
      declarations: source.declarations,
      sources: dependencyHashes(source, allSources),
    }));
    return {
      source,
      canonical: source.declarations.includes(stem),
      jobFile: cache && path.join(cache.directory, 'jobs', `${jobId}.bin`),
      compiled: undefined,
      cached: false,
      workerMs: undefined,
    };
  });

  // Resolve persistent hits before dispatching: a hit is a read plus a decode, so paying a worker thread for it
  // would cost more than the compile it replaces.
  for (const job of jobs) {
    if (!job.jobFile || !fs.existsSync(job.jobFile)) continue;
    try {
      job.compiled = deserialize(fs.readFileSync(job.jobFile)) as ArtifactMap;
      job.cached = true;
    } catch {
      job.compiled = undefined;
    }
  }

  const workerCount = parallel ? Math.floor(parallel.jobs) : 1;
  if (parallel && workerCount > 1) {
    assertWorkerTransferableOptions(options, workerCount);
    const planned = planWorkerCompiles(jobs);
    // One job is not worth a worker: thread startup plus a fresh module graph costs more than the compile.
    if (planned.length > 1) await runCompileWorkerPool(planned, jobs, options, parallel);
  }

  for (const job of jobs) {
    const { source } = job;
    // An importing root can fill MarketplaceDataV1 from MarketplaceV3.sol first. The
    // declaring file must still compile so its own bytecode (event pin, delegate bodies)
    // replaces that import copy.
    //
    // This skip is an OUTPUT rule, not an optimisation, so it is evaluated here, in order for every source -
    // including one a worker already compiled - and its decision never consults the parallel plan. A wrong plan
    // can therefore only waste a worker compile, never change the artifact tree.
    if (!job.canonical
      && source.declarations.length > 0 && source.declarations.every((name) => artifacts[name])) continue;
    let compiled = job.compiled;
    let fileMs = job.workerMs;
    if (compiled === undefined) {
      const fileStarted = Date.now();
      try {
        compiled = compileFile(source.path, {
          ...options,
          compileDeclarations: source.declarations,
        });
      } catch (error: any) {
        throw new Error(`Failed to compile project root ${source.path}: ${error.message}`, { cause: error });
      }
      fileMs = Date.now() - fileStarted;
      compiledRoots.push(source.path);
      if (job.jobFile) writeAtomic(job.jobFile, serialize(compiled));
    } else if (job.cached) {
      cacheHits.push(source.path);
    } else {
      compiledRoots.push(source.path);
      if (job.jobFile) writeAtomic(job.jobFile, serialize(compiled));
    }
    if (fileMs !== undefined && process.env.SOLIDC_PROFILE === '1') {
      console.error('[solidc-profile]', JSON.stringify({
        label: 'project-file',
        ms: fileMs,
        file: source.path,
        declarations: source.declarations,
        artifacts: Object.keys(compiled),
      }));
    }
    const ownedDeclarations = new Set(source.declarations);
    for (const [name, artifact] of Object.entries(compiled)) {
      // compileFileMulti returns artifacts for the root and every imported declaration. Only the source that
      // declares a contract owns its published artifact: an importing root can be compiled with a different
      // primary-contract context, and publishing that imported copy makes focused compiles overwrite canonical
      // dependency artifacts. Filtering here also keeps one-file iteration proportional to the selected source.
      if (!ownedDeclarations.has(name)) continue;
      if (artifact.abi?.some((fn) => fn.modifiers?.includes('delegate'))) {
        artifact.delegateProxyStateOutputCountPinned = true;
      }
      artifacts[name] = artifact;
    }
  }
  if (cache) writeAtomic(path.join(cache.directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { artifacts, compiledRoots, cacheHits };
}
