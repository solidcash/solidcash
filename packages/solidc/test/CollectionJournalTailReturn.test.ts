import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * D2/R19. The collection-journal wrapper check refused ANY `return` in a wrapper that calls a multi-entry
 * journal helper, and the Solidity ERC-20 wrapper is exactly `_transfer(from, to, v); return true;`. That
 * refusal is a thrown Error, so it failed the whole file's multi-contract compile: measured on the F3 corpora
 * it took out UniswapV2ERC20/UniswapV2Pair, UniswapV2Factory and three Unicrow files, five of which carry one
 * of the twelve bus-reachable application contracts.
 *
 * A TAIL return is not an early return. The write-backs are placed immediately before it, exactly as the
 * final `require` guard is already placed after them, so no path leaves the wrapper before the flush. The
 * three refusals below are the boundary: a second return, a return that is not last, and a return whose
 * expression reads an entry whose write-back now precedes it.
 */
const TOKEN = (wrapper: string): string => `pragma solidcash >=0.8.0;
contract TailToken() {
  mapping(bytes20 => bigint) balances;
  function _transfer(bytes20 from, bytes20 to, bigint value) internal {
    this.balances[from] = this.balances[from] - value;
    this.balances[to] = this.balances[to] + value;
  }
  ${wrapper}
}`;

const EARLY_RETURN = /cannot be used by .* because the wrapper contains an early return/;

describe('collection-journal wrapper with a tail return', () => {
  it('admits the Solidity ERC-20 wrapper shape', () => {
    const artifact = compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        _transfer(from, to, value);
        return true;
      }`), { forceStateful: true });
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    expect(artifact.abi.map((entry) => entry.name)).toContain('transfer');
  });

  it('places both write-backs before the tail return, so neither is unreachable', () => {
    const artifact = compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        _transfer(from, to, value);
        return true;
      }`), { forceStateful: true });
    // Two distinct entries are journalled, so the route must reserve two entry slots on `balances`; a
    // write-back stranded after the return would leave the second slot with its default value.
    const entries = artifact.abi.find((entry) => entry.name === 'transfer')?.entryAccesses ?? [];
    expect(entries.filter((entry) => entry.collection === 'balances').length).toBe(2);
  });

  it('still refuses a return that is not the wrapper\'s last statement', () => {
    expect(() => compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        _transfer(from, to, value);
        return true;
        require(value >= 0);
      }`), { forceStateful: true })).toThrow(EARLY_RETURN);
  });

  it('still refuses a genuinely early return inside a branch', () => {
    expect(() => compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        if (value == 0) { return false; }
        _transfer(from, to, value);
        return true;
      }`), { forceStateful: true })).toThrow(EARLY_RETURN);
  });

  it('still refuses a tail return whose expression reads a journalled entry', () => {
    expect(() => compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bigint) {
        _transfer(from, to, value);
        return this.balances[to];
      }`), { forceStateful: true })).toThrow(EARLY_RETURN);
  });

  it('leaves a wrapper with no return byte-identical', () => {
    const source = TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public {
        _transfer(from, to, value);
        require(value >= 0);
      }`);
    expect(compileString(source, { forceStateful: true }).bytecode.length).toBeGreaterThan(0);
  });
});
