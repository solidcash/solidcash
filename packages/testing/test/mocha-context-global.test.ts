import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * MistSwap MasterChef.test.ts uses Mocha's `context("…", fn)` as a nested-suite alias for `describe`.
 * Without `globals.context` in vitest-setup, collection fails with "ReferenceError: context is not defined".
 * This asserts the SHIPPED setup file installs the alias (and it.skip) rather than re-implementing the wiring.
 */
describe('mocha suite aliases in vitest-setup (shipped source)', () => {
  const setupPath = join(dirname(fileURLToPath(import.meta.url)), '../src/vitest-setup.ts');
  const src = readFileSync(setupPath, 'utf8');

  it('assigns globalThis.context (MasterChef nested suite)', () => {
    expect(src).toMatch(/globals\.context\s*=/);
    expect(src).toMatch(/context === describe|Mocha: context/);
  });

  it('preserves it.skip for RebaseERC20 / ChainlinkOracle it.skip sites (one-level wrap, no stack overflow)', () => {
    expect(src).toMatch(/['"]skip['"]/);
    // wrapCb(nested) binds mocha `this` without runner(it.skip) recursion
    expect(src).toMatch(/wrapCb\(nested/);
    expect(src).toMatch(/Do NOT recurse|one-level only|One-level only/i);
  });
});
