import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

const provider = createTestProvider();
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function deploy(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// P3 (docs/evm-storage-parity.md): EVM-exact register layout. A fixed-size array / struct state var occupies
// its full multi-word EVM footprint, so a var declared AFTER it gets the correct EVM slot number. Previously a
// composite collapsed to one slot, so `x` after `uint256[3] arr` was mislabeled EVM slot 1 instead of 3, and
// assembly using the literal EVM slot diverged.
const AFTER_ARRAY = `pragma solidcash >=0.8.0;
contract C() {
  uint256[3] arr;
  uint256 x;
  function setX(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.x = v;
  }
  function readXviaSlot3(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(3) }   // EVM slot of x: past uint256[3] which occupies slots 0,1,2
    require(r == e);
  }
}`;

// A struct of two words occupies 2 EVM slots, so `x` lands at slot 2 (was slot 1 before the fix).
const AFTER_STRUCT = `pragma solidcash >=0.8.0;
contract C() {
  struct Pair { uint256 a; uint256 b; }
  Pair p;
  uint256 x;
  function setX(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.x = v;
  }
  function readXviaSlot2(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(2) }
    require(r == e);
  }
}`;

describe('EVM storage layout: composite state vars occupy full EVM slots (P3)', () => {
  it('assigns the var after a fixed array its correct EVM slot (no __evm_storage needed)', () => {
    // sload(3) resolves to the declared var x, so no __evm_storage collection is synthesized.
    const art = compileString(AFTER_ARRAY, { solidityImportCompat: true });
    const cols = (art.stateLayout as unknown as { collections?: { name: string }[] })?.collections ?? [];
    expect(cols.some((c) => c.name === '__evm_storage')).toBe(false);
  });

  it('reads a high-level scalar written after a fixed array via its literal EVM slot', async () => {
    const sc = await deploy(AFTER_ARRAY);
    await (sc as any).setX(77n, alicePub, sig()).send();       // high-level write to x
    await (sc as any).readXviaSlot3(77n).send();               // assembly sload(3) reads the same storage
  });

  it('reads a high-level scalar written after a 2-word struct via its literal EVM slot', async () => {
    const art = compileString(AFTER_STRUCT, { solidityImportCompat: true });
    const cols = (art.stateLayout as unknown as { collections?: { name: string }[] })?.collections ?? [];
    // If the struct is pre-flattened to scalar leaves, slot 2 still resolves to x; either way no __evm_storage.
    expect(cols.some((c) => c.name === '__evm_storage')).toBe(false);
    const sc = await deploy(AFTER_STRUCT);
    await (sc as any).setX(88n, alicePub, sig()).send();
    await (sc as any).readXviaSlot2(88n).send();
  });
});

// A UDVT (`type T is uintN`) state var packs by its underlying width (stateVarByteWidth unwraps ValueType) and its
// slot is readable/writable in assembly: sload combines via unwrap+uint256 cast, sstore decomposes + masks + wraps.
const UDVT_SLOT = `pragma solidcash >=0.8.0;
type Small is uint16;
contract C() {
  Small a;
  function setHi(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.a = Small.wrap(uint16(v));
  }
  function readViaSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(a.slot) }
    require(r == e);
  }
  function setViaSlot(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(a.slot, v) }
  }
  function readHi(uint256 e) {
    require(uint256(Small.unwrap(a)) == e);
  }
}`;

describe('UDVT (type T is uintN) storage slot read/write in assembly', () => {
  it('sload of a UDVT var slot reads its high-level-written value (unwrap)', async () => {
    const sc = await deploy(UDVT_SLOT);
    await (sc as any).setHi(300n, alicePub, sig()).send();
    await (sc as any).readViaSlot(300n).send();
  });
  it('sstore to a UDVT var slot is read back high-level (wrap + sub-word mask)', async () => {
    const sc = await deploy(UDVT_SLOT);
    await (sc as any).setViaSlot(305n, alicePub, sig()).send();
    await (sc as any).readHi(305n).send();
  });
});

// The int/UDVT-int slot path round-trips a HIGH value (top bit of the field's width set): it uses int truncation
// (uintN(word) = word mod 2^N, a positive BigInt), NOT a byte cast, so it is unaffected by the NUM2BIN
// sign-magnitude issue that excludes bytesN slot fields.
describe('int/UDVT-int slot round-trips a high (top-bit-set) value', () => {
  it('a uint16 UDVT slot round-trips 0xffff (top uint16 bit set)', async () => {
    const sc = await deploy(UDVT_SLOT);
    await (sc as any).setViaSlot(65535n, alicePub, sig()).send();
    await (sc as any).readHi(65535n).send();
  });
});

// bytesN slot fields via the two's-complement trick (NUM2BIN(N+1) drop sign byte / prepend-0x00 BIN2NUM): round-trip
// a full word through a packed bytesN slot for HIGH-BIT values (0xcccc/0xbbbb/0xaaaa - the ones a naive bytesN(uint)
// NUM2BIN sign-magnitude cast broke).
const PACKED_BYTES2_HI = `pragma solidcash >=0.8.0;
contract C() {
  bytes2 a;
  bytes2 b;
  function setViaSlot(uint256 w, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(a.slot, w) }
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(a.slot) }
    require(r == e);
  }
}`;

const PACKED_MIXED_HI = `pragma solidcash >=0.8.0;
type MU is uint16;
type MB is bytes2;
contract C() {
  MU a;
  MB b;
  bytes2 c;
  function setViaSlot(uint256 w, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(a.slot, w) }
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(a.slot) }
    require(r == e);
  }
}`;

describe('bytesN packed slot round-trips HIGH-BIT values (two-complement trick)', () => {
  it('two bytes2 fields round-trip 0xccccbbbb (both high bit set)', async () => {
    const sc = await deploy(PACKED_BYTES2_HI);
    await (sc as any).setViaSlot(0xccccbbbbn, alicePub, sig()).send();
    await (sc as any).readSlot(0xccccbbbbn).send();
  });
  it('mixed UDVT-int + UDVT-bytes + bytes2 round-trip 0xccccbbbbaaaa (all high bit set)', async () => {
    const sc = await deploy(PACKED_MIXED_HI);
    await (sc as any).setViaSlot(0xccccbbbbaaaan, alicePub, sig()).send();
    await (sc as any).readSlot(0xccccbbbbaaaan).send();
  });
});

// bytes32 full-word slot: the write can't NUM2BIN to 33 as a bytesN cast, so wordToBytesN splits the word into two
// bytes16 halves (each via the N=16 trick) and concats; the read prepends 0x00 before uint256. Round-trips a
// top-bit-set word (0xff..) that a bare bytes32(uint) NUM2BIN cast could not.
const BYTES32_SLOT_HI = `pragma solidcash >=0.8.0;
contract C() {
  bytes32 x;
  function setViaSlot(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(x.slot, v) }
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(x.slot) }
    require(r == e);
  }
}`;

describe('bytes32 full-word slot round-trips a high-bit word (split write / prepend-0x00 read)', () => {
  it('round-trips 0xff..00 (top byte 0xff)', async () => {
    const sc = await deploy(BYTES32_SLOT_HI);
    const hi = BigInt('0x' + 'ff' + '00'.repeat(31));
    await (sc as any).setViaSlot(hi, alicePub, sig()).send();
    await (sc as any).readSlot(hi).send();
  });
  it('round-trips a mixed-byte word with high bits throughout', async () => {
    const sc = await deploy(BYTES32_SLOT_HI);
    const w = BigInt('0x' + 'ff'.repeat(16) + '80'.repeat(16));
    await (sc as any).setViaSlot(w, alicePub, sig()).send();
    await (sc as any).readSlot(w).send();
  });
});

// A 64-byte struct/array occupies slots [p, p+words] (head slot + flow), and the NEXT var starts at p+words -
// EVM-parity layout. The composite's own value-field sub-slots ARE now decoded to their fields (see the
// composite sub-slot round-trip suite below); an UNSUPPORTED composite (a variable-width/nested field) still
// fails closed (never silently reads __evm_storage).
const STRUCT_AFTER = `pragma solidcash >=0.8.0;
contract C() {
  struct Pair { uint256 a; uint256 b; }
  Pair p;
  uint256 x;
  function setP(uint256 va, uint256 vb, uint256 vx, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.p = Pair(va, vb);
    this.x = vx;
  }
  function readSlot2(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(2) }
    require(r == e);
  }
}`;

describe('64-byte composite occupies [p, p+1]; next var at p+2', () => {
  it('the var AFTER a 2-slot struct is at slot 2 (head + flow layout is EVM-exact)', async () => {
    const sc = await deploy(STRUCT_AFTER);
    await (sc as any).setP(42n, 99n, 7n, alicePub, sig()).send();
    await (sc as any).readSlot2(7n).send();
  });
  it('a raw sload of an UNSUPPORTED composite sub-slot (address field) fails closed', () => {
    // A struct with a variable-width (address) field has no sound fixed-word slot layout, so it stays
    // fail-closed (never a silent __evm_storage read). Value-field structs are handled below.
    const src = 'contract C { struct T { address a; uint96 b; } T t; uint256 x;'
      + ' function f() public returns (uint r) { assembly { r := sload(0) } require(true); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow(/inline assembly/i);
  });
});

// Composite sub-slot field access: sload/sstore on a fixed value-field struct's own slots. The SOUNDNESS proof
// is the CROSS-CHECK between the slot path and the high-level field path (a slot->slot round-trip alone could be
// self-consistently wrong): write-via-slot then read-the-FIELDS, and write-the-FIELDS then read-via-slot. All
// with TOP-BIT-SET field values (the sign-magnitude NUM2BIN trap).
const COMP_STRUCT = `pragma solidcash >=0.8.0;
contract C() {
  struct S { uint64 y; uint64 z; }
  S s;
  function setViaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(s.slot, w) }
  }
  function setFields(uint64 vy, uint64 vz, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.s = S(vy, vz);
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(s.slot) }
    require(r == e);
  }
  function readFields(uint256 ey, uint256 ez) {
    require(uint256(s.y) == ey);
    require(uint256(s.z) == ez);
  }
}`;

// A 2-slot struct (two full uint256 words): exercises the rel!=0 sub-slot AND the `add(s.slot, 1)` slot form.
const COMP_STRUCT_MULTISLOT = `pragma solidcash >=0.8.0;
contract C() {
  struct M { uint256 a; uint256 b; }
  M m;
  function setBviaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(add(m.slot, 1), w) }
  }
  function readB(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(add(m.slot, 1)) }
    require(r == e);
  }
  function readFieldB(uint256 e) { require(m.b == e); }
  function readFieldA(uint256 e) { require(m.a == e); }
}`;

// A packed bytesN struct routes the composite field through the same two's-complement byte path as a scalar slot.
const COMP_STRUCT_BYTES = `pragma solidcash >=0.8.0;
contract C() {
  struct B { bytes4 p; bytes4 q; }
  B b;
  function setViaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(b.slot, w) }
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(b.slot) }
    require(r == e);
  }
}`;

const U64MAX = (1n << 64n) - 1n;
const PACKED_MAX = (1n << 128n) - 1n; // y = z = 2^64-1

describe('composite sub-slot field access: struct head/sub-slot read+write (VM round-trip)', () => {
  it('write-via-slot lands in the real packed fields (high-bit uint64 both set)', async () => {
    const sc = await deploy(COMP_STRUCT);
    await (sc as any).setViaSlot(PACKED_MAX, alicePub, sig()).send();
    await (sc as any).readFields(U64MAX, U64MAX).send(); // cross-check: slot write reached s.y / s.z
  });
  it('write-the-fields is read back through the combined slot word (high-bit)', async () => {
    const sc = await deploy(COMP_STRUCT);
    await (sc as any).setFields(U64MAX, U64MAX, alicePub, sig()).send();
    await (sc as any).readSlot(PACKED_MAX).send(); // cross-check: sload combines s.y + s.z<<64
  });
  it('slot write truncates high bits past the two fields (2^150-1 -> both fields 2^64-1)', async () => {
    const sc = await deploy(COMP_STRUCT);
    await (sc as any).setViaSlot((1n << 150n) - 1n, alicePub, sig()).send();
    await (sc as any).readFields(U64MAX, U64MAX).send();
    await (sc as any).readSlot(PACKED_MAX).send();
  });
  it('rel!=0 sub-slot via add(m.slot,1): write b, cross-check field b (and a untouched)', async () => {
    const sc = await deploy(COMP_STRUCT_MULTISLOT);
    const hi = (1n << 255n) | 123n; // top bit set
    await (sc as any).setBviaSlot(hi, alicePub, sig()).send();
    await (sc as any).readB(hi).send();
    await (sc as any).readFieldB(hi).send();
    await (sc as any).readFieldA(0n).send(); // slot+1 write must not touch field a (slot 0)
  });
  it('packed bytes4 struct fields round-trip a high-bit word (0xccccbbbb) through the slot', async () => {
    const sc = await deploy(COMP_STRUCT_BYTES);
    await (sc as any).setViaSlot(0xccccbbbbn, alicePub, sig()).send();
    await (sc as any).readSlot(0xccccbbbbn).send();
  });
});

// A fixed VALUE array's head slot decodes to its packed elements: EVM packs floor(32/w) per slot. Same
// element<->slot cross-check + high-bit values as the struct suite. The write pushes per-element (ArrayAssign),
// no whole-array rebuild.
const COMP_ARRAY = `pragma solidcash >=0.8.0;
contract C() {
  uint128[2] a;
  function setViaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(a.slot, w) }
  }
  function setElems(uint128 v0, uint128 v1, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.a[0] = v0;
    this.a[1] = v1;
  }
  function readSlot(uint256 e) {
    uint256 r = 0;
    assembly { r := sload(a.slot) }
    require(r == e);
  }
  function readElems(uint256 e0, uint256 e1) {
    require(uint256(a[0]) == e0);
    require(uint256(a[1]) == e1);
  }
}`;

// The corpus dirty_storage_static_array shape: a single uint8[1], write via slot truncates to the element width.
const COMP_ARRAY_U8 = `pragma solidcash >=0.8.0;
contract C() {
  uint8[1] a;
  function setViaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(a.slot, w) }
  }
  function readElem(uint256 e) { require(uint256(a[0]) == e); }
}`;

const U128MAX = (1n << 128n) - 1n;
const WORD_MAX = (1n << 256n) - 1n; // a[0] = a[1] = 2^128-1

describe('composite sub-slot field access: fixed value array head slot read+write (VM round-trip)', () => {
  it('write-via-slot lands in the real packed elements (high-bit uint128 both set)', async () => {
    const sc = await deploy(COMP_ARRAY);
    await (sc as any).setViaSlot(WORD_MAX, alicePub, sig()).send();
    await (sc as any).readElems(U128MAX, U128MAX).send(); // cross-check: slot write reached a[0] / a[1]
  });
  it('write-the-elements is read back through the combined slot word (high-bit)', async () => {
    const sc = await deploy(COMP_ARRAY);
    await (sc as any).setElems(U128MAX, U128MAX, alicePub, sig()).send();
    await (sc as any).readSlot(WORD_MAX).send(); // cross-check: sload combines a[0] + a[1]<<128
  });
  it('uint8[1] slot write truncates to the element width (257 -> a[0] == 1)', async () => {
    const sc = await deploy(COMP_ARRAY_U8);
    await (sc as any).setViaSlot(257n, alicePub, sig()).send();
    await (sc as any).readElem(1n).send();
  });
});
