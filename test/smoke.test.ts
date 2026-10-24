import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('solidhat smoke', () => {
  it('provides signers', async () => {
    const [owner] = await ethers.getSigners();
    expect(await owner.getAddress()).to.be.properAddress;
  });
});
