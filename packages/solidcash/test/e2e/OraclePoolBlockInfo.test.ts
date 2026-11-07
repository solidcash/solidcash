import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import { ORACLE_POOL_PARAMETER, oraclePoolBinding } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, Signer } from '../../src/index.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { selectPoolInfoCoin, type PoolBlockFields } from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, mintTestOraclePool } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

/**
 * Direct block.* readers on an oracle pool (oracle pools, phase 3). A reader takes the hidden `__oraclePool` input,
 * which the SDK fills from `oraclePool` or the provider's pool, and co-spends a block-info coin of that pool, which
 * it recreates at its own index. The read checks the coin's category, capability and flags, no lock. Every block.*
 * reader is stateful on this branch, so each reader here is deployed.
 */

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
const SCRIPT_FAILURE = /OP_VERIFY|EQUALVERIFY/;

interface Chain { provider: MockNetworkProvider; signer: Signer }

async function chain(): Promise<Chain> {
  const provider = createTestProvider() as MockNetworkProvider;
  const signer = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 6; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return { provider, signer };
}

/** Whether transaction `txid` recreates a mutable NFT of the pool, the info coin it read. */
async function recreatedIn(provider: MockNetworkProvider, category: string, txid: string): Promise<boolean> {
  const transaction = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof transaction === 'string') throw new Error(transaction);
  return transaction.outputs.some(({ token }) => token?.nft?.capability === 'mutable'
    && binToHex(token.category) === category);
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

  it('a creator deploys a child that reads block.* through the creator\'s pool', async () => {
    const { provider, signer } = await chain();
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const { Clock, ClockMaker } = compileStringMulti(CREATOR, { allowUnsafeOperations: true });
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

  it('a reader binds the pool named in oraclePool, which its argument may not contradict', async () => {
    const { provider, signer } = await chain();
    const pool = await mintTestOraclePool(provider, POOL_TIP);
    const artifact = compileString(STATEFUL_READER);
    expect(new Contract(artifact, [], { provider, oraclePool: pool }).oraclePool).toBe(pool);
    expect(new Contract(artifact, [], { provider }).oraclePool).toBe(provider.oraclePoolCategory);
    // A binding passed in the arguments names its own pool, which oraclePool may not contradict.
    expect(() => new Contract(artifact, [oraclePoolBinding(hexToBin(pool))], {
      provider, oraclePool: provider.oraclePoolCategory,
    })).toThrow(/binds pool/);

    const named = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n }, oraclePool: pool });
    expect((named as unknown as StatefulContract).inner.oraclePool).toBe(pool);
    const tx = await (named as unknown as Reads).check(POOL_TIP.timestamp, POOL_TIP.number);
    expect(await recreatedIn(provider, pool, tx.txid)).toBe(true);
    // The provider's pool publishes the chain's fields, not these.
    const byDefault = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n } });
    await expect((byDefault as unknown as Reads).check(POOL_TIP.timestamp, POOL_TIP.number))
      .rejects.toThrow(SCRIPT_FAILURE);
  });
});
