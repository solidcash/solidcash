import { readFileSync } from "node:fs";
import hre from "hardhat";
import { findDeploymentByAddress } from "@solidcash/solidcash/stateful";
import { randomUtxo } from "@solidcash/solidcash";
import { cashAddressToLockingBytecode } from "@bitauth/libauth/build/lib/address/locking-bytecode.js";

export const connection = await hre.network.create();
export const { networkHelpers } = connection;
const connectionEthers = connection.ethers;

const sushiFixture = JSON.parse(
  readFileSync(new URL("./fixtures/sushi-pair-bytecode.json", import.meta.url), "utf8")
) as { initCodeHash: string; bytecode: string };
const uniswapFixture = JSON.parse(
  readFileSync(new URL("./fixtures/uniswap-pair-bytecode.json", import.meta.url), "utf8")
) as { initCodeHash: string; bytecode: string };

export const ethers = new Proxy(connectionEthers, {
  get(target, property, receiver) {
    if (property === "deployContract") {
      return async (name: string, args: any[], signer?: any) => {
        const contract = await target.deployContract(name, args, signer);
        const resolvedSigner = signer ?? (await target.getSigners())[0];
        const address = typeof resolvedSigner.address === "string"
          ? resolvedSigner.address : await resolvedSigner.getAddress();
        // A deploy consumes the signer's genesis-eligible coins, and `deployFrom` otherwise fans out a fresh one
        // inside the same call. Keep one vout-0 token-free coin available so the next create's category (and
        // therefore its address) is knowable before the transaction is built.
        const utxos = await target.provider.getUtxos(address);
        const eligible = utxos.filter((utxo: any) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 100_000n);
        if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
          console.error('DEPLOY_TOPUP', name, address, utxos.length, eligible.length);
        }
        if (eligible.length === 0) {
          await (target.provider as any).addUtxo(address, randomUtxo({ satoshis: 1_000_000n, vout: 0 }));
        }
        return contract;
      };
    }
    return Reflect.get(target, property, receiver);
  },
});

export const MaxUint256 = ethers.MaxUint256;
export const MaxUint112 = (1n << 112n) - 1n;
export const AddressZero = ethers.ZeroAddress;
export const ZeroHash = ethers.ZeroHash;
export const SUSHI_INIT_CODE_HASH = sushiFixture.initCodeHash;
export const UNISWAP_INIT_CODE_HASH = uniswapFixture.initCodeHash;

export function addressOf(contract: any): string {
  return contract.target as string;
}

export async function deployToken(name: string, symbol: string, deployer?: any): Promise<any> {
  const token = await ethers.deployContract("TestERC20", [name, symbol], deployer);
  await token.waitForDeployment();
  return token;
}

export async function deployNoReturnToken(deployer?: any): Promise<any> {
  const token = await ethers.deployContract("TestNoReturnERC20", [], deployer);
  await token.waitForDeployment();
  return token;
}

export async function deployTestFactory(pairBytecode: string, deployer?: any): Promise<any> {
  const factory = await ethers.deployContract("TestFactory", [pairBytecode], deployer);
  await factory.waitForDeployment();
  return factory;
}

export async function deploySushiFactory(deployer?: any): Promise<any> {
  return deployTestFactory(sushiFixture.bytecode, deployer);
}

export async function deployUniswapFactory(deployer?: any): Promise<any> {
  return deployTestFactory(uniswapFixture.bytecode, deployer);
}

export async function deployWETH(deployer?: any): Promise<any> {
  const weth = await ethers.deployContract("WETH9", [], deployer);
  await weth.waitForDeployment();
  return weth;
}

export async function deployRouter(
  routerName: string,
  factoryAddress: string,
  wethAddress: string,
  deployer?: any
): Promise<any> {
  const router = await ethers.deployContract(
    routerName,
    [factoryAddress, wethAddress],
    deployer
  );
  await router.waitForDeployment();
  return router;
}

export async function mint(token: any, to: string, amount: bigint): Promise<void> {
  await token.mint(to, amount);
}

export async function approve(
  token: any,
  owner: any,
  spender: string,
  amount: bigint = MaxUint256
): Promise<void> {
  await token.connect(owner).approve(spender, amount);
}

export async function latestTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  if (!block) throw new Error("missing latest block");
  return block.timestamp;
}

export async function increaseTime(seconds: number): Promise<void> {
  await networkHelpers.time.increase(seconds);
}

export async function signPermit(
  signer: any,
  token: any,
  spender: string,
  value: bigint,
  deadline: bigint
): Promise<{ v: number; r: string; s: string }> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = {
    name: await token.name(),
    version: "1",
    chainId,
    verifyingContract: await token.getAddress(),
  };
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const nonce = await token.nonces(signer.address);
  const signature = await signer.signTypedData(domain, types, {
    owner: signer.address,
    spender,
    value,
    nonce,
    deadline,
  });
  return ethers.Signature.from(signature);
}

export async function signPermitWithNonce(
  signer: any,
  token: any,
  spender: string,
  value: bigint,
  deadline: bigint,
  nonce: bigint
): Promise<{ v: number; r: string; s: string }> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = {
    name: await token.name(),
    version: "1",
    chainId,
    verifyingContract: await token.getAddress(),
  };
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const signature = await signer.signTypedData(domain, types, {
    owner: signer.address,
    spender,
    value,
    nonce,
    deadline,
  });
  return ethers.Signature.from(signature);
}

export function gasCost(receipt: any): bigint {
  return BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice ?? 0n);
}

export function sortTokens(tokenA: string, tokenB: string): [string, string] {
  // The covenant orders address values by their locking bytecode's unsigned big-endian value, and a deployed
  // stateful contract's value is its physical self-pinned address (not the logical CREATE address a test names
  // it by). Sort those exact values so `token0`/`token1` match the pair's own ordering.
  const valueAddress = (address: string): string => {
    try {
      const deployment = findDeploymentByAddress(connection.ethers.provider as any, address);
      const physical = (deployment?.contract as { inner?: { address?: string } } | undefined)?.inner?.address;
      return typeof physical === 'string' ? physical : address;
    } catch {
      return address;
    }
  };
  const lockBytes = (address: string): Uint8Array => {
    const decoded = cashAddressToLockingBytecode(address);
    return typeof decoded === 'string' ? new Uint8Array() : decoded.bytecode;
  };
  const compareUnsigned = (left: Uint8Array, right: Uint8Array): number => {
    let leftStart = 0;
    while (leftStart < left.length && left[leftStart] === 0) leftStart += 1;
    let rightStart = 0;
    while (rightStart < right.length && right[rightStart] === 0) rightStart += 1;
    const leftLength = left.length - leftStart;
    const rightLength = right.length - rightStart;
    if (leftLength !== rightLength) return leftLength < rightLength ? -1 : 1;
    for (let index = 0; index < leftLength; index += 1) {
      const difference = left[leftStart + index] - right[rightStart + index];
      if (difference !== 0) return difference < 0 ? -1 : 1;
    }
    return 0;
  };
  const a = valueAddress(tokenA);
  const b = valueAddress(tokenB);
  return compareUnsigned(lockBytes(a), lockBytes(b)) <= 0 ? [a, b] : [b, a];
}

export function pairFor(
  factory: string,
  tokenA: string,
  tokenB: string,
  initCodeHash: string = SUSHI_INIT_CODE_HASH
): string {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  return ethers.getCreate2Address(
    factory,
    ethers.keccak256(ethers.solidityPacked(["address", "address"], [token0, token1])),
    initCodeHash
  );
}
