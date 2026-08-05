/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any */
import { SignatureTemplate } from 'solidcash';
import { ethers, loadFixture } from '@solidcash/testing';
import { expect } from '@solidcash/testing/chai';

async function deployGoldenTokenFixture() {
  const [owner] = await ethers.getSigners();
  const factory = await ethers.getContractFactory('GoldenToken', owner);
  const token = await factory.deploy(owner.publicKey, {
    initialState: { totalSupply: 0n, ownerBalance: 0n },
  });
  await token.waitForDeployment();
  return { token: token as any, owner };
}

describe('maintained stateful golden path', () => {
  it('deploys, calls, decodes event arguments, and reads state', async () => {
    const { token, owner } = await loadFixture(deployGoldenTokenFixture);
    const mint = token.mint(25n, new SignatureTemplate(owner.privateKey));

    await expect(mint).to.emit(token, 'Mint').withArgs(25n, 25n);
    const state = await token.getState();
    expect(state.totalSupply).to.equal(25n);
    expect(state.ownerBalance).to.equal(25n);
  });

  it('asserts a failed call with its source reason', async () => {
    const { token, owner } = await loadFixture(deployGoldenTokenFixture);
    const burn = token.burn(1n, new SignatureTemplate(owner.privateKey));
    await expect(burn).to.be.revertedWith(/Insufficient balance/);
  });

  it('restores the fixture state and reruns the successful path', async () => {
    const { token, owner } = await loadFixture(deployGoldenTokenFixture);
    expect((await token.getState()).totalSupply).to.equal(0n);

    await token.mint(10n, new SignatureTemplate(owner.privateKey)).send();
    expect((await token.getState()).totalSupply).to.equal(10n);
  });
});
