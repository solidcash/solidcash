import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { compileString } from './direct-compile.js';

/**
 * Cross-worker disk cache (SOLIDC_COMPILE_CACHE_DIR): vitest forks do not share the in-process Map.
 * This pins the shipped path — write on miss, read on a cold Map — not a reimplementation of the cache.
 */
describe('SOLIDC_COMPILE_CACHE_DIR disk layer', () => {
  const previousCache = process.env.SOLIDC_COMPILE_CACHE;
  const previousDir = process.env.SOLIDC_COMPILE_CACHE_DIR;
  let dir: string | undefined;

  afterEach(() => {
    if (previousCache === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
    else process.env.SOLIDC_COMPILE_CACHE = previousCache;
    if (previousDir === undefined) delete process.env.SOLIDC_COMPILE_CACHE_DIR;
    else process.env.SOLIDC_COMPILE_CACHE_DIR = previousDir;
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('writes a cache file on miss and returns the same bytecode on a subsequent hit', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-disk-cache-'));
    process.env.SOLIDC_COMPILE_CACHE = '1';
    process.env.SOLIDC_COMPILE_CACHE_DIR = dir;

    const src = 'contract DiskCachePin() { function f(int x) { require(x == 7); } }';
    const first = compileString(src);
    expect(readdirSync(dir).filter((f) => f.endsWith('.json')).length).toBeGreaterThanOrEqual(1);
    expect(first.bytecode.length).toBeGreaterThan(0);

    // Second call hits in-process Map (still exercises clone path) and must match bytes.
    const second = compileString(src);
    expect(second.bytecode).toBe(first.bytecode);
    expect(second.contractName).toBe('DiskCachePin');
  });
});
