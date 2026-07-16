import { describe, it } from 'vitest';
import { assertSlotConformant, slotLayoutCase } from './harness.js';

// Differential slot-id parity: SolidCash must assign the SAME EVM storage slot as solc (0.8.36) for the storage
// SYSTEM. solc computes the slot (EVM ground truth, /Code/solidity StorageOffsets::computeOffsets); the SolidCash
// covenant asserts its own assembly `.slot` equals it.
//
// SCOPE (per design): we match the EVM storage SYSTEM - the slot ADDRESSING model - not the internal way array
// ELEMENTS are stored. A mapping and a dynamic array each occupy exactly ONE slot (the anchor / length header),
// which is a fixed system property, so a var declared after them is at a hard-parity slot. A FIXED array's or a
// STRUCT's multi-slot element footprint (and hence the slot of whatever follows it) is an ALLOWABLE DIVERGENCE:
// SolidCash may pack elements more densely into the 128-byte NFT commitment than EVM's 32-byte slots. So those
// element-packing / following-var cases are intentionally NOT asserted here (see docs/evm-storage-parity.md).

const slot = (decls: string, slotExpr: string, label: string): Promise<void> =>
  assertSlotConformant(slotLayoutCase({ decls, slotExpr, label }));

describe('EVM slot-id parity (1) linear slots of data <= 32 bytes', () => {
  it('sequential full-word vars', () => slot('uint256 a; uint256 b; uint256 c;', 'c.slot', 'uint256 c @ 2'));
  it('bytes32 then words each take their own slot',
    () => slot('bytes32 a; uint256 b; uint256 c;', 'c.slot', 'bytes32 then words'));
});

describe('EVM slot-id parity (2) packed sub-word data (bools, uintN)', () => {
  it('two uint128 pack into one slot', () => slot('uint128 a; uint128 b; uint256 c;', 'c.slot', 'uint128x2 @ slot0'));
  it('bool + uint32 + uint64 pack, next word in slot 1',
    () => slot('bool a; uint32 b; uint64 d; uint256 c;', 'c.slot', 'bool+uint32+uint64 pack'));
  it('address + uint96 pack into one slot (the OZ pattern)',
    () => slot('address a; uint96 b; uint256 c;', 'c.slot', 'address+uint96 @ slot0'));
  it('a value that would overflow the current slot moves to the next',
    () => slot('uint128 a; uint128 b; uint128 x; uint256 c;', 'c.slot', 'uint128x3 then word'));
  it('small uints pack tightly (uint8+uint8+uint16, next word @ 1)',
    () => slot('uint8 a; uint8 b; uint16 d; uint256 c;', 'c.slot', 'uint8+uint8+uint16 pack'));
});

describe('EVM slot-id parity (2b) other value types (signed ints, enum, bytesN)', () => {
  it('int128 packs like uint128 (same storageBytes)',
    () => slot('int128 a; int128 b; uint256 c;', 'c.slot', 'int128x2 @ slot0'));
  it('int256 takes a full slot each', () => slot('int256 a; int256 b; uint256 c;', 'c.slot', 'int256x2'));
  it('bytes4 + bytes28 fill one slot (4+28=32), next word @ 1',
    () => slot('bytes4 a; bytes28 b; uint256 c;', 'c.slot', 'bytes4+bytes28 fill'));
  it('bytes1 + bytes31 fill one slot, next word @ 1',
    () => slot('bytes1 a; bytes31 b; uint256 c;', 'c.slot', 'bytes1+bytes31 fill'));
  it('an enum is one byte and packs (enum + uint8 + uint16, next word @ 1)',
    () => slot('enum E { X, Y } E a; uint8 b; uint16 d; uint256 c;', 'c.slot', 'enum packs as uint8'));
});

describe('EVM slot-id parity (3) mappings (system: one slot each)', () => {
  it('a mapping takes one slot (next var @ 1)',
    () => slot('mapping(uint256 => uint256) m; uint256 x;', 'x.slot', 'mapping then word'));
  it('two mappings then a word @ slot 2',
    () => slot('mapping(uint256 => uint256) m; mapping(uint256 => uint256) n; uint256 x;', 'x.slot', 'two mappings'));
  it('nested mapping still one slot (next var @ 1)',
    () => slot('mapping(uint256 => mapping(uint256 => uint256)) m; uint256 x;', 'x.slot', 'nested mapping one slot'));
  it('the mapping is at its declaration-order base slot',
    () => slot('uint256 pre; mapping(uint256 => uint256) m;', 'm.slot', 'mapping base @ 1'));
});

describe('EVM slot-id parity (4) dynamic arrays (system: one length slot)', () => {
  it('a dynamic uint256[] takes one (length) slot (next var @ 1)',
    () => slot('uint256[] arr; uint256 x;', 'x.slot', 'uint256[] length slot'));
  it('a dynamic array of a sub-word type still takes one length slot',
    () => slot('uint32[] arr; uint256 x;', 'x.slot', 'uint32[] length slot'));
  it('the dynamic array is at its declaration-order base slot',
    () => slot('uint256 pre; uint256[] arr;', 'arr.slot', 'dyn arr base @ 1'));
});

// A composite's OWN base slot is a system property (it depends only on preceding scalars/mappings/dyn-arrays,
// all fixed-footprint). Its ELEMENT footprint - which drives the NEXT var's slot - is the allowable divergence,
// so it is not asserted here.
describe('EVM slot-id parity (5) fixed-array / struct base slot (own position is system)', () => {
  it('a fixed array is at its declaration-order base slot',
    () => slot('uint256 pre; uint256[3] arr;', 'arr.slot', 'fixed arr base @ 1'));
  it('a struct is at its declaration-order base slot',
    () => slot('struct S { uint256 a; uint256 b; } uint256 pre; S s;', 's.slot', 'struct base @ 1'));
});
