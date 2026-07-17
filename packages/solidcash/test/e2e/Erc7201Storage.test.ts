import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv, aliceAddress } from '../fixture/vars.js';

const provider = createTestProvider();
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function deploy(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// ERC-7201 namespaced storage (docs/evm-storage-parity.md P1): a NO-PARAM factory
//   `function layout() internal pure returns (S storage $) { assembly { $.slot := CONST } }`
// is the OZ-upgradeable idiom. Its struct fields are PROMOTED to hidden packed state (scalar -> register var,
// mapping -> collection). This is the exact shape of every OZ v5 upgradeable base (Ownable/ERC20/etc).

// MVP-1: single scalar field, local-alias read + write. uint256 (clean roundtrip; address is a 25-byte lbc,
// out of scope like the __evm_storage address-slot case).
const NS_SINGLE = `pragma solidcash >=0.8.0;
library CounterStorage {
  struct Layout { uint256 count; }
  bytes32 constant SLOT = keccak256("myapp.storage.Counter");
  function layout() internal pure returns (Layout storage $) { assembly { $.slot := SLOT } }
}
contract Counter() {
  function setCount(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    CounterStorage.Layout storage $ = CounterStorage.layout();
    $.count = v;
  }
  function checkCount(uint256 e) {
    CounterStorage.Layout storage $ = CounterStorage.layout();
    require($.count == e);
  }
}`;

describe('ERC-7201 namespaced storage: const-slot factory -> promoted state (MVP-1)', () => {
  it('compiles the const-slot factory idiom (promotes the field, consumes the factory)', () => {
    const art = compileString(NS_SINGLE, { solidityImportCompat: true });
    // The no-param factory is consumed (never emitted as a callable).
    expect(art.abi.some((f) => f.name === 'layout')).toBe(false);
    // The scalar field is promoted to a hidden PACKED register state var (one data NFT), not an __evm_storage entry.
    const svs = (art.stateLayout as unknown as { variables?: { name: string }[] })?.variables ?? [];
    expect(svs.some((v) => /count/i.test(v.name))).toBe(true);
    expect((art.stateLayout as unknown as { dataNftCount?: number })?.dataNftCount).toBe(1);
  });

  it('reads the promoted scalar default (0) right after deploy', async () => {
    const sc = await deploy(NS_SINGLE);
    await (sc as any).checkCount(0n).send();
  });

  it('persists the promoted scalar across txs (set in tx1, read in tx2)', async () => {
    const sc = await deploy(NS_SINGLE);
    await (sc as any).setCount(42n, alicePub, sig()).send();
    await (sc as any).checkCount(42n).send();
  });
});

// MVP-2: a multi-scalar namespaced struct. The PACKING win: the fields co-pack into ONE data-NFT commitment
// (128B), not one UTXO per slot. Each `$.f = v` is a separate write; all fields round-trip.
const NS_MULTI = `pragma solidcash >=0.8.0;
library AppStorage {
  struct Layout { uint256 a; uint128 b; uint64 c; bool d; }
  bytes32 constant SLOT = keccak256("myapp.storage.App");
  function layout() internal pure returns (Layout storage $) { assembly { $.slot := SLOT } }
}
contract App() {
  function setAll(uint256 a, uint128 b, uint64 c, bool d, pubkey pk, sig s) {
    require(checkSig(s, pk));
    AppStorage.Layout storage $ = AppStorage.layout();
    $.a = a; $.b = b; $.c = c; $.d = d;
  }
  function checkAll(uint256 a, uint128 b, uint64 c, bool d) {
    AppStorage.Layout storage $ = AppStorage.layout();
    require($.a == a && $.b == b && $.c == c && $.d == d);
  }
  function bumpA(uint256 delta, pubkey pk, sig s) {
    require(checkSig(s, pk));
    AppStorage.Layout storage $ = AppStorage.layout();
    $.a = $.a + delta;   // read-modify-write one field; the others are untouched (self-read, skipped)
  }
}`;

describe('ERC-7201 namespaced storage: multi-scalar packing (MVP-2)', () => {
  it('packs all fields into ONE data NFT (not one UTXO per slot)', () => {
    const art = compileString(NS_MULTI, { solidityImportCompat: true });
    const sl = art.stateLayout as unknown as { variables?: { name: string }[]; dataNftCount?: number };
    expect(sl?.dataNftCount).toBe(1);
    expect((sl?.variables ?? []).map((v) => v.name).sort())
      .toEqual(['Layout__a', 'Layout__b', 'Layout__c', 'Layout__d']);
  });

  it('round-trips every field of the packed struct', async () => {
    const sc = await deploy(NS_MULTI);
    await (sc as any).setAll(7n, 8n, 9n, true, alicePub, sig()).send();
    await (sc as any).checkAll(7n, 8n, 9n, true).send();
  });

  it('read-modify-write of one field leaves the others intact (packed rebuild)', async () => {
    const sc = await deploy(NS_MULTI);
    await (sc as any).setAll(100n, 8n, 9n, true, alicePub, sig()).send();
    await (sc as any).bumpA(5n, alicePub, sig()).send();
    await (sc as any).checkAll(105n, 8n, 9n, true).send();
  });
});

// MVP-3: an ERC-20-storage-shaped namespaced struct with a MAPPING field + a scalar. The mapping field can't
// be a single slot (it is a subspace), so it promotes to a hidden collection; the scalar packs in the register.
// `$.balances[k]` read/write route to the promoted collection; `$.totalSupply` to the register.
const NS_MAPPING = `pragma solidcash >=0.8.0;
library ERC20Storage {
  struct Layout { mapping(address => uint256) balances; uint256 totalSupply; }
  bytes32 constant SLOT = keccak256("myapp.storage.ERC20");
  function layout() internal pure returns (Layout storage $) { assembly { $.slot := SLOT } }
}
contract Token() {
  function mint(address to, uint256 amt, pubkey pk, sig s) {
    require(checkSig(s, pk));
    ERC20Storage.Layout storage $ = ERC20Storage.layout();
    $.balances[to] = $.balances[to] + amt;
    $.totalSupply = $.totalSupply + amt;
  }
  function checkBalance(address who, uint256 e) {
    ERC20Storage.Layout storage $ = ERC20Storage.layout();
    require($.balances[who] == e);
  }
  function checkSupply(uint256 e) {
    ERC20Storage.Layout storage $ = ERC20Storage.layout();
    require($.totalSupply == e);
  }
}`;

describe('ERC-7201 namespaced storage: mapping field (MVP-3)', () => {
  it('promotes a mapping field to a collection and a scalar to the register', () => {
    const art = compileString(NS_MAPPING, { solidityImportCompat: true });
    const sl = art.stateLayout as unknown as { variables?: { name: string }[]; collections?: { name: string }[] };
    expect((sl?.variables ?? []).map((v) => v.name)).toContain('Layout__totalSupply');
    expect((sl?.collections ?? []).map((c) => c.name)).toContain('Layout__balances');
    // mint writes both the promoted mapping entry (balances[to]) and the promoted register (totalSupply).
    const mint = art.abi.find((f) => f.name === 'mint') as { writesState?: boolean; entryAccesses?: { collection: string }[] };
    expect(mint?.writesState).toBe(true);
    expect(mint?.entryAccesses?.[0]?.collection).toBe('Layout__balances');
  });

  it('mints to a mapping entry + register and reads both back across txs', async () => {
    const sc = await deploy(NS_MAPPING);
    await (sc as any).mint(aliceAddress, 100n, alicePub, sig()).send();
    await (sc as any).checkBalance(aliceAddress, 100n).send();
    await (sc as any).checkSupply(100n).send();
    await (sc as any).mint(aliceAddress, 50n, alicePub, sig()).send();
    await (sc as any).checkBalance(aliceAddress, 150n).send();
    await (sc as any).checkSupply(150n).send();
  });
});

// A dynamic string/bytes field (ERC20 name/symbol shape) promotes to a chunk-backed dynamic var (the third
// 128B-aware substrate). The value lives in chunk UTXOs; the register holds only the length header.
const NS_STRING = `pragma solidcash >=0.8.0;
library MetaStorage {
  struct Layout { string name; }
  bytes32 constant SLOT = keccak256("myapp.storage.Meta");
  function layout() internal pure returns (Layout storage $) { assembly { $.slot := SLOT } }
}
contract Meta() {
  function setName(string n, pubkey pk, sig s) {
    require(checkSig(s, pk));
    MetaStorage.Layout storage $ = MetaStorage.layout();
    $.name = n;
  }
  function checkName(string e) {
    MetaStorage.Layout storage $ = MetaStorage.layout();
    require($.name == e);
  }
}`;

describe('ERC-7201 namespaced storage: dynamic string field (chunk substrate)', () => {
  it('round-trips a promoted dynamic string field across txs', async () => {
    const sc = await deploy(NS_STRING);
    await (sc as any).setName('OpenZeppelin Token', alicePub, sig()).send();
    await (sc as any).checkName('OpenZeppelin Token').send();
  });
});

// The OZ v5 UPGRADEABLE base shape: the ERC-7201 factory is a CONTRACT METHOD (not a library free fn) and is
// called inside initializer/reinitializer/guard MODIFIERS. LowerStorageSlotPointers drops contract-method
// factories too (not just free fns), and runs AFTER modifier expansion so a factory use inlined from a modifier
// body is rewritten (else the dropped factory leaves a dangling call). This unblocks OZ PausableUpgradeable etc.
describe('ERC-7201 namespaced storage: contract-method factory + modifier usage (OZ upgradeable shape)', () => {
  it('compiles a contract-method (non-library) factory used via a local alias', () => {
    const src = `contract C {
      struct S { bool paused; }
      bytes32 private constant LOC = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;
      function _get() private pure returns (S storage $) { assembly { $.slot := LOC } }
      function pause() public { S storage $ = _get(); $.paused = true; }
      function isPaused() public view returns (bool) { S storage $ = _get(); return $.paused; }
    }`;
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });

  it('compiles a contract-method factory used INSIDE a modifier body (inlined by expansion), inherited', () => {
    const src = `contract Base {
      struct S { bool entered; }
      bytes32 private constant LOC = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;
      function _get() private pure returns (S storage $) { assembly { $.slot := LOC } }
      modifier guard() { S storage $ = _get(); require(!$.entered); $.entered = true; _; }
    }
    contract C is Base { function act() public guard() { } }`;
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});
