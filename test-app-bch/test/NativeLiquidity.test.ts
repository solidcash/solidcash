import { describe, expect, it } from "vitest";
import hre from "hardhat";
import { framedDeploy } from "@solidcash/solidcash/framed";
import { registerDeployment } from "@solidcash/solidcash/stateful";
import { randomUtxo } from "@solidcash/solidcash";
import { addressToLockScript } from "@solidcash/solidcash/dist/utils.js";
import { binToHex, cashAddressToLockingBytecode } from "@bitauth/libauth";

/**
 * The router's native-liquidity entry, as the app's add-liquidity panel calls it.
 *
 * `addLiquidityETH` is payable: the frame's `msg.value` is the native side, which the router wraps into WETH9 and sends
 * to the pair before minting. The e2e seed stops here, so this drives the shipped path on the mock: a token/WETH pair
 * is deployed, registered, and the router's entry adds liquidity with a native value.
 */
describe("addLiquidityETH on BCH", () => {
  it("wraps the native value and mints the pool", async () => {
    const connection = await hre.network.create();
    const ethers = connection.ethers;
    const provider = (connection as unknown as { provider: any }).provider;
    const signer = await ethers.getSigner(0);

    const factory = await ethers.deployContract("UniswapV2Factory", [signer.address]);
    await factory.waitForDeployment();
    const weth = await ethers.deployContract("WETH9", []);
    await weth.waitForDeployment();
    const router = await ethers.deployContract("UniswapV2Router02", [
      await factory.getAddress(), await weth.getAddress(),
    ]);
    await router.waitForDeployment();
    const token = await ethers.deployContract("TestERC20", ["Token", "TKN"]);
    await token.waitForDeployment();
    await token.mint(signer.address, 1_000_000_000_000n);
    await token.approve(await router.getAddress(), ethers.MaxUint256);

    // The pair's genesis states the factory as its constructor's sender, so the factory's lock is the one it sees.
    const ownerAddress = signer.getAddress();
    const utxos = await provider.getUtxos(ownerAddress);
    let funding = utxos.find((utxo: any) => utxo.vout === 0 && utxo.token === undefined && utxo.satoshis > 500_000n);
    if (funding === undefined) {
      funding = randomUtxo({ satoshis: 1_000_000n, vout: 0 });
      await provider.addUtxo(ownerAddress, funding);
    }
    const factoryLock = addressToLockScript(await factory.getAddress());
    const pairBundle = JSON.parse(
      (await import("node:fs")).readFileSync(
        new URL("../artifacts/solidcash/UniswapV2Pair.func.json", import.meta.url), "utf8",
      ),
    );
    const deployed = await framedDeploy.deployFramedStatefulContract(
      JSON.parse(
        (await import("node:fs")).readFileSync(
          new URL("../artifacts/solidcash/UniswapV2Pair.json", import.meta.url), "utf8",
        ),
      ) as never,
      [],
      {
        provider, fundingUtxo: funding, funder: signer.unlockP2PKH(), changeAddress: ownerAddress,
        senderLockingBytecode: factoryLock, functionSplit: pairBundle,
      } as never,
    );
    const pairAddress = deployed.contract.address;
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
    await factory.registerPair(await token.getAddress(), await weth.getAddress(), pairAddress);

    const amountToken = 1_000_000n;
    // The caller's coin is 1e9 satoshis, so the value plus the fee needs a second coin: the composer funds the rest
    // of the value from more of the caller's coins and returns the change.
    const amountNative = 1_000_000_000n;
    await router.addLiquidityETH(
      await token.getAddress(), amountToken, 0n, 0n, signer.address, 2n ** 40n, { value: amountNative },
    );
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const [reserve0, reserve1] = await pair.getReserves();
    console.log("reserves", reserve0, reserve1, "wrapped", await weth.balanceOf(pairAddress));
    expect(reserve0 > 0n && reserve1 > 0n).toBe(true);
  }, 600_000);
});
