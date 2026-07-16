import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// keccak256 is the compute-and-commit model: each call co-spends its own side-car (slot-per-call) that
// computes ONE hash into its own NFT commitment; the contract reads call i from the i-th of the last N
// side-car outputs. So N direct-param calls are fine (no collision - N distinct side-cars). It applies to
// STATELESS functions whose every keccak256 arg is a direct parameter (so send() can transparently
// co-spend); complex/nested args and stateful contracts fall back to the inline model. These tests pin that.

const fn = (a: any): any => a.abi.find((f: any) => f.name === 'f');
const lib = (a: any): any => a.externalLibraries?.find((l: any) => l.name === 'keccak256');

describe('keccak256 compute-model selection (soundness gate)', () => {
  it('a single keccak256(param) call uses the compute model', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(x) == e); } }');
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParams).toEqual(['x']);
    expect(lib(a).resultNft).toBe(true);
  });

  it('TWO direct-param keccak256 calls use the compute model (slot-per-call, one side-car each)', () => {
    const a = compileString('contract C { function f(bytes a, bytes b) public pure { require(keccak256(a) != keccak256(b)); } }');
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParams).toEqual(['a', 'b']); // per-call params in emission order
    expect(lib(a).resultNft).toBe(true);
  });

  it('nested keccak256(keccak256(x)) is two calls -> inline (not compute)', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(keccak256(x)) == e); } }');
    expect(fn(a).keccakCompute).toBeFalsy();
  });

  it('a complex (non-parameter) argument is not a transparent-co-spend candidate -> inline', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(bytes(x)[0:1]) == e); } }');
    expect(fn(a).keccakCompute).toBeFalsy();
  });
});
