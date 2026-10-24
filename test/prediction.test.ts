import { readFileSync } from 'fs';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract } from '@solidcash/solidcash';
import { deriveLogicalCreateAddress } from '@solidcash/solidcash/stateful';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';

const pairArtifact = JSON.parse(readFileSync('.sushi/artifacts/solidcash/UniswapV2Pair.json', 'utf8'));

describe('pair address prediction', () => {
  it('predicts the locking address from the template and the funding category', async () => {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.deployContract('UniswapV2Factory', [owner.address]);
    await factory.waitForDeployment();
    const provider = ethers.provider as any;
    const funding = (await provider.getUtxos(owner.address))
      .find((utxo: any) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 10_000n);
    expect(funding).to.not.equal(undefined);

    // The child category is the funding outpoint's txid. With the pair template and that category, the SDK
    // derives the p2sh32 address before the deployment transaction exists.
    const predicted = new Contract(pairArtifact, [], {
      provider,
      category: hexToBin(funding.txid),
      addressType: 'p2sh32',
    } as any);

    const logicalNonce = await (owner as any).getNonce();
    const predictedLogical = deriveLogicalCreateAddress(owner.address, logicalNonce);

    const pair = await ethers.deployContract('UniswapV2Pair', [await factory.getAddress()], owner, {
      fundingUtxo: funding,
      funder: (owner as any).unlockP2PKH(),
      changeAddress: owner.address,
    });
    await pair.waitForDeployment();

    expect((pair as any).address).to.equal((predicted as any).address);
    expect(await pair.getAddress()).to.equal(predictedLogical);
  });
});
