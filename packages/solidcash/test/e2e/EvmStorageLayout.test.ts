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

// Ragged packing: uint40 (width 5) does not divide 32, so a slot holds floor(32/5)=6 elements with 2 slack
// bytes. The bit math must still place a[i] at bit 40*i (a[5] at bit 200, ending at bit 240 - inside the slot).
const COMP_ARRAY_RAGGED = `pragma solidcash >=0.8.0;
contract C() {
  uint40[6] a;
  function setViaSlot(uint256 w, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    assembly { sstore(a.slot, w) }
  }
  function readA0(uint256 e) { require(uint256(a[0]) == e); }
  function readA5(uint256 e) { require(uint256(a[5]) == e); }
}`;

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
  it('ragged uint40[6] packing: distinct top-bit elements at slack-boundary offsets', async () => {
    const sc = await deploy(COMP_ARRAY_RAGGED);
    const V = (i: bigint): bigint => (1n << 39n) + i; // top bit of uint40 set, distinct per element
    let w = 0n;
    for (let i = 0n; i < 6n; i += 1n) w += V(i) << (40n * i);
    await (sc as any).setViaSlot(w, alicePub, sig()).send();
    await (sc as any).readA0(V(0n)).send(); // first element
    await (sc as any).readA5(V(5n)).send(); // last element (bit 200..239, against the 2-byte slack)
  });
});

// Nested struct: `struct S { Inner inner; uint256 x; }` - the nested Inner starts a fresh slot (slot 0),
// x lands at slot 1. sload/sstore(s.slot) reaches the nested Inner's packed fields via a recursive rebuild.
const COMP_NESTED = `pragma solidcash >=0.8.0;
contract C() {
  struct Inner { uint64 a; uint64 b; }
  struct S { Inner inner; uint256 x; }
  S s;
  function setSlot0(uint256 w, pubkey pk, sig sg) { require(checkSig(sg, pk)); assembly { sstore(s.slot, w) } }
  function setSlot1(uint256 w, pubkey pk, sig sg) { require(checkSig(sg, pk)); assembly { sstore(add(s.slot, 1), w) } }
  function setFields(uint64 va, uint64 vb, uint256 vx, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.s = S(Inner(va, vb), vx);
  }
  function readSlot0(uint256 e) { uint256 r = 0; assembly { r := sload(s.slot) } require(r == e); }
  function readInner(uint256 ea, uint256 eb) {
    require(uint256(s.inner.a) == ea);
    require(uint256(s.inner.b) == eb);
  }
  function readX(uint256 e) { require(s.x == e); }
}`;

describe('composite sub-slot field access: NESTED struct (recursive rebuild)', () => {
  it('write-slot0 lands in the nested Inner fields (high-bit uint64 both set)', async () => {
    const sc = await deploy(COMP_NESTED);
    await (sc as any).setSlot0(PACKED_MAX, alicePub, sig()).send();
    await (sc as any).readInner(U64MAX, U64MAX).send(); // cross-check: reaches s.inner.a / s.inner.b
  });
  it('write-the-nested-fields reads back through the combined slot-0 word', async () => {
    const sc = await deploy(COMP_NESTED);
    await (sc as any).setFields(U64MAX, U64MAX, 5n, alicePub, sig()).send();
    await (sc as any).readSlot0(PACKED_MAX).send(); // cross-check: sload combines s.inner.a + s.inner.b<<64
  });
  it('write slot 1 (x, after the nested struct) leaves the nested Inner untouched', async () => {
    const sc = await deploy(COMP_NESTED);
    await (sc as any).setFields(U64MAX, U64MAX, 0n, alicePub, sig()).send(); // inner = (max,max), x = 0
    const hix = (1n << 255n) | 42n;
    await (sc as any).setSlot1(hix, alicePub, sig()).send();                 // x = hix via slot 1
    await (sc as any).readX(hix).send();
    await (sc as any).readInner(U64MAX, U64MAX).send();                      // inner unchanged by the slot-1 write
  });
});

