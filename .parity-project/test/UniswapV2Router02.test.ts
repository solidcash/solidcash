import { expect } from "chai";
import {
  AddressZero,
  MaxUint256,
  approve,
  deployRouter,
  deploySushiFactory,
  deployToken,
  deployWETH,
  ethers,
  gasCost,
  latestTimestamp,
  pairFor,
  signPermit,
} from "./helpers.js";

describe("UniswapV2Router02", () => {
  let owner: any;
  let trader: any;
  let other: any;
  let weth: any;
  let wethAddress: string;
  let factory: any;
  let factoryAddress: string;
  let router: any;
  let routerAddress: string;
  let tokenA: any;
  let tokenB: any;
  let tokenC: any;
  let feeToken: any;
  let tokenAAddress: string;
  let tokenBAddress: string;
  let tokenCAddress: string;
  let feeTokenAddress: string;

  const deadline = async () => BigInt(await latestTimestamp()) + 1000n;

  async function createToken(name: string, symbol: string): Promise<any> {
    const token = await deployToken(name, symbol, owner);
    await token.mint(owner.address, ethers.parseEther("1000000"));
    await token.mint(trader.address, ethers.parseEther("1000000"));
    await approve(token, owner, routerAddress);
    await approve(token, trader, routerAddress);
    return token;
  }

  async function pairAt(tokenAAddress: string, tokenBAddress: string): Promise<any> {
    return ethers.getContractAt(
      "UniswapV2Pair",
      await factory.getPair(tokenAAddress, tokenBAddress)
    );
  }

  async function seed(
    tokenAAddress: string,
    tokenBAddress: string,
    amountA: bigint,
    amountB: bigint,
    from: any = owner
  ): Promise<any> {
    await router
      .connect(from)
      .addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountA,
        amountB,
        0n,
        0n,
        from.address,
        await deadline()
      );
    return pairAt(tokenAAddress, tokenBAddress);
  }

  async function seedETH(
    tokenAddress: string,
    amountToken: bigint,
    amountETH: bigint,
    from: any = owner
  ): Promise<any> {
    await router
      .connect(from)
      .addLiquidityETH(tokenAddress, amountToken, 0n, 0n, from.address, await deadline(), {
        value: amountETH,
      });
    return pairAt(tokenAddress, wethAddress);
  }

  beforeEach(async () => {
    [owner, trader, other] = await ethers.getSigners();
    weth = await deployWETH(owner);
    wethAddress = await weth.getAddress();
    factory = await deploySushiFactory(owner);
    factoryAddress = await factory.getAddress();
    router = await deployRouter("UniswapV2Router02", factoryAddress, wethAddress, owner);
    routerAddress = await router.getAddress();
    tokenA = await createToken("Token A", "A");
    tokenB = await createToken("Token B", "B");
    tokenC = await createToken("Token C", "C");
    feeToken = await createToken("Fee Token", "FEE");
    tokenAAddress = await tokenA.getAddress();
    tokenBAddress = await tokenB.getAddress();
    tokenCAddress = await tokenC.getAddress();
    feeTokenAddress = await feeToken.getAddress();
  });

  it("stores the factory and WETH addresses", async () => {
    expect(await router.factory()).to.equal(factoryAddress);
    expect(await router.WETH()).to.equal(wethAddress);
  });

  it("rejects plain Ether transfers", async () => {
    await expect(owner.sendTransaction({ to: routerAddress, value: 1n })).to.revert(ethers);
  });

  describe("addLiquidity", () => {
    it("creates the pair and mints liquidity", async () => {
      const expectedPair = pairFor(factoryAddress, tokenAAddress, tokenBAddress);
      const result = await router.addLiquidity.staticCall(
        tokenAAddress,
        tokenBAddress,
        10000n,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      const receipt = await (
        await router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          10000n,
          10000n,
          0n,
          0n,
          owner.address,
          await deadline()
        )
      ).wait();
      const pair = await pairAt(tokenAAddress, tokenBAddress);
      expect(await pair.getAddress()).to.equal(expectedPair);
      expect(result.amountA).to.equal(10000n);
      expect(result.amountB).to.equal(10000n);
      expect(result.liquidity).to.equal(9000n);
      expect(await pair.balanceOf(owner.address)).to.equal(9000n);
      expect(receipt!.status).to.equal(1);
    });

    it("uses the desired amount when the other token is in excess", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const result = await router.addLiquidity.staticCall(
        tokenAAddress,
        tokenBAddress,
        1000n,
        2000n,
        0n,
        900n,
        owner.address,
        await deadline()
      );
      expect(result.amountA).to.equal(1000n);
      expect(result.amountB).to.equal(1000n);
    });

    it("uses the desired amount of the second token when the first is in excess", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const result = await router.addLiquidity.staticCall(
        tokenAAddress,
        tokenBAddress,
        2000n,
        1000n,
        900n,
        0n,
        owner.address,
        await deadline()
      );
      expect(result.amountA).to.equal(1000n);
      expect(result.amountB).to.equal(1000n);
    });

    it("rejects insufficient B liquidity", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await expect(
        router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          1000n,
          2000n,
          0n,
          1500n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
    });

    it("rejects insufficient A liquidity", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await expect(
        router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          2000n,
          1000n,
          1500n,
          0n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
    });

    it("rejects an expired deadline", async () => {
      await expect(
        router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          10000n,
          10000n,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("rejects a failing token transfer", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await tokenA.setFailTransfers(true);
      await expect(
        router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          1000n,
          1000n,
          0n,
          0n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });
  });

  describe("addLiquidityETH", () => {
    it("creates the WETH pair and deposits Ether", async () => {
      const value = ethers.parseEther("1");
      const result = await router.addLiquidityETH.staticCall(
        tokenAAddress,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline(),
        { value }
      );
      await router.addLiquidityETH(tokenAAddress, 10000n, 0n, 0n, owner.address, await deadline(), {
        value,
      });
      const pair = await pairAt(tokenAAddress, wethAddress);
      expect(result.amountToken).to.equal(10000n);
      expect(result.amountETH).to.equal(value);
      expect(await pair.balanceOf(owner.address)).to.be.gt(0n);
      expect(await weth.balanceOf(await pair.getAddress())).to.equal(value);
      expect(await weth.totalSupply()).to.equal(value);
      expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
    });

    it("refunds excess Ether", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const value = ethers.parseEther("2");
      const result = await router.addLiquidityETH.staticCall(
        tokenAAddress,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline(),
        { value }
      );
      expect(result.amountETH).to.equal(ethers.parseEther("1"));

      const before = await ethers.provider.getBalance(owner.address);
      const receipt = await (
        await router.addLiquidityETH(
          tokenAAddress,
          10000n,
          0n,
          0n,
          owner.address,
          await deadline(),
          { value }
        )
      ).wait();
      const after = await ethers.provider.getBalance(owner.address);
      const refund = value - result.amountETH;
      expect(after).to.equal(before - value - gasCost(receipt) + refund);
      expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
    });

    it("rejects an expired deadline", async () => {
      await expect(
        router.addLiquidityETH(
          tokenAAddress,
          10000n,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n,
          { value: 1000n }
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("rejects insufficient Ether liquidity", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router.addLiquidityETH(
          tokenAAddress,
          10000n,
          0n,
          ethers.parseEther("1.5"),
          owner.address,
          await deadline(),
          { value: ethers.parseEther("2") }
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
    });

    it("rejects insufficient token liquidity", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router.addLiquidityETH(
          tokenAAddress,
          20000n,
          15000n,
          0n,
          owner.address,
          await deadline(),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
    });
  });

  describe("removeLiquidity", () => {
    it("returns both tokens and burns the LP tokens", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      const beforeA = await tokenA.balanceOf(owner.address);
      const beforeB = await tokenB.balanceOf(owner.address);

      await router.removeLiquidity(
        tokenAAddress,
        tokenBAddress,
        liquidity,
        0n,
        0n,
        owner.address,
        await deadline()
      );

      expect(await pair.balanceOf(owner.address)).to.equal(0n);
      expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA + 9000n);
      expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB + 9000n);
    });

    it("handles the reverse token order", async () => {
      const pair = await seed(tokenBAddress, tokenAAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      const result = await router.removeLiquidity.staticCall(
        tokenBAddress,
        tokenAAddress,
        liquidity,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      expect(result.amountA).to.equal(9000n);
      expect(result.amountB).to.equal(9000n);
    });

    it("rejects insufficient A liquidity", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidity(
          tokenAAddress,
          tokenBAddress,
          liquidity,
          9001n,
          0n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
    });

    it("rejects insufficient B liquidity", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidity(
          tokenAAddress,
          tokenBAddress,
          liquidity,
          0n,
          9001n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
    });

    it("rejects an expired deadline", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidity(
          tokenAAddress,
          tokenBAddress,
          liquidity,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("removeLiquidityETH", () => {
    it("returns tokens and Ether", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const totalSupply = await pair.totalSupply();
      const expectedToken = (liquidity * 10000n) / totalSupply;
      const expectedETH = (liquidity * ethers.parseEther("1")) / totalSupply;
      await pair.connect(owner).approve(routerAddress, liquidity);
      const tokenBefore = await tokenA.balanceOf(other.address);
      const ethBefore = await ethers.provider.getBalance(other.address);

      await router.removeLiquidityETH(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        await deadline()
      );

      expect(await tokenA.balanceOf(other.address)).to.equal(tokenBefore + expectedToken);
      expect(await ethers.provider.getBalance(other.address)).to.equal(ethBefore + expectedETH);
      expect(await weth.totalSupply()).to.equal(ethers.parseEther("1") - expectedETH);
    });

    it("rejects insufficient token liquidity", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidityETH(
          tokenAAddress,
          liquidity,
          MaxUint256,
          0n,
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
    });

    it("rejects insufficient Ether liquidity", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidityETH(
          tokenAAddress,
          liquidity,
          0n,
          ethers.parseEther("2"),
          owner.address,
          await deadline()
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
    });

    it("rejects an ETH recipient that reverts", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      const reject = await ethers.deployContract("RejectETH", []);
      await reject.waitForDeployment();
      await expect(
        router.removeLiquidityETH(
          tokenAAddress,
          liquidity,
          0n,
          0n,
          await reject.getAddress(),
          await deadline()
        )
      ).to.be.revertedWith("TransferHelper: ETH_TRANSFER_FAILED");
    });

    it("rejects an expired deadline", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidityETH(
          tokenAAddress,
          liquidity,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("removeLiquidityETHSupportingFeeOnTransferTokens", () => {
    it("returns tokens and Ether", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const totalSupply = await pair.totalSupply();
      const expectedToken = (liquidity * 10000n) / totalSupply;
      const expectedETH = (liquidity * ethers.parseEther("1")) / totalSupply;
      await pair.connect(owner).approve(routerAddress, liquidity);
      const tokenBefore = await tokenA.balanceOf(other.address);
      const ethBefore = await ethers.provider.getBalance(other.address);

      await router.removeLiquidityETHSupportingFeeOnTransferTokens(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        await deadline()
      );

      expect(await tokenA.balanceOf(other.address)).to.equal(tokenBefore + expectedToken);
      expect(await ethers.provider.getBalance(other.address)).to.equal(ethBefore + expectedETH);
    });

    it("rejects an expired deadline", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(routerAddress, liquidity);
      await expect(
        router.removeLiquidityETHSupportingFeeOnTransferTokens(
          tokenAAddress,
          liquidity,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("removeLiquidityETHWithPermitSupportingFeeOnTransferTokens", () => {
    it("removes liquidity with a permit", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        liquidity,
        permitDeadline
      );
      const ethBefore = await ethers.provider.getBalance(other.address);

      await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        permitDeadline,
        false,
        v,
        r,
        s
      );

      expect(await ethers.provider.getBalance(other.address)).to.be.gt(ethBefore);
    });

    it("supports an unlimited permit", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        MaxUint256,
        permitDeadline
      );
      await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        permitDeadline,
        true,
        v,
        r,
        s
      );
      expect(await pair.allowance(owner.address, routerAddress)).to.equal(MaxUint256);
    });
  });

  describe("removeLiquidityWithPermit", () => {
    it("removes liquidity with a permit", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        liquidity,
        permitDeadline
      );
      await router.removeLiquidityWithPermit(
        tokenAAddress,
        tokenBAddress,
        liquidity,
        0n,
        0n,
        owner.address,
        permitDeadline,
        false,
        v,
        r,
        s
      );
      expect(await pair.balanceOf(owner.address)).to.equal(0n);
    });

    it("supports an unlimited permit", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        MaxUint256,
        permitDeadline
      );
      await router.removeLiquidityWithPermit(
        tokenAAddress,
        tokenBAddress,
        liquidity,
        0n,
        0n,
        owner.address,
        permitDeadline,
        true,
        v,
        r,
        s
      );
      expect(await pair.allowance(owner.address, routerAddress)).to.equal(MaxUint256);
    });

    it("rejects an expired permit", async () => {
      const pair = await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) - 1n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        liquidity,
        permitDeadline
      );
      await expect(
        router.removeLiquidityWithPermit(
          tokenAAddress,
          tokenBAddress,
          liquidity,
          0n,
          0n,
          owner.address,
          permitDeadline,
          false,
          v,
          r,
          s
        )
      ).to.be.revertedWith("UniswapV2: EXPIRED");
    });
  });

  describe("removeLiquidityETHWithPermit", () => {
    it("removes liquidity with a permit", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        liquidity,
        permitDeadline
      );
      await router.removeLiquidityETHWithPermit(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        permitDeadline,
        false,
        v,
        r,
        s
      );
      expect(await ethers.provider.getBalance(other.address)).to.be.gt(0n);
    });

    it("supports an unlimited permit", async () => {
      const pair = await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(
        owner,
        pair,
        routerAddress,
        MaxUint256,
        permitDeadline
      );
      await router.removeLiquidityETHWithPermit(
        tokenAAddress,
        liquidity,
        0n,
        0n,
        other.address,
        permitDeadline,
        true,
        v,
        r,
        s
      );
      expect(await pair.allowance(owner.address, routerAddress)).to.equal(MaxUint256);
    });
  });

  describe("token swaps", () => {
    it("swaps exact tokens for tokens", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const beforeA = await tokenA.balanceOf(trader.address);
      const beforeB = await tokenB.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactTokensForTokens(
          1000n,
          900n,
          [tokenAAddress, tokenBAddress],
          trader.address,
          await deadline()
        );
      expect(await tokenA.balanceOf(trader.address)).to.equal(beforeA - 1000n);
      expect(await tokenB.balanceOf(trader.address)).to.equal(beforeB + 906n);
    });

    it("swaps along a multi-hop path", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await seed(tokenBAddress, tokenCAddress, 10000n, 10000n);
      const beforeC = await tokenC.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactTokensForTokens(
          1000n,
          0n,
          [tokenAAddress, tokenBAddress, tokenCAddress],
          trader.address,
          await deadline()
        );
      expect(await tokenC.balanceOf(trader.address)).to.be.gt(beforeC);
    });

    it("rejects too little output", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await expect(
        router
          .connect(trader)
          .swapExactTokensForTokens(
            1000n,
            1000n,
            [tokenAAddress, tokenBAddress],
            trader.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("swaps tokens for an exact amount of tokens", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const beforeA = await tokenA.balanceOf(trader.address);
      const beforeB = await tokenB.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapTokensForExactTokens(
          900n,
          1000n,
          [tokenAAddress, tokenBAddress],
          trader.address,
          await deadline()
        );
      expect(await tokenB.balanceOf(trader.address)).to.equal(beforeB + 900n);
      expect(await tokenA.balanceOf(trader.address)).to.be.lt(beforeA);
    });

    it("rejects excessive input for an exact output", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await expect(
        router
          .connect(trader)
          .swapTokensForExactTokens(
            900n,
            900n,
            [tokenAAddress, tokenBAddress],
            trader.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
    });

    it("rejects an expired deadline on a swap", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      await expect(
        router
          .connect(trader)
          .swapExactTokensForTokens(
            1000n,
            0n,
            [tokenAAddress, tokenBAddress],
            trader.address,
            BigInt(await latestTimestamp()) - 1n
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("Ether swaps", () => {
    it("swaps exact Ether for tokens", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const before = await tokenA.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactETHForTokens(
          0n,
          [wethAddress, tokenAAddress],
          trader.address,
          await deadline(),
          { value: ethers.parseEther("0.1") }
        );
      expect(await tokenA.balanceOf(trader.address)).to.be.gt(before);
    });

    it("rejects an invalid Ether input path", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokens(
            0n,
            [tokenAAddress, wethAddress],
            trader.address,
            await deadline(),
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects too little Ether swap output", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokens(
            MaxUint256,
            [wethAddress, tokenAAddress],
            trader.address,
            await deadline(),
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("swaps tokens for an exact amount of Ether", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const amountOut = ethers.parseEther("0.1");
      const before = await ethers.provider.getBalance(other.address);
      await router
        .connect(trader)
        .swapTokensForExactETH(
          amountOut,
          MaxUint256,
          [tokenAAddress, wethAddress],
          other.address,
          await deadline()
        );
      expect(await ethers.provider.getBalance(other.address)).to.equal(before + amountOut);
    });

    it("rejects an invalid Ether output path", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapTokensForExactETH(
            1n,
            MaxUint256,
            [wethAddress, tokenAAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects excessive input for an exact Ether output", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapTokensForExactETH(
            ethers.parseEther("0.1"),
            1n,
            [tokenAAddress, wethAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
    });

    it("swaps exact tokens for Ether", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const before = await ethers.provider.getBalance(other.address);
      await router
        .connect(trader)
        .swapExactTokensForETH(
          1000n,
          0n,
          [tokenAAddress, wethAddress],
          other.address,
          await deadline()
        );
      expect(await ethers.provider.getBalance(other.address)).to.be.gt(before);
    });

    it("rejects an invalid token to Ether path", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETH(
            1000n,
            0n,
            [wethAddress, tokenAAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects too little Ether output", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETH(
            1000n,
            MaxUint256,
            [tokenAAddress, wethAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("swaps Ether for an exact amount of tokens and refunds dust", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const value = ethers.parseEther("1");
      const amountOut = 100n;
      const amounts = await router.getAmountsIn(amountOut, [wethAddress, tokenAAddress]);
      const before = await ethers.provider.getBalance(owner.address);
      const receipt = await (
        await router.swapETHForExactTokens(
          amountOut,
          [wethAddress, tokenAAddress],
          other.address,
          await deadline(),
          { value }
        )
      ).wait();
      const after = await ethers.provider.getBalance(owner.address);
      expect(await tokenA.balanceOf(other.address)).to.equal(amountOut);
      expect(after).to.equal(before - amounts[0] - gasCost(receipt));
      expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
    });

    it("rejects an invalid path for exact tokens", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router.swapETHForExactTokens(
          100n,
          [tokenAAddress, wethAddress],
          other.address,
          await deadline(),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects insufficient Ether for an exact output", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      await expect(
        router.swapETHForExactTokens(
          9999n,
          [wethAddress, tokenAAddress],
          other.address,
          await deadline(),
          { value: 1n }
        )
      ).to.be.revertedWith("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
    });

    it("rejects an ETH recipient that reverts", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const reject = await ethers.deployContract("RejectETH", []);
      await reject.waitForDeployment();
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETH(
            1000n,
            0n,
            [tokenAAddress, wethAddress],
            await reject.getAddress(),
            await deadline()
          )
      ).to.be.revertedWith("TransferHelper: ETH_TRANSFER_FAILED");
    });

    it("rejects an expired deadline on an Ether input swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokens(
            0n,
            [wethAddress, tokenAAddress],
            trader.address,
            BigInt(await latestTimestamp()) - 1n,
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("rejects an expired deadline on an exact Ether output swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapTokensForExactETH(
            1n,
            MaxUint256,
            [tokenAAddress, wethAddress],
            other.address,
            BigInt(await latestTimestamp()) - 1n
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("rejects an expired deadline on a token to Ether swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETH(
            1n,
            0n,
            [tokenAAddress, wethAddress],
            other.address,
            BigInt(await latestTimestamp()) - 1n
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("rejects an expired deadline on an exact token output swap", async () => {
      await expect(
        router.swapETHForExactTokens(
          1n,
          [wethAddress, tokenAAddress],
          other.address,
          BigInt(await latestTimestamp()) - 1n,
          { value: ethers.parseEther("0.1") }
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("does not refund when the exact input is supplied", async () => {
      await seedETH(tokenAAddress, 10000n, ethers.parseEther("1"));
      const amountOut = 100n;
      const amounts = await router.getAmountsIn(amountOut, [wethAddress, tokenAAddress]);
      const before = await ethers.provider.getBalance(owner.address);
      const receipt = await (
        await router.swapETHForExactTokens(
          amountOut,
          [wethAddress, tokenAAddress],
          other.address,
          await deadline(),
          { value: amounts[0] }
        )
      ).wait();
      const after = await ethers.provider.getBalance(owner.address);
      expect(after).to.equal(before - amounts[0] - gasCost(receipt));
      expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
    });
  });

  describe("fee-on-transfer swaps", () => {
    beforeEach(async () => {
      await feeToken.setFeeBps(0n);
      await seed(feeTokenAddress, tokenBAddress, 10000n, 10000n);
      await seedETH(feeTokenAddress, 10000n, ethers.parseEther("1"));
      await feeToken.setFeeBps(100n);
    });

    it("swaps exact tokens for tokens", async () => {
      const before = await tokenB.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactTokensForTokensSupportingFeeOnTransferTokens(
          1000n,
          0n,
          [feeTokenAddress, tokenBAddress],
          trader.address,
          await deadline()
        );
      expect(await tokenB.balanceOf(trader.address)).to.be.gt(before);
    });

    it("supports a multi-hop path", async () => {
      await seed(tokenBAddress, tokenAAddress, 10000n, 10000n);
      const before = await tokenA.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactTokensForTokensSupportingFeeOnTransferTokens(
          1000n,
          0n,
          [feeTokenAddress, tokenBAddress, tokenAAddress],
          trader.address,
          await deadline()
        );
      expect(await tokenA.balanceOf(trader.address)).to.be.gt(before);
    });

    it("rejects too little output", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForTokensSupportingFeeOnTransferTokens(
            1000n,
            MaxUint256,
            [feeTokenAddress, tokenBAddress],
            trader.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("rejects an expired deadline on a fee-on-transfer input swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForTokensSupportingFeeOnTransferTokens(
            1000n,
            0n,
            [feeTokenAddress, tokenBAddress],
            trader.address,
            BigInt(await latestTimestamp()) - 1n
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("swaps exact Ether for tokens", async () => {
      const before = await feeToken.balanceOf(trader.address);
      await router
        .connect(trader)
        .swapExactETHForTokensSupportingFeeOnTransferTokens(
          0n,
          [wethAddress, feeTokenAddress],
          trader.address,
          await deadline(),
          { value: ethers.parseEther("0.1") }
        );
      expect(await feeToken.balanceOf(trader.address)).to.be.gt(before);
    });

    it("rejects an invalid path when swapping Ether for tokens", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokensSupportingFeeOnTransferTokens(
            0n,
            [feeTokenAddress, wethAddress],
            trader.address,
            await deadline(),
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects too little output when swapping Ether for tokens", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokensSupportingFeeOnTransferTokens(
            MaxUint256,
            [wethAddress, feeTokenAddress],
            trader.address,
            await deadline(),
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("rejects an expired deadline on a fee-on-transfer Ether input swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactETHForTokensSupportingFeeOnTransferTokens(
            0n,
            [wethAddress, feeTokenAddress],
            trader.address,
            BigInt(await latestTimestamp()) - 1n,
            { value: ethers.parseEther("0.1") }
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("swaps exact tokens for Ether", async () => {
      const before = await ethers.provider.getBalance(other.address);
      await router
        .connect(trader)
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          1000n,
          0n,
          [feeTokenAddress, wethAddress],
          other.address,
          await deadline()
        );
      expect(await ethers.provider.getBalance(other.address)).to.be.gt(before);
    });

    it("rejects an invalid path when swapping tokens for Ether", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETHSupportingFeeOnTransferTokens(
            1000n,
            0n,
            [wethAddress, feeTokenAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("rejects too little Ether output", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETHSupportingFeeOnTransferTokens(
            1000n,
            MaxUint256,
            [feeTokenAddress, wethAddress],
            other.address,
            await deadline()
          )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("rejects an expired deadline on a fee-on-transfer Ether output swap", async () => {
      await expect(
        router
          .connect(trader)
          .swapExactTokensForETHSupportingFeeOnTransferTokens(
            1000n,
            0n,
            [feeTokenAddress, wethAddress],
            other.address,
            BigInt(await latestTimestamp()) - 1n
          )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });
  });

  describe("library functions", () => {
    it("quotes amounts", async () => {
      expect(await router.quote(100n, 1000n, 2000n)).to.equal(200n);
      await expect(router.quote(0n, 1000n, 2000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_AMOUNT"
      );
      await expect(router.quote(100n, 0n, 2000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes amounts out", async () => {
      expect(await router.getAmountOut(1000n, 10000n, 10000n)).to.equal(906n);
      await expect(router.getAmountOut(0n, 10000n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT"
      );
      await expect(router.getAmountOut(1000n, 0n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes amounts in", async () => {
      expect(await router.getAmountIn(906n, 10000n, 10000n)).to.equal(1000n);
      await expect(router.getAmountIn(0n, 10000n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT"
      );
      await expect(router.getAmountIn(1000n, 0n, 10000n)).to.be.revertedWith(
        "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
      );
    });

    it("computes chained amounts", async () => {
      await seed(tokenAAddress, tokenBAddress, 10000n, 10000n);
      const out = await router.getAmountsOut(1000n, [tokenAAddress, tokenBAddress]);
      expect(out[0]).to.equal(1000n);
      expect(out[1]).to.equal(906n);
      const input = await router.getAmountsIn(906n, [tokenAAddress, tokenBAddress]);
      expect(input[0]).to.equal(1000n);
      expect(input[1]).to.equal(906n);
    });

    it("rejects short paths", async () => {
      await expect(router.getAmountsOut(1000n, [tokenAAddress])).to.be.revertedWith(
        "UniswapV2Library: INVALID_PATH"
      );
      await expect(router.getAmountsIn(1000n, [tokenAAddress])).to.be.revertedWith(
        "UniswapV2Library: INVALID_PATH"
      );
    });
  });
});
