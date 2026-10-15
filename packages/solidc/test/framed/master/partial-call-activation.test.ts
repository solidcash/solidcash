import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

const SOURCE = `pragma solidity ^0.8.20;
  interface ISink { function take(uint256 value) external returns (bool); }
  contract Guarded {
    uint256 amount;
    function nested(address target, uint256 next) public {
      if (amount != next) {
        if (next > amount) { require(ISink(target).take(next - amount)); }
        else if (block.number >= 100) { require(ISink(target).take(amount - next)); }
      }
    }
    function conjunction(address target, uint256 next) public {
      if (next > amount && block.number >= 100) { require(ISink(target).take(next - amount)); }
    }
    function disjunction(address target, uint256 next) public {
      if (next > amount || block.number >= 100) { require(ISink(target).take(next)); }
    }
  }
`;

describe('partially publishable framed call activation', () => {
  it('retains necessary known conjuncts without treating disjuncts as necessary', () => {
    const artifact = compileString(SOURCE, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    const calls = (entry: string): NonNullable<typeof artifact.abi[number]['externalCalls']> =>
      artifact.abi.find((row) => row.name === entry)!.externalCalls!;
    expect(calls('nested')[1].condition).toMatchObject({
      kind: 'binary', operator: '&&',
      left: { kind: 'binary', operator: '!=' },
      right: { kind: 'unary', operator: '!', expression: { kind: 'binary', operator: '>' } },
    });
    expect(calls('conjunction')[0].condition).toMatchObject({ kind: 'binary', operator: '>' });
    // A false known operand cannot rule out an OR whose block operand is true at execution.
    expect(calls('disjunction')[0].condition).toBeUndefined();
  });
});
