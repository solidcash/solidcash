import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { binToHex, cashAddressToLockingBytecode, hexToBin } from "@bitauth/libauth";
import { framedValidator } from "@solidcash/solidc/runtime";
import type { Artifact, FunctionSplitBundle } from "@solidcash/utils";
import { framedCall, framedDeploy } from "@solidcash/solidcash/framed";
import { deployStatefulContract } from "@solidcash/solidcash/dist/stateful/sc-deploy.js";
import { MasterPoolDeployment } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import {
  childCollectionHashes, childGenesisOutputCount,
} from "@solidcash/solidcash/dist/framed/deploy/genesis-outputs.js";
import { resolveMasterPoolSize } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
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

/**
 * `addLiquidityETH` on a pair the factory created with `createPair`, not one deployed and registered beforehand.
 *
 * The router wraps the native value into WETH9 and sends it to the pair before minting. The created pair's callee
 * chain must settle the router's WETH9 deposit write into the transfer's read, exactly as the registered pair does.
 */
describe("addLiquidityETH on an atomically created pair", () => {
  it("wraps the native value and mints the pool", async () => {
    const connection = await hre.network.create();
    const ethers = connection.ethers;
    const provider = (connection as unknown as { provider: any }).provider;
    const signer = await ethers.getSigner(0);
    const callerLock = (signer as unknown as { getLockingBytecode(): Uint8Array }).getLockingBytecode();
    const callerAddress = signer.getAddress();

    const factory = { artifact: artifactOf("UniswapV2Factory"), bundle: bundleOf("UniswapV2Factory") };
    const pair = { artifact: artifactOf("UniswapV2Pair"), bundle: bundleOf("UniswapV2Pair") };
    const weth = await ethers.deployContract("WETH9", []);
    await weth.waitForDeployment();
    const token = await ethers.deployContract("TestERC20", ["Token", "TKN"]);
    await token.waitForDeployment();
    await token.mint(callerAddress, 1_000_000_000_000n);

    const childLocks = MasterPoolDeployment.createFunctionSplit({
      bundle: pair.bundle, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR,
      size: resolveMasterPoolSize(PAIR_POOL),
    }).getEntryLocks();
    const tokens = [
      Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac]),
      Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x32), 0x88, 0xac]),
    ];
    const funding = { txid: `${"70".repeat(31)}72`, vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(callerAddress, funding);
    const factoryDeployed = await deployStatefulContract(factory.artifact, [callerLock], {
      provider, fundingUtxo: funding, funder: signer.unlockP2PKH(), changeAddress: callerAddress,
      threadCount: resolveMasterPoolSize().masters, validatorCount: resolveMasterPoolSize().validators,
      functionSplit: factory.bundle, childLocks,
      childCollections: childCollectionHashes(pair.artifact),
      childOutputCount: childGenesisOutputCount({
        artifact: pair.artifact, category: new Uint8Array(32).fill(9), validatorProgram: VALIDATOR,
        provider, split: pair.bundle, pool: resolveMasterPoolSize(PAIR_POOL), ownerLock: callerLock,
        initializer: { functionName: "initialize", args: tokens },
      }),
    } as never);
    framedDeploy.registerFramedCreatedChild(provider, "UniswapV2Pair", pair.artifact, pair.bundle);
    await ethers.getContractAt("UniswapV2Factory", factoryDeployed.categoryId);
    const factoryAddress = framedDeploy.framedContractAddress(provider.network, factoryDeployed.categoryId);
    const router = await ethers.deployContract("UniswapV2Router02", [
      factoryAddress, await weth.getAddress(),
    ]);
    await router.waitForDeployment();
    await token.approve(await router.getAddress(), ethers.MaxUint256);

    const tokenLock = addressToLockScript(await token.getAddress());
    const wethLock = addressToLockScript(await weth.getAddress());
    const caller = { txid: `${"71".repeat(31)}73`, vout: 0, satoshis: 20_000_000n };
    await provider.addUtxo(callerAddress, caller);
    const split = framedDeploy.functionSplitFor(provider, factoryDeployed.categoryId) ?? factory.bundle;
    const created = await framedCall.callFramedEntry({
      provider, artifact: factory.artifact, categoryId: factoryDeployed.categoryId, functionName: "createPair",
      args: [tokenLock, wethLock], callerUtxo: caller, callerLockingBytecode: callerLock,
      funder: signer.unlockP2PKH(), split, validatorProgram: VALIDATOR, publish: true,
      creates: pairCreation(factory.artifact, pair, tokenLock, wethLock),
    } as never);
    const refused = created.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? "refused"}`).join("; ");
    expect(created.accepted, refused).toBe(true);

    const pairCategory = caller.txid;
    const pairAddress = framedDeploy.framedContractAddress(provider.network, pairCategory);
    framedDeploy.registerFunctionSplit(provider, pairCategory, pair.bundle);
    const pairLock = cashAddressToLockingBytecode(pairAddress);
    if (typeof pairLock === "string") throw new Error(pairLock);
    const pairContract = StatefulContract.withCategory(
      new Contract(pair.artifact as never, [] as never, { provider, category: hexToBin(pairCategory) } as never),
      pairCategory,
    );
    registerDeployment(provider, {
      contractName: "UniswapV2Pair", address: pairAddress, lockingBytecode: binToHex(pairLock.bytecode),
      contract: pairContract, category: pairCategory,
    } as never);
    await ethers.getContractAt("UniswapV2Pair", pairCategory);

    const amountToken = 1_000_000n;
    const amountNative = 1_000_000_000n;
    await router.addLiquidityETH(
      await token.getAddress(), amountToken, 0n, 0n, callerAddress, 2n ** 40n, { value: amountNative },
    );
    const state = await ethers.getContractAt("UniswapV2Pair", pairCategory);
    const [reserve0, reserve1] = await state.getReserves();
    console.log("reserves", reserve0, reserve1, "wrapped", await weth.balanceOf(pairAddress));
    expect(reserve0 > 0n && reserve1 > 0n).toBe(true);
  }, 600_000);
});
