// Decode length and range checks (audit ARITH-4, ARITH-6): a malformed blob or an out-of-range enum reverts, a
// well-formed one decodes. evmCompat static decodes read the head words as solc does: short reverts, a tail is
// ignored.
import { describe, expect, it } from 'vitest';
import { compileBch, evalBchCheck, evalBchVmRejects } from '../conformance/bch.js';

const word = (v: bigint): string => v.toString(16).padStart(64, '0');
const hex = (s: string): string => `0x${s}`;

const EVM_SRC = `contract D() {
  function pair(bytes data, uint256 a, uint256 b) {
    (uint256 x, uint256 y) = abi.decode(data, (uint256, uint256));
    require(x == a);
    require(y == b);
  }
  function one(bytes data, uint256 a) {
    uint256 x = abi.decode(data, (uint256));
    require(x == a);
  }
}
`;

const NATIVE_SRC = `contract N() {
  enum Status { A, B, C }
  struct S { int a; bytes32 t; }
  function last(bytes data, bytes h) {
    (int a, bytes32 t) = abi.decode(data, (int, bytes32));
    require(a == 5);
    require(bytes(t) == h);
  }
  function field(bytes data, bytes h) {
    S memory s = abi.decode(data, (S));
    require(bytes(s.t) == h);
  }
  function status(bytes data, int v) {
    Status s = abi.decode(data, (Status));
    require(int(uint256(s)) == v);
  }
}
`;

describe('evmCompat abi.decode of static words', () => {
  const artifact = compileBch(EVM_SRC, true);
  it('decodes a well-formed tuple', async () => {
    expect(await evalBchCheck(artifact, 'pair', [hex(word(1n) + word(2n)), 1n, 2n])).toBe(true);
  });
  it('reverts on a short last word', async () => {
    expect(await evalBchVmRejects(artifact, 'pair', [hex(word(1n) + word(2n).slice(2)), 1n, 0n])).toBe(true);
    expect(await evalBchVmRejects(artifact, 'one', [hex(word(7n).slice(2)), 7n])).toBe(true);
  });
  it('ignores bytes after the last word', async () => {
    expect(await evalBchCheck(artifact, 'pair', [hex(word(1n) + word(2n) + '01'.repeat(8)), 1n, 2n])).toBe(true);
    expect(await evalBchCheck(artifact, 'one', [hex(word(7n) + 'ff'), 7n])).toBe(true);
  });
});

describe('native abi.decode last fields and enums', () => {
  const artifact = compileBch(NATIVE_SRC, false);
  const t = 'ab'.repeat(32);
  it('decodes a well-formed bytes32 last field', async () => {
    expect(await evalBchCheck(artifact, 'last', [hex(`5520${t}`), hex(t)])).toBe(true);
    expect(await evalBchCheck(artifact, 'field', [hex(`5520${t}`), hex(t)])).toBe(true);
  });
  it('reverts on a long bytes32 last field', async () => {
    expect(await evalBchVmRejects(artifact, 'last', [hex(`5520${t}cd`), hex(`${t}cd`)])).toBe(true);
    expect(await evalBchVmRejects(artifact, 'field', [hex(`5520${t}cd`), hex(`${t}cd`)])).toBe(true);
  });
  it('reverts on a wrong bytes32 length prefix', async () => {
    expect(await evalBchVmRejects(artifact, 'last', [hex(`5521${t}`), hex(t)])).toBe(true);
  });
  it('decodes an enum member', async () => {
    expect(await evalBchCheck(artifact, 'status', ['0x52', 2n])).toBe(true);
    expect(await evalBchCheck(artifact, 'status', ['0x00', 0n])).toBe(true);
  });
  it('reverts on an out-of-range enum', async () => {
    expect(await evalBchVmRejects(artifact, 'status', ['0x53', 3n])).toBe(true);
    expect(await evalBchVmRejects(artifact, 'status', ['0x0105', 5n])).toBe(true);
  });
});
