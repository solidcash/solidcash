import { describe, expect, it } from 'vitest';
import { parseCode } from '../../src/compiler.js';
import { findLengthMinusOneKeyCanonical } from '../../src/generation/upsertKeySources.js';

describe('generic upsert fixed-key recovery', () => {
  it('refuses to guess between unrelated state-array tail expressions', () => {
    const ast = parseCode(`contract Registry() {
      int[] primary;
      int[] secondary;
      function inspect() public view returns (int) {
        int left = this.primary.length - 1;
        int right = this.secondary.length - 1;
        return left + right;
      }
    }`);
    const astFunction = ast.contract.functions.find((candidate) => candidate.name === 'inspect');
    expect(astFunction).toBeDefined();
    expect(findLengthMinusOneKeyCanonical(
      astFunction!.body,
      new Set(['primary', 'secondary']),
    )).toBeUndefined();
  });

  it('retains one unambiguous state-array tail expression with neutral names', () => {
    const ast = parseCode(`contract Ledger() {
      int[] records;
      function inspect() public view returns (int) {
        int ordinal = this.records.length - 1;
        return ordinal;
      }
    }`);
    const astFunction = ast.contract.functions.find((candidate) => candidate.name === 'inspect');
    expect(findLengthMinusOneKeyCanonical(astFunction!.body, new Set(['records'])))
      .toBe('binop:-(unop:.length(state:records),lit:1)');
  });
});
