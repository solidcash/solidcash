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

// EVM-storage foundation (docs/evm-storage-parity.md): assembly sstore/sload on an arbitrary slot routes to a
// synthesized `mapping(uint256 => uint256) __evm_storage`. A persistent roundtrip (set in tx1, read in tx2)
// must ride the mapping entry-NFT covenant: distinct slots are independent, an untouched slot reads default 0.
const EVM = `pragma solidcash >=0.8.0;
contract C() {
  function setSlot(uint256 slot, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(slot, v) }
  }
  function checkSlot(uint256 slot, uint256 expected) {
    uint256 r = 0;
    assembly { r := sload(slot) }
    require(r == expected);
  }
}`;

// Solidity corpus accessor and packed-storage parity:
// test/libsolidity/semanticTests/storage/accessors_mapping_for_array.sol
// test/libsolidity/semanticTests/storage/array_accessor.sol
// test/libsolidity/semanticTests/storage/chop_sign_bits.sol
// test/libsolidity/semanticTests/storage/complex_accessors.sol
// test/libsolidity/semanticTests/storage/empty_nonempty_empty.sol
// test/libsolidity/semanticTests/storage/mapping_state.sol
// test/libsolidity/semanticTests/storage/packed_storage_overflow.sol
// test/libsolidity/semanticTests/storage/packed_storage_signed.sol
// test/libsolidity/semanticTests/storage/simple_accessor.sol
// test/libsolidity/semanticTests/storage/state_smoke_test.sol
describe('EVM-storage foundation: sstore/sload roundtrip via __evm_storage', () => {
  it('persists a slot across txs; distinct/untouched slots are independent', async () => {
    const sc = await deploy(EVM);
    await (sc as any).setSlot(5n, 42n, alicePub, sig()).send();   // __evm_storage[5] = 42
    await (sc as any).checkSlot(5n, 42n).send();                  // reads 42 back
    await (sc as any).checkSlot(9n, 0n).send();                   // untouched slot -> default 0
    await (sc as any).setSlot(9n, 100n, alicePub, sig()).send();  // __evm_storage[9] = 100
    await (sc as any).checkSlot(9n, 100n).send();                 // slot 9 now 100
    await (sc as any).checkSlot(5n, 42n).send();                  // slot 5 unchanged
  });
});

// OZ StorageSlot idiom (write-to-any-slot): `XSlot storage d = StorageSlot.getXSlot(SLOT); d.value = v` lowers
// to __evm_storage[uint256(SLOT)] with per-field-type value casts (LowerStorageSlotPointers). This is the
// exact OZ StorageSlot library shape - it must COMPILE (synthesize __evm_storage) and a write must persist.
const SLOTPTR_ADDR = `pragma solidcash >=0.8.0;
library StorageSlot {
  struct AddressSlot { address value; }
  function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) { assembly { r.slot := slot } }
}
contract TestSlot() {
  bytes32 constant TEST_SLOT = keccak256("ADMIN_SLOT");
  function setAddr(address a, pubkey pk, sig s) {
    require(checkSig(s, pk));
    StorageSlot.AddressSlot storage d = StorageSlot.getAddressSlot(TEST_SLOT);
    d.value = a;
  }
  function checkAddr(address expected) {
    StorageSlot.AddressSlot storage d = StorageSlot.getAddressSlot(TEST_SLOT);
    require(d.value == expected);
  }
}`;

// Two uint256-valued slot pointers. The slot key `uint256(SLOT)` is a compile-time constant the compiler resolves
// (keySource.kind='constant'), so a READ can locate + co-spend the entry without a key arg. Slot A = keccak256(
// "SLOT_A") hashes to a uint256 with the top bit SET (byte[31]=0xe3; uint256(bytes32) sign-pads a 0x00 so it reads
// positive, not negative); B = keccak256("B") is high bit clear - both roundtrip.
const SLOTPTR_U256 = `pragma solidcash >=0.8.0;
library StorageSlot {
  struct Uint256Slot { uint256 value; }
  function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) { assembly { r.slot := slot } }
}
contract T() {
  bytes32 constant A = keccak256("SLOT_A");
  bytes32 constant B = keccak256("B");
  function setA(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    StorageSlot.Uint256Slot storage d = StorageSlot.getUint256Slot(A); d.value = v;
  }
  function setB(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    StorageSlot.Uint256Slot storage d = StorageSlot.getUint256Slot(B); d.value = v;
  }
  function checkA(uint256 e) { StorageSlot.Uint256Slot storage d = StorageSlot.getUint256Slot(A); require(d.value == e); }
  function checkB(uint256 e) { StorageSlot.Uint256Slot storage d = StorageSlot.getUint256Slot(B); require(d.value == e); }
}`;

describe('EVM-storage: OZ StorageSlot pointer (write-to-any-slot)', () => {
  it('compiles the OZ StorageSlot idiom (synthesizes __evm_storage)', () => {
    const art = compileString(SLOTPTR_ADDR, { solidityImportCompat: true });
    expect(art.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBe(true);
    // The factory library function is consumed (never emitted as a callable).
    expect(art.abi.some((f) => f.name === 'getAddressSlot')).toBe(false);
    // A read resolves the constant slot key (kind='constant') so the SDK can locate the entry with no key arg.
    const ks = (art.abi.find((f) => f.name === 'checkAddr') as { entryAccesses?: { keySources?: { kind: string }[] }[] })
      ?.entryAccesses?.[0]?.keySources?.[0];
    expect(ks?.kind).toBe('constant');
  });

  // A BCH `address` is a full locking bytecode (e.g. a 25-byte P2PKH `76a914<hash>88ac`), NOT a 20-byte hash, so an
  // AddressSlot cannot round-trip cleanly through the uint256 register (uint160 keeps only the embedded hash and
  // drops the address type/prefix). Address-valued slots COMPILE but are out of scope at runtime - skipped, not
  // forced. uint256/bool/bytes32 slots round-trip (below).
  it.skip('reads an address slot back (out of scope: a BCH address is a 25-byte lbc, not a 20-byte hash)', async () => {
    const sc = await deploy(SLOTPTR_ADDR);
    const { aliceAddress } = await import('../fixture/vars.js');
    await (sc as any).setAddr(aliceAddress, alicePub, sig()).send();
    await (sc as any).checkAddr(aliceAddress).send();
  });

  it('writes a slot then reads it back through the pointer (constant key resolved)', async () => {
    const sc = await deploy(SLOTPTR_U256);
    await (sc as any).setA(42n, alicePub, sig()).send();
    await (sc as any).checkA(42n).send();
  });

  it('distinct slots stay independent; an untouched slot reads default 0', async () => {
    const sc = await deploy(SLOTPTR_U256);
    await (sc as any).setA(11n, alicePub, sig()).send();
    await (sc as any).setB(22n, alicePub, sig()).send();
    await (sc as any).checkA(11n).send();
    await (sc as any).checkB(22n).send();
  });

  it('reads an untouched slot as default 0 even when a different slot has an entry', async () => {
    const sc = await deploy(SLOTPTR_U256);
    await (sc as any).setA(11n, alicePub, sig()).send();
    await (sc as any).checkB(0n).send(); // B never written -> co-spends nothing, reads default (not A's entry)
  });
});
