import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('UniswapV2Factory', () => {
  let factory: any;
  let owner: any;
  let other: any;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    factory = await ethers.deployContract('UniswapV2Factory', [owner.address]);
    await factory.waitForDeployment();
  });

  it('records the fee setter and starts with zero addresses', async () => {
    expect(await factory.call.feeToSetter()).to.equal(owner.address);
    expect(await factory.call.feeTo()).to.equal(ethers.ZeroAddress);
    expect(await factory.call.migrator()).to.equal(ethers.ZeroAddress);
    expect(await factory.call.allPairsLength()).to.equal(0n);
  });

  it('lets the fee setter update feeTo and migrator', async () => {
    await factory.setFeeTo(other.address);
    expect(await factory.call.feeTo()).to.equal(other.address);
    await factory.setMigrator(other.address);
    expect(await factory.call.migrator()).to.equal(other.address);
    await factory.setFeeToSetter(other.address);
    expect(await factory.call.feeToSetter()).to.equal(other.address);
  });

  it('rejects admin calls from anyone else', async () => {
    await expect(factory.connect(other).setFeeTo(other.address))
      .to.be.revertedWith('UniswapV2: FORBIDDEN');
    await expect(factory.connect(other).setMigrator(other.address))
      .to.be.revertedWith('UniswapV2: FORBIDDEN');
    await expect(factory.connect(other).setFeeToSetter(other.address))
      .to.be.revertedWith('UniswapV2: FORBIDDEN');
  });

  it('returns zero for an unknown pair and a non-zero code hash', async () => {
    expect(await factory.call.getPair(other.address, other.address)).to.equal(ethers.ZeroAddress);
    const hash = await factory.call.pairCodeHash();
    expect(hash).to.not.equal('0x' + '00'.repeat(32));
  });
});
