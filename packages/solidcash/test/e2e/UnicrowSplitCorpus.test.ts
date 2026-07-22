import { describe, expect, it } from 'vitest';
import { compileFile, compileFileSplit } from 'solidc';
import { ContractFactory, Signer, SplitContractBundle } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

describe.skipIf(process.env.SOLIDC_REAL_CORPUS !== '1')('Unicrow split corpus', () => {
  it('rejects the unsplit corpus at the BCH unlocking-script limit', async () => {
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
    )).rejects.toThrow(/unlocking bytecode exceeds the maximum bytecode length/i);
  }, 240_000);

  it('deploys the imported constructor through its planned facets', async () => {
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
    const deployed = await factory.deploy(constructorArgs, {
      fundingUtxo: fundingUtxos[0],
      facetOverrides,
      initialState: { __block_timestamp: 0n, __blockOracleOwner: alicePub },
    });
    const state = await deployed.root.getState();

    expect(Object.keys(deployed.facets)).toHaveLength(compiled.manifest.facets.length);
    expect(state.protocolFee).toBe(100n);
    const expectedAddress = addressToLockScript(address);
    expect(state.governanceAddress).toEqual(expectedAddress);
    expect(state.unicrowClaim).toEqual(expectedAddress);
    expect(state.escrowIdCounter).toEqual({ _value: 1n });
  }, 240_000);
});
