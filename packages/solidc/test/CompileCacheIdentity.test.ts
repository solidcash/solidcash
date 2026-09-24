import { afterEach, describe, expect, it } from 'vitest';
import {
  buildArtifactCacheKey,
  clearCompileCache,
  compileString,
  getCompileCacheEntryCount,
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
});
