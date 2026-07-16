import { describe, it } from 'vitest';
import { assertStatefulConformant, mappingCase } from './harness.js';

// Mapping element read/write VALUE parity vs solc: `m[k] = v; m[k]` returns `v` on both VMs. The physical m[k]
// slot is sha256 on BCH (behavioral parity, not byte-identical keccak - documented), so this asserts the VALUE
// semantics + encoding roundtrip, not the slot number. Key/value types are limited to those that encode
// identically on both encoders (int/uint/bool/bytesN); address diverges (20-byte EVM vs BCH locking bytecode).

const map = (keyType: string, valueType: string, args: readonly unknown[], label: string): Promise<void> =>
  assertStatefulConformant(mappingCase({ keyType, valueType, args, label }));

describe('mapping element read/write value parity', () => {
  it('uint256 => uint256', () => map('uint256', 'uint256', [7n, 42n], 'uint=>uint'));
  it('uint256 => uint256 (max value)', () => map('uint256', 'uint256', [1n, (1n << 256n) - 1n], 'uint=>uint max'));
  it('uint256 => bool (true)', () => map('uint256', 'bool', [3n, true], 'uint=>bool true'));
  it('uint256 => bool (false)', () => map('uint256', 'bool', [4n, false], 'uint=>bool false'));
  it('uint256 => bytes32', () => map('uint256', 'bytes32', [5n, `0x${'ab'.repeat(32)}`], 'uint=>bytes32'));
  it('uint256 => int256 (negative value)', () => map('uint256', 'int256', [6n, -12345n], 'uint=>int negative'));
  it('int256 => uint256 (signed key)', () => map('int256', 'uint256', [-7n, 88n], 'int key'));
  // (bytes32 keys need a Uint8Array SDK arg while ethers needs a hex string - a shared-arg harness limitation,
  // not a compiler divergence; bytesN VALUES are covered above and int/uint keys exercise the key path.)
});
