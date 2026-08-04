/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-expressions */
/**
 * Drop-in demo: this file uses the SAME bare imports a ported Hardhat/ethers/chai test would
 * (`hardhat`, `chai`, `@nomicfoundation/hardhat-network-helpers`), resolved to the SolidCash harness via the
 * Vitest aliases in ../vitest.config.ts. No import path here mentions "solidcash".
 */
import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { loadFixture, time, mine } from '@nomicfoundation/hardhat-network-helpers';
import { Contract, TransactionBuilder, randomUtxo } from 'solidcash';
import exampleArtifact from '../artifacts/solidcash/example.artifact.js';

async function deployExampleFixture() {
  const [owner, alice, bob] = await ethers.getSigners();
  const contract = new Contract(exampleArtifact, [], { provider: network.provider });
  await network.provider.addUtxo(contract.address, randomUtxo());
  return { contract, owner, alice, bob };
}

describe('Example (ported-style: bare hardhat/chai/network-helpers imports)', () => {
  it('deploys and exposes named signers', async () => {
    const { owner, alice } = await loadFixture(deployExampleFixture);
    expect(owner.getAddress()).to.not.equal(alice.getAddress());
    expect(owner.getAddress()).to.be.properAddress;
  });

  it('reverts with the require reason', async () => {
    const { contract } = await loadFixture(deployExampleFixture);
    const [utxo] = await network.provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider: network.provider })
      .addInput(utxo, contract.unlock.test(0n))
      .addOutput({ to: contract.address, amount: 10000n });
    await expect(tx).to.be.revertedWith(/Wrong value passed/);
  });

  it('supports time and block helpers', async () => {
    await loadFixture(deployExampleFixture);
    const h0 = await network.provider.getBlockHeight();
    await mine(3);
    expect(await network.provider.getBlockHeight()).to.equal(h0 + 3);
    const t0 = await time.latest();
    await time.increase(60);
    expect((await time.latest()) - t0).to.equal(60);
  });
});
