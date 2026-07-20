import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import {
  Signer, getContractFactory, upgrades,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { alicePriv } from '../fixture/vars.js';
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
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

// A two-data-NFT delegate: proves the default proxy bytecode is layout / dataNftCount independent.
const DELEGATE_IMPL_MULTI = `pragma solidcash >=0.8.0;
  contract DelegateImplMulti() {
    bigint counter;
    bigint total;
    function bump(bigint by) delegate { this.counter = this.counter + by; this.total = this.total + 1; }
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

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
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

    const Impl = getContractFactory(implArtifact, signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 5n });   // no options.proxy
    await proxy.waitForDeployment();

    expect(proxy.address).toMatch(/^bchtest:|^bitcoincash:|^bchreg:/);
    expect(await proxy.getAddress()).toBe(proxy.address);
    expect(proxy.deploymentTransaction().txid).toBeDefined();

    // Forward the implementation's `increment` through the default proxy: counter 5 -> 6.
    const tx = await (proxy as any).increment().send();
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
      getContractFactory(implArtifact, signer), { counter: 5n }, { proxy: compileString(CUSTOM_PROXY) },
    );

    const tx = await proxy.forward('increment', []).send();
    expect(proxyState(tx, proxy.proxy.categoryId, implArtifact.stateLayout).counter).toBe(6n);
  });

  // An `initialize` delegate: state is set by running it through the proxy (the OZ/Ethereum initializer flow).
  const INIT_IMPL = `pragma solidcash >=0.8.0;
    contract InitImpl() {
      int a;
      int b;
      function initialize(int a_, int b_) delegate { this.a = a_; this.b = b_; }
      function auth(pubkey p, sig s) unsafe { require(checkSig(s, p)); }
    }`;

  it('auto-runs an `initialize` delegate with the init args (Ethereum drop-in flow)', async () => {
    const signer = await fundedSigner();
    const proxy = await upgrades.deployProxy(getContractFactory(compileString(INIT_IMPL), signer), [7n, 9n]);

    // deployProxy deployed the proxy at defaults then forwarded initialize(7, 9) - state is set through the proxy.
    const state = await (proxy.proxy as any).getState();
    expect(state.a).toBe(7n);
    expect(state.b).toBe(9n);
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
      function initialize(int v) delegate { this.version = v; }
      function setVersion(int v) delegate { emit Changed(v); this.version = v; }
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
  });
});
