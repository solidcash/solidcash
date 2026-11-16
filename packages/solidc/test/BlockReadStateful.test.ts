/**
 * A blockhash(n) read makes a contract stateful. A block.* read does not: it slices a coin of the oracle pool the
 * contract binds, so a reader with nothing else stateful stays a plain contract.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.51.0;';

describe('which block reads make a contract stateful', () => {
  it('a blockhash read does', () => {
    const source = `${P} contract B { function f(int n, bytes32 h) { require(blockhash(n) == h); } }`;
    expect(compileString(source).stateLayout).toBeDefined();
  });

  it.each([
    ['block.timestamp', 'function f(int t) { require(block.timestamp == t); }'],
    ['block.number', 'function f(int n) { require(block.number == n); }'],
    ['block.chainid', 'function f(uint256 c) { require(block.chainid == c); }'],
    ['block.gaslimit', 'function f(int g) { require(block.gaslimit == g); }'],
    ['block.prevrandao', 'function f(uint256 r) { require(block.prevrandao != r); }'],
  ])('%s does not', (_label, body) => {
    expect(compileString(`${P} contract B { ${body} }`).stateLayout).toBeUndefined();
  });

  it('and a contract that reads none stays stateless', () => {
    expect(compileString(`${P} contract B { function f(int x) { require(x > 0); } }`).stateLayout).toBeUndefined();
  });
});
