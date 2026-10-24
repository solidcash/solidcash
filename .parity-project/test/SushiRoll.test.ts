import { expect } from "chai";
import {
  MaxUint256,
  approve,
  deployRouter,
  deploySushiFactory,
  deployToken,
  deployUniswapFactory,
  deployWETH,
  ethers,
  latestTimestamp,
  pairFor,
  signPermit,
} from "./helpers.js";

describe("SushiRoll", () => {
  let owner: any;
  let oldFactory: any;
  let newFactory: any;
  let oldFactoryAddress: string;
  let newFactoryAddress: string;
  let router: any;
  let routerAddress: string;
  let roll: any;
  let rollAddress: string;
  let tokenA: any;
  let tokenB: any;
  let tokenAAddress: string;
  let tokenBAddress: string;
  let oldPair: any;
  let oldPairAddress: string;

  const deadline = async () => BigInt(await latestTimestamp()) + 1000n;

  async function seedOldPair(amountA: bigint, amountB: bigint): Promise<void> {
    await tokenA.mint(oldPairAddress, amountA);
    await tokenB.mint(oldPairAddress, amountB);
    await oldPair.mint(owner.address);
  }

  async function newPair(): Promise<any> {
    return ethers.getContractAt(
      "UniswapV2Pair",
      await newFactory.getPair(tokenAAddress, tokenBAddress)
    );
  }

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    oldFactory = await deployUniswapFactory(owner);
    newFactory = await deploySushiFactory(owner);
    oldFactoryAddress = await oldFactory.getAddress();
    newFactoryAddress = await newFactory.getAddress();
    const weth = await deployWETH(owner);
    router = await deployRouter(
      "UniswapV2Router02",
      newFactoryAddress,
      await weth.getAddress(),
      owner
    );
    routerAddress = await router.getAddress();

    tokenA = await deployToken("Token A", "A", owner);
    tokenB = await deployToken("Token B", "B", owner);
    tokenAAddress = await tokenA.getAddress();
    tokenBAddress = await tokenB.getAddress();
    await tokenA.mint(owner.address, ethers.parseEther("1000000"));
    await tokenB.mint(owner.address, ethers.parseEther("1000000"));

    await oldFactory.createPair(tokenAAddress, tokenBAddress);
    oldPairAddress = await oldFactory.getPair(tokenAAddress, tokenBAddress);
    oldPair = await ethers.getContractAt("UniswapV2Pair", oldPairAddress);

    roll = await ethers.deployContract("SushiRoll", [oldFactoryAddress, routerAddress]);
    await roll.waitForDeployment();
    rollAddress = await roll.getAddress();

    await approve(tokenA, owner, rollAddress);
    await approve(tokenB, owner, rollAddress);
  });

  it("stores the old and new routers", async () => {
    expect(await roll.oldRouter()).to.equal(oldFactoryAddress);
    expect(await roll.router()).to.equal(routerAddress);
  });

  // migrate() currently calls _addLiquidity (which only computes amounts) and
  // never the addLiquidity helper, so no new LP is minted and the pooled tokens
  // stay in the roll. These tests pin the deployed behavior.
  it("removes old liquidity, creates the new pair, and refunds unused tokens", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    const beforeA = await tokenA.balanceOf(owner.address);
    const beforeB = await tokenB.balanceOf(owner.address);

    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );

    const pair = await newPair();
    expect(await pair.getAddress()).to.equal(
      pairFor(newFactoryAddress, tokenAAddress, tokenBAddress)
    );
    expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA + 4000n);
    expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB + 4000n);
    expect(await pair.balanceOf(owner.address)).to.equal(0n);
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(0n);
    expect(reserves[1]).to.equal(0n);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(5000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(5000n);
    expect(await oldPair.balanceOf(owner.address)).to.equal(0n);
  });

  it("keeps all removed tokens in the roll when the desired amounts match", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    const beforeA = await tokenA.balanceOf(owner.address);
    const beforeB = await tokenB.balanceOf(owner.address);

    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      9000n,
      9000n,
      0n,
      0n,
      await deadline()
    );

    expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA);
    expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(9000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(9000n);
    expect(await (await newPair()).balanceOf(owner.address)).to.equal(0n);
  });

  it("handles the reverse token order", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    const beforeA = await tokenA.balanceOf(owner.address);
    const beforeB = await tokenB.balanceOf(owner.address);

    await roll.migrate(
      tokenBAddress,
      tokenAAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );

    expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA + 4000n);
    expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB + 4000n);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(5000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(5000n);
  });

  it("uses the B-optimal branch against an existing new pair", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );

    await approve(tokenA, owner, routerAddress);
    await approve(tokenB, owner, routerAddress);
    await router.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      5000n,
      5000n,
      0n,
      0n,
      owner.address,
      await deadline()
    );

    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    const beforeA = await tokenA.balanceOf(owner.address);
    const beforeB = await tokenB.balanceOf(owner.address);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      10000n,
      1000n,
      2000n,
      0n,
      0n,
      await deadline()
    );

    const pair = await newPair();
    expect(await pair.balanceOf(owner.address)).to.equal(4000n);
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(5000n);
    expect(reserves[1]).to.equal(5000n);
    expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA + 9000n);
    expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB + 9000n);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(6000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(6000n);
  });

  it("uses the A-optimal branch against an existing new pair", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );

    await approve(tokenA, owner, routerAddress);
    await approve(tokenB, owner, routerAddress);
    await router.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      5000n,
      5000n,
      0n,
      0n,
      owner.address,
      await deadline()
    );

    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      10000n,
      2000n,
      1000n,
      0n,
      0n,
      await deadline()
    );

    const pair = await newPair();
    expect(await pair.balanceOf(owner.address)).to.equal(4000n);
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(5000n);
    expect(reserves[1]).to.equal(5000n);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(6000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(6000n);
  });

  it("rejects insufficient A liquidity on removal", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await expect(
      roll.migrate(
        tokenAAddress,
        tokenBAddress,
        9000n,
        5000n,
        5000n,
        9001n,
        0n,
        await deadline()
      )
    ).to.be.revertedWith("SushiRoll: INSUFFICIENT_A_AMOUNT");
  });

  it("rejects insufficient B liquidity on removal", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await expect(
      roll.migrate(
        tokenAAddress,
        tokenBAddress,
        9000n,
        5000n,
        5000n,
        0n,
        9001n,
        await deadline()
      )
    ).to.be.revertedWith("SushiRoll: INSUFFICIENT_B_AMOUNT");
  });

  it("rejects insufficient B liquidity when adding to an existing pair", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );
    await approve(tokenA, owner, routerAddress);
    await approve(tokenB, owner, routerAddress);
    await router.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      5000n,
      5000n,
      0n,
      0n,
      owner.address,
      await deadline()
    );

    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await expect(
      roll.migrate(
        tokenAAddress,
        tokenBAddress,
        10000n,
        1000n,
        2000n,
        0n,
        1500n,
        await deadline()
      )
    ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
  });

  it("rejects insufficient A liquidity when adding to an existing pair", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await roll.migrate(
      tokenAAddress,
      tokenBAddress,
      9000n,
      5000n,
      5000n,
      0n,
      0n,
      await deadline()
    );
    await approve(tokenA, owner, routerAddress);
    await approve(tokenB, owner, routerAddress);
    await router.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      5000n,
      5000n,
      0n,
      0n,
      owner.address,
      await deadline()
    );

    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await expect(
      roll.migrate(
        tokenAAddress,
        tokenBAddress,
        10000n,
        2000n,
        1000n,
        1500n,
        0n,
        await deadline()
      )
    ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
  });

  it("rejects an expired deadline", async () => {
    await seedOldPair(10000n, 10000n);
    await oldPair.connect(owner).approve(rollAddress, MaxUint256);
    await expect(
      roll.migrate(
        tokenAAddress,
        tokenBAddress,
        9000n,
        5000n,
        5000n,
        0n,
        0n,
        BigInt(await latestTimestamp()) - 1n
      )
    ).to.be.revertedWith("SushiSwap: EXPIRED");
  });

  it("migrates with an LP permit and no prior approval", async () => {
    await seedOldPair(10000n, 10000n);
    const liquidity = await oldPair.balanceOf(owner.address);
    const permitDeadline = BigInt(await latestTimestamp()) + 1000n;
    const { v, r, s } = await signPermit(
      owner,
      oldPair,
      rollAddress,
      liquidity,
      permitDeadline
    );

    await roll.migrateWithPermit(
      tokenAAddress,
      tokenBAddress,
      liquidity,
      5000n,
      5000n,
      0n,
      0n,
      permitDeadline,
      v,
      r,
      s
    );

    expect(await oldPair.balanceOf(owner.address)).to.equal(0n);
    expect(await oldPair.allowance(owner.address, rollAddress)).to.equal(0n);
    expect(await tokenA.balanceOf(rollAddress)).to.equal(5000n);
    expect(await tokenB.balanceOf(rollAddress)).to.equal(5000n);
    expect(await (await newPair()).balanceOf(owner.address)).to.equal(0n);
  });

  describe("internal addLiquidity helper", () => {
    let harness: any;
    let harnessAddress: string;

    beforeEach(async () => {
      harness = await ethers.deployContract("SushiRollHarness", [
        oldFactoryAddress,
        routerAddress,
      ]);
      await harness.waitForDeployment();
      harnessAddress = await harness.getAddress();
      await approve(tokenA, owner, harnessAddress);
      await approve(tokenB, owner, harnessAddress);
    });

    it("adds liquidity and mints LP tokens", async () => {
      const beforeA = await tokenA.balanceOf(owner.address);
      const beforeB = await tokenB.balanceOf(owner.address);
      const result = await harness.addLiquidityExternal.staticCall(
        tokenAAddress,
        tokenBAddress,
        10000n,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      await harness.addLiquidityExternal(
        tokenAAddress,
        tokenBAddress,
        10000n,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );

      const pair = await newPair();
      expect(result.amountA).to.equal(10000n);
      expect(result.amountB).to.equal(10000n);
      expect(result.liquidity).to.equal(9000n);
      expect(await pair.balanceOf(owner.address)).to.equal(9000n);
      expect(await tokenA.balanceOf(owner.address)).to.equal(beforeA - 10000n);
      expect(await tokenB.balanceOf(owner.address)).to.equal(beforeB - 10000n);
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(10000n);
      expect(reserves[1]).to.equal(10000n);
    });

    it("uses the B-optimal amount", async () => {
      await harness.addLiquidityExternal(
        tokenAAddress,
        tokenBAddress,
        10000n,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      const result = await harness.addLiquidityExternal.staticCall(
        tokenAAddress,
        tokenBAddress,
        1000n,
        2000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      expect(result.amountA).to.equal(1000n);
      expect(result.amountB).to.equal(1000n);
    });

    it("uses the A-optimal amount", async () => {
      await harness.addLiquidityExternal(
        tokenAAddress,
        tokenBAddress,
        10000n,
        10000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      const result = await harness.addLiquidityExternal.staticCall(
        tokenAAddress,
        tokenBAddress,
        2000n,
        1000n,
        0n,
        0n,
        owner.address,
        await deadline()
      );
      expect(result.amountA).to.equal(1000n);
      expect(result.amountB).to.equal(1000n);
    });

    it("rejects an expired deadline", async () => {
      await expect(
        harness.addLiquidityExternal(
          tokenAAddress,
          tokenBAddress,
          10000n,
          10000n,
          0n,
          0n,
          owner.address,
          BigInt(await latestTimestamp()) - 1n
        )
      ).to.be.revertedWith("SushiSwap: EXPIRED");
    });
  });
});
