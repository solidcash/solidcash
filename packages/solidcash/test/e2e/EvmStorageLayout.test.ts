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
