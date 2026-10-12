import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { computeErc7201SlotNumber } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// A bound past Number.MAX_SAFE_INTEGER keeps its exact value wherever it becomes a compiled constant.
const pushed = (value: bigint): string => binToHex(bigIntToVmNumber(value));
const compiled = (source: string): string => JSON.stringify(compileString(source, { evmCompat: true }));
const lengthOf = (bound: string): string => compiled(`contract C { uint8[${bound}] a;`
  + ' function f() public view returns (uint256) { return a.length; } }');

const SLOT = computeErc7201SlotNumber('example.main');
const ROUNDED = BigInt(Number(SLOT));

describe('array bounds past 2^53', () => {
  it('folds `.length` of uint8[2**200] to the exact bound', () => {
    expect(lengthOf('2**200')).toContain(pushed(2n ** 200n));
  });

  it('folds `.length` of an erc7201-bounded array to the exact slot number, not its double', () => {
    expect(ROUNDED).not.toBe(SLOT);
    const artifact = lengthOf('erc7201("example.main")');
    expect(artifact).toContain(pushed(SLOT));
    expect(artifact).not.toContain(pushed(ROUNDED));
  });

  it('places the next state variable exactly after an erc7201-bounded array', () => {
    const artifact = compiled('contract C { uint8[erc7201("example.main")] a; uint256 x;'
      + ' function f() public pure returns (uint256) { uint256 s; assembly { s := x.slot } return s; } }');
    expect(artifact).toContain(pushed((SLOT + 31n) / 32n));
  });

  it('keeps a safe-integer bound on its stored length (control)', () => {
    expect(lengthOf('2**53 - 1')).not.toContain(pushed(2n ** 53n - 1n));
  });
});
