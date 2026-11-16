import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  ORACLE_POOL_PARAMETER, POOL_FLAG_NUMBER_STOPPED, POOL_FLAG_TIMESTAMP_STOPPED, oraclePoolBinding,
  poolSlotLockingBytecode, poolSlotReadUnlocking, type Artifact,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, SignatureTemplate, Signer, TransactionBuilder } from '../../src/index.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  PoolKeeper, poolInfoUnlockable, selectPoolInfoCoin, type PoolBlockFields,
} from '../../src/oracle/pool/index.js';
import type { UnlockableUtxo, Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';
import {
  TEST_ORACLE_POOL_KEY, createTestProvider, expectScriptRejection, mintTestOraclePool,
} from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * Direct block.* readers on an oracle pool (oracle pools, phase 3). A reader takes the hidden `__oraclePool` input,
 * which the SDK fills from `oraclePool` or the provider's pool, and co-spends a block-info coin of that pool, which
 * it recreates at its own index. The read checks the coin's category, capability and flags, no lock.
 */

const READER = `
contract PoolReader() {
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
    }
}`;

const STATEFUL_READER = `
contract PoolClock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
    }
}`;

const RECORDER = `pragma solidity ^0.8.0;
contract Recorder {
    uint256 public height;
    uint256 public clock;
    function set(uint256 h, uint256 t) public { height = h; clock = t; }
}`;

const FORWARDER = `pragma solidity ^0.8.0;
interface IRecorder { function set(uint256 h, uint256 t) external; }
contract Forwarder {
    IRecorder public recorder;
    uint256 public forwards;
    constructor(IRecorder recorder_) { recorder = recorder_; }
    function forward() public { recorder.set(block.number + 1, block.timestamp + 1); forwards = forwards + 1; }
}`;

const GUARDED = `pragma solidity ^0.8.0;
interface IRecorder { function set(uint256 h, uint256 t) external; }
contract Guarded {
    IRecorder public recorder;
    uint256 public runs;
    constructor(IRecorder recorder_) { recorder = recorder_; }
    function atGenesis() public { if (block.number == 0) { recorder.set(1, 1); } runs = runs + 1; }
    function afterGenesis() public { if (block.number > 0) { recorder.set(2, 2); } runs = runs + 1; }
}`;

const ZERO_TXID = `0x${'00'.repeat(32)}`;

// The creator reads nothing; it binds the pool because the child it creates does.
const CREATOR = `
contract Clock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
    }
}
contract ClockMaker() {
    int made;
    function make(int fundingInputIndex) {
        new Clock();
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != ${ZERO_TXID});
        this.made = this.made + 1;
    }
}`;

// Fields of a pool the test mints, unlike the chain's tip that the provider's pool publishes.
const POOL_TIP: PoolBlockFields = {
  number: 120_000n, timestamp: 1_690_000_000n, difficulty: 0x1d00ffffn, size: 4_321n, totalFees: 9_876n,
  coinbase: hexToBin(`76a914${'11'.repeat(20)}88ac`),
};

const TXID = /^[0-9a-f]{64}$/;
const SCRIPT_FAILURE = /OP_VERIFY|EQUALVERIFY|non-truthy/;

interface Chain { provider: MockNetworkProvider; signer: Signer }

async function chain(): Promise<Chain> {
  const provider = createTestProvider() as MockNetworkProvider;
  const signer = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 6; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return { provider, signer };
}

/** The `check` arguments with the hidden block-info input index given, so the builder cannot choose it. */
function withIndex(artifact: Artifact, timestamp: bigint, number: bigint, index: bigint): bigint[] {
  const values: Record<string, bigint> = {
    eTimestamp: timestamp, eNumber: number, __internal__blockOracleInputIndex: index,
  };
  return artifact.abi.find((fn) => fn.name === 'check')!.inputs.map((input) => values[input.name]!);
}

/**
 * Spend a stateless reader once. A `supplied` coin is input 1, recreated at output 1; the builder co-spends a coin of
 * the reader's pool itself unless the transaction already spends one.
 */
async function spendReader(
  provider: MockNetworkProvider, reader: Contract, args: bigint[], supplied?: UnlockableUtxo,
): Promise<string> {
  const utxo = await provider.addUtxo(reader.address, randomUtxo({ satoshis: 100_000n }));
  const payer = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fee = await provider.addUtxo(payer.address, randomUtxo({ satoshis: 20_000n }));
  const builder = new TransactionBuilder({ provider })
    .addInput(utxo, reader.unlock.check(...args))
    .addOutput({ to: reader.address, amount: 110_000n });
  if (supplied !== undefined) {
    const { unlocker, ...coin } = supplied;
    builder.addInput(coin, unlocker).addOutput({
      to: unlocker.generateLockingBytecode(), amount: coin.satoshis, token: coin.token,
    });
  }
  builder.addInput(fee, payer.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  return (await builder.send()).txid;
}

/** Whether transaction `txid` recreates a mutable NFT of the pool, the info coin it read. */
async function recreatedIn(provider: MockNetworkProvider, category: string, txid: string): Promise<boolean> {
  const transaction = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof transaction === 'string') throw new Error(transaction);
  return transaction.outputs.some(({ token }) => token?.nft?.capability === 'mutable'
    && binToHex(token.category) === category);
}

function slotUnlockable(utxo: Utxo, category: string): UnlockableUtxo {
  const lock = poolSlotLockingBytecode(hexToBin(category));
  const unlocking = poolSlotReadUnlocking(hexToBin(category));
  return { ...utxo, unlocker: { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => unlocking } };
}

type Reads = { check(timestamp: bigint, number: bigint): Promise<{ txid: string }> };

describe('oracle pool block-info reads by direct contracts', () => {
  it('a stateful reader binds the provider pool, which refreshes, and reads block.timestamp and block.number', async () => {
    const { provider, signer } = await chain();
    const artifact = compileString(STATEFUL_READER);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const sc = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n } });
    const category = provider.oraclePoolCategory!;
    expect(category).toMatch(TXID);
    expect((sc as unknown as StatefulContract).inner.oraclePool).toBe(category);

    await provider.mine(3);
    await provider.send('evm_increaseTime', [600]);
    expect(provider.oraclePoolRefreshError).toBeUndefined();
    const { fields } = (await selectPoolInfoCoin(provider, category))!;
    expect(fields.number).toBe(BigInt(await provider.getBlockHeight()));
    expect(fields.timestamp).toBe(BigInt(provider.getBlockTime() - 1));

    const reader = sc as unknown as Reads;
    const tx = await reader.check(fields.timestamp, fields.number);
    expect(tx.txid).toMatch(TXID);
    expect(await recreatedIn(provider, category, tx.txid)).toBe(true);
    // A send can move the pool's clock, never its height.
    await expect(reader.check(fields.timestamp, fields.number + 1n)).rejects.toThrow(SCRIPT_FAILURE);
  });

  it('a stateless reader binds the provider pool and co-spends one of its info coins', async () => {
    const { provider } = await chain();
    const reader = new Contract(compileString(READER), [], { provider });
    const category = provider.oraclePoolCategory!;
    expect(reader.oraclePool).toBe(category);
    expect(binToHex(reader.constructorArgs[0] as Uint8Array)).toBe(binToHex(oraclePoolBinding(hexToBin(category))));

    const { fields } = (await selectPoolInfoCoin(provider, category))!;
    const txid = await spendReader(provider, reader, [fields.timestamp, fields.number]);
    expect(txid).toMatch(TXID);
    expect(await recreatedIn(provider, category, txid)).toBe(true);
    await expect(spendReader(provider, reader, [fields.timestamp, fields.number + 1n])).rejects.toThrow(SCRIPT_FAILURE);
  });

  it('an external call\'s arguments read block.number and block.timestamp from the coin the body slices', async () => {
    const { provider, signer } = await chain();
    const options = { evmCompat: true, forceStateful: true, messageBus: false } as const;
    const recorder = await getContractFactory(compileString(RECORDER, options), signer).deploy() as any;
    const forwarder = await getContractFactory(compileString(FORWARDER, options), signer)
      .deploy(recorder.address) as any;
    const { fields } = (await selectPoolInfoCoin(provider, provider.oraclePoolCategory!))!;
    await forwarder.forward().send();
    expect(await recorder.height()).toBe(fields.number + 1n);
    expect(await recorder.clock()).toBe(fields.timestamp + 1n);
  });

  it('a guard that reads block.number decides whether its external call runs', async () => {
    const { signer } = await chain();
    const options = { evmCompat: true, forceStateful: true, messageBus: false } as const;
    const recorder = await getContractFactory(compileString(RECORDER, options), signer).deploy() as any;
    const guarded = await getContractFactory(compileString(GUARDED, options), signer)
      .deploy(recorder.address) as any;
    await guarded.atGenesis().send();
    expect(await guarded.runs()).toBe(1n);
    expect(await recorder.height()).toBe(0n);
    await guarded.afterGenesis().send();
    expect(await guarded.runs()).toBe(2n);
    expect(await recorder.height()).toBe(2n);
  });

  it('a creator deploys a child that reads block.* through the creator\'s pool', async () => {
    // A deployer `new` of a block reader is not in v1 (A15): its oracle needs an owner the creator binds. The
    // binding-forwarding shape is the pre-B10 fold's, kept through the internal escape.
    expect(() => compileStringMulti(CREATOR, { allowUnsafeOperations: true })).toThrow(/child-reads-block-data/);
    const { provider, signer } = await chain();
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const { Clock, ClockMaker } = compileStringMulti(CREATOR, {
      allowUnsafeOperations: true, __legacyDeployFold: true,
    } as never);
    expect(ClockMaker.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const make = ClockMaker.abi.find((fn) => fn.name === 'make')!;
    expect(make.deployTargets?.[0]?.constructorArgs).toEqual([ORACLE_POOL_PARAMETER]);

    const maker = await getContractFactory(ClockMaker, signer).deploy({ initialState: { made: 0n }, oraclePool: pool });
    const factory = maker as unknown as StatefulContract;
    expect(factory.inner.oraclePool).toBe(pool);
    const fundingUtxo = await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 200_000n }));
    const { child } = await StatefulContract.deployFrom({
      provider,
      factory: maker,
      deployFunctionName: 'make',
      deployFunctionArgs: [BigInt(1 + (make.requiredNftIndices?.length ?? ClockMaker.stateLayout!.dataNftCount))],
      childArtifact: Clock,
      childInitialState: { reads: 0n },
      fundingUtxo,
      funder: signer.unlockP2PKH(),
      changeAddress: signer.getAddress(),
    });
    expect(child.inner.oraclePool).toBe(pool);
    expect(binToHex(child.inner.constructorArgs[0] as Uint8Array)).toBe(binToHex(oraclePoolBinding(hexToBin(pool))));

    const tx = await (child.connect(signer) as unknown as Reads).check(POOL_TIP.timestamp, POOL_TIP.number);
    expect(tx.txid).toMatch(TXID);
    expect(await recreatedIn(provider, pool, tx.txid)).toBe(true);
  });

  it('a reader binds the pool named in oraclePool', async () => {
    const { provider } = await chain();
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const artifact = compileString(READER);
    const named = new Contract(artifact, [], { provider, oraclePool: pool });
    const byDefault = new Contract(artifact, [], { provider });
    expect(named.oraclePool).toBe(pool);
    expect(byDefault.oraclePool).toBe(provider.oraclePoolCategory);
    expect(named.address).not.toBe(byDefault.address);

    const txid = await spendReader(provider, named, [POOL_TIP.timestamp, POOL_TIP.number]);
    expect(await recreatedIn(provider, pool, txid)).toBe(true);
    // The provider's pool publishes the chain's fields, not these.
    await expect(spendReader(provider, byDefault, [POOL_TIP.timestamp, POOL_TIP.number])).rejects.toThrow(SCRIPT_FAILURE);
    // A binding passed in the arguments names its own pool, which oraclePool may not contradict.
    expect(() => new Contract(artifact, [oraclePoolBinding(hexToBin(pool))], {
      provider, oraclePool: provider.oraclePoolCategory,
    })).toThrow(/binds pool/);
  });

  it('refuses a coin of another category, a ring slot and a stopped coin given as the info coin', async () => {
    const { provider } = await chain();
    const pool = await mintTestOraclePool(provider, POOL_TIP, { infoCoins: 2, slots: true });
    const artifact = compileString(READER);
    const reader = new Contract(artifact, [], { provider, oraclePool: pool });
    const args = withIndex(artifact, POOL_TIP.timestamp, POOL_TIP.number, 1n);
    const keeper = new PoolKeeper({ provider, category: pool, ownerKey: TEST_ORACLE_POOL_KEY });
    const refused = async (coin: UnlockableUtxo): Promise<void> => {
      const outcome = await spendReader(provider, reader, args, coin)
        .then(() => 'ACCEPTED', (error: Error) => error.message);
      expectScriptRejection(outcome, 0);
      expect(outcome).toMatch(SCRIPT_FAILURE);
    };

    // Control: a live info coin of the bound pool at the given index.
    const [live, other] = await keeper.infoCoins();
    expect(await spendReader(provider, reader, args, poolInfoUnlockable(live!.utxo, pool))).toMatch(TXID);

    // A live info coin of another pool: the provider's.
    const foreign = provider.oraclePoolCategory!;
    await refused(poolInfoUnlockable((await selectPoolInfoCoin(provider, foreign))!.utxo, foreign));
    // A ring slot of the bound pool, whose flags are 0x80.
    const [slot] = await keeper.slots();
    await refused(slotUnlockable(slot!.utxo, pool));
    // A stopped info coin of the bound pool.
    await keeper.stop([other!.utxo]);
    const stopped = (await keeper.infoCoins()).find(({ fields }) => fields.flags !== 0)!;
    expect(stopped.fields.flags).toBe(POOL_FLAG_NUMBER_STOPPED | POOL_FLAG_TIMESTAMP_STOPPED);
    await refused(poolInfoUnlockable(stopped.utxo, pool));
  });
});
