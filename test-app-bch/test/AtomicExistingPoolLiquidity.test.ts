import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { binToHex, cashAddressToLockingBytecode, hexToBin } from "@bitauth/libauth";
import { framedValidator } from "@solidcash/solidc/runtime";
import type { Artifact, FunctionSplitBundle } from "@solidcash/utils";
import { framedCall, framedDeploy } from "@solidcash/solidcash/framed";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { MasterPoolDeployment, resolveMasterPoolSize } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import {
  childCollectionHashes, childGenesisOutputCount,
} from "@solidcash/solidcash/dist/framed/deploy/genesis-outputs.js";
import { bindProviderBlockOracle } from "@solidcash/solidcash/dist/framed/call/block-oracle.js";
import { addressToLockScript } from "@solidcash/solidcash/dist/utils.js";
import { Contract } from "@solidcash/solidcash";
import { registerDeployment, StatefulContract } from "@solidcash/solidcash/stateful";
import { PAIR_POOL, pairCreation } from "./pair-creation.js";

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");
const artifactOf = (name: string): Artifact =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
const bundleOf = (name: string): FunctionSplitBundle =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8")) as FunctionSplitBundle;
const VALIDATOR = framedValidator.buildValidatorProgram();
const MAX_UINT256 = 2n ** 256n - 1n;

/**
 * A second provider's deposits into an existing native pool, as the app's "add to a pool" flow makes them: balanced,
 * with native value beyond the pool's ratio (the router deposits the optimal amount into WETH9 and refunds the rest),
 * and with tokens beyond it (the router takes the optimal token amount and deposits all of the value).
 */
describe("addLiquidityETH to an existing native pool", () => {
  it("accepts a second provider's balanced and unbalanced deposits", async () => {
    const connection = await hre.network.create();
    const ethers = connection.ethers;
    const provider = (connection as unknown as { provider: any }).provider;
    const holder = await ethers.getSigner(0);
    const holderLock = (holder as unknown as { getLockingBytecode(): Uint8Array }).getLockingBytecode();
    const holderAddress = holder.getAddress();

    const factory = { artifact: artifactOf("UniswapV2Factory"), bundle: bundleOf("UniswapV2Factory") };
    const pair = { artifact: artifactOf("UniswapV2Pair"), bundle: bundleOf("UniswapV2Pair") };
    const weth = await ethers.deployContract("WETH9", []);
    await weth.waitForDeployment();

    bindProviderBlockOracle(provider, pair.artifact);
    for (const shard of [...pair.bundle.shards, ...pair.bundle.internalCuts]) {
      bindProviderBlockOracle(provider, shard.artifact);
    }
    const childLocks = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR,
      size: resolveMasterPoolSize(PAIR_POOL),
    }).getEntryLocks();
    const standIns = [
      Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac]),
      Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x32), 0x88, 0xac]),
    ];
    const funding = { txid: binToHex(randomBytes(32)), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(holderAddress, funding);
    const factoryDeployed = await deployStatefulContract(factory.artifact, [holderLock], {
      provider, fundingUtxo: funding, funder: holder.unlockP2PKH(), changeAddress: holderAddress,
      threadCount: resolveMasterPoolSize().masters, validatorCount: resolveMasterPoolSize().validators,
      functionSplit: factory.bundle, childLocks,
      childCollections: childCollectionHashes(pair.artifact),
      childOutputCount: childGenesisOutputCount({
        artifact: pair.artifact, category: new Uint8Array(32).fill(9), validatorProgram: VALIDATOR,
        provider, split: pair.bundle, pool: resolveMasterPoolSize(PAIR_POOL), ownerLock: holderLock,
        initializer: { functionName: "initialize", args: standIns },
      }),
    } as never);
    framedDeploy.registerFramedCreatedChild(provider, "UniswapV2Pair", pair.artifact, pair.bundle);
    await ethers.getContractAt("UniswapV2Factory", factoryDeployed.categoryId);
    const factoryAddress = framedDeploy.framedContractAddress(provider.network, factoryDeployed.categoryId);
    const router = await ethers.deployContract("UniswapV2Router02", [factoryAddress, await weth.getAddress()]);
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    const wethLock = addressToLockScript(await weth.getAddress());

    const other = await ethers.getSigner(1);
    const otherAddress = other.getAddress();
    const token = await ethers.deployContract("TestERC20", ["Token", "TK"]);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    await token.mint(holderAddress, 1_000_000_000_000n);
    await token.approve(routerAddress, MAX_UINT256);
    await token.mint(otherAddress, 1_000_000_000_000n);
    await token.connect(other).approve(routerAddress, MAX_UINT256);

    const caller = { txid: binToHex(randomBytes(32)), vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(holderAddress, caller);
    const split = framedDeploy.functionSplitFor(provider, factoryDeployed.categoryId) ?? factory.bundle;
    const created = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId: factoryDeployed.categoryId, functionName: "createPair",
      args: [addressToLockScript(tokenAddress), wethLock], callerUtxo: caller, callerLockingBytecode: holderLock,
      funder: holder.unlockP2PKH(), split, validatorProgram: VALIDATOR, publish: true,
      creates: pairCreation(factory.artifact, pair, addressToLockScript(tokenAddress), wethLock),
    } as never);
    expect(created.accepted, "createPair refused").toBe(true);
    const pairCategory = caller.txid;
    const pairAddress = framedDeploy.framedContractAddress(provider.network, pairCategory);
    framedDeploy.registerFunctionSplit(provider, pairCategory, pair.bundle);
    const pairLock = cashAddressToLockingBytecode(pairAddress);
    if (typeof pairLock === "string") throw new Error(pairLock);
    registerDeployment(provider, {
      contractName: "UniswapV2Pair", address: pairAddress, lockingBytecode: binToHex(pairLock.bytecode),
      contract: StatefulContract.withCategory(
        new Contract(pair.artifact as never, [] as never, { provider, category: hexToBin(pairCategory) } as never),
        pairCategory,
      ),
      category: pairCategory,
    } as never);
    const lp = await ethers.getContractAt("UniswapV2Pair", pairCategory);

    // The pool: 1,000 satoshis per token unit.
    await router.addLiquidityETH(tokenAddress, 1_000_000n, 0n, 0n, holderAddress, 2n ** 40n, { value: 1_000_000_000n });

    const cases = (process.env.ADD_CASES?.split(",") ?? ["balanced", "value surplus", "token surplus"]);
    const failures: string[] = [];
    for (const name of cases) {
      const [tokens, value] = name === "balanced" ? [500_000n, 500_000_000n]
        : name === "value surplus" ? [500_000n, 600_000_000n] : [500_000n, 400_000_000n];
      const before = (await lp.balanceOf(otherAddress)) as bigint;
      try {
        await router.connect(other).addLiquidityETH(tokenAddress, tokens, 0n, 0n, otherAddress, 2n ** 40n, { value });
      } catch (error) {
        failures.push(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
        continue;
      }
      const minted = ((await lp.balanceOf(otherAddress)) as bigint) - before;
      if (minted <= 0n) failures.push(`${name}: minted no LP`);
      console.log(`${name}: minted ${minted} LP`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, 3_600_000);
});
