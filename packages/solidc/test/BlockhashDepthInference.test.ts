import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * The ring depth a blockhash reader needs, inferred from its reads and published as `artifact.blockhashDepth`.
 *
 * `blockhash(block.number - K)` with K a compile-time constant needs the last K blocks, `blockhash(block.number)` one;
 * any other argument leaves the depth to the deployer. The artifact carries the most over bounded reads, and a read
 * further back than a ring holds is refused at compile time.
 */

const P = 'pragma solidcash ^0.14.0;';
const read = (name: string, argument: string, extra = ''): string =>
  `function ${name}(${extra}bytes32 h) { require(blockhash(${argument}) == h); }`;
const depthOf = (...members: string[]): number | undefined =>
  compileString(`${P} contract R { ${members.join(' ')} }`, { messageBus: false }).blockhashDepth;

describe('blockhash ring depth inference', () => {
  it('needs K blocks for block.number - K', () => {
    expect(depthOf(read('f', 'block.number - 1'))).toBe(1);
    expect(depthOf(read('f', 'block.number - 5'))).toBe(5);
  });

  it('leaves an argument it cannot bound to the deployer', () => {
    expect(depthOf(read('f', 'n', 'int n, '))).toBeUndefined();
  });

  it('takes the most over the reads', () => {
    expect(depthOf(read('f', 'block.number - 1'), read('g', 'block.number - 12'))).toBe(12);
    expect(depthOf('int constant BACK = 7;', read('f', 'block.number - BACK'), read('g', 'block.number - 3')))
      .toBe(7);
    expect(depthOf(read('f', 'block.number - 5'), read('g', 'n', 'int n, '))).toBeUndefined();
  });

  it('refuses a read further back than a ring holds', () => {
    expect(() => depthOf(read('f', 'block.number - 300'))).toThrow(/BlockhashDepthError|at most 256/);
  });

  it('publishes no depth for a contract that reads no blockhash', () => {
    expect(depthOf('function f(int x) { require(x > 0); }')).toBeUndefined();
  });
});
