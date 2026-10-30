import { readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "chai";
import hre from "hardhat";
import { framedDeploy } from "@solidcash/solidcash/framed";
import { randomUtxo } from "@solidcash/solidcash";
import { addressToLockScript } from "@solidcash/solidcash/dist/utils.js";
import type { Artifact, FunctionSplitBundle } from "@solidcash/utils";
const parseBCH = (value: string): bigint => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100_000_000n + BigInt((fraction + "00000000").slice(0, 8));
};

let ethers: any;

/**
 * The BCH app's pair path, on the mock: a pair is deployed as its own genesis (the constructor's sender is the
 * factory), `registerPair` records it and initializes it, and the router's add-liquidity and swap reach it through the
 * factory's `getPair`. Driven through the shipped SDK deployment and the shipped call path, the same code the app's
 * backend runs.
 */

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");

function artifactOf(name: string): Artifact {
  return JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
}

function bundleOf(name: string): FunctionSplitBundle {
  return JSON.parse(
    readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8"),
  ) as FunctionSplitBundle;
}

describe("a BCH pair the factory registers", () => {
  it("initializes, adds liquidity and swaps through the router", async () => {
    // The network the run selects (mock by default, `localhost` on a `solidcash node`): the same flow on both.
    const connection = await hre.network.create();
    ethers = connection.ethers;
    const signer = await connection.ethers.getSigner(0);
    const provider = (connection as unknown as { provider: any }).provider;

    const factory = await connection.ethers.deployContract("UniswapV2Factory", [signer.address]);
    await factory.waitForDeployment();
    const weth = await connection.ethers.deployContract("WETH9", []);
    await weth.waitForDeployment();
    const router = await connection.ethers.deployContract("UniswapV2Router02", [
      await factory.getAddress(), await weth.getAddress(),
    ]);
    await router.waitForDeployment();

    const tokenA = await connection.ethers.deployContract("TestERC20", ["Token A", "A"]);
    await tokenA.waitForDeployment();
    const tokenB = await connection.ethers.deployContract("TestERC20", ["Token B", "B"]);
    await tokenB.waitForDeployment();
    for (const token of [tokenA, tokenB]) {
      await token.mint(signer.address, ethers.parseEther("1000000"));
      await token.approve(await router.getAddress(), ethers.MaxUint256);
    }

    // The pair's genesis is its own transaction. Its constructor reads msg.sender as its factory, so the sender the
    // deployment states is the factory's lock, not the deployer's.
    const ownerAddress = signer.getAddress();
    const utxos = await provider.getUtxos(ownerAddress);
    let funding = utxos.find((utxo: any) => utxo.vout === 0 && utxo.token === undefined && utxo.satoshis > 500_000n);
    if (funding === undefined) {
      funding = randomUtxo({ satoshis: 1_000_000n, vout: 0 });
      await provider.addUtxo(ownerAddress, funding);
    }
    const factoryLock = addressToLockScript(await factory.getAddress());
    // One bundle object: the deployment binds its shards to the provider's block oracle (the pair reads
    // block.timestamp), and every later call has to find the masters at the locks the deployment minted.
    const pairBundle = bundleOf("UniswapV2Pair");
    const deployed = await framedDeploy.deployFramedStatefulContract(artifactOf("UniswapV2Pair"), [], {
      provider,
      fundingUtxo: funding,
      funder: signer.unlockP2PKH(),
      changeAddress: ownerAddress,
      senderLockingBytecode: factoryLock,
      functionSplit: pairBundle,
    } as never);
    const pairAddress = deployed.contract.address;
    // The deployment is what a callee is found by: register it at its framed address and its category's split.
    const { registerDeployment } = await import("@solidcash/solidcash/stateful");
    const { cashAddressToLockingBytecode, binToHex } = await import("@bitauth/libauth");
    const frameLock = cashAddressToLockingBytecode(pairAddress);
    if (typeof frameLock === "string") throw new Error(frameLock);
    const framedAddress = framedDeploy.framedContractAddress(provider.network, deployed.categoryId);
    framedDeploy.registerFunctionSplit(provider, deployed.categoryId, pairBundle);
    for (const address of new Set([framedAddress, pairAddress])) {
      registerDeployment(provider, {
        contractName: "UniswapV2Pair", address, lockingBytecode: binToHex(frameLock.bytecode),
        contract: deployed.contract, category: deployed.categoryId,
      } as never);
    }
    console.log("pair framed address", framedAddress, "handle", pairAddress);

    {
      const { framedValidator } = await import("@solidcash/solidc/runtime");
      const { deployMaster } = await import("@solidcash/solidcash/dist/framed/deploy/material.js");
      const validatorProgram = framedValidator.buildValidatorProgram();
      const category = new Uint8Array(Buffer.from(deployed.categoryId, "hex"));
      const bundle = bundleOf("UniswapV2Pair");
      for (const shard of bundle.shards) console.log("shard", shard.selector, shard.function);
      const mintShard = bundle.shards.find((shard) => shard.function === "mint");
      const mintLock = mintShard === undefined ? undefined
        : deployMaster(mintShard.artifact, category, validatorProgram).lockingBytecode;
      console.log("mint shard lock", mintLock === undefined ? "none" : Buffer.from(mintLock).toString("hex"));
      const utxos = await provider.getUtxosByTokenCategory(deployed.categoryId);
      for (const utxo of utxos) {
        console.log("category utxo", utxo.lockingBytecode === undefined ? "<none>"
          : Buffer.from(utxo.lockingBytecode).toString("hex").slice(0, 20), utxo.token?.nft?.capability);
      }
    }
    const tokenAAddress = await tokenA.getAddress();
    const tokenBAddress = await tokenB.getAddress();
    const listed = await factory.getPair(tokenAAddress, tokenBAddress);
    console.log("before registration getPair ->", listed);

    await factory.registerPair(tokenAAddress, tokenBAddress, pairAddress);
    console.log("after registration getPair ->", await factory.getPair(tokenAAddress, tokenBAddress));

    const amount = parseBCH("1000");
    await router.addLiquidity(
      tokenAAddress, tokenBAddress, amount, amount, 0n, 0n, signer.address, 2n ** 40n,
    );
    const pair = await connection.ethers.getContractAt("UniswapV2Pair", pairAddress);
    const [reserve0, reserve1] = await pair.getReserves();
    console.log("pair", pairAddress, "reserves", reserve0, reserve1, "supply", await pair.totalSupply());
    expect(reserve0).to.equal(amount);
    expect(reserve1).to.equal(amount);

    // A swap through the router's BCH entry: the caller states the pair and the amounts its own quote computed, so the
    // swap is one straight-line transaction. The pair's invariant check enforces the amounts.
    const before = await tokenB.balanceOf(signer.address);
    const amountIn = parseBCH("10");
    const amountInWithFee = amountIn * 997n;
    const quoted = (amountInWithFee * reserve1) / (reserve0 * 1000n + amountInWithFee);
    const token0Address = await pair.token0();
    const tokenAIsZero = token0Address === tokenAAddress;
    await router.swapOnPair(
      pairAddress, tokenAAddress, amountIn,
      tokenAIsZero ? 0n : quoted, tokenAIsZero ? quoted : 0n,
      signer.address, 2n ** 40n,
    );
    const after = await tokenB.balanceOf(signer.address);
    const [next0, next1] = await pair.getReserves();
    const out = after - before;
    console.log("swap out", out, "reserves now", next0, next1);
    expect(out > 0n).to.equal(true);
    // The pair holds its tokens sorted; the input is token0 or token1 as the pair named them.
    if (tokenAIsZero) {
      expect(next0).to.equal(reserve0 + amountIn);
      expect(next1).to.equal(reserve1 - out);
    } else {
      expect(next1).to.equal(reserve1 + amountIn);
      expect(next0).to.equal(reserve0 - out);
    }

    // The pool the app's detail page removes from: approve the LP token, then burn half of the position.
    const routerAddress = await router.getAddress();
    const position = await pair.balanceOf(signer.address);
    const liquidity = position / 2n;
    await pair.approve(routerAddress, liquidity);
    const aBefore = await tokenA.balanceOf(signer.address);
    const bBefore = await tokenB.balanceOf(signer.address);
    await router.removeLiquidity(
      tokenAAddress, tokenBAddress, liquidity, 0n, 0n, signer.address, 2n ** 40n,
    );
    const aAfter = await tokenA.balanceOf(signer.address);
    const bAfter = await tokenB.balanceOf(signer.address);
    console.log("removed", aAfter - aBefore, bAfter - bBefore, "lp left", await pair.balanceOf(signer.address));
    expect(aAfter > aBefore).to.equal(true);
    expect(bAfter > bBefore).to.equal(true);
  }, 600_000);
});
