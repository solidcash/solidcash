/**
 * Any block.* or blockhash read makes a contract stateful, whatever oracle pool it binds.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.50.0;';

describe('any block.* or blockhash read makes a contract stateful', () => {
  it.each([
    ['block.timestamp', 'function f(int t) { require(block.timestamp == t); }'],
    ['block.chainid', 'function f(uint256 c) { require(block.chainid == c); }'],
    ['block.gaslimit', 'function f(int g) { require(block.gaslimit == g); }'],
    ['block.prevrandao', 'function f(uint256 r) { require(block.prevrandao != r); }'],
    ['blockhash', 'function f(int n, bytes32 h) { require(blockhash(n) == h); }'],
  ])('%s', (_label, body) => {
    expect(compileString(`${P} contract B { ${body} }`).stateLayout).toBeDefined();
  });

  it('and a contract that reads none stays stateless', () => {
    expect(compileString(`${P} contract B { function f(int x) { require(x > 0); } }`).stateLayout).toBeUndefined();
  });
});
