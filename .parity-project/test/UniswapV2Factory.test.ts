import { expect } from "chai";
import { artifacts } from "hardhat";
import {
  AddressZero,
  deployToken,
  ethers,
  sortTokens,
} from "./helpers.js";

describe("UniswapV2Factory", () => {
  let feeToSetter: any;
  let other: any;
  let factory: any;
  let tokenA: any;
  let tokenB: any;
  let tokenC: any;
  let tokenAAddress: string;
  let tokenBAddress: string;
  let tokenCAddress: string;

  beforeEach(async () => {
    [feeToSetter, other] = await ethers.getSigners();
    factory = await ethers.deployContract("UniswapV2Factory", [feeToSetter.address]);
    await factory.waitForDeployment();
    tokenA = await deployToken("Token A", "A", feeToSetter);
    tokenB = await deployToken("Token B", "B", feeToSetter);
    tokenC = await deployToken("Token C", "C", feeToSetter);
    tokenAAddress = await tokenA.getAddress();
    tokenBAddress = await tokenB.getAddress();
    tokenCAddress = await tokenC.getAddress();
  });

  it("sets the constructor arguments", async () => {
    expect(await factory.feeToSetter()).to.equal(feeToSetter.address);
    expect(await factory.feeTo()).to.equal(AddressZero);
    expect(await factory.migrator()).to.equal(AddressZero);
    expect(await factory.allPairsLength()).to.equal(0n);
  });

  it("reports the hash of the pair creation code", async () => {
    const artifact = await artifacts.readArtifact("UniswapV2Pair");
    expect(await factory.pairCodeHash()).to.equal(ethers.keccak256(artifact.bytecode));
  });

  describe("createPair", () => {
    it("creates and initializes a pair, sorted by token address", async () => {
      const [token0, token1] = sortTokens(tokenAAddress, tokenBAddress);
      const salt = ethers.keccak256(
        ethers.solidityPacked(["address", "address"], [token0, token1])
      );
      const pairAddress = ethers.getCreate2Address(
        await factory.getAddress(),
        salt,
        await factory.pairCodeHash()
      );

      await expect(factory.createPair(tokenBAddress, tokenAAddress))
        .to.emit(factory, "PairCreated")
        .withArgs(token0, token1, pairAddress, 1n);

      expect(await factory.getPair(tokenAAddress, tokenBAddress)).to.equal(pairAddress);
      expect(await factory.getPair(tokenBAddress, tokenAAddress)).to.equal(pairAddress);
      expect(await factory.allPairs(0)).to.equal(pairAddress);
      expect(await factory.allPairsLength()).to.equal(1n);

      const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
      expect(await pair.factory()).to.equal(await factory.getAddress());
      expect(await pair.token0()).to.equal(token0);
      expect(await pair.token1()).to.equal(token1);
    });

    it("deploys the pair at the CREATE2 address", async () => {
      await factory.createPair(tokenAAddress, tokenBAddress);
      const [token0, token1] = sortTokens(tokenAAddress, tokenBAddress);
      const salt = ethers.keccak256(
        ethers.solidityPacked(["address", "address"], [token0, token1])
      );
      const predicted = ethers.getCreate2Address(
        await factory.getAddress(),
        salt,
        await factory.pairCodeHash()
      );
      expect(await factory.getPair(tokenAAddress, tokenBAddress)).to.equal(predicted);
    });

    it("supports more than one pair", async () => {
      await factory.createPair(tokenAAddress, tokenBAddress);
      await factory.createPair(tokenBAddress, tokenCAddress);
      expect(await factory.allPairsLength()).to.equal(2n);
      expect(await factory.allPairs(1)).to.equal(
        await factory.getPair(tokenBAddress, tokenCAddress)
      );
    });

    it("rejects identical token addresses", async () => {
      await expect(factory.createPair(tokenAAddress, tokenAAddress)).to.be.revertedWith(
        "UniswapV2: IDENTICAL_ADDRESSES"
      );
    });

    it("rejects the zero address", async () => {
      await expect(factory.createPair(AddressZero, tokenAAddress)).to.be.revertedWith(
        "UniswapV2: ZERO_ADDRESS"
      );
    });

    it("rejects an existing pair regardless of argument order", async () => {
      await factory.createPair(tokenAAddress, tokenBAddress);
      await expect(factory.createPair(tokenBAddress, tokenAAddress)).to.be.revertedWith(
        "UniswapV2: PAIR_EXISTS"
      );
    });
  });

  describe("setFeeTo", () => {
    it("lets the feeToSetter set the fee recipient", async () => {
      await factory.connect(feeToSetter).setFeeTo(other.address);
      expect(await factory.feeTo()).to.equal(other.address);
    });

    it("allows clearing the fee recipient", async () => {
      await factory.connect(feeToSetter).setFeeTo(other.address);
      await factory.connect(feeToSetter).setFeeTo(AddressZero);
      expect(await factory.feeTo()).to.equal(AddressZero);
    });

    it("rejects other callers", async () => {
      await expect(
        factory.connect(other).setFeeTo(other.address)
      ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    });
  });

  describe("setMigrator", () => {
    it("lets the feeToSetter set the migrator", async () => {
      await factory.connect(feeToSetter).setMigrator(other.address);
      expect(await factory.migrator()).to.equal(other.address);
    });

    it("rejects other callers", async () => {
      await expect(
        factory.connect(other).setMigrator(other.address)
      ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    });
  });

  describe("setFeeToSetter", () => {
    it("transfers the setter role", async () => {
      await factory.connect(feeToSetter).setFeeToSetter(other.address);
      expect(await factory.feeToSetter()).to.equal(other.address);
      await expect(factory.connect(feeToSetter).setFeeTo(other.address)).to.be.revertedWith(
        "UniswapV2: FORBIDDEN"
      );
      await factory.connect(other).setFeeTo(other.address);
      expect(await factory.feeTo()).to.equal(other.address);
    });

    it("rejects other callers", async () => {
      await expect(
        factory.connect(other).setFeeToSetter(other.address)
      ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    });
  });
});
