import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync, readdirSync, existsSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  clearCompileCache, compileString, getArtifactCacheHitCount, getCompileCacheEntryCount, pruneCompileCacheDir,
} from '../src/compiler.js';

/**
 * Cross-worker disk cache (SOLIDC_COMPILE_CACHE_DIR): vitest forks do not share the in-process Map.
 * Pins the shipped path — write on miss, read after an empty Map (real disk hit), and
 * re-attach lazy delegateArtifact so a cold worker matches a warm one.
 */
describe('SOLIDC_COMPILE_CACHE_DIR disk layer', () => {
  const previousCache = process.env.SOLIDC_COMPILE_CACHE;
  const previousDir = process.env.SOLIDC_COMPILE_CACHE_DIR;
  const previousMaxEntries = process.env.SOLIDC_COMPILE_CACHE_MAX_ENTRIES;
  let dir: string | undefined;

  afterEach(() => {
    clearCompileCache();
    if (previousCache === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
    else process.env.SOLIDC_COMPILE_CACHE = previousCache;
    if (previousDir === undefined) delete process.env.SOLIDC_COMPILE_CACHE_DIR;
    else process.env.SOLIDC_COMPILE_CACHE_DIR = previousDir;
    if (previousMaxEntries === undefined) delete process.env.SOLIDC_COMPILE_CACHE_MAX_ENTRIES;
    else process.env.SOLIDC_COMPILE_CACHE_MAX_ENTRIES = previousMaxEntries;
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('bounds historical source variants in long-running watch processes', () => {
    process.env.SOLIDC_COMPILE_CACHE = '1';
    process.env.SOLIDC_COMPILE_CACHE_MAX_ENTRIES = '2';
    for (const name of ['First', 'Second', 'Third']) {
      compileString(`contract ${name} { function f() { require(true); } }`, { messageBus: false });
    }
    expect(getCompileCacheEntryCount()).toBe(2);
  });

  it('writes a cache file on miss and returns the same bytecode on a subsequent hit', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-disk-cache-'));
    process.env.SOLIDC_COMPILE_CACHE = '1';
    process.env.SOLIDC_COMPILE_CACHE_DIR = dir;

    const src = 'contract DiskCachePin() { function f(int x) { require(x == 7); } }';
    const first = compileString(src);
    expect(readdirSync(dir).filter((f) => f.endsWith('.json')).length).toBeGreaterThanOrEqual(1);
    expect(first.bytecode.length).toBeGreaterThan(0);

    // Second call hits in-process Map (clone path) and must match bytes.
    const second = compileString(src);
    expect(second.bytecode).toBe(first.bytecode);
    expect(second.contractName).toBe('DiskCachePin');
  });

  it('cold Map loads from disk and re-attaches lazy delegateArtifact with bytecode parity', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-disk-delegate-'));
    process.env.SOLIDC_COMPILE_CACHE = '1';
    process.env.SOLIDC_COMPILE_CACHE_DIR = dir;

    // Stateful + public state write → eligible for proxy/delegate variant.
    const src = `contract DiskDelegatePin() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; require(true); }
    }`;

    const warm = compileString(src);
    const warmDesc = Object.getOwnPropertyDescriptor(warm, 'delegateArtifact');
    expect(warmDesc?.get).toBeTypeOf('function');
    const warmDelegate = warm.delegateArtifact;
    expect(warmDelegate).toBeDefined();
    expect(warmDelegate!.bytecode.length).toBeGreaterThan(0);
    expect(readdirSync(dir).filter((f) => f.endsWith('.json')).length).toBeGreaterThanOrEqual(1);

    // Empty the process Map — next compileString must take the disk path (as a new vitest worker would).
    clearCompileCache();
    const cold = compileString(src);
    const coldDesc = Object.getOwnPropertyDescriptor(cold, 'delegateArtifact');
    expect(coldDesc?.get).toBeTypeOf('function');
    expect(cold.bytecode).toBe(warm.bytecode);
    expect(cold.contractName).toBe(warm.contractName);
    const coldDelegate = cold.delegateArtifact;
    expect(coldDelegate).toBeDefined();
    expect(coldDelegate!.bytecode).toBe(warmDelegate!.bytecode);
  });

  it('marks an entry used when a cold worker reads it from disk, and leaves no temp file', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-disk-touch-'));
    process.env.SOLIDC_COMPILE_CACHE = '1';
    process.env.SOLIDC_COMPILE_CACHE_DIR = dir;
    const src = 'contract DiskTouchPin() { function f(int x) { require(x == 5); } }';
    const first = compileString(src);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    const entry = join(dir, files[0]!);
    const lastUse = new Date(Date.now() - 86_400_000);
    utimesSync(entry, lastUse, lastUse);
    clearCompileCache();
    expect(compileString(src).bytecode).toBe(first.bytecode);
    expect(getArtifactCacheHitCount()).toBe(1);
    expect(statSync(entry).mtimeMs).toBeGreaterThan(lastUse.getTime() + 3_600_000);
  });

  it('prunes the least recently used entries past its budget, and only files it names', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-disk-prune-'));
    const name = (n: number): string => `${createHash('sha256').update(`entry ${n}`).digest('hex')}.json`;
    const age = (file: string, hours: number): void => {
      const when = new Date(Date.now() - hours * 3_600_000);
      utimesSync(join(dir!, file), when, when);
    };
    for (let n = 0; n < 4; n += 1) {
      writeFileSync(join(dir, name(n)), Buffer.alloc(100, `entry ${n} `));
      age(name(n), 4 - n);
    }
    const staleTemp = `${name(4)}.4242.0a1b2c3d4e5f.tmp`;
    const liveTemp = `${name(5)}.4242.5f4e3d2c1b0a.tmp`;
    writeFileSync(join(dir, staleTemp), 'partial');
    age(staleTemp, 2);
    writeFileSync(join(dir, liveTemp), 'partial');
    writeFileSync(join(dir, 'artifact-context'), 'kept');
    writeFileSync(join(dir, 'notes.json'), 'kept');
    age('notes.json', 48);
    // 400 bytes of entries over a 350-byte budget: the least recently used go until three quarters of it (262) holds.
    pruneCompileCacheDir(dir, 350);
    const kept = [name(2), name(3), liveTemp, 'artifact-context', 'notes.json'].sort();
    expect(readdirSync(dir).sort()).toStrictEqual(kept);
    pruneCompileCacheDir(dir, 350);
    expect(readdirSync(dir).sort()).toStrictEqual(kept);
  });
});
