import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('TestERC20', () => {
  let token: any;
  let owner: any;
  let other: any;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    token = await ethers.deployContract('TestERC20', ['Token', 'TKN']);
    await token.waitForDeployment();
  });

  it('exposes metadata and starts empty', async () => {
    expect(await token.call.name()).to.equal('Token');
    expect(await token.call.symbol()).to.equal('TKN');
    expect(await token.call.decimals()).to.equal(18n);
    expect(await token.call.totalSupply()).to.equal(0n);
    expect(await token.call.balanceOf(owner.address)).to.equal(0n);
  });

  it('mints and transfers', async () => {
    await token.mint(owner.address, 1000n);
    expect(await token.call.totalSupply()).to.equal(1000n);
    await token.transfer(other.address, 400n);
    expect(await token.call.balanceOf(owner.address)).to.equal(600n);
    expect(await token.call.balanceOf(other.address)).to.equal(400n);
  });

  it('approves and spends an allowance', async () => {
    await token.mint(owner.address, 1000n);
    await token.approve(other.address, 300n);
    expect(await token.call.allowance(owner.address, other.address)).to.equal(300n);
    await token.connect(other).transferFrom(owner.address, other.address, 200n);
    expect(await token.call.balanceOf(other.address)).to.equal(200n);
    expect(await token.call.allowance(owner.address, other.address)).to.equal(100n);
  });

  it('keeps an unlimited allowance', async () => {
    await token.mint(owner.address, 1000n);
    await token.approve(other.address, ethers.MaxUint256);
    await token.connect(other).transferFrom(owner.address, other.address, 700n);
    expect(await token.call.allowance(owner.address, other.address)).to.equal(ethers.MaxUint256);
  });

  it('charges a configured transfer fee', async () => {
    await token.mint(owner.address, 10_000n);
    await token.setFeeBps(100n);
    await token.transfer(other.address, 1_000n);
    expect(await token.call.balanceOf(other.address)).to.equal(990n);
    expect(await token.call.totalSupply()).to.equal(9_990n);
  });

  it('reverts when transfers are configured to revert', async () => {
    await token.mint(owner.address, 10n);
    await token.setRevertTransfers(true);
    await expect(token.transfer(other.address, 1n)).to.be.revertedWith('TestERC20: TRANSFER_REVERTED');
  });

  it('rejects a transfer larger than the balance', async () => {
    await token.mint(owner.address, 1n);
    await expect(token.transfer(other.address, 2n)).to.be.revertedWith('TestERC20: BALANCE');
  });
});