// bool + enum packed slot fields (1 byte each): slot 0 = b(byte0) ++ ev(byte1) ++ x(bytes2..31). The word<->field
// cast is Solidity's typed cleaning (uint256(bool) in {0,1}, enum bounded), exact for well-defined values.
const BOOL_ENUM_SLOT = `pragma solidcash >=0.8.0;
contract C() {
  enum E { A, B, C }
  bool b;
  E ev;
  uint240 x;
  function setViaSlot(uint256 w, pubkey pk, sig s) { require(checkSig(s, pk)); assembly { sstore(b.slot, w) } }
  function setFields(bool vb, uint8 ve, uint240 vx, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.b = vb;
    this.ev = E(ve);
    this.x = vx;
  }
  function readSlot(uint256 e) { uint256 r = 0; assembly { r := sload(b.slot) } require(r == e); }
  function readFields(uint256 eb, uint256 ee, uint256 ex) {
    require(uint256(b) == eb);
    require(uint256(ev) == ee);
    require(uint256(x) == ex);
  }
}`;

describe('bool + enum packed slot fields (typed-cleaning round-trip)', () => {
  const X = (1n << 239n) | 0x1234n; // top bit of uint240 set
  const WORD = 1n + (2n << 8n) + (X << 16n); // b=1, ev=2 (E.C), x=X
  it('write-via-slot lands in the real bool/enum/int fields', async () => {
    const sc = await deploy(BOOL_ENUM_SLOT);
    await (sc as any).setViaSlot(WORD, alicePub, sig()).send();
    await (sc as any).readFields(1n, 2n, X).send();
  });
  it('write-the-fields reads back through the combined slot word', async () => {
    const sc = await deploy(BOOL_ENUM_SLOT);
    await (sc as any).setFields(true, 2n, X, alicePub, sig()).send();
    await (sc as any).readSlot(WORD).send();
  });
});

// Nested array-in-struct: `struct S { uint64[2] arr; uint256 x }` - arr occupies slot 0 (arr[0] bit0, arr[1]
// bit64), x at slot 1. The write rebuilds `s = S([arr0', arr1'], s.x)` (ctor + array literal). (A top-level fixed
// array OF structs is excluded - the SDK cannot yet auto-derive that state layout even without assembly.)
const COMP_ARR_IN_STRUCT = `pragma solidcash >=0.8.0;
contract C() {
  struct S { uint64[2] arr; uint256 x; }
  S s;
  function setViaSlot(uint256 w, pubkey pk, sig sg) { require(checkSig(sg, pk)); assembly { sstore(s.slot, w) } }
  function setFields(uint64 v0, uint64 v1, uint256 vx, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.s = S([v0, v1], vx);
  }
  function readSlot(uint256 e) { uint256 r = 0; assembly { r := sload(s.slot) } require(r == e); }
  function readArr(uint256 e0, uint256 e1) { require(uint256(s.arr[0]) == e0); require(uint256(s.arr[1]) == e1); }
  function readX(uint256 e) { require(s.x == e); }
}`;

describe('composite sub-slot: array-in-struct (full-value ctor+array-literal rebuild)', () => {
  it('write-slot0 lands in s.arr[0]/s.arr[1], x (slot 1) preserved through the rebuild', async () => {
    const sc = await deploy(COMP_ARR_IN_STRUCT);
    await (sc as any).setFields(1n, 2n, 7n, alicePub, sig()).send();      // arr=[1,2], x=7
    await (sc as any).setViaSlot(PACKED_MAX, alicePub, sig()).send();     // arr=[max,max] via slot 0
    await (sc as any).readArr(U64MAX, U64MAX).send();                     // cross-check: slot write reached arr
    await (sc as any).readX(7n).send();                                   // x read back unchanged in the rebuild
  });
  it('write-the-fields reads back through the combined slot-0 word', async () => {
    const sc = await deploy(COMP_ARR_IN_STRUCT);
    await (sc as any).setFields(U64MAX, U64MAX, 5n, alicePub, sig()).send();
    await (sc as any).readSlot(PACKED_MAX).send();                        // sload combines arr[0] + arr[1]<<64
  });
});

// Dynamic-array resize `sstore(a.slot, n)` = set length to n (truncate / zero-fill grow), via the branchless blob
// surgery elems' = (elems ++ zeros(n*width))[0:n*width]. Cross-checked against .length and a[i].
const RESIZE = `pragma solidcash >=0.8.0;
contract C() {
  uint128[] a;
  function push3(pubkey pk, sig s) { require(checkSig(s, pk)); this.a.push(11); this.a.push(22); this.a.push(33); }
  function resize(uint256 n, pubkey pk, sig s) { require(checkSig(s, pk)); assembly { sstore(a.slot, n) } }
  function chkLen(uint256 e) { require(this.a.length == e); }
  function chkElem(uint256 i, uint256 e) { require(uint256(this.a[i]) == e); }
}`;

