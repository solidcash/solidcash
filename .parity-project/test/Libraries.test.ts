import { expect } from "chai";
import {
  AddressZero,
  MaxUint256,
  deployNoReturnToken,
  deploySushiFactory,
  deployToken,
  ethers,
  pairFor,
  sortTokens,
} from "./helpers.js";

const Q112 = 1n << 112n;

describe("Libraries", () => {
  let owner: any;
  let other: any;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  describe("Math", () => {
    let math: any;

    beforeEach(async () => {
      math = await ethers.deployContract("MathTest", []);
      await math.waitForDeployment();
    });

    it("returns the smaller value", async () => {
      expect(await math.min(1n, 2n)).to.equal(1n);
      expect(await math.min(2n, 1n)).to.equal(1n);
      expect(await math.min(2n, 2n)).to.equal(2n);
    });

    it("computes integer square roots", async () => {
      expect(await math.sqrt(0n)).to.equal(0n);
      expect(await math.sqrt(1n)).to.equal(1n);
      expect(await math.sqrt(2n)).to.equal(1n);
      expect(await math.sqrt(3n)).to.equal(1n);
      expect(await math.sqrt(4n)).to.equal(2n);
      expect(await math.sqrt(10000n)).to.equal(100n);
      expect(await math.sqrt(10n ** 36n)).to.equal(10n ** 18n);
      expect(await math.sqrt(10n ** 36n + 1n)).to.equal(10n ** 18n);
    });
  });

  describe("SafeMath", () => {
    let math: any;

    beforeEach(async () => {
      math = await ethers.deployContract("SafeMathTest", []);
      await math.waitForDeployment();
    });

    it("adds", async () => {
      expect(await math.add(1n, 2n)).to.equal(3n);
      expect(await math.add(MaxUint256, 0n)).to.equal(MaxUint256);
    });

    it("rejects addition overflow", async () => {
      await expect(math.add(MaxUint256, 1n)).to.be.revertedWith("ds-math-add-overflow");
    });

    it("subtracts", async () => {
      expect(await math.sub(3n, 2n)).to.equal(1n);
      expect(await math.sub(0n, 0n)).to.equal(0n);
    });

    it("rejects subtraction underflow", async () => {
      await expect(math.sub(0n, 1n)).to.be.revertedWith("ds-math-sub-underflow");
    });

    it("multiplies", async () => {
      expect(await math.mul(3n, 2n)).to.equal(6n);
      expect(await math.mul(0n, MaxUint256)).to.equal(0n);
      expect(await math.mul(MaxUint256, 0n)).to.equal(0n);
    });

    it("rejects multiplication overflow", async () => {
      await expect(math.mul(MaxUint256, 2n)).to.be.revertedWith("ds-math-mul-overflow");
    });
  });

  describe("UQ112x112", () => {
    let uq: any;

    beforeEach(async () => {
      uq = await ethers.deployContract("UQ112x112Test", []);
      await uq.waitForDeployment();
    });

    it("encodes uint112 values as UQ112x112", async () => {
      expect(await uq.encode(0n)).to.equal(0n);
      expect(await uq.encode(1n)).to.equal(Q112);
      expect(await uq.encode(2n)).to.equal(Q112 * 2n);
    });

    it("divides UQ112x112 values", async () => {
      expect(await uq.uqdiv(Q112 * 2n, 2n)).to.equal(Q112);
      expect(await uq.uqdiv(Q112, 3n)).to.equal(Q112 / 3n);
    });
  });

  describe("TransferHelper", () => {
    let helper: any;

    beforeEach(async () => {
      helper = await ethers.deployContract("TransferHelperTest", []);
      await helper.waitForDeployment();
    });

    it("safeApprove approves a standard token", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await helper.safeApprove(await token.getAddress(), other.address, 100n);
      expect(await token.allowance(await helper.getAddress(), other.address)).to.equal(100n);
    });

    it("safeApprove accepts a token that returns no data", async () => {
      const token = await deployNoReturnToken(owner);
      await helper.safeApprove(await token.getAddress(), other.address, 100n);
      expect(await token.allowance(await helper.getAddress(), other.address)).to.equal(100n);
    });

    it("safeApprove rejects a failing call", async () => {
      const noApprove = await ethers.deployContract("TestMigrator", []);
      await noApprove.waitForDeployment();
      await expect(
        helper.safeApprove(await noApprove.getAddress(), other.address, 100n)
      ).to.be.revertedWith("TransferHelper: APPROVE_FAILED");
    });

    it("safeTransfer moves standard tokens", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(await helper.getAddress(), 100n);
      await helper.safeTransfer(await token.getAddress(), other.address, 40n);
      expect(await token.balanceOf(other.address)).to.equal(40n);
      expect(await token.balanceOf(await helper.getAddress())).to.equal(60n);
    });

    it("safeTransfer accepts a token that returns no data", async () => {
      const token = await deployNoReturnToken(owner);
      await token.mint(await helper.getAddress(), 100n);
      await helper.safeTransfer(await token.getAddress(), other.address, 40n);
      expect(await token.balanceOf(other.address)).to.equal(40n);
    });

    it("safeTransfer rejects a false return value", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(await helper.getAddress(), 100n);
      await token.setFailTransfers(true);
      await expect(
        helper.safeTransfer(await token.getAddress(), other.address, 40n)
      ).to.be.revertedWith("TransferHelper: TRANSFER_FAILED");
    });

    it("safeTransfer rejects a reverting token", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(await helper.getAddress(), 100n);
      await token.setRevertTransfers(true);
      await expect(
        helper.safeTransfer(await token.getAddress(), other.address, 40n)
      ).to.be.revertedWith("TransferHelper: TRANSFER_FAILED");
    });

    it("safeTransferFrom moves approved tokens", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(owner.address, 100n);
      await token.connect(owner).approve(await helper.getAddress(), 100n);
      await helper.safeTransferFrom(
        await token.getAddress(),
        owner.address,
        other.address,
        40n
      );
      expect(await token.balanceOf(other.address)).to.equal(40n);
      expect(await token.allowance(owner.address, await helper.getAddress())).to.equal(60n);
    });

    it("safeTransferFrom accepts a token that returns no data", async () => {
      const token = await deployNoReturnToken(owner);
      await token.mint(owner.address, 100n);
      await token.connect(owner).approve(await helper.getAddress(), 100n);
      await helper.safeTransferFrom(
        await token.getAddress(),
        owner.address,
        other.address,
        40n
      );
      expect(await token.balanceOf(other.address)).to.equal(40n);
    });

    it("safeTransferFrom rejects a false return value", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(owner.address, 100n);
      await token.connect(owner).approve(await helper.getAddress(), 100n);
      await token.setFailTransfers(true);
      await expect(
        helper.safeTransferFrom(await token.getAddress(), owner.address, other.address, 40n)
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("safeTransferFrom rejects a reverting token", async () => {
      const token = await deployToken("Token", "TKN", owner);
      await token.mint(owner.address, 100n);
      await token.connect(owner).approve(await helper.getAddress(), 100n);
      await token.setRevertTransfers(true);
      await expect(
        helper.safeTransferFrom(await token.getAddress(), owner.address, other.address, 40n)
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("safeTransferETH sends Ether", async () => {
      const before = await ethers.provider.getBalance(other.address);
      await helper.safeTransferETH(other.address, 100n, { value: 100n });
      expect(await ethers.provider.getBalance(other.address)).to.equal(before + 100n);
    });

    it("safeTransferETH rejects a recipient that reverts", async () => {
      const reject = await ethers.deployContract("RejectETH", []);
      await reject.waitForDeployment();
      await expect(
        helper.safeTransferETH(await reject.getAddress(), 100n, { value: 100n })
      ).to.be.revertedWith("TransferHelper: ETH_TRANSFER_FAILED");
    });
  });

  describe("UniswapV2Library", () => {
    let library: any;
    let factory: any;
    let tokenA: any;
    let tokenB: any;
    let tokenC: any;
    let tokenAAddress: string;
    let tokenBAddress: string;
    let tokenCAddress: string;

    beforeEach(async () => {
      library = await ethers.deployContract("UniswapV2LibraryTest", []);
      await library.waitForDeployment();
      factory = await deploySushiFactory(owner);
      tokenA = await deployToken("Token A", "A", owner);
      tokenB = await deployToken("Token B", "B", owner);
      tokenC = await deployToken("Token C", "C", owner);
      tokenAAddress = await tokenA.getAddress();
      tokenBAddress = await tokenB.getAddress();
      tokenCAddress = await tokenC.getAddress();
    });

    async function seedPair(
      tokenX: any,
      tokenY: any,
      amountX: bigint,
      amountY: bigint
    ): Promise<void> {
      const x = await tokenX.getAddress();
      const y = await tokenY.getAddress();
      await factory.createPair(x, y);
      const pairAddress = await factory.getPair(x, y);
      const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
      await tokenX.mint(pairAddress, amountX);
      await tokenY.mint(pairAddress, amountY);
      await pair.mint(owner.address);
    }

    it("sorts token addresses", async () => {
      const [token0, token1] = sortTokens(tokenAAddress, tokenBAddress);
      const forward = await library.sortTokens(tokenAAddress, tokenBAddress);
      const reverse = await library.sortTokens(tokenBAddress, tokenAAddress);
      expect(forward[0]).to.equal(token0);
      expect(forward[1]).to.equal(token1);
      expect(reverse[0]).to.equal(token0);
      expect(reverse[1]).to.equal(token1);
    });

    it("rejects identical or zero token addresses", async () => {
      await expect(
        library.sortTokens(tokenAAddress, tokenAAddress)
      ).to.be.revertedWith("UniswapV2Library: IDENTICAL_ADDRESSES");
      await expect(
        library.sortTokens(AddressZero, tokenAAddress)
      ).to.be.revertedWith("UniswapV2Library: ZERO_ADDRESS");
    });

    it("computes the CREATE2 pair address", async () => {
      const predicted = pairFor(await factory.getAddress(), tokenAAddress, tokenBAddress);
      expect(await library.pairFor(await factory.getAddress(), tokenAAddress, tokenBAddress)).to.equal(
        predicted
      );
      await factory.createPair(tokenAAddress, tokenBAddress);
      expect(await factory.getPair(tokenAAddress, tokenBAddress)).to.equal(predicted);
    });

    it("returns reserves in the order of the requested tokens", async () => {
      await seedPair(tokenA, tokenB, 1000n, 2000n);
      const [reserveA, reserveB] = await library.getReserves(
        await factory.getAddress(),
        tokenAAddress,
        tokenBAddress
      );
      const [reserveB2, reserveA2] = await library.getReserves(
        await factory.getAddress(),
        tokenBAddress,
        tokenAAddress
      );
      expect(reserveA).to.equal(1000n);
      expect(reserveB).to.equal(2000n);
      expect(reserveA2).to.equal(1000n);
      expect(reserveB2).to.equal(2000n);
    });

    it("quotes an equivalent amount", async () => {
      expect(await library.quote(100n, 1000n, 2000n)).to.equal(200n);
    });

    it("rejects an invalid quote", async () => {
      await expect(library.quote(0n, 1000n, 2000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_AMOUNT"
      );
      await expect(library.quote(100n, 0n, 2000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
      await expect(library.quote(100n, 1000n, 0n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes output amounts with the 0.3% fee", async () => {
      expect(await library.getAmountOut(1000n, 10000n, 10000n)).to.equal(906n);
    });

    it("rejects an invalid output amount computation", async () => {
      await expect(library.getAmountOut(0n, 10000n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT"
      );
      await expect(library.getAmountOut(1000n, 0n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
      await expect(library.getAmountOut(1000n, 10000n, 0n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes input amounts", async () => {
      expect(await library.getAmountIn(906n, 10000n, 10000n)).to.equal(1000n);
    });

    it("rejects an invalid input amount computation", async () => {
      await expect(library.getAmountIn(0n, 10000n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT"
      );
      await expect(library.getAmountIn(1000n, 0n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
      await expect(library.getAmountIn(1000n, 10000n, 0n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes chained output amounts", async () => {
      await seedPair(tokenA, tokenB, 10000n, 10000n);
      await seedPair(tokenB, tokenC, 10000n, 10000n);
      const amounts = await library.getAmountsOut(await factory.getAddress(), 1000n, [
        tokenAAddress,
        tokenBAddress,
        tokenCAddress,
      ]);
      const first = await library.getAmountOut(1000n, 10000n, 10000n);
      const second = await library.getAmountOut(first, 10000n, 10000n);
      expect(amounts).to.deep.equal([1000n, first, second]);
    });

    it("rejects a short output path", async () => {
      await expect(
        library.getAmountsOut(await factory.getAddress(), 1000n, [tokenAAddress])
      ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    });

    it("computes chained input amounts", async () => {
      await seedPair(tokenA, tokenB, 10000n, 10000n);
      await seedPair(tokenB, tokenC, 10000n, 10000n);
      const amounts = await library.getAmountsIn(await factory.getAddress(), 900n, [
        tokenAAddress,
        tokenBAddress,
        tokenCAddress,
      ]);
      const last = await library.getAmountIn(900n, 10000n, 10000n);
      const first = await library.getAmountIn(last, 10000n, 10000n);
      expect(amounts).to.deep.equal([first, last, 900n]);
    });

    it("rejects a short input path", async () => {
      await expect(
        library.getAmountsIn(await factory.getAddress(), 900n, [tokenAAddress])
      ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    });
  });
});
