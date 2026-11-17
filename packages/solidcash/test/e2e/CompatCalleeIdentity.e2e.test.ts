/**
 * Under evmCompat a call's target can be a 20-byte identity (an address cast from `bytes20` or a word, decoded, or
 * written as a literal), and the caller takes the co-spent callee's identity from its lock: a P2SH32 lock's HASH160,
 * the hash a P2PKH lock carries. It also took the hash a P2SH20 lock carries, and a 20-byte or zero-padded 32-byte
 * lock as the identity itself. A P2SH20 lock carrying the HASH160 of a contract's P2SH32 lock projects to that
 * contract's identity, and anyone can spend it: its redeem script is the contract's P2SH32 lock, `OP_HASH256 <h>
 * OP_EQUAL`, which the contract's public redeem bytecode satisfies. With a minting token of a category its spender
 * makes, and the call's record moved to that category, such a coin answered a typed call through a one-method
 * interface, whose selector the caller does not bind, in the callee's place. Now a co-spent coin stands for a 20-byte
 * identity only as a P2SH32 or a P2PKH lock.
 *
 * Each spend is evaluated on the production profile's VM.
 */
import {
  binToHex, decodeAuthenticationInstructions, encodeDataPush, flattenBinArray, hexToBin,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { hash160 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `pragma solidity ^0.8.0;
interface IOracle { function price() external returns (uint256); }
contract Oracle {
  uint256 public reads;
  function price() external returns (uint256) { reads += 1; return 7; }
}
contract Reader {
  IOracle oracle;
  uint256 public last;
  function setOracle(IOracle o) external { oracle = o; }
  function setOracleId(bytes20 id) external { oracle = IOracle(address(id)); }
  function read() external { last = oracle.price(); }
}`;

const productionVm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({ profile: 'production' }));
type Program = Parameters<typeof productionVm.evaluate>[0];
type Spend = Program['transaction'];
type Coins = Program['sourceOutputs'];

const accepts = (transaction: Spend, sourceOutputs: Coins, inputIndex: number): true | string =>
  productionVm.stateSuccess(productionVm.evaluate({ inputIndex, sourceOutputs, transaction }));

type Deployed = { contract: any; address: Uint8Array };

async function deploy(provider: ReturnType<typeof createTestProvider>, artifact: Artifact): Promise<Deployed> {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  return { contract, address };
}

/**
 * The honest spend of `reader.read()` with the reader's target set by `point`, and a forger that moves the oracle's
 * master to another lock, with its outputs, record among them, moved to a category of the spender's making.
 */
async function readSpend(point: (reader: Deployed, oracle: Deployed) => Promise<void>): Promise<{
  transaction: Spend; sourceOutputs: Coins; master: number; oracleLock: Uint8Array; redeem: Uint8Array;
  forge(lock: Uint8Array, unlocking?: Uint8Array): { spend: Spend; coins: Coins };
}> {
  const artifacts = compileStringMulti(SOURCE, { evmCompat: true, forceStateful: true });
  const provider = createTestProvider();
  const oracle = await deploy(provider, artifacts.Oracle!);
  const reader = await deploy(provider, artifacts.Reader!);
  await point(reader, oracle);
  const builder = await reader.contract.read().withExternalCall(oracle.contract, 'price', []).build();
  const transaction: Spend = builder.buildLibauthTransaction();
  const sourceOutputs: Coins = generateLibauthSourceOutputs(builder.inputs);
  const master = sourceOutputs.findIndex((coin) => binToHex(coin.lockingBytecode) === binToHex(oracle.address));
  const category = binToHex(sourceOutputs[master]!.token!.category);
  const pushes = decodeAuthenticationInstructions(transaction.inputs[master]!.unlockingBytecode);
  const redeem = (pushes[pushes.length - 1] as { data: Uint8Array }).data;
  const spenderCategory = new Uint8Array(32).fill(0x7a);
  const recategorized = <T extends { token?: { category: Uint8Array } }>(value: T): T => (
    value.token !== undefined && binToHex(value.token.category) === category
      ? { ...value, token: { ...value.token, category: spenderCategory } } : value);
  return {
    transaction, sourceOutputs, master, oracleLock: oracle.address, redeem,
    forge: (lock, unlocking) => ({
      coins: sourceOutputs.map((coin, index) => (index === master
        ? recategorized({ ...coin, lockingBytecode: lock }) : recategorized(coin))),
      spend: {
        ...transaction,
        inputs: transaction.inputs.map((input, index) => (index === master && unlocking !== undefined
          ? { ...input, unlockingBytecode: unlocking } : input)),
        outputs: transaction.outputs.map((output, index) => (index === master
          ? recategorized({ ...output, lockingBytecode: lock }) : recategorized(output))),
      },
    }),
  };
}

describe('a typed call\'s callee under evmCompat, against a lock of another kind with its identity', () => {
  it('refuses a P2SH20 lock carrying the HASH160 of the callee\'s P2SH32 lock, which anyone can spend', async () => {
    const read = await readSpend(async (reader, oracle) => {
      await reader.contract.setOracleId(hash160(oracle.address)).send();
    });
    expect(accepts(read.transaction, read.sourceOutputs, 0)).toBe(true);
    const standIn = flattenBinArray([Uint8Array.of(0xa9, 0x14), hash160(read.oracleLock), Uint8Array.of(0x87)]);
    const forged = read.forge(standIn, flattenBinArray([encodeDataPush(read.redeem), encodeDataPush(read.oracleLock)]));
    expect(accepts(forged.spend, forged.coins, read.master)).toBe(true);
    expect(accepts(forged.spend, forged.coins, 0)).not.toBe(true);
  }, 300_000);

  it('refuses a 20-byte lock and a zero-padded 32-byte lock that are the callee\'s identity', async () => {
    const read = await readSpend(async (reader, oracle) => {
      await reader.contract.setOracleId(hash160(oracle.address)).send();
    });
    for (const lock of [hash160(read.oracleLock), flattenBinArray([new Uint8Array(12), hash160(read.oracleLock)])]) {
      const forged = read.forge(lock);
      expect(accepts(forged.spend, forged.coins, 0)).not.toBe(true);
    }
  }, 300_000);

  it('accepts the callee through its stored lock, and refuses the stand-in there as before', async () => {
    const read = await readSpend(async (reader, oracle) => { await reader.contract.setOracle(oracle.address).send(); });
    expect(accepts(read.transaction, read.sourceOutputs, 0)).toBe(true);
    const standIn = flattenBinArray([Uint8Array.of(0xa9, 0x14), hash160(read.oracleLock), Uint8Array.of(0x87)]);
    const forged = read.forge(standIn);
    expect(accepts(forged.spend, forged.coins, 0)).not.toBe(true);
  }, 300_000);
});
