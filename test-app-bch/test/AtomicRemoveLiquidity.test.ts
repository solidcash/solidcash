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
import { bytesToSlotValue, keyToSlotMulti } from "@solidcash/solidcash/dist/stateful/SortedList.js";
import { collectionKeyEncoding } from "@solidcash/solidcash/dist/framed/composer/mapping-plan.js";

const ARTIFACTS = path.resolve(__dirname, "../artifacts/solidcash");
const artifactOf = (name: string): Artifact =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")) as Artifact;
const bundleOf = (name: string): FunctionSplitBundle =>
  JSON.parse(readFileSync(path.join(ARTIFACTS, `${name}.func.json`), "utf8")) as FunctionSplitBundle;
const VALIDATOR = framedValidator.buildValidatorProgram();
/** How many fresh pairs the case removes liquidity from: one per predecessor case by default. */
const ROUNDS = Number(process.env.REMOVE_ROUNDS ?? 3);
const MAX_UINT256 = 2n ** 256n - 1n;
/** The node the pair's own LP node is inserted after, by round: the list's head, the zero address's, the holder's. */
const PREDECESSORS = ["head", "zero", "holder"] as const;
type Predecessor = (typeof PREDECESSORS)[number];

/**
 * Removing liquidity from pairs the factory created with `createPair`, as the app's pool page does: the LP holder
 * approves the router for the whole LP balance (the uint256 maximum, which `transferFrom` reads and leaves alone),
 * removes half with `removeLiquidityETH`, then the rest with `removeLiquidity` into the wrapped coin.
 *
 * The router moves the LP tokens into the pair with `transferFrom(holder, pair, liquidity)`, which debits the holder's
 * `balanceOf` node and creates the pair's own: an insert into the LP mapping's sorted list, whose predecessor is
 * whichever node holds the greatest slot below the pair's. The pair's slot hashes its address, which its category
 * fixes, so each round picks a category that puts the inserted node after the list's head, the zero address's node
 * (the minimum liquidity) or the holder's.
 *
 * The head case is the one that was refused (`UniswapV2Pair.transferFrom() at line 78: no source message`): a genesis
 * with a folded initializer minted every collection's empty head twice, the first mint relinked one of them, and an
 * insert at the front of the list spent the copy no write ever relinked.
 */
describe("removeLiquidity on atomically created pairs", () => {
  it("removes half, then the rest, from fresh pairs whose LP keys fall in any order", async () => {
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
      size: resolveMasterPoolSize(),
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
        provider, split: pair.bundle, pool: resolveMasterPoolSize(), ownerLock: holderLock,
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
    // The LP mapping's slots: the zero address holds the minimum liquidity, the holder the rest.
    const lpEncoding = collectionKeyEncoding(pair.artifact, "balanceOf");
    const lpSlotOf = (address: string | Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti(
      [typeof address === "string" ? addressToLockScript(address) : address], lpEncoding,
    ));
    const zeroSlot = lpSlotOf(new Uint8Array(0));
    const holderSlot = lpSlotOf(holderAddress);
    const predecessorOf = (slot: bigint): Predecessor => {
      const below = [["zero", zeroSlot], ["holder", holderSlot]].filter(([, held]) => (held as bigint) < slot)
        .sort((a, b) => ((a[1] as bigint) < (b[1] as bigint) ? 1 : -1));
      return below.length === 0 ? "head" : below[0]![0] as Predecessor;
    };

    const failures: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const token = await ethers.deployContract("TestERC20", [`Token ${round}`, `TK${round}`]);
      await token.waitForDeployment();
      const tokenAddress = await token.getAddress();
      await token.mint(holderAddress, 1_000_000_000_000n);
      await token.approve(routerAddress, MAX_UINT256);

      // A fresh category per round, chosen so the pair's own LP node goes after the round's predecessor: the pair's
      // slot hashes its address, which its category fixes, so each case is met by trying categories until one fits.
      const cases = (process.env.REMOVE_CASES?.split(",") as Predecessor[] | undefined) ?? [...PREDECESSORS];
      const wanted = cases[round % cases.length]!;
      let txid = binToHex(randomBytes(32));
      while (predecessorOf(lpSlotOf(framedDeploy.framedContractAddress(provider.network, txid))) !== wanted) {
        txid = binToHex(randomBytes(32));
      }
      const caller = { txid, vout: 0, satoshis: 20_000_000n };
      await provider.addUtxo(holderAddress, caller);
      const split = framedDeploy.functionSplitFor(provider, factoryDeployed.categoryId) ?? factory.bundle;
      const created = await framedCall.callFramedEntry({
        provider, artifact: factory.artifact, categoryId: factoryDeployed.categoryId, functionName: "createPair",
        args: [addressToLockScript(tokenAddress), wethLock], callerUtxo: caller, callerLockingBytecode: holderLock,
        funder: holder.unlockP2PKH(), split, validatorProgram: VALIDATOR, publish: true,
      } as never);
      expect(created.accepted, `round ${round}: createPair refused`).toBe(true);

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

      // The LP mapping then holds the zero address's minimum liquidity and the holder's node, the shape the app's
      // seeded pools have.
      await router.addLiquidityETH(tokenAddress, 1_000_000n, 0n, 0n, holderAddress, 2n ** 40n, { value: 1_000_000_000n });
      const liquidity = (await lp.balanceOf(holderAddress)) as bigint;
      await lp.approve(routerAddress, MAX_UINT256);

      const label = `round ${round} (pair ${pairCategory.slice(0, 8)}, LP node after the ${wanted})`;
      try {
        await router.removeLiquidityETH(tokenAddress, liquidity / 2n, 0n, 0n, holderAddress, 2n ** 40n);
      } catch (error) {
        failures.push(`${label} removeLiquidityETH: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
        continue;
      }
      const rest = (await lp.balanceOf(holderAddress)) as bigint;
      try {
        await router.removeLiquidity(tokenAddress, await weth.getAddress(), rest, 0n, 0n, holderAddress, 2n ** 40n);
      } catch (error) {
        failures.push(`${label} removeLiquidity: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
        continue;
      }
      expect((await lp.balanceOf(holderAddress)) as bigint, `${label}: the holder's LP after removing it all`).toBe(0n);
      console.log(`${label}: removed ${liquidity} LP in two steps`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, 3_600_000);
});
