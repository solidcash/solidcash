import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
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

type CompileFile = (file: string, options: Record<string, unknown>) => ArtifactMap;

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
 */
export function compileSolidityProject(
  sourceFiles: string[],
  options: Record<string, unknown>,
  compileFile: CompileFile,
  cache?: ProjectCompileCacheOptions,
): ProjectCompileResult {
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

  for (const source of ordered) {
    if (source.declarations.length > 0 && source.declarations.every((name) => artifacts[name])) continue;
    const jobId = hash(stableStringify({
      compilerVersion: cache?.compilerVersion ?? '',
      options,
      sources: dependencyHashes(source, allSources),
    }));
    const jobFile = cache && path.join(cache.directory, 'jobs', `${jobId}.bin`);
    let compiled: ArtifactMap | undefined;
    if (jobFile && fs.existsSync(jobFile)) {
      try {
        compiled = deserialize(fs.readFileSync(jobFile)) as ArtifactMap;
        cacheHits.push(source.path);
      } catch {
        compiled = undefined;
      }
    }
    if (!compiled) {
      try {
        compiled = compileFile(source.path, options);
      } catch (error: any) {
        throw new Error(`Failed to compile project root ${source.path}: ${error.message}`, { cause: error });
      }
      compiledRoots.push(source.path);
      if (jobFile) writeAtomic(jobFile, serialize(compiled));
    }
    for (const [name, artifact] of Object.entries(compiled)) artifacts[name] ??= artifact;
  }
  if (cache) writeAtomic(path.join(cache.directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { artifacts, compiledRoots, cacheHits };
}
