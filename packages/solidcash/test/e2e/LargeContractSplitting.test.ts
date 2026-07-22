import { describe, expect, it } from 'vitest';
import { compileStringSplit } from 'solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import { Signer, SplitContractBundle, deriveLogicalCreateAddress, upgrades } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

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

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
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
  it('deploys branded master-only facets and routes calls into one shared root state', async () => {
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

    // Each facet genesis contains its minting master but no application mutable data NFT.
    for (const tx of deployed.deploymentTransactions.slice(0, -1) as any[]) {
      const tokenOutputs = getTxOutputs(tx).filter((output) => output.token);
      expect(tokenOutputs.filter((output) => output.token?.nft?.capability === 'minting')).toHaveLength(1);
      expect(tokenOutputs.some((output) => output.token?.nft?.capability === 'mutable')).toBe(false);
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
    expect(() => sdk.attach({ rootCategory: '01'.repeat(32), facetCategories: {} }))
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
    `, { forceSplit: true, solidityImportCompat: true });
    const deployed = await SplitContractBundle.from(compiled, signer).deploy([7n], {
      initialState: { __block_timestamp: 0n, __blockOracleOwner: alicePub },
    });
    expect((await deployed.root.getState()).value).toBe(7n);
  });
});
