import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  clearCompileCache, compileFile, compileFileMulti, compileString, getArtifactCacheHitCount,
} from '../src/index.js';

describe('compileFile artifact cache', () => {
  let dir: string | undefined;

  beforeEach(() => {
    clearCompileCache();
  });

  afterEach(() => {
    clearCompileCache();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('hits the in-process cache on a second compileFile of the same source', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-file-cache-'));
    const file = join(dir, 'Cached.scash');
    writeFileSync(file, 'pragma solidcash ^0.14.0;\ncontract Cached() { function f(int x) { require(x == 1); } }\n');
    const first = compileFile(file, { suppressWarnings: true, messageBus: false });
    expect(getArtifactCacheHitCount()).toBe(0);
    const second = compileFile(file, { suppressWarnings: true, messageBus: false });
    expect(first.debug?.bytecode).toBe(second.debug?.bytecode);
    expect(first.debug?.bytecode?.length).toBeGreaterThan(0);
    expect(getArtifactCacheHitCount()).toBeGreaterThan(0);
  });

  it('hits the in-process cache on a second compileFileMulti without re-probing', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-file-multi-cache-'));
    const file = join(dir, 'Cached.scash');
    writeFileSync(file, 'pragma solidcash ^0.14.0;\ncontract Cached() { function f(int x) { require(x == 1); } }\n');
    const options = { suppressWarnings: true, messageBus: false, compileDeclarations: ['Cached'] };
    const first = compileFileMulti(file, options);
    expect(getArtifactCacheHitCount()).toBe(0);
    const second = compileFileMulti(file, options);
    expect(second.Cached.debug?.bytecode).toBe(first.Cached.debug?.bytecode);
    expect(second.Cached.debug?.bytecode?.length).toBeGreaterThan(0);
    expect(getArtifactCacheHitCount()).toBeGreaterThan(0);
  });

  it('allows compileFileMulti callers to explicitly disable the artifact cache', () => {
    dir = mkdtempSync(join(tmpdir(), 'solidc-file-multi-no-cache-'));
    const file = join(dir, 'Uncached.scash');
    writeFileSync(file, 'pragma solidcash ^0.14.0;\ncontract Uncached() { function f(int x) { require(x == 1); } }\n');
    const options = {
      suppressWarnings: true,
      messageBus: false,
      compileDeclarations: ['Uncached'],
      __artifactCache: false,
    } as const;
    const first = compileFileMulti(file, options);
    const second = compileFileMulti(file, options);
    expect(second.Uncached.debug?.bytecode).toBe(first.Uncached.debug?.bytecode);
    expect(getArtifactCacheHitCount()).toBe(0);
  });

  it('keeps compileString uncached unless SOLIDC_COMPILE_CACHE is set', () => {
    const previous = process.env.SOLIDC_COMPILE_CACHE;
    delete process.env.SOLIDC_COMPILE_CACHE;
    try {
      const source = 'pragma solidcash ^0.14.0;\ncontract Uncached() { function f(int x) { require(x == 1); } }\n';
      const first = compileString(source, { suppressWarnings: true, messageBus: false });
      const second = compileString(source, { suppressWarnings: true, messageBus: false });
      expect(first.debug?.bytecode).toBe(second.debug?.bytecode);
      expect(first.debug?.bytecode?.length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
      else process.env.SOLIDC_COMPILE_CACHE = previous;
    }
  });
});
