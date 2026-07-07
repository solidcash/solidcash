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
//   const proxy = await upgrades.deployProxy(Impl, [initialState], { proxy: proxyArtifact });
//   await proxy.increment().send();
// The proxy holds the state, the implementation carries the logic; calls forward through a pinned delegatecall
// (finding C1: the co-spend is forced + the delegate identity AND function are pinned). See docs/upgrades.md.

// A multi-function delegate: selector dispatch makes the forwarded selector real (the pinned proxy pins it).
const DELEGATE_IMPL = `pragma solidcash >=0.8.0;
  contract DelegateImpl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

// Pinned proxy: `up(bytes input, address impl, ...)` forces + pins the delegate co-spend (the safe form).
const PINNED_PROXY = `pragma solidcash >=0.8.0;
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

function proxyCounter(tx: any, categoryId: string, layout: any): bigint {
  const out = getTxOutputs(tx).find(
    (o: any) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
  );
  return parsePushdataCommitment(out!.token!.nft!.commitment, layout, 0).counter as bigint;
}

describe('upgrades.deployProxy (ethers/hardhat OZ-upgrades style)', () => {
  it('deploys impl + proxy, seeds state, and forwards a call via a pinned delegatecall', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxyArtifact = compileString(PINNED_PROXY);

    const Impl = getContractFactory(implArtifact, signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 5n }, { proxy: proxyArtifact });
    await proxy.waitForDeployment();

    expect(proxy.address).toMatch(/^bchtest:|^bitcoincash:|^bchreg:/);
    expect(await proxy.getAddress()).toBe(proxy.address);
    expect(proxy.deploymentTransaction().txid).toBeDefined();

    // Forward the implementation's `increment` through the proxy: counter 5 -> 6.
    const tx = await (proxy as any).increment().send();
    expect(tx.txid).toBeDefined();
    expect(proxyCounter(tx, proxy.proxy.categoryId, proxyArtifact.stateLayout)).toBe(6n);
  });

  it('accepts an OZ-style positional initializer list', async () => {
    const signer = await fundedSigner();
    const implArtifact = compileString(DELEGATE_IMPL);
    const proxyArtifact = compileString(PINNED_PROXY);

    // [42n] maps positionally to the implementation's first state variable (counter).
    const proxy = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer), [42n], { proxy: proxyArtifact },
    );

    const tx = await proxy.forward('increment', []).send();
    expect(proxyCounter(tx, proxy.proxy.categoryId, proxyArtifact.stateLayout)).toBe(43n);
  });

  it('rejects without a proxy artifact (BCH needs a separate proxy contract)', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(DELEGATE_IMPL), signer);
    await expect(upgrades.deployProxy(Impl, { counter: 1n })).rejects.toThrow(/options\.proxy/);
  });
});