describe('dynamic array resize sstore(a.slot, n) (blob truncate / zero-fill grow)', () => {
  it('grows with zero-fill, preserving existing elements', async () => {
    const sc = await deploy(RESIZE);
    await (sc as any).push3(alicePub, sig()).send();       // [11,22,33]
    await (sc as any).resize(5n, alicePub, sig()).send();  // [11,22,33,0,0]
    await (sc as any).chkLen(5n).send();
    await (sc as any).chkElem(2n, 33n).send();             // preserved
    await (sc as any).chkElem(4n, 0n).send();              // zero-filled
  });
  it('shrinks by truncation, and resize(0) empties', async () => {
    const sc = await deploy(RESIZE);
    await (sc as any).push3(alicePub, sig()).send();
    await (sc as any).resize(1n, alicePub, sig()).send();  // [11]
    await (sc as any).chkLen(1n).send();
    await (sc as any).chkElem(0n, 11n).send();
    await (sc as any).resize(0n, alicePub, sig()).send();
    await (sc as any).chkLen(0n).send();
  });
});

// Calldata `.offset` of a (first) dynamic param = the compile-time ABI byte position of its data
// (4 + headWords*32 + 32). EVM-parity value (corpus calldata_offset_read: single bytes -> 0x44, u,b,u -> 0x84).
const CALLDATA_OFFSET = `pragma solidcash >=0.8.0;
contract C() {
  uint256 dummy;
  function chkSingle(bytes calldata x) { uint256 r = 0; assembly { r := x.offset } require(r == 68); }
  function chkMixed(uint256 a, bytes calldata x, uint256 b) { uint256 r = 0; assembly { r := x.offset } require(r == 132); }
}`;

describe('calldata .offset = compile-time ABI data position', () => {
  it('single bytes param -> 0x44', async () => {
    const sc = await deploy(CALLDATA_OFFSET);
    await (sc as any).chkSingle(new Uint8Array([1, 2, 3])).send();
  });
  it('uint, bytes, uint -> 0x84', async () => {
    const sc = await deploy(CALLDATA_OFFSET);
    await (sc as any).chkMixed(7n, new Uint8Array([1, 2]), 8n).send();
  });
});

// Calldata `.offset`/`.length` are ASSIGNABLE (a calldata-slice re-point): modeled as function-scoped mutable
// locals, so `x.offset := 8` in one block is read back as 8 in a later block (corpus calldata_offset_read_write).
const CALLDATA_RW = `pragma solidcash >=0.8.0;
contract C() {
  uint256 dummy;
  function chk(uint256 a, bytes calldata x, uint256 b) {
    assembly { x.offset := 8  x.length := 20 }
    uint256 r = 0; uint256 v = 0;
    assembly { r := x.offset  v := x.length }
    require(r == 8);
    require(v == 20);
  }
}`;

describe('calldata .offset/.length assignable (mutable component, cross-block)', () => {
  it('assign in one block, read back in another', async () => {
    const sc = await deploy(CALLDATA_RW);
    await (sc as any).chk(7n, new Uint8Array([1, 2]), 8n).send();
  });
});

// EVM dynamic-array element-slot idiom: `mstore(0, arr.slot); sstore(keccak256(0,32)+i, v)` == `arr[i] = v`
// (EVM stores elements at keccak(slot)+i). sload is guarded (out-of-range -> 0). Corpus delete_storage_array.
const KECCAK_ELEM = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] data;
  function writeViaKeccak(pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(0, 2) mstore(0, 0) sstore(keccak256(0, 32), 234) sstore(add(keccak256(0, 32), 1), 123) }
  }
  function chkFields() { require(data.length == 2); require(data[0] == 234); require(data[1] == 123); }
  function readViaKeccak(uint256 e) { uint256 r = 999; assembly { mstore(0, 0) r := sload(keccak256(0, 32)) } require(r == e); }
  function clear(pubkey pk, sig s) { require(checkSig(s, pk)); delete this.data; }
}`;

describe('keccak256 dynamic-array element-slot idiom (sstore(keccak(0,32)+i, v) == arr[i]=v)', () => {
  it('writes land in the real elements; guarded read returns 0 out-of-range', async () => {
    const sc = await deploy(KECCAK_ELEM);
    await (sc as any).writeViaKeccak(alicePub, sig()).send();
    await (sc as any).chkFields().send();                // cross-check: reached data[0]/data[1]
    await (sc as any).readViaKeccak(234n).send();
    await (sc as any).clear(alicePub, sig()).send();
    await (sc as any).readViaKeccak(0n).send();           // out-of-range after delete -> 0
  });
});

// Let-bound array-element slot: `let pos := add(keccak256(0,32), i)` recorded as data[i] at its binding, so a
// later sstore/sload(pos) routes to the element (corpus array_storage_index_zeroed_test).
const KECCAK_LETBOUND = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] data;
  function seed(pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(data.slot, 3) mstore(0, data.slot) let p := add(keccak256(0, 32), 2) sstore(p, 777) }
  }
  function chk() { require(data.length == 3); require(data[2] == 777); }
  function readLet(uint256 i, uint256 e) { uint256 r = 0; assembly { mstore(0, data.slot) let p := add(keccak256(0, 32), i) r := sload(p) } require(r == e); }
}`;

