import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { StorageLayoutSpecifierError } from '../src/Errors.js';

// Solidity storage-layout specifiers (`contract C layout at <expr>`): a valid one is ignored (state lives in NFT
// commitments), one solc rejects is refused with the solc rule named in the message.

const BODY = '{ function f() public pure returns (uint256) { return 1; } }';
const compile = (source: string): string => compileString(source, { evmCompat: true }).contractName;

const refusal = (source: string): StorageLayoutSpecifierError => {
  try {
    compile(source);
  } catch (error) {
    expect(error).toBeInstanceOf(StorageLayoutSpecifierError);
    return error as StorageLayoutSpecifierError;
  }
  throw new Error('expected the storage layout specifier to be rejected');
};

describe('valid storage layout specifiers stay accepted', () => {
  it('accepts integer literals, literal arithmetic and units', () => {
    expect(compile(`contract C layout at 42 ${BODY}`)).toBe('C');
    expect(compile(`contract C layout at 0x1234_ABCD ${BODY}`)).toBe('C');
    expect(compile(`contract C layout at 2**256 - 1 ${BODY}`)).toBe('C');
    expect(compile(`contract C layout at 12/3 ${BODY}`)).toBe('C');
    expect(compile(`contract C layout at 5 minutes ${BODY}`)).toBe('C');
  });

  it('accepts constant arithmetic and constants initialized from other constants', () => {
    expect(compile(`uint constant X = 42; contract C layout at 0xffff * (50 - X) ${BODY}`)).toBe('C');
    expect(compile(`uint constant X = 42; uint constant Y = X * 2; contract C layout at Y ${BODY}`)).toBe('C');
  });

  it('accepts erc7201 of a string literal or a string constant', () => {
    expect(compile(`contract C layout at erc7201("example.main") ${BODY}`)).toBe('C');
    expect(compile(`string constant NS = "example.main"; contract C layout at erc7201(NS) ${BODY}`)).toBe('C');
  });

  it('accepts a layout next to inheritance from a base without one', () => {
    expect(compile(`contract A {} contract C layout at 42 is A ${BODY}`)).toBe('C');
    expect(compile(`contract A {} contract C is A layout at 7 ${BODY}`)).toBe('C');
  });
});

describe('storage layout specifiers solc rejects', () => {
  it('1139: the base slot must be a compile-time constant expression', () => {
    const error = refusal('contract C layout at block.number {}');
    expect(error.rule).toBe('TypeError 1139');
    expect(error.message).toContain('must be a compile-time constant expression. (solc TypeError 1139)');
    expect(refusal('function f() pure returns (uint256) { return 1; } contract C layout at f() {}').rule)
      .toBe('TypeError 1139');
  });

  it('1763: the base slot must evaluate to an integer', () => {
    const error = refusal('contract C layout at address(0x1234) {}');
    expect(error.rule).toBe('TypeError 1763');
    expect(error.message).toContain("must evaluate to an integer (the type is 'address' instead)");
    expect(refusal('contract C layout at 3/2 {}').rule).toBe('TypeError 1763');
    expect(refusal('bytes32 constant B = "abc"; contract C layout at B {}').message).toContain("'bytes32'");
  });

  it('1505: the base slot must be evaluable by the constant evaluator', () => {
    expect(refusal('contract C layout at uint(42) {}').rule).toBe('TypeError 1505');
    expect(refusal('contract C layout at type(uint).max {}').rule).toBe('TypeError 1505');
    expect(refusal('uint constant N = 100; contract C layout at N / 0 {}').rule).toBe('TypeError 1505');
  });

  it('6753: the base slot must be in the uint256 range', () => {
    expect(refusal('contract C layout at -1 {}').message).toContain('evaluates to -1, which is outside the range');
    expect(refusal('contract C layout at 2**256 {}').message).toContain('evaluates to 2**256');
  });

  it('1481: a signed integer base slot is not convertible to uint256', () => {
    expect(refusal('int constant Y = 64; contract C layout at Y {}').rule).toBe('TypeError 1481');
  });

  it('8894 and 7587: no inheriting a custom layout, no layout on an abstract contract', () => {
    const error = refusal('contract A layout at 1 {} contract B is A {}');
    expect(error.rule).toBe('TypeError 8894');
    expect(error.message).toContain('Cannot inherit from a contract with a custom storage layout');
    expect(refusal('abstract contract C layout at 42 {}').rule).toBe('TypeError 7587');
  });
});
