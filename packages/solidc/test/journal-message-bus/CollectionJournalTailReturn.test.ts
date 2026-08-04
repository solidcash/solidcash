import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

/**
 * D2/R19. The collection-journal wrapper check refused ANY `return` in a wrapper that calls a multi-entry
 * journal helper, and the Solidity ERC-20 wrapper is exactly `_transfer(from, to, v); return true;`. That
 * refusal is a thrown Error, so it failed the whole file's multi-contract compile: measured on the F3 corpora
 * it took out UniswapV2ERC20/UniswapV2Pair, UniswapV2Factory and three Unicrow files, five of which carry one
 * of the twelve bus-reachable application contracts.
 *
 * A TAIL return is not an early return. The write-backs are placed immediately before it, exactly as the
 * final `require` guard is already placed after them, so no path leaves the wrapper before the flush. The
 * lowering now applies the same rule to every earlier or nested return: it wraps that exit with cloned
 * write-backs, while a return expression continues to read the pending journal value.
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

  it('flushes before a return that is not the wrapper\'s last statement', () => {
    const artifact = compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        _transfer(from, to, value);
        return true;
        require(value >= 0);
      }`), { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'transfer')?.entryAccesses).toHaveLength(2);
  });

  it('flushes every journalled entry before a genuinely early branch return', () => {
    const artifact = compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bool) {
        if (value == 0) { return false; }
        _transfer(from, to, value);
        return true;
      }`), { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'transfer')?.entryAccesses).toHaveLength(2);
  });

  it('keeps a journal read available to a tail return expression', () => {
    const artifact = compileString(TOKEN(`
      function transfer(bytes20 from, bytes20 to, bigint value) public returns (bigint) {
        _transfer(from, to, value);
        return this.balances[to];
      }`), { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'transfer')?.entryAccesses).toHaveLength(2);
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
