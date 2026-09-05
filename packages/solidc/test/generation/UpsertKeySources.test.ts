import { describe, expect, it } from 'vitest';
import { compileString, parseCode } from '../../src/compiler.js';
import { findLengthMinusOneKeyCanonical } from '../../src/generation/upsertKeySources.js';

describe('generic upsert fixed-key recovery', () => {
  it('does not inject kernel permutation parameters into a legacy internal helper', () => {
    const artifact = compileString(`contract Registry() {
      mapping(address => bool) flags;
      function update(address[] members) internal {
        for (int i = 0; i < members.length; i = i + 1) {
          this.flags[members[i]] = true;
        }
      }
      function apply(address[] members) public {
        update(members);
        require(true);
      }
    }`, { forceStateful: true, solidityImportCompat: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'apply')?.inputs
      .some((input) => input.name.startsWith('__internal__vmapCounter'))).toBe(false);
  });

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
