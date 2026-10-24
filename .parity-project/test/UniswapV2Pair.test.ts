import { expect } from "chai";
import {
  AddressZero,
  MaxUint112,
  MaxUint256,
  deployNoReturnToken,
  deployToken,
  ethers,
  increaseTime,
} from "./helpers.js";

const Q112 = 1n << 112n;

describe("UniswapV2Pair", () => {
  let owner: any;
  let other: any;
  let feeTo: any;
  let factory: any;
  let pair: any;
  let token0: any;
  let token1: any;
  let pairAddress: string;

  async function mintLiquidity(amount0: bigint, amount1: bigint) {
    await token0.mint(pairAddress, amount0);
    await token1.mint(pairAddress, amount1);
    return pair.mint(owner.address);
  }

  beforeEach(async () => {
    [owner, other, feeTo] = await ethers.getSigners();
    factory = await ethers.deployContract("UniswapV2Factory", [owner.address]);
    await factory.waitForDeployment();

    const a = await deployToken("Token A", "A", owner);
    const b = await deployToken("Token B", "B", owner);
    const aAddress = await a.getAddress();
    const bAddress = await b.getAddress();
    await factory.createPair(aAddress, bAddress);
    pairAddress = await factory.getPair(aAddress, bAddress);
    pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    token0 = await ethers.getContractAt("TestERC20", await pair.token0());
    token1 = await ethers.getContractAt("TestERC20", await pair.token1());
  });

  it("stores the factory and the sorted tokens", async () => {
    expect(await pair.factory()).to.equal(await factory.getAddress());
    expect(await pair.token0()).to.equal(await token0.getAddress());
    expect(await pair.token1()).to.equal(await token1.getAddress());
    expect(await pair.MINIMUM_LIQUIDITY()).to.equal(1000n);
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(0n);
    expect(reserves[1]).to.equal(0n);
    expect(reserves[2]).to.equal(0n);
  });

  describe("initialize", () => {
    it("can only be called by the factory", async () => {
      await expect(
        pair.connect(other).initialize(await token0.getAddress(), await token1.getAddress())
      ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    });
  });

  describe("mint", () => {
    it("mints the first liquidity and permanently locks the minimum", async () => {
      await expect(mintLiquidity(10000n, 10000n))
        .to.emit(pair, "Mint")
        .withArgs(owner.address, 10000n, 10000n);
      expect(await pair.totalSupply()).to.equal(10000n);
      expect(await pair.balanceOf(owner.address)).to.equal(9000n);
      expect(await pair.balanceOf(AddressZero)).to.equal(1000n);
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(10000n);
      expect(reserves[1]).to.equal(10000n);
      expect(reserves[2]).to.not.equal(0n);
    });

    it("rejects a first mint that cannot cover the minimum liquidity", async () => {
      await expect(mintLiquidity(1000n, 1000n)).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED"
      );
    });

    it("mints proportional liquidity for subsequent deposits", async () => {
      await mintLiquidity(10000n, 10000n);
      await mintLiquidity(1000n, 1000n);
      expect(await pair.balanceOf(owner.address)).to.equal(10000n);
      expect(await pair.totalSupply()).to.equal(11000n);
    });

    it("rejects a deposit that mints no liquidity", async () => {
      await mintLiquidity(10000n, 10000n);
      await token0.mint(pairAddress, 1000n);
      await expect(pair.mint(owner.address)).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED"
      );
    });

    it("rejects balances that do not fit in uint112", async () => {
      const tooMuch = MaxUint112 + 1n;
      await token0.mint(pairAddress, tooMuch);
      await token1.mint(pairAddress, tooMuch);
      await expect(pair.mint(owner.address)).to.be.revertedWith("UniswapV2: OVERFLOW");
    });

    it("skips the fee mint when reserves have not grown", async () => {
      await factory.setFeeTo(feeTo.address);
      await mintLiquidity(10000n, 10000n);
      await mintLiquidity(1000n, 1000n);
      expect(await pair.balanceOf(feeTo.address)).to.equal(0n);
    });

    it("mints protocol fees after reserve growth when feeTo is set", async () => {
      await factory.setFeeTo(feeTo.address);
      await mintLiquidity(10000n, 10000n);
      await token0.mint(pairAddress, 5000n);
      await pair.swap(0n, 3300n, other.address, "0x");

      await token0.mint(pairAddress, 1000n);
      await token1.mint(pairAddress, 1000n);
      await pair.mint(owner.address);

      expect(await pair.balanceOf(feeTo.address)).to.be.gt(0n);
    });

    it("skips the fee mint when the fee amount rounds to zero", async () => {
      await factory.setFeeTo(feeTo.address);
      await mintLiquidity(2000n, 2000n);
      await token0.mint(pairAddress, 5n);
      await pair.swap(0n, 2n, other.address, "0x");

      const feeBalanceBefore = await pair.balanceOf(feeTo.address);
      await token0.mint(pairAddress, 1000n);
      await token1.mint(pairAddress, 1000n);
      await pair.mint(owner.address);

      expect(await pair.balanceOf(feeTo.address)).to.equal(feeBalanceBefore);
      expect(await pair.balanceOf(owner.address)).to.equal(1997n);
    });

    it("clears kLast when fees are turned off", async () => {
      await factory.setFeeTo(feeTo.address);
      await mintLiquidity(10000n, 10000n);
      await token0.mint(pairAddress, 5000n);
      await pair.swap(0n, 3300n, other.address, "0x");
      await factory.setFeeTo(AddressZero);

      await token0.mint(pairAddress, 1000n);
      await token1.mint(pairAddress, 1000n);
      await pair.mint(owner.address);
      expect(await pair.kLast()).to.equal(0n);
    });

    describe("with a migrator", () => {
      let migrator: any;

      beforeEach(async () => {
        migrator = await ethers.deployContract("TestMigrator", []);
        await migrator.waitForDeployment();
        await factory.setMigrator(await migrator.getAddress());
      });

      it("uses the migrator desired liquidity instead of the minimum", async () => {
        await token0.mint(pairAddress, 10000n);
        await token1.mint(pairAddress, 10000n);
        await migrator.setDesired(5000n);
        await migrator.mint(pairAddress, owner.address);
        expect(await pair.totalSupply()).to.equal(5000n);
        expect(await pair.balanceOf(owner.address)).to.equal(5000n);
        expect(await pair.balanceOf(AddressZero)).to.equal(0n);
      });

      it("rejects zero desired liquidity", async () => {
        await token0.mint(pairAddress, 10000n);
        await token1.mint(pairAddress, 10000n);
        await migrator.setDesired(0n);
        await expect(migrator.mint(pairAddress, owner.address)).to.be.revertedWith(
          "Bad desired liquidity"
        );
      });

      it("rejects max desired liquidity", async () => {
        await token0.mint(pairAddress, 10000n);
        await token1.mint(pairAddress, 10000n);
        await migrator.setDesired(MaxUint256);
        await expect(migrator.mint(pairAddress, owner.address)).to.be.revertedWith(
          "Bad desired liquidity"
        );
      });

      it("blocks the first mint from addresses other than the migrator", async () => {
        await token0.mint(pairAddress, 10000n);
        await token1.mint(pairAddress, 10000n);
        await expect(pair.mint(owner.address)).to.be.revertedWith("Must not have migrator");
      });
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await mintLiquidity(10000n, 10000n);
    });

    it("burns liquidity and returns the underlying tokens", async () => {
      const liquidity = await pair.balanceOf(owner.address);
      await pair.transfer(pairAddress, liquidity);
      await expect(pair.burn(other.address))
        .to.emit(pair, "Burn")
        .withArgs(owner.address, 9000n, 9000n, other.address);

      expect(await pair.totalSupply()).to.equal(1000n);
      expect(await pair.balanceOf(owner.address)).to.equal(0n);
      expect(await token0.balanceOf(other.address)).to.equal(9000n);
      expect(await token1.balanceOf(other.address)).to.equal(9000n);
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(1000n);
      expect(reserves[1]).to.equal(1000n);
    });

    it("rejects a burn that returns no tokens", async () => {
      await expect(pair.burn(other.address)).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED"
      );
    });

    it("updates kLast when fees are on", async () => {
      await factory.setFeeTo(feeTo.address);
      await token0.mint(pairAddress, 5000n);
      await pair.swap(0n, 3300n, other.address, "0x");
      const liquidity = await pair.balanceOf(owner.address);
      await pair.transfer(pairAddress, liquidity);
      await pair.burn(other.address);
      const reserves = await pair.getReserves();
      expect(await pair.kLast()).to.equal(reserves[0] * reserves[1]);
    });

    it("reverts when an underlying transfer fails", async () => {
      await token0.setFailTransfers(true);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.transfer(pairAddress, liquidity);
      await expect(pair.burn(other.address)).to.be.revertedWith(
        "UniswapV2: TRANSFER_FAILED"
      );
    });
  });

  describe("swap", () => {
    beforeEach(async () => {
      await mintLiquidity(10000n, 10000n);
    });

    it("rejects zero output", async () => {
      await expect(pair.swap(0n, 0n, other.address, "0x")).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT"
      );
    });

    it("rejects output at or above the reserve", async () => {
      await expect(pair.swap(0n, 10000n, other.address, "0x")).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_LIQUIDITY"
      );
      await expect(pair.swap(10000n, 0n, other.address, "0x")).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("rejects sending output to one of the tokens", async () => {
      await expect(
        pair.swap(1n, 0n, await token0.getAddress(), "0x")
      ).to.be.revertedWith("UniswapV2: INVALID_TO");
      await expect(
        pair.swap(0n, 1n, await token1.getAddress(), "0x")
      ).to.be.revertedWith("UniswapV2: INVALID_TO");
    });

    it("reverts when the output transfer fails", async () => {
      await token0.setFailTransfers(true);
      await expect(pair.swap(1n, 0n, other.address, "0x")).to.be.revertedWith(
        "UniswapV2: TRANSFER_FAILED"
      );
    });

    it("requires an input amount", async () => {
      await expect(pair.swap(1n, 0n, other.address, "0x")).to.be.revertedWith(
        "UniswapV2: INSUFFICIENT_INPUT_AMOUNT"
      );
    });

    it("enforces the invariant", async () => {
      await token0.mint(pairAddress, 1n);
      await expect(pair.swap(0n, 1n, other.address, "0x")).to.be.revertedWith("UniswapV2: K");
    });

    it("swaps tokens and updates reserves and price accumulators", async () => {
      const before = await pair.getReserves();
      await increaseTime(10);
      await token0.mint(pairAddress, 1000n);
      const tx = await pair.swap(0n, 900n, other.address, "0x");
      await expect(tx)
        .to.emit(pair, "Swap")
        .withArgs(owner.address, 1000n, 0n, 0n, 900n, other.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const elapsed = BigInt(block!.timestamp) - before[2];

      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(11000n);
      expect(reserves[1]).to.equal(9100n);
      expect(await token1.balanceOf(other.address)).to.equal(900n);
      expect(await pair.price0CumulativeLast()).to.equal(Q112 * elapsed);
      expect(await pair.price1CumulativeLast()).to.equal(Q112 * elapsed);
    });

    it("swaps in the other direction", async () => {
      await token1.mint(pairAddress, 500n);
      await expect(pair.swap(400n, 0n, other.address, "0x"))
        .to.emit(pair, "Swap")
        .withArgs(owner.address, 0n, 500n, 400n, 0n, other.address);
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(9600n);
      expect(reserves[1]).to.equal(10500n);
    });

    it("supports a flash swap callback that repays the pair", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      await token1.mint(await callee.getAddress(), 110n);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [await token1.getAddress(), 110n, 0n]
      );
      await expect(pair.swap(100n, 0n, await callee.getAddress(), data))
        .to.emit(pair, "Swap")
        .withArgs(owner.address, 0n, 110n, 100n, 0n, await callee.getAddress());
      expect(await token0.balanceOf(await callee.getAddress())).to.equal(100n);
    });

    it("rejects reentrancy from the flash swap callback", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [AddressZero, 0n, 1n]
      );
      await expect(
        pair.swap(100n, 0n, await callee.getAddress(), data)
      ).to.be.revertedWith("UniswapV2: LOCKED");
    });

    it("rejects reentrant burn calls", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [AddressZero, 0n, 2n]
      );
      await expect(
        pair.swap(100n, 0n, await callee.getAddress(), data)
      ).to.be.revertedWith("UniswapV2: LOCKED");
    });

    it("rejects reentrant swap calls", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [AddressZero, 0n, 3n]
      );
      await expect(
        pair.swap(100n, 0n, await callee.getAddress(), data)
      ).to.be.revertedWith("UniswapV2: LOCKED");
    });

    it("rejects reentrant skim calls", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [AddressZero, 0n, 4n]
      );
      await expect(
        pair.swap(100n, 0n, await callee.getAddress(), data)
      ).to.be.revertedWith("UniswapV2: LOCKED");
    });

    it("rejects reentrant sync calls", async () => {
      const callee = await ethers.deployContract("TestCallee", []);
      await callee.waitForDeployment();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint8"],
        [AddressZero, 0n, 5n]
      );
      await expect(
        pair.swap(100n, 0n, await callee.getAddress(), data)
      ).to.be.revertedWith("UniswapV2: LOCKED");
    });

    it("accepts tokens that return no data on transfer", async () => {
      const nrt = await deployNoReturnToken(owner);
      const normal = await deployToken("Normal", "N", owner);
      const localFactory = await ethers.deployContract("UniswapV2Factory", [
        owner.address,
      ]);
      await localFactory.waitForDeployment();
      await localFactory.createPair(await nrt.getAddress(), await normal.getAddress());
      const customPairAddress = await localFactory.getPair(
        await nrt.getAddress(),
        await normal.getAddress()
      );
      const customPair = await ethers.getContractAt("UniswapV2Pair", customPairAddress);
      const nrtIsToken0 = (await customPair.token0()) === (await nrt.getAddress());

      await nrt.mint(customPairAddress, 10000n);
      await normal.mint(customPairAddress, 10000n);
      await customPair.mint(owner.address);
      await normal.mint(customPairAddress, 1000n);

      if (nrtIsToken0) {
        await customPair.swap(900n, 0n, other.address, "0x");
      } else {
        await customPair.swap(0n, 900n, other.address, "0x");
      }
      expect(await nrt.balanceOf(other.address)).to.equal(900n);
    });
  });

  describe("skim", () => {
    beforeEach(async () => {
      await mintLiquidity(10000n, 10000n);
    });

    it("transfers excess balances without changing reserves", async () => {
      await token0.mint(pairAddress, 100n);
      await token1.mint(pairAddress, 50n);
      await pair.skim(other.address);
      expect(await token0.balanceOf(other.address)).to.equal(100n);
      expect(await token1.balanceOf(other.address)).to.equal(50n);
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(10000n);
      expect(reserves[1]).to.equal(10000n);
    });
  });

  describe("sync", () => {
    beforeEach(async () => {
      await mintLiquidity(10000n, 10000n);
    });

    it("forces reserves to match balances and updates price accumulators", async () => {
      const before = await pair.getReserves();
      await token0.mint(pairAddress, 100n);
      await token1.mint(pairAddress, 50n);
      await increaseTime(5);
      const tx = await pair.sync();
      await expect(tx)
        .to.emit(pair, "Sync")
        .withArgs(10100n, 10050n);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const elapsed = BigInt(block!.timestamp) - before[2];

      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(10100n);
      expect(reserves[1]).to.equal(10050n);
      expect(await pair.price0CumulativeLast()).to.equal(Q112 * elapsed);
      expect(await pair.price1CumulativeLast()).to.equal(Q112 * elapsed);
    });
  });
});
