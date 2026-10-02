import { describe, expect, it, vi } from 'vitest';
import { compileStringMulti, compileStringSplit } from '../src/index.js';

/**
 * A compile is a function of its own source and options only: two contracts compiled in either order produce the
 * same artifacts. These two generate the same detached message-bus verifier source, and one compiles in Solidity-
 * compat mode, whose casts reverse byte order; a verifier memo keyed without that option handed the program built
 * under one setting to the other contract's compile.
 */
const COMPAT = `
  interface IA { function echo(bytes b) external returns (bytes); }
  contract A { bigint d; function echo(bytes b) public returns (bytes) { return b; } }
  contract B { bytes last; function use(address a, bytes b) public { this.last = IA(a).echo(b); } }`;
const SPLIT = `
contract SplitCounter() {
    int x;
    int y;
    function setX(int value) { this.x = value; require(value >= 0); }
    function addX(int value) { this.x = this.x + value; require(value >= 0); }
    function setXReturning(int value) returns (int) { this.x = value; require(value >= 0); return value; }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}`;

const json = (value: unknown): string => JSON.stringify(value, (key, item: unknown) => (
  key === 'updatedAt' ? undefined : typeof item === 'bigint' ? `${item}n` : item));

describe('compile order independence', () => {
  it('gives each artifact the same bytes whichever contract compiled first', async () => {
    const splitFirst = json(compileStringSplit(SPLIT, { forceSplit: true, suppressWarnings: true }));
    const compatAfter = json(compileStringMulti(COMPAT, { solidityImportCompat: true, suppressWarnings: true }));
    // The other order needs a compiler with no module state from the compiles above.
    vi.resetModules();
    const fresh = await import('../src/index.js');
    const compatFirst = json(fresh.compileStringMulti(COMPAT, { solidityImportCompat: true, suppressWarnings: true }));
    const splitAfter = json(fresh.compileStringSplit(SPLIT, { forceSplit: true, suppressWarnings: true }));
    expect(splitAfter).toBe(splitFirst);
    expect(compatAfter).toBe(compatFirst);
  }, 300_000);
});
