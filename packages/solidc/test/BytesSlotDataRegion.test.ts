import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// The keccak-data-region write idiom `sstore(keccak256(0, b.slot), w)` must route into the high-level `bytes b`
// (after a long-marker resize), NOT into the anonymous __evm_storage virtual mapping. A bytes32-typed value
// exposes the routing: if the write fell through to __evm_storage, the bytes32 value would fail the mapping's
// uint256 value type.
describe('keccak data-region write routes to the high-level bytes state', () => {
  it('compiles a long-resize + keccak data-region write with a bytes32 value', () => {
    expect(compileString('contract C { bytes b; function f(bytes32 w) public { assembly {'
      + ' sstore(b.slot, 65) mstore(0, b.slot) sstore(keccak256(0, 32), w) } } }', {
      evmCompat: true,
    }).contractName).toBe('C');
  });

  it('keeps a runtime slot value and an invalid short marker fail-closed', () => {
    // A runtime X cannot be decoded at compile time, and an even low byte >= 64 would claim length >= 32 in the
    // short-inline form; both must refuse rather than silently writing __evm_storage or a wrong length.
    expect(() => compileString('contract C { bytes b; function f(uint x) public {'
      + ' assembly { sstore(b.slot, x) } require(true); } }', { evmCompat: true })).toThrow(/inline assembly/i);
    expect(() => compileString('contract C { bytes b; function f() public {'
      + ' assembly { sstore(b.slot, 64) } require(true); } }', { evmCompat: true })).toThrow(/inline assembly/i);
  });

  it('keeps a non-canonical long marker (odd low byte, length < 32) fail-closed', () => {
    // 2*len+1 with len < 32 claims a long string for a length that must be short-inline encoded. Accepting it
    // would store a short value the next sload re-encodes as an even marker (write 63, read 62), a silent
    // miscompile of the raw slot round-trip. Canonical long markers (len >= 32, e.g. 65) remain accepted.
    expect(() => compileString('contract C { bytes b; function f() public {'
      + ' assembly { sstore(b.slot, 63) } require(true); } }', { evmCompat: true })).toThrow(/inline assembly/i);
    expect(() => compileString('contract C { bytes b; function f() public {'
      + ' assembly { sstore(b.slot, 1) } require(true); } }', { evmCompat: true })).toThrow(/inline assembly/i);
  });
});
