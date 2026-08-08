import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { clearCompileCache, compileString } from '../src/compiler.js';

/**
 * Cross-worker disk cache (SOLIDC_COMPILE_CACHE_DIR): vitest forks do not share the in-process Map.
 * Pins the shipped path — write on miss, read after an empty Map (real disk hit), and
 * re-attach lazy delegateArtifact so a cold worker matches a warm one.
 */
describe('SOLIDC_COMPILE_CACHE_DIR disk layer', () => {
  const previousCache = process.env.SOLIDC_COMPILE_CACHE;
  const previousDir = process.env.SOLIDC_COMPILE_CACHE_DIR;
  let dir: string | undefined;

  afterEach(() => {
    clearCompileCache();
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
});
