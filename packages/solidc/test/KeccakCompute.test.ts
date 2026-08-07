import { describe, it, expect } from 'vitest';
import { KECCAK256_COMPUTE_STATEFUL_COVENANT } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// keccak256 is the compute-and-commit model: each call co-spends its own side-car (slot-per-call) that
// computes ONE hash into its own NFT commitment; the contract reads call i from the i-th of the last N
// side-car outputs. EVERY stateless keccak256 uses it: direct-param args are co-spent from the call args;
// complex/nested args are recorded as `null` (the SDK resolves them via a VM probe). Only STATEFUL contracts
// fall back to inline, pending block-layout-slot compute. These tests pin that selection.

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

  it('nested keccak256(keccak256(x)) uses compute; the complex outer arg is recorded null', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(keccak256(x)) == e); } }');
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParams).toEqual([null, 'x']); // outer complex (probed), inner param
  });

  it('a complex (non-parameter) argument uses compute with a null preimage param (SDK probes it)', () => {
    const a = compileString('contract C { function f(bytes x, bytes32 e) public pure { require(keccak256(bytes(x)[0:1]) == e); } }');
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParams).toEqual([null]);
  });

  it('a STATEFUL contract also uses compute, reading a keccakSideCar block-layout slot', () => {
    const a = compileString(
      'contract C { int n; function f(bytes x, bytes32 e) public { require(keccak256(x) == e); this.n = this.n + 1; } }',
    );
    expect(fn(a).keccakCompute).toBe(true);
    expect(fn(a).keccakPreimageParams).toEqual(['x']);
    // Stateful -> a block layout with a keccakSideCar slot (sibling of blockhashOracle), branded side-car.
    expect(a.abi.find((f: any) => f.name === 'f')?.blockLayout?.slots?.some((s: any) => s.kind === 'keccakSideCar')).toBe(true);
    expect(lib(a).branded).toBe(true);
  });

  it('the descriptor reports minInstances (max call count across functions) for deploy-time provisioning', () => {
    const a = compileString(
      'contract C { function f(bytes a, bytes b) public pure { require(keccak256(a) != keccak256(b)); }'
      + ' function g(bytes x, bytes32 e) public pure { require(keccak256(x) == e); } }',
    );
    expect(lib(a).minInstances).toBe(2); // f has 2 keccak calls, g has 1 -> deploy 2 side-cars
    expect(lib(a).unbounded).toBeFalsy();
  });

  it('keccak256 inside a loop flags the function keccakInLoop and the descriptor unbounded', () => {
    const a = compileString(
      'contract C { function f(bytes x, int n) public pure { bytes32 h = keccak256(x);'
      + ' for (int i = 0; i < n; i++) { h = keccak256(abi.encodePacked(h)); } require(h != 0x00); } }',
    );
    expect(fn(a).keccakInLoop).toBe(true);
    expect(lib(a).unbounded).toBe(true);
    expect(lib(a).minInstances).toBe(2); // static lower bound (1 outside + 1 syntactic in-loop)
  });

  it('a stateless dynamic keccak loop flags keccakLoopReads and compares the covenant (no per-iteration hash)', () => {
    const a = compileString(
      'contract C { function f(bytes32 x, int n, bytes32 t) public pure { bytes32 h = x;'
      + ' for (int i = 0; i < n; i++) { h = keccak256(h); } require(h == t); } }',
    );
    // Dynamic (runtime-bound) loop -> the SDK progressively co-spends N absolute-forward side-cars.
    expect(fn(a).keccakLoopReads).toBe(true);
    expect(a.stateLayout).toBeUndefined(); // stateless (no block layout)
    // The loop embeds the covenant constant and byte-compares it, instead of re-hashing it every iteration
    // (which would blow the per-input hash-density budget at ~5 iters).
    expect(a.bytecode.includes(KECCAK256_COMPUTE_STATEFUL_COVENANT)).toBe(true);
  });
});
