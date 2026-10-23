import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString, compileStringSplit } from '@solidcash/solidc';
import { messageBusVerifierCommitment, parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import {
  SplitContract,
  SplitContractBundle,
  StatefulContract,
  deriveLogicalCreateAddress,
  upgrades,
} from '../../src/stateful/index.js';

import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `
contract SplitCounter() {
    int x;
    int y;
    function setX(int value) { this.x = value; require(value >= 0); }
    function addX(int value) { this.x = this.x + value; require(value >= 0); }
    function setXReturning(int value) returns (int) { this.x = value; require(value >= 0); return value; }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}
`;

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
  for (const byte of ['a1', 'b2', 'c3', 'd4']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

function stateFromTx(tx: any, category: string, layout: any): Record<string, bigint> {
  const output = getTxOutputs(tx).find(
    (candidate: any) => candidate.token?.category === category
      && candidate.token?.nft?.capability === 'mutable',
  );
  return parsePushdataCommitment(output!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
}

describe('split contract SDK', () => {
  it('deploys branded facets without application data NFTs and routes calls into one shared root state', async () => {
    const signer = await fundedSigner();
    const compiled = compileStringSplit(SOURCE, { forceSplit: true });
    const sdk = SplitContractBundle.from(compiled, signer);
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), 0n);
    const deployed = await sdk
      .deploy([], { initialState: { x: 1n, y: 2n } });
    expect(await signer.getNonce()).toBe(1);
    expect(deployed.address).toBe(predicted);

    expect(Object.keys(deployed.facets)).toHaveLength(1);
    expect(new Set(Object.values(deployed.facets).map((facet) => facet.categoryId)).size).toBe(1);
    expect(Object.values(deployed.facets).every((facet) => facet.categoryId !== deployed.categoryId)).toBe(true);

    // Each facet genesis contains its minting master but no application mutable data NFT. A facet that publishes a
    // message-bus verifier program also mints that verifier's NFT, which is mutable but holds no application state,
    // so the only mutable output allowed is the verifier's own commitment.
    const facetGeneses = deployed.deploymentTransactions.slice(0, -1) as any[];
    expect(facetGeneses).toHaveLength(compiled.manifest.facets.length);
    for (const [index, tx] of facetGeneses.entries()) {
      const facetArtifact = compiled.facets[compiled.manifest.facets[index]!.name]!;
      const verifierCommitments = facetArtifact.messageBus?.verifierProgram
        ? [binToHex(messageBusVerifierCommitment(0))] : [];
      // Output 0 is the facet category's authhead, whose identity NFT is mutable too.
      const tokenOutputs = getTxOutputs(tx).slice(1).filter((output) => output.token);
      expect(tokenOutputs.filter((output) => output.token?.nft?.capability === 'minting')).toHaveLength(1);
      expect(tokenOutputs.filter((output) => output.token?.nft?.capability === 'mutable')
        .map((output) => output.token!.nft!.commitment)).toEqual(verifierCommitments);
    }

    const setTx = await deployed.call.setX(7n).send();
    expect(stateFromTx(setTx, deployed.categoryId, compiled.root.stateLayout).x).toBe(7n);

    const addTx = await deployed.call.addX(5n).send();
    const afterAdd = stateFromTx(addTx, deployed.categoryId, compiled.root.stateLayout);
    expect(afterAdd.x).toBe(12n);
    expect(afterAdd.y).toBe(2n);

    const returningTx = await deployed.call.setXReturning(15n).send();
    expect(stateFromTx(returningTx, deployed.categoryId, compiled.root.stateLayout).x).toBe(15n);

    // The same delegated function can materialize its authenticated return channel. A successful spend proves
    // both root and facet agreed on the shared returnEvent slot and on the encoded value.
    const emittedReturnTx = await deployed.call.setXReturning(17n).emitReturn().send();
    expect(stateFromTx(emittedReturnTx, deployed.categoryId, compiled.root.stateLayout).x).toBe(17n);

    // staticCall probes the same authenticated facet path without broadcasting the state transition.
    expect(await deployed.call.setXReturning(19n).staticCall()).toBe(19n);

    const yTx = await deployed.call.setY(9n).send();
    const afterY = stateFromTx(yTx, deployed.categoryId, compiled.root.stateLayout);
    expect(afterY.x).toBe(17n);
    expect(afterY.y).toBe(9n);

    const attached = SplitContractBundle.from(compiled, signer).attach(deployed.deploymentRecord());
    expect(attached.address).toBe(deployed.address);
    const attachedTx = await attached.call.addX(1n).send();
    expect(stateFromTx(attachedTx, attached.categoryId, compiled.root.stateLayout).x).toBe(18n);

    const rediscovered = await SplitContractBundle.from(compiled, signer).at(predicted);
    expect(rediscovered.deploymentRecord()).toEqual(deployed.deploymentRecord());
    const rediscoveredTx = await rediscovered.call.addX(1n).send();
    expect(stateFromTx(rediscoveredTx, rediscovered.categoryId, compiled.root.stateLayout).x).toBe(19n);
  });

  it('rejects a missing facet during attachment', async () => {
    const signer = await fundedSigner();
    const compiled = compileStringSplit(SOURCE, { forceSplit: true });
    const sdk = SplitContractBundle.from(compiled, signer);
    expect(() => sdk.attach({ rootCategory: '01'.repeat(31) + 'fe', facetCategories: {} }))
      .toThrow(/missing or invalid category/i);
  });

  it('rejects tampered facet layout metadata before deployment', async () => {
    const signer = await fundedSigner();
    const compiled = compileStringSplit(SOURCE, { forceSplit: true });
    const name = compiled.manifest.facets[0].name;
    const tampered = structuredClone(compiled);
    tampered.facets[name].stateLayout = { ...tampered.facets[name].stateLayout!, variables: [] };
    expect(() => SplitContractBundle.from(tampered, signer)).toThrow(/state layout differs/i);
  });

  it('deployProxy flattens a split implementation to root -> facets', async () => {
    const signer = await fundedSigner();
    const compiled = compileStringSplit(SOURCE, { forceSplit: true });
    const deployed = await upgrades.deployProxy(
      SplitContractBundle.from(compiled, signer), { x: 3n, y: 4n },
    );
    // Two facet genesis transactions plus one state-root genesis: no implementation-router deployment.
    expect(await signer.getNonce()).toBe(1);
    expect(deployed.deploymentTransactions).toHaveLength(compiled.manifest.facets.length + 1);
    const tx = await deployed.call.addX(2n).send();
    const state = stateFromTx(tx, deployed.categoryId, compiled.root.stateLayout);
    expect(state.x).toBe(5n);
    expect(state.y).toBe(4n);

    await expect(upgrades.deployProxy(
      SplitContractBundle.from(compiled, await fundedSigner()), {}, { proxy: compiled.root },
    )).rejects.toThrow(/cannot be wrapped in a custom proxy/i);
  });

  it('keeps constructor initialization compatible with facet-injected oracle state', async () => {
    const signer = await fundedSigner();
    const compiled = compileStringSplit(`
      pragma solidity ^0.8.7;
      contract SplitInit {
        uint value;
        constructor(uint initial) { value = initial; }
        function set(uint next) external { value = next + block.timestamp; require(next > 0); }
      }
    `, { forceSplit: true, evmCompat: true, messageBus: false });
    const deployed = await SplitContractBundle.from(compiled, signer).deploy([7n]);
    expect((await deployed.root.getState()).value).toBe(7n);
  });

  it('settles a typed graph call through a verifier-bound split facet', async () => {
    const signer = await fundedSigner();
    const provider = signer.provider;
    const peerArtifact = compileString(`contract Peer() {
      int stored;
      function ping(int next) { this.stored = next; require(next >= 0); }
    }`);
    const peerContract = new Contract(peerArtifact, [], { provider });
    const { categoryId: peerCategory } = await setupStatefulUtxos(
      provider, peerContract, peerArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const peer = StatefulContract.withCategory(peerContract, peerCategory);
    const bundle = compileStringSplit(`interface IPeer { function ping(int value) external; }
      contract GraphFacet {
        int value;
        function step(address target, int next) public {
          IPeer(target).ping(next);
          value = next;
          require(next >= 0);
        }
      }`, {
      evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, optimizeForCompilationSpeed: true,
      suppressWarnings: true, forceSplit: true,
    });
    const deployed = await SplitContractBundle.from(bundle, signer).deploy([], {
      initialState: { value: 0n },
    });
    const facetName = bundle.manifest.facets[0].name;
    const facet = deployed.facets[facetName];
    const connectedFacet = StatefulContract.withCategory(facet.inner, facet.categoryId, {
      externals: { IPeer: peer },
    }).connect(signer);
    const routed = new SplitContract(bundle, deployed.root, {
      ...deployed.facets, [facetName]: connectedFacet,
    }, deployed.deploymentTransactions);
    const target = peerContract.withCategory(hexToBin(peerCategory)).lockingBytecode;
    const tx = await routed.call.step(target, 7n).send();
    expect(stateFromTx(tx, deployed.categoryId, bundle.root.stateLayout).value).toBe(7n);
    expect((await peer.getState()).stored).toBe(7n);
  });

  it('returns a complete fixed array through a split facet on-chain', async () => {
    const signer = await fundedSigner();
    const bundle = compileStringSplit(`pragma solidity ^0.8.7;
      uint8 constant B=0; uint8 constant S=1; uint8 constant M=2;
      uint8 constant P=3; uint8 constant A=4;
      contract ReturnFacet {
        uint256 total;
        function calculate(uint256 amount) internal pure returns(uint256[5] memory) {
          uint256[5] memory payments;
          payments[B]=amount/10; payments[S]=amount/5; payments[M]=amount/5;
          payments[A]=amount/10;
          payments[P]=amount-payments[B]-payments[S]-payments[M]-payments[A];
          return payments;
        }
        function claim(uint256 amount) external returns(uint256[5] memory) {
          uint256[5] memory payments=calculate(amount);
          this.total=amount; require(amount>0);
          return [payments[B],payments[S],payments[M],payments[P],payments[A]];
        }
      }`, { evmCompat: true, messageBus: false, forceSplit: true });
    const deployed = await SplitContractBundle.from(bundle, signer).deploy([], {
      initialState: { total: 0n },
    });
    expect(await deployed.call.claim(100n).staticCall()).toEqual([10n, 20n, 20n, 40n, 10n]);
    const tx = await deployed.call.claim(100n).emitReturn().send();
    expect(stateFromTx(tx, deployed.categoryId, bundle.root.stateLayout).total).toBe(100n);
  });
});
