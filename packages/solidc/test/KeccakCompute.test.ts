import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// The compute-and-commit keccak model (default) uses ONE side-car that computes ONE hash into ONE NFT
// commitment. If a function with TWO keccak256 calls used this model, both calls would read the SAME
// last-output commitment and collide (return the same hash). So the compiler MUST only select the compute
// model for a SINGLE keccak256 call; multi-call keccak stays on the inline model (which computes each hash
// independently on the contract's own budget). These tests pin that gate.

const fn = (a: any): any => a.abi.find((f: any) => f.name === 'f');
const lib = (a: any): any => a.externalLibraries?.find((l: any) => l.name === 'keccak256');

describe('keccak256 compute-model selection (soundness gate)', () => {
  it('a single keccak256(param) call uses the compute model', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(x) == e); } }');
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParam).toBe('x');
    expect(lib(a).resultNft).toBe(true);
  });

  it('TWO keccak256 calls do NOT use the compute model (would collide on one side-car commitment)', () => {
    const a = compileString('contract C { function f(bytes a, bytes b) public pure { require(keccak256(a) != keccak256(b)); } }');
    expect(fn(a).keccakCompute).toBeFalsy();
    expect(lib(a).resultNft).toBeFalsy();
    expect(fn(a).externalLibraryCalls).toEqual({ keccak256: 2 }); // still uses keccak, via the inline model
  });

  it('keccakResultNft:true does NOT force the compute model onto a multi-call function', () => {
    const a = compileString(
      'contract C { function f(bytes a, bytes b) public pure { require(keccak256(a) != keccak256(b)); } }',
      { keccakResultNft: true },
    );
    expect(fn(a).keccakCompute).toBeFalsy();
    expect(lib(a).resultNft).toBeFalsy();
  });

  it('nested keccak256(keccak256(x)) is two calls -> inline (not compute)', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(keccak256(x)) == e); } }');
    expect(fn(a).keccakCompute).toBeFalsy();
  });

  it('a complex (non-parameter) argument is not a transparent-co-spend candidate -> inline', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(bytes(x)[0:1]) == e); } }');
    expect(fn(a).keccakCompute).toBeFalsy();
  });

  it('keccakResultNft:false forces the inline model for a single call', () => {
    const a = compileString(
      'contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(x) == e); } }',
      { keccakResultNft: false },
    );
    expect(fn(a).keccakCompute).toBeFalsy();
    expect(lib(a).resultNft).toBeFalsy();
  });
});
