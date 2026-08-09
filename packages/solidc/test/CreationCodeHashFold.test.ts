import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * `keccak256(type(C).creationCode)` hashes a blob the compiler already holds, so it folds to a constant.
 *
 * It cannot be computed on chain at realistic sizes: a keccak side-car input funds three 64-byte blocks, and
 * a Uniswap pair's creation code is 12,509 bytes = 92 blocks. MistSwap's `UniswapV2Factory.pairCodeHash()` is
 * exactly this shape, and 56 PairKashi/SushiSwapSwapper tests reach it during setup.
 *
 * Folding has to happen on BOTH sides or the layout desynchronises: `countLibraryCalls` must not count the
 * call (or a `keccakSideCar` slot is reserved that nothing reads, and the SDK co-spends an input for it), and
 * code generation must emit the digest instead of a side-car read.
 */
const SRC = `pragma solidcash >=0.8.0;
  contract Child {
    int n;
    function bump() public { this.n = this.n + 1; }
  }
  contract Parent {
    bytes32 h;
    function pin() public { this.h = keccak256(type(Child).creationCode); }
  }`;

describe('keccak256(type(C).creationCode) folds to a constant', () => {
  it('reserves no side-car slot and publishes no preimage param', () => {
    const artifact = compileString(SRC, { forceStateful: true });
    expect(artifact.contractName).toBe('Parent');
    const fn = artifact.abi.find((f) => f.name === 'pin') as any;
    expect((fn?.blockLayout?.slots ?? [])
      .filter((slot: { kind: string }) => slot.kind === 'keccakSideCar')).toHaveLength(0);
    expect(fn?.keccakPreimageParams).toBeUndefined();
    expect(fn?.externalLibraryCalls?.keccak256).toBeUndefined();
  });

  it('still uses a side-car for a hash of runtime data', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        bytes32 h;
        function pin(bytes x) public { this.h = keccak256(x); }
      }`, { forceStateful: true });
    const fn = artifact.abi.find((f) => f.name === 'pin') as any;
    expect((fn?.blockLayout?.slots ?? [])
      .filter((slot: { kind: string }) => slot.kind === 'keccakSideCar')).toHaveLength(1);
    expect(fn?.keccakPreimageParams).toEqual(['x']);
  });
});