describe('let-bound array-element slot (let pos := add(keccak(0,32), i))', () => {
  it('sstore/sload(pos) routes to data[i]; guarded out-of-range', async () => {
    const sc = await deploy(KECCAK_LETBOUND);
    await (sc as any).seed(alicePub, sig()).send();
    await (sc as any).chk().send();
    await (sc as any).readLet(2n, 777n).send();
    await (sc as any).readLet(9n, 0n).send();
  });
});

// bytes/string slot short-encoding const write: `sstore(b.slot, X)` for a compile-time X sets the value from EVM's
// short-slot layout (data in the HIGH bytes, big-endian, low byte = 2*len); X==0 clears. Corpus dirty_storage_bytes.
const BYTES_SLOT_WRITE = `pragma solidcash >=0.8.0;
contract C() {
  bytes b;
  function set(pubkey pk, sig s) { require(checkSig(s, pk)); assembly { sstore(b.slot, or("deadbeef", 0x08)) } }
  function chk() { require(b.length == 4); require(b[0] == 0x64); require(b[3] == 0x64); require(b[1] == 0x65); }
  function clr(pubkey pk, sig s) { require(checkSig(s, pk)); assembly { sstore(b.slot, 0) } }
  function isEmpty() { require(b.length == 0); }
}`;

describe('bytes slot short-encoding const write (data in high bytes, big-endian)', () => {
  it('sstore(b.slot, or("deadbeef",0x08)) -> b="dead"; sstore(b.slot,0) clears', async () => {
    const sc = await deploy(BYTES_SLOT_WRITE);
    await (sc as any).set(alicePub, sig()).send();
    await (sc as any).chk().send();
    await (sc as any).clr(alicePub, sig()).send();
    await (sc as any).isEmpty().send();
  });
});

// bytes slot sload = the EVM byte-array slot ENCODING: short (len<32) = data-in-high-bytes (big-endian) | 2*len;
// long = 2*len+1. VM-proven formula `len<32 ? uint256(bytes32((b ++ zeros ++ bytes1(2*len)).reverse())) : 2*len+1`.
// (byte_array_storage_layout compiles but its bytes-push-LOOP hits a pre-existing SDK state-derivation gap, so the
// encoding is proven here via the const-write path + a long push.)
const BYTES_SLOT_LOAD = `pragma solidcash >=0.8.0;
contract C() {
  bytes b;
  function setDead(pubkey pk, sig s) { require(checkSig(s, pk)); assembly { sstore(b.slot, or("deadbeef", 0x08)) } }
  function pushLong(pubkey pk, sig s) { require(checkSig(s, pk)); this.b = ""; while (this.b.length < 33) { this.b.push(0x61); } }
  function encShort(uint256 e) { uint256 r = 0; assembly { r := sload(b.slot) } require(r == e); }
  function encEmpty(uint256 e) { uint256 r = 0; assembly { r := sload(b.slot) } require(r == e); }
}`;
const DEAD_SLOT = (0x64656164n << 224n) + 8n; // big-endian "dead" + low byte 0x08

describe('bytes slot sload = EVM byte-array encoding (short data-in-high | 2len; long 2len+1)', () => {
  it('short "dead" -> data-in-high | 8; empty -> 0', async () => {
    const sc = await deploy(BYTES_SLOT_LOAD);
    await (sc as any).encEmpty(0n).send();                         // empty -> 0
    await (sc as any).setDead(alicePub, sig()).send();
    await (sc as any).encShort(DEAD_SLOT).send();                  // short encoding, big-endian data
  });
  it('long (33 bytes) -> 2*33+1 = 67', async () => {
    const sc = await deploy(BYTES_SLOT_LOAD);
    await (sc as any).pushLong(alicePub, sig()).send();
    await (sc as any).encShort(67n).send();
  });
});
