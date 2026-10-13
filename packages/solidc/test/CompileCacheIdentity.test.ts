import { mkdirSync, mkdtempSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildArtifactCacheKey,
  clearCompileCache,
  compileString,
  getCompileCacheEntryCount,
  sourceTreeFingerprint,
} from '../src/compiler.js';

/**
 * SOLIDC env registry: compile-cache / artifact identity audit.
 * Execution-affecting options change the cache key; observation-only cache-dir does not.
 */
describe('SOLIDC env registry compile-cache artifact identity', () => {
  const previousCache = process.env.SOLIDC_COMPILE_CACHE;
  const previousDir = process.env.SOLIDC_COMPILE_CACHE_DIR;

  afterEach(() => {
    clearCompileCache();
    if (previousCache === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
    else process.env.SOLIDC_COMPILE_CACHE = previousCache;
    if (previousDir === undefined) delete process.env.SOLIDC_COMPILE_CACHE_DIR;
    else process.env.SOLIDC_COMPILE_CACHE_DIR = previousDir;
  });

  const src = 'contract CacheIdentityPin() { function f(int x) { require(x == 1); } }';

  it('execution-affecting options change buildArtifactCacheKey', () => {
    const base = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
    const withKernel = buildArtifactCacheKey(
      src,
      { suppressWarnings: true, forceStateful: true, messageBus: true, messageBusKernel: true },
      'CacheIdentityPin',
    );
    const withOwnerAlt = buildArtifactCacheKey(
      src,
      { suppressWarnings: true, ownerAltAnchor: true },
      'CacheIdentityPin',
    );
    expect(withKernel).not.toBe(base);
    expect(withOwnerAlt).not.toBe(base);
    expect(withKernel).not.toBe(withOwnerAlt);
  });

  it('OPT-2 a bytecode-changing debug switch is not reused for a later compile', () => {
    process.env.SOLIDC_COMPILE_CACHE = '1';
    const previousTail = process.env.SOLIDC_ROUTE_ABI_TAIL;
    const previousRow = process.env.SOLIDC_ROW_ASSERT;
    delete process.env.SOLIDC_ROUTE_ABI_TAIL;
    delete process.env.SOLIDC_ROW_ASSERT;
    try {
      clearCompileCache();
      const base = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
      process.env.SOLIDC_ROUTE_ABI_TAIL = '0';
      const withTail = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
      expect(withTail).not.toBe(base);
      compileString(src, { suppressWarnings: true, messageBus: false });
      expect(getCompileCacheEntryCount()).toBe(1);
      process.env.SOLIDC_ROW_ASSERT = '1';
      compileString(src, { suppressWarnings: true, messageBus: false });
      expect(getCompileCacheEntryCount()).toBe(2);
    } finally {
      if (previousTail === undefined) delete process.env.SOLIDC_ROUTE_ABI_TAIL;
      else process.env.SOLIDC_ROUTE_ABI_TAIL = previousTail;
      if (previousRow === undefined) delete process.env.SOLIDC_ROW_ASSERT;
      else process.env.SOLIDC_ROW_ASSERT = previousRow;
    }
  });

  it('SOLIDC_COMPILE_CACHE_DIR is observation-only (does not change cache identity)', () => {
    process.env.SOLIDC_COMPILE_CACHE = '1';
    delete process.env.SOLIDC_COMPILE_CACHE_DIR;
    const keyWithoutDir = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
    process.env.SOLIDC_COMPILE_CACHE_DIR = '/tmp/solidc-cache-identity-audit-a';
    const keyWithDirA = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
    process.env.SOLIDC_COMPILE_CACHE_DIR = '/tmp/solidc-cache-identity-audit-b';
    const keyWithDirB = buildArtifactCacheKey(src, { suppressWarnings: true }, 'CacheIdentityPin');
    expect(keyWithDirA).toBe(keyWithoutDir);
    expect(keyWithDirB).toBe(keyWithoutDir);
  });

  it('distinct execution options create distinct in-process cache entries', () => {
    process.env.SOLIDC_COMPILE_CACHE = '1';
    clearCompileCache();
    compileString(src, { suppressWarnings: true, messageBus: false });
    expect(getCompileCacheEntryCount()).toBe(1);
    compileString(src, {
      suppressWarnings: true, forceStateful: true, messageBus: true, messageBusKernel: true,
    });
    expect(getCompileCacheEntryCount()).toBe(2);
    // Same options hit the same entry.
    compileString(src, { suppressWarnings: true, messageBus: false });
    expect(getCompileCacheEntryCount()).toBe(2);
  });

  it('identifies compiler sources by content, nested files included', () => {
    const root = mkdtempSync(join(tmpdir(), 'solidc-fingerprint-'));
    // An editor saves through a rename, so every write below is a new file at the old path.
    const save = (file: string, text: string): void => {
      writeFileSync(`${file}.new`, text);
      renameSync(`${file}.new`, file);
    };
    try {
      const srcTree = join(root, 'src');
      const emitter = join(srcTree, 'generation', 'emitter.ts');
      mkdirSync(join(srcTree, 'generation'), { recursive: true });
      save(join(srcTree, 'compiler.ts'), 'export const entry = 1;\n');
      save(emitter, 'export const op = 0x69;\n');
      const original = sourceTreeFingerprint([srcTree]);
      // A same-size edit with its mtime put back, which a size-and-mtime identity reads as the previous build.
      const { atime, mtime } = statSync(emitter);
      save(emitter, 'export const op = 0x6a;\n');
      utimesSync(emitter, atime, mtime);
      expect(sourceTreeFingerprint([srcTree])).not.toBe(original);
      // Reverting the edit restores the identity, and with it the entries cached for it.
      save(emitter, 'export const op = 0x69;\n');
      expect(sourceTreeFingerprint([srcTree])).toBe(original);
      // Declarations and source maps are not code a compiler loads.
      save(join(srcTree, 'generation', 'emitter.d.ts'), 'export declare const op: number;\n');
      save(join(srcTree, 'generation', 'emitter.js.map'), '{}\n');
      expect(sourceTreeFingerprint([srcTree])).toBe(original);
      // A file moved from one tree to the next changes the identity, although its path and hash stay in order.
      const distTree = join(root, 'dist');
      mkdirSync(join(distTree, 'generation'), { recursive: true });
      const before = sourceTreeFingerprint([srcTree, distTree]);
      renameSync(emitter, join(distTree, 'generation', 'emitter.ts'));
      expect(sourceTreeFingerprint([srcTree, distTree])).not.toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
