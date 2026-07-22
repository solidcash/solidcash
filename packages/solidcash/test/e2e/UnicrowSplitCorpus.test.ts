import { describe, expect, it } from 'vitest';
import { compileFile, compileFileSplit } from 'solidc';
import { ContractFactory, Signer, SplitContractBundle } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

describe.skipIf(process.env.SOLIDC_REAL_CORPUS !== '1')('Unicrow split corpus', () => {
  it('documents the ordinary imported constructor blocker', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const fundingUtxo = await provider.addUtxo(signer.getAddress(), {
      txid: 'df'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileFile(
      '../../examples/effectiveacceleration/contracts/unicrow/Unicrow.sol',
      { solidityImportCompat: true },
    );
    const address = signer.getAddress();
    await expect(new ContractFactory(artifact, signer).deploy(
      address, address, address, address, 100n,
      {
        fundingUtxo,
        funder: signer.unlockP2PKH(),
        changeAddress: signer.getAddress(),
        initialState: { __block_timestamp: 0n, __blockOracleOwner: alicePub },
      },
    )).rejects.toThrow(/Failed to derive initial state commitments from constructor/);
  }, 240_000);

  it('reaches the same imported constructor blocker through its planned facets', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const fundingUtxos = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea']) {
      fundingUtxos.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }

    const compiled = compileFileSplit(
      '../../examples/effectiveacceleration/contracts/unicrow/Unicrow.sol',
      { solidityImportCompat: true },
    );
    const address = signer.getAddress();
    const constructorArgs = [address, address, address, address, 100n];
    const factory = SplitContractBundle.from(compiled, signer);
    const facetOverrides = Object.fromEntries(compiled.manifest.facets.map((facet, index) => [
      facet.name, { fundingUtxo: fundingUtxos[index + 1] },
    ]));
    await expect(factory.deploy(constructorArgs, {
      fundingUtxo: fundingUtxos[0],
      facetOverrides,
      initialState: { __block_timestamp: 0n, __blockOracleOwner: alicePub },
    })).rejects.toThrow(/Failed to derive initial state commitments from constructor/);
    expect(compiled.manifest.facets.length).toBeGreaterThan(0);
  }, 240_000);
});
