import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import type { Artifact } from '@solidcash/utils';

/**
 * Side-car slot reservation must count THIS function's library calls, not another contract's.
 *
 * `computeBlockLayout` reserves one `keccakSideCar` slot per counted keccak256 call, and every later slot
 * (entries, event, returnEvent, deploy) is positioned after them. Code generation records one
 * `keccakPreimageParams` entry per EMITTED call, and the SDK co-spends one side-car per that entry. So an
 * over-count does not merely waste a slot: it shifts every following slot's absolute offset away from where
 * the SDK builds it, and the covenant reads the wrong input.
 *
 * `countLibraryCalls` walked resolved back-edges that leave the function body, so a `new Child()` in the body
 * pulled in every keccak256 call site in Child. Measured on MistSwap: `UniswapV2Factory.createPair` (one
 * keccak256) reserved EIGHT slots - its own, plus all seven in UniswapV2Pair/UniswapV2ERC20 - and 45 functions
 * across that corpus were over-reserved this way.
 *
 * Only the cross-CONTRACT edge is skipped. The sibling walkers (`countEcrecoverCalls`, `keccakCallInLoop`, ...)
 * skip a wider set, and that is NOT the right precedent here: an internal helper is inlined into its caller, so
 * following `resolvedFunction` is load-bearing. The last test in the first block pins that direction.
 */

const sideCarSlots = (artifact: Artifact, fn: string): number =>
  ((artifact.abi.find((f) => f.name === fn) as any)?.blockLayout?.slots ?? [])
    .filter((slot: { kind: string }) => slot.kind === 'keccakSideCar').length;

const preimageParams = (artifact: Artifact, fn: string): number =>
  ((artifact.abi.find((f) => f.name === fn) as any)?.keccakPreimageParams ?? []).length;

const keccakCalls = (artifact: Artifact, fn: string): number | undefined =>
  (artifact.abi.find((f) => f.name === fn) as any)?.externalLibraryCalls?.keccak256;

describe('keccak256 side-car slots count only the function that emits them', () => {
  /** Child carries three keccak256 calls; the deploying parent emits exactly one of its own. */
  const DEPLOYS_A_CHILD_WITH_KECCAK = `
    contract Child {
      bytes32 a;
      bytes32 b;
      bytes32 c;
      function h(bytes x) public { this.a = keccak256(x); this.b = keccak256(x); this.c = keccak256(x); }
    }
    contract Parent {
      bytes32 s;
      function f(bytes x) public {
        this.s = keccak256(x);
        Child c = new Child();
      }
    }`;

  it('a deployed child\'s keccak256 calls do not reserve slots in the deploying function', () => {
    const artifact = compileString(DEPLOYS_A_CHILD_WITH_KECCAK);
    expect(artifact.contractName).toBe('Parent');
    // Pre-fix this was 4: Parent's own call plus all three of Child's, reached via `referencedContract`.
    expect(keccakCalls(artifact, 'f')).toBe(1);
    expect(sideCarSlots(artifact, 'f')).toBe(1);
  });

  it('reserved slots equal emitted preimage params, so later block slots keep their offsets', () => {
    const artifact = compileString(DEPLOYS_A_CHILD_WITH_KECCAK);
    // The invariant the SDK depends on: it co-spends one side-car per preimage param and positions every
    // following slot at its layout offset. Any inequality here desynchronises the two.
    expect(sideCarSlots(artifact, 'f')).toBe(preimageParams(artifact, 'f'));
  });

  /**
   * The other direction, and the reason only the cross-CONTRACT edge is skipped: an internal helper is inlined
   * into its caller, so its keccak256 really does run in the caller's block. Skipping `resolvedFunction` here
   * (as the sibling walkers do) loses the entry point's slot, `keccakCompute` and `keccakPreimageParams`
   * outright, and the covenant then reads a side-car nobody reserved.
   */
  it('a private helper\'s keccak256 still reserves a slot in the calling entry point', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        bytes32 h;
        address owner;
        function calc(bytes x) private view returns (bytes32) { return keccak256(x); }
        constructor(bytes x) { owner = msg.sender; this.h = calc(x); }
        function get() public view returns (bytes32) { return this.h; }
      }`, { forceStateful: true });
    expect(keccakCalls(artifact, '__construct')).toBe(1);
    expect(sideCarSlots(artifact, '__construct')).toBe(1);
  });

  it('a function that emits three calls reserves one batched slot and publishes all preimages', () => {
    const artifact = compileString(`
      contract Child {
        bytes32 a;
        bytes32 b;
        bytes32 c;
        function h(bytes x) public { this.a = keccak256(x); this.b = keccak256(x); this.c = keccak256(x); }
      }`);
    expect(artifact.contractName).toBe('Child');
    expect(sideCarSlots(artifact, 'h')).toBe(1);
    expect(preimageParams(artifact, 'h')).toBe(3);
  });
});

/**
 * The published preimage list remains one entry per call; the SDK groups those entries three per physical slot.
 *
 * A keccak-containing helper is now INLINED into its callers (InlineReturningStateHelpers), so the call is
 * emitted under the caller's own traversal and its param is attributed there by name. The padding in
 * `Artifact.ts` remains the backstop for any shape that still emits under a different traversal.
 */
describe('keccakPreimageParams retains every call across batched side-car slots', () => {
  const HELPER_KECCAK = `pragma solidcash >=0.8.0;
    contract C() {
      bytes32 h;
      address owner;
      function calc(bytes x) private view returns (bytes32) { return keccak256(x); }
      constructor(bytes x) { owner = msg.sender; this.h = calc(x); }
      function get() public view returns (bytes32) { return this.h; }
    }`;

  it('attributes a private helper\'s call to the calling entry point by name', () => {
    const artifact = compileString(HELPER_KECCAK, { forceStateful: true });
    const ctor = artifact.abi.find((f) => f.name === '__construct') as any;
    expect(sideCarSlots(artifact, '__construct')).toBe(1);
    // Pre-fix this was undefined, so the SDK co-spent zero side-cars for a covenant that reads one. Now the
    // helper inlines, so the constructor emits the call itself and names the parameter it hashed.
    expect(ctor?.keccakPreimageParams).toEqual(['x']);
  });

  it('leaves a directly emitted call\'s param name intact', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        bytes32 h;
        constructor(bytes x) { this.h = keccak256(x); }
        function get() public view returns (bytes32) { return this.h; }
      }`, { forceStateful: true });
    const ctor = artifact.abi.find((f) => f.name === '__construct') as any;
    expect(ctor?.keccakPreimageParams).toEqual(['x']);
  });
});
