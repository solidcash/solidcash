import { ethers } from 'hardhat';
import { expect } from 'chai';
import { cashAddressToLockingBytecode } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';

describe('UniswapV2Pair (directly deployed)', () => {
  let pair: any;
  let tokenA: any;
  let tokenB: any;
  let owner: any;
  let other: any;
  let lockA: Uint8Array;
  let lockB: Uint8Array;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    tokenA = await ethers.deployContract('TestERC20', ['A', 'A']);
    tokenB = await ethers.deployContract('TestERC20', ['B', 'B']);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    pair = await ethers.deployContract('UniswapV2Pair', [owner.address]);
    await pair.waitForDeployment();
    lockA = (cashAddressToLockingBytecode(await tokenA.getAddress()) as any).bytecode;
    lockB = (cashAddressToLockingBytecode(await tokenB.getAddress()) as any).bytecode;
  });

  it('records the deployer as the factory', async () => {
    const ownerLock = (cashAddressToLockingBytecode(owner.address) as any).bytecode as Uint8Array;
    expect(Buffer.from(await pair.call.factory()).toString('hex')).to.equal(Buffer.from(ownerLock.slice(3, 23)).toString('hex'));
  });

  it('initializes once from the factory and exposes empty reserves', async () => {
    await pair.initialize(lockA, lockB);
    const reserves = await pair.call.getReserves();
    expect(reserves[0]).to.equal(0n);
    expect(reserves[1]).to.equal(0n);
    expect(reserves[2]).to.equal(0n);
    expect(Buffer.from(await pair.call.token0()).toString('hex')).to.equal(Buffer.from(hash160(lockA)).toString('hex'));
    expect(Buffer.from(await pair.call.token1()).toString('hex')).to.equal(Buffer.from(hash160(lockB)).toString('hex'));
  });

  it('initializes only once', async () => {
    await pair.initialize(lockA, lockB);
    await expect(pair.connect(other).initialize(lockA, lockB)).to.be.revertedWith('UniswapV2: INITIALIZED');
  });

  it('exposes the LP token metadata', async () => {
    expect(await pair.call.name()).to.equal('SushiSwap LP Token');
    expect(await pair.call.symbol()).to.equal('SLP');
    expect(await pair.call.decimals()).to.equal(18n);
    expect(await pair.call.totalSupply()).to.equal(0n);
    expect(await pair.call.balanceOf(owner.address)).to.equal(0n);
  });

  it('handles LP token approvals and zero-value transfers', async () => {
    await pair.approve(other.address, 100n);
    expect(await pair.call.allowance(owner.address, other.address)).to.equal(100n);
    await pair.transfer(other.address, 0n);
    expect(await pair.call.balanceOf(other.address)).to.equal(0n);
    await expect(pair.transfer(other.address, 1n)).to.be.revertedWith('ds-math-sub-underflow');
  });
});
