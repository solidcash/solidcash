import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Signer, deriveLogicalCreateAddress, getContractFactory, resolveLogicalIdentity, upgrades,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs } from '../test-util.js';

// ethers/hardhat OpenZeppelin-upgrades-style proxy deploy for stateful contracts:
//   const Impl = getContractFactory(implArtifact, signer);
//   const proxy = await upgrades.deployProxy(Impl, [initialState]);   // built-in default proxy
//   await proxy.increment().send();
// The proxy holds the state, the implementation carries the logic; calls forward through a pinned delegatecall
// (finding C1: forced co-spend + delegate identity AND function pinned). See docs/upgrades.md.

// A multi-function delegate: selector dispatch makes the forwarded selector real (the pinned proxy pins it).
const DELEGATE_IMPL = `pragma solidcash >=0.8.0;
  contract DelegateImpl() {
    bigint counter;
    function increment() public { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

// A two-data-NFT delegate: proves the default proxy bytecode is layout / dataNftCount independent.
const DELEGATE_IMPL_MULTI = `pragma solidcash >=0.8.0;
  contract DelegateImplMulti() {
    bigint counter;
    bigint total;
    function bump(bigint by) public { this.counter = this.counter + by; this.total = this.total + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

// A custom pinned proxy: `up(bytes input, address impl, ...)` takes the impl as a call param (the 'param' mode).
const CUSTOM_PROXY = `pragma solidcash >=0.8.0;
  contract PinnedProxy() {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
      require(checkSig(s, pk));
      impl.delegatecall(input);
      require(input.length > 0);
    }
  }`;

/**
 * A FRESH key per call. The logical CREATE address is deterministic in (deployer, nonce) and these deploys use
 * nonce 0, so reusing one key leaves another immutable anchor at the same address on every run and
 * `resolveLogicalIdentity` then legitimately reports "ambiguous ... found N". A real deployer consumes each
 * nonce once, so uniqueness here restores the property the test means to assert.
 */
function freshPrivateKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  // Keep the value non-zero and below the secp256k1 group order.
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(freshPrivateKey(), provider);
  // Two genesis-valid funders: one for the implementation, one for the proxy.
  await provider.addUtxo(signer.getAddress(), { txid: 'a1'.repeat(32), vout: 0, satoshis: 1_000_000n });
  await provider.addUtxo(signer.getAddress(), { txid: 'b2'.repeat(32), vout: 0, satoshis: 1_000_000n });
  return signer;
}

function proxyState(tx: any, categoryId: string, layout: any): Record<string, bigint> {
  const out = getTxOutputs(tx).find(
    (o: any) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
  );
  return parsePushdataCommitment(out!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
}

describe('upgrades.deployProxy (ethers/hardhat OZ-upgrades style)', () => {
  it('uses the built-in default proxy (no proxy artifact needed) and forwards a call', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), 0n);

    const Impl = getContractFactory(implArtifact, signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 5n });   // no options.proxy
    await proxy.waitForDeployment();
    expect(await signer.getNonce()).toBe(1);

    expect(proxy.address).toMatch(/^bchtest:|^bitcoincash:|^bchreg:/);
    expect(await proxy.getAddress()).toBe(proxy.address);
    expect(proxy.address).toBe(predicted);
    expect((await resolveLogicalIdentity(signer.provider, predicted)).categoryId).toBe(proxy.proxy.categoryId);
    expect(proxy.deploymentTransaction().txid).toBeDefined();

    // Forward the implementation's `increment` through the default proxy: counter 5 -> 6.
    const tx = await (proxy as any).increment().send();
    expect(await signer.getNonce()).toBe(2);
    expect(tx.txid).toBeDefined();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).counter).toBe(6n);
  });

  it('accepts an OZ-style positional initializer list', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);

    // [42n] maps positionally to the implementation's first state variable (counter).
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), [42n]);

    const tx = await proxy.forward('increment', []).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).counter).toBe(43n);
  });

  it('the default proxy is layout-independent (multi-data-NFT implementation)', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL_MULTI);

    const proxy = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer), { counter: 5n, total: 0n },
    );

    // bump(10): counter 5 -> 15, total 0 -> 1, through the SAME default proxy bytecode.
    const tx = await (proxy as any).bump(10n).send();
    const state = proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout);
    expect(state.counter).toBe(15n);
    expect(state.total).toBe(1n);
  });

  it('accepts a custom proxy contract via options.proxy (param-impl mode)', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);

    const proxy = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer), { counter: 5n }, {
        // This fixture deliberately demonstrates the caller-selected implementation mode. Production proxies
        // should pin implementation identity, which is why the compiler requires an explicit unsafe opt-in.
        proxy: compileString(CUSTOM_PROXY, { allowUnsafeOperations: true }),
      },
    );

    const tx = await proxy.forward('increment', []).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).counter).toBe(6n);
  });

  // An `initialize` delegate: state is set by running it through the proxy (the OZ/Ethereum initializer flow).
  const INIT_IMPL = `pragma solidcash >=0.8.0;
    contract InitImpl() {
      int public a;
      int b;
      function initialize(int a_, int b_) public { this.a = a_; this.b = b_; }
      function requireUninitialized() public { this.a = this.a; require(this.a == 0, "AlreadyInitialized"); }
      function auth(pubkey p, sig s) unsafe { require(checkSig(s, p)); }
    }`;

  it('auto-runs an `initialize` delegate with the init args (Ethereum drop-in flow)', async () => {
    const signer = await fundedSigner();
    const proxy = await upgrades.deployProxy(getContractFactory(compileString(INIT_IMPL), signer), [7n, 9n]);

    // deployProxy deployed the proxy at defaults then forwarded initialize(7, 9) - state is set through the proxy.
    const state = await (proxy.proxy as any).getState();
    expect(state.a).toBe(7n);
    expect(state.b).toBe(9n);
    expect(await (proxy as any).a()).toBe(7n);
    const failing = await (proxy as any).requireUninitialized().build();
    expect(() => failing.debug()).toThrow('AlreadyInitialized');
  });

  it('auto-detects an OZ initializer in Solidity import-compat mode', async () => {
    const signer = await fundedSigner();
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract OzStyle {
        int public count;
        modifier initializer() { _; }
        function initialize(int initial) public initializer { this.count = initial; }
        function increment() public { this.count = this.count + 1; }
      }`, { solidityImportCompat: true });
    expect(artifact.abi.find((entry) => entry.name === 'initialize')?.modifiers).toContain('delegate');
    expect(artifact.abi.find((entry) => entry.name === 'increment')?.modifiers).toContain('delegate');

    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), [5n]);
    expect((await (proxy.proxy as any).getState()).count).toBe(5n);
    await (proxy as any).increment().send();
    expect((await (proxy.proxy as any).getState()).count).toBe(6n);
  });

  it('preserves pending state across nested OZ initializer helpers', async () => {
    const signer = await fundedSigner();
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract NestedOzStyle {
        bool private initializing;
        int public count;
        modifier initializer() { initializing = true; _; initializing = false; }
        modifier onlyInitializing() { require(initializing); _; }
        function __Base_init(int initial) internal onlyInitializing { count = initial; }
        function initialize(int initial) public initializer { __Base_init(initial); }
      }`, { solidityImportCompat: true });

    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), [9n]);
    expect((await (proxy.proxy as any).getState()).count).toBe(9n);
  });

  it('passes every proxy state NFT to a multi-NFT delegate initializer', async () => {
    const signer = await fundedSigner();
    const artifact = compileString(`pragma solidity ^0.8.24;
      contract MultiNftOzStyle {
        uint16 a;
        uint16 b;
        uint16 c;
        uint16 d;
        modifier initializer() { _; }
        function initialize(uint16 value) public initializer { this.d = value; }
      }`, { solidityImportCompat: true, commitmentLimit: 3 });
    expect(artifact.stateLayout?.dataNftCount).toBeGreaterThan(1);

    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), [4n]);
    expect((await (proxy.proxy as any).getState()).d).toBe(4n);
  });

  it('initializer: false seeds state at genesis (SolidCash constructor style)', async () => {
    const signer = await fundedSigner();
    // Same contract, but skip the initializer: the positional args seed the state directly at genesis (one tx).
    const proxy = await upgrades.deployProxy(
      getContractFactory(compileString(INIT_IMPL), signer), [3n, 4n], { initializer: false },
    );

    const state = await (proxy.proxy as any).getState();
    expect(state.a).toBe(3n);
    expect(state.b).toBe(4n);
  });

  // A delegate fn that emits: the impl verifies its event at proxyMaster+offset, so the event NFT lands in the
  // PROXY block (proxy category, capability none) and the co-spent impl UTXOs shift after it.
  const EVENT_IMPL = `pragma solidcash >=0.8.0;
    contract EventImpl() {
      event Changed(int v);
      int version;
      address owner;
      function initialize(int v) public { this.owner = msg.sender; this.version = v; }
      function setVersion(int v) public { require(msg.sender == this.owner); emit Changed(v); this.version = v; }
    }`;

  it('emits an event from inside a delegate function (event NFT lands in the proxy block)', async () => {
    const signer = await fundedSigner();
    // A third funder: the event NFT reserves one output-only funder input beyond the two deploy genesis coins.
    await signer.provider.addUtxo(signer.getAddress(), { txid: 'c3'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const implArtifact = compileString(EVENT_IMPL);
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), [1n]);

    const tx = await (proxy as any).setVersion(25n).send();
    // State written through the proxy (delegate writes proxyMaster+1).
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).version).toBe(25n);
    // The event NFT: immutable (capability none), proxy category, commitment = pushdata-encoded arg (25 = 0x19).
    const eventOut = getTxOutputs(tx).find(
      (o: any) => o.token?.category === proxy.proxy.categoryId && o.token?.nft?.capability === 'none',
    );
    expect(eventOut).toBeDefined();
    expect(eventOut!.token!.nft!.commitment).toBe('0119');
    // Getter dispatch must retain the connected runner so its return-event output uses a real P2PKH funder.
    expect(await (proxy as any).version()).toBe(25n);
  });

  const INHERITED_OWNER_IMPL = `pragma solidity ^0.8.0;
    contract OwnableBase {
      address owner;
      event OwnershipTransferred(address previousOwner, address newOwner);
      modifier initializer() { _; }
      function ownerValue() public view returns (address) { return this.owner; }
      function _msgSender() internal view returns (address) { return msg.sender; }
      function _checkOwner() internal view { require(ownerValue() == _msgSender()); }
      modifier onlyOwner() { _checkOwner(); _; }
      function _transferOwnership(address next) internal {
        address previous = this.owner;
        this.owner = next;
        emit OwnershipTransferred(previous, next);
      }
      function transferOwnership(address next) public virtual onlyOwner { _transferOwnership(next); }
    }
    contract InheritedOwnerImpl() is OwnableBase {
      function initialize() public initializer { this.owner = msg.sender; }
      function transferOwnership(address next) public override onlyOwner { super.transferOwnership(next); }
    }`;

  it('preserves msg.sender through an inherited owner modifier with an address argument', async () => {
    const signer = await fundedSigner();
    await signer.provider.addUtxo(signer.getAddress(), { txid: 'c4'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const implArtifact = compileString(INHERITED_OWNER_IMPL, { solidityImportCompat: true });
    expect(implArtifact.abi.find((entry) => entry.name === 'transferOwnership')?.emits).toEqual([
      expect.objectContaining({ eventSignature: 'OwnershipTransferred(address,address)' }),
    ]);
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    expect((await (proxy.proxy as any).getState()).owner).toBeInstanceOf(Uint8Array);
    await (proxy as any).transferOwnership(signer.getAddress()).send();
    expect(await (proxy as any).owner()).toBe(signer.getAddress());
  });

  // Robustness of events-in-delegate: an indexed param, two emits in one call, and a no-arg event.
  const EVENT_IMPL2 = `pragma solidcash >=0.8.0;
    contract EventImpl2() {
      event A(int indexed i, int v);
      event B(int v);
      int x;
      function initialize(int v) public { this.x = v; }
      function two(int v) public { emit A(v, v); emit B(v + 1); this.x = v; }
      function none() public { emit B(0); this.x = this.x + 1; }
    }`;

  it('supports indexed params, multiple emits in one delegate call, and shifts co-spent impl UTXOs', async () => {
    const signer = await fundedSigner();
    // two() emits twice -> two event NFTs -> two output-only funder inputs beyond the two deploy coins.
    await signer.provider.addUtxo(signer.getAddress(), { txid: 'd4'.repeat(32), vout: 0, satoshis: 1_000_000n });
    await signer.provider.addUtxo(signer.getAddress(), { txid: 'e5'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const implArtifact = compileString(EVENT_IMPL2);
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), [3n]);

    const tx = await (proxy as any).two(7n).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).x).toBe(7n);
    // Two event NFTs (immutable, proxy category) precede the co-spent impl master/state.
    const eventOuts = getTxOutputs(tx).filter(
      (o: any) => o.token?.category === proxy.proxy.categoryId && o.token?.nft?.capability === 'none',
    );
    expect(eventOuts.length).toBe(2);
  });

  // A delegate that WRITES A MAPPING (users[msg.sender]=v). A vmap INSERT mints one new entry node, so the
  // transaction's own-category mutable NFT count rises by one - which is exactly what the default proxy's
  // `emitOwnCategoryMutableNftConservation` (C1 full-state authority, `in == out`) forbids.
  const MAP_IMPL = `pragma solidcash >=0.8.0;
    contract MapImpl() {
      int count;
      mapping(address => int) users;
      function initialize() public { this.count = 0; }
      function register(int v) public { users[msg.sender] = v; this.count = this.count + 1; }
      function clear() public { delete users[msg.sender]; this.count = this.count - 1; }
    }`;

  it('writes a msg.sender-keyed vmap from inside a delegate, minting its entry NFTs in the proxy block', async () => {
    const signer = await fundedSigner();
    await signer.provider.addUtxo(signer.getAddress(), { txid: 'f6'.repeat(32), vout: 0, satoshis: 1_000_000n });
    await signer.provider.addUtxo(signer.getAddress(), { txid: '07'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const implArtifact = compileString(MAP_IMPL);
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const tx = await (proxy as any).register(5n).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).count).toBe(1n);
    const entryOut = getTxOutputs(tx).find(
      (output: any) => output.token?.category === proxy.proxy.categoryId
        && output.token?.nft?.capability === 'mutable'
        && (output.token?.nft?.commitment?.length ?? 0) > 20,
    );
    expect(entryOut).toBeDefined();
    expect(await (proxy as any).users(signer.getAddress())).toBe(5n);
    expect(await (proxy as any).getUsers(0, 0)).toEqual([5n]);

    const clearTx = await (proxy as any).clear().send();
    expect(proxyState(clearTx, proxy.proxy.categoryId, implArtifact.stateLayout).count).toBe(0n);
    expect(await (proxy as any).users(signer.getAddress())).toBe(0n);
    expect(await (proxy as any).getUsers(0, 0)).toEqual([0n]);
  }, 300_000);

  it('materializes a returning external call made by a delegated implementation', async () => {
    const signer = await fundedSigner();
    await signer.provider.addUtxo(signer.getAddress(), { txid: '18'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract ValueSource() {
        int marker;
        function twice(int value) view returns (int) { return value * 2; }
      }`);
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IValueSource { function twice(int value) external view returns (int); }
      contract NestedCallImpl() {
        int result;
        function initialize() public { this.result = 0; }
        function run(address source, int value) public { this.result = IValueSource(source).twice(value); }
      }`, { solidityImportCompat: true });
    const callee = await getContractFactory(calleeArtifact, signer).deploy({ initialState: { marker: 1n } });
    const proxy = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer),
      [],
    );
    const tx = await (proxy as any).run(callee.inner.lockingBytecode, 7n).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).result).toBe(14n);
  });

  // Nested proxy emit+return composition still requires a dedicated cross-owner event/return layout.
  it.skip('materializes a returning external call to another deployed proxy', async () => {
    const signer = await fundedSigner();
    await signer.provider.addUtxo(signer.getAddress(), {
      txid: '19'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const valueArtifact = compileString(`pragma solidcash >=0.8.0;
      contract ProxyValueSource() {
        event Read(int value);
        int marker;
        function initialize(int initial) public { this.marker = initial; }
        function twice(int value) public returns (int) { emit Read(value); return value * 2; }
      }`);
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProxyValueSource { function twice(int value) external view returns (int); }
      contract NestedProxyCaller() {
        int result;
        function initialize() public { this.result = 0; }
        function run(address source, int value) public {
          this.result = IProxyValueSource(source).twice(value);
        }
      }`, { solidityImportCompat: true });
    const valueProxy = await upgrades.deployProxy(
      getContractFactory(valueArtifact, signer), [1n],
    );
    const callerProxy = await upgrades.deployProxy(
      getContractFactory(callerArtifact, signer), [],
    );
    const tx = await (callerProxy as any).run(valueProxy.proxy.inner.lockingBytecode, 9n).send();
    expect(proxyState(tx, callerProxy.proxy.categoryId, callerArtifact.stateLayout).result).toBe(18n);
  });
});
