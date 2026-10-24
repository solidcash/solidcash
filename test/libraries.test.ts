import { ethers } from 'hardhat';
import { expect } from 'chai';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { hexToBin, binToHex } from '@bitauth/libauth/build/lib/format/hex.js';

describe('libraries', () => {
  let owner: any;
  let other: any;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
  });

  it('Math.min and Math.sqrt', async () => {
    const math = await ethers.deployContract('MathTest');
    await math.waitForDeployment();
    expect(await math.call.min(3n, 7n)).to.equal(3n);
    expect(await math.call.min(7n, 3n)).to.equal(3n);
    expect(await math.call.sqrt(0n)).to.equal(0n);
    expect(await math.call.sqrt(1n)).to.equal(1n);
    expect(await math.call.sqrt(4n)).to.equal(2n);
    expect(await math.call.sqrt(9n)).to.equal(3n);
    expect(await math.call.sqrt(10n)).to.equal(3n);
    expect(await math.call.sqrt(100n)).to.equal(10n);
  });

  it('UQ112x112 encode and uqdiv', async () => {
    const uq = await ethers.deployContract('UQ112x112Test');
    await uq.waitForDeployment();
    expect(await uq.call.encode(1n)).to.equal(1n << 112n);
    expect(await uq.call.encode(3n)).to.equal(3n << 112n);
    const encoded = await uq.call.encode(3n);
    expect(await uq.call.uqdiv(encoded, 1n)).to.equal(3n << 112n);
  });

  it('UniswapV2Library quotes and amounts', async () => {
    const lib = await ethers.deployContract('UniswapV2LibraryTest');
    await lib.waitForDeployment();
    expect(await lib.call.quote(1n, 100n, 200n)).to.equal(2n);
    // 1 in against 1,000,000 / 2,000,000 with the 0.3% fee.
    expect(await lib.call.getAmountOut(1n, 1_000_000n, 2_000_000n)).to.equal(1n);
    expect(await lib.call.getAmountIn(1n, 1_000_000n, 2_000_000n)).to.equal(1n);
    expect(await lib.call.getAmountOut(1_000n, 1_000_000n, 2_000_000n)).to.equal(1_992n);
    expect(await lib.call.getAmountIn(1_992n, 1_000_000n, 2_000_000n)).to.equal(1_000n);
  });

  it('UniswapV2Library sorts a token pair', async () => {
    const lib = await ethers.deployContract('UniswapV2LibraryTest');
    await lib.waitForDeployment();
    const a = 'aa20' + '11'.repeat(32) + '87';
    const b = 'aa20' + '22'.repeat(32) + '87';
    const idA = binToHex(hash160(hexToBin(a)));
    const idB = binToHex(hash160(hexToBin(b)));
    const result = await lib.call.sortTokens(`0x${a}`, `0x${b}`);
    expect(binToHex(result[0])).to.equal(idA);
    expect(binToHex(result[1])).to.equal(idB);
    const reversed = await lib.call.sortTokens(`0x${b}`, `0x${a}`);
    expect(binToHex(reversed[0])).to.equal(idA);
    expect(binToHex(reversed[1])).to.equal(idB);
  });

  it('SafeMath rejects underflow, overflow and multiplication overflow', async () => {
    const math = await ethers.deployContract('SafeMathTest');
    await math.waitForDeployment();
    await expect((math as any).sub(1n, 2n).send()).to.be.revertedWith('ds-math-sub-underflow');
    await expect((math as any).add(ethers.MaxUint256, 1n).send()).to.be.revertedWith('ds-math-add-overflow');
    await expect((math as any).mul(ethers.MaxUint256, 2n).send()).to.be.revertedWith('ds-math-mul-overflow');
  });

  it('TransferHelper moves tokens through approvals and balances', async () => {
    const token = await ethers.deployContract('TestERC20', ['Token', 'TKN']);
    const helper = await ethers.deployContract('TransferHelperTest');
    await token.waitForDeployment();
    await helper.waitForDeployment();
    const helperAddress = await helper.getAddress();
    const tokenAddress = await token.getAddress();
    await token.mint(helperAddress, 1_000n);
    await token.mint(owner.address, 1_000n);
    await helper.safeApprove(tokenAddress, other.address, 100n);
    expect(await token.call.allowance(helperAddress, other.address)).to.equal(100n);
    await helper.safeTransfer(tokenAddress, other.address, 50n);
    expect(await token.call.balanceOf(other.address)).to.equal(50n);
    expect(await token.call.balanceOf(helperAddress)).to.equal(950n);
    await token.approve(helperAddress, 60n);
    await helper.safeTransferFrom(tokenAddress, owner.address, other.address, 60n);
    expect(await token.call.balanceOf(other.address)).to.equal(110n);
    expect(await token.call.balanceOf(owner.address)).to.equal(940n);
  });
});
