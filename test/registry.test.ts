import { ethers } from 'hardhat';
import { expect } from 'chai';
import { cashAddressToLockingBytecode } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';

describe('BCH-native pair registry', () => {
  let owner: any;
  let tokenA: any;
  let tokenB: any;
  let factory: any;
  let pair: any;
  let lockA: Uint8Array;
  let lockB: Uint8Array;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    tokenA = await ethers.deployContract('TestERC20', ['A', 'A']);
    tokenB = await ethers.deployContract('TestERC20', ['B', 'B']);
    factory = await ethers.deployContract('UniswapV2Factory', [owner.address]);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    await factory.waitForDeployment();
    lockA = (cashAddressToLockingBytecode(await tokenA.getAddress()) as any).bytecode as Uint8Array;
    lockB = (cashAddressToLockingBytecode(await tokenB.getAddress()) as any).bytecode as Uint8Array;
    pair = await ethers.deployContract('UniswapV2Pair', [await factory.getAddress()]);
    await pair.waitForDeployment();
    // initialize with the canonical order the registry sorts to
    const [token0, token1] = Buffer.compare(Buffer.from(lockA), Buffer.from(lockB)) < 0
      ? [lockA, lockB] : [lockB, lockA];
    await pair.initialize(token0, token1);
  });

  it('deploys, initializes and registers the pair', async () => {
    await factory.registerPair(lockA, lockB, await pair.getAddress());
    expect(await factory.call.allPairsLength()).to.equal(1n);
    const forward = await factory.call.getPair(lockA, lockB);
    const reverse = await factory.call.getPair(lockB, lockA);
    expect(binToHex(forward as Uint8Array)).to.equal(binToHex(reverse as Uint8Array));
    expect(await pair.call.factory()).to.not.equal(ethers.ZeroAddress);
    const [token0, token1] = Buffer.compare(Buffer.from(lockA), Buffer.from(lockB)) < 0
      ? [lockA, lockB] : [lockB, lockA];
    expect(Buffer.from(await pair.call.token0()).toString('hex')).to.equal(binToHex(hash160(token0)));
    expect(Buffer.from(await pair.call.token1()).toString('hex')).to.equal(binToHex(hash160(token1)));
  });

  it('rejects a second registration for the same pair', async () => {
    await factory.registerPair(lockA, lockB, await pair.getAddress());
    await expect(factory.registerPair(lockA, lockB, await pair.getAddress()))
      .to.be.revertedWith('UniswapV2: PAIR_EXISTS');
  });

  it('discovers the pair through the library registry read', async () => {
    await factory.registerPair(lockA, lockB, await pair.getAddress());
    const pairAddress = await pair.getAddress();
    const pairLock = (cashAddressToLockingBytecode(pairAddress) as any).bytecode as Uint8Array;
    const [token0, token1] = Buffer.compare(Buffer.from(lockA), Buffer.from(lockB)) < 0
      ? [lockA, lockB] : [lockB, lockA];
    const lib = await ethers.deployContract('UniswapV2LibraryTest');
    await lib.waitForDeployment();
    const found = await (lib.call.pairFor(await factory.getAddress(), lockA, lockB) as any)
      .withExternalCall(factory, 'getPair', [token0, token1])
      .staticCall();
    expect(binToHex(found as Uint8Array)).to.equal(binToHex(hash160(pairLock)));

    const reserves = await (lib.call.getReserves(await factory.getAddress(), lockA, lockB) as any)
      .withExternalCall(factory, 'getPair', [token0, token1])
      .withExternalCall(pair, 'getReserves', [])
      .staticCall();
    expect(reserves[0]).to.equal(0n);
    expect(reserves[1]).to.equal(0n);
  });

  it('rejects registration from a non-admin', async () => {
    const [, other] = await ethers.getSigners();
    await expect(factory.connect(other).registerPair(lockA, lockB, await pair.getAddress()))
      .to.be.revertedWith('UniswapV2: FORBIDDEN');
  });
});
