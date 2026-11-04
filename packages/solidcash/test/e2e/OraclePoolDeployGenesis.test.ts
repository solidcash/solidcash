import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { ORACLE_POOL_PARAMETER, POOL_MAX_DEPTH, oraclePoolBinding } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import {
  PoolKeeper, createOraclePool, resolveDeploymentOraclePool, selectPoolInfoCoin, selectPoolSlot,
} from '../../src/oracle/pool/index.js';
import { p2pkhLockOf } from '../../src/oracle/pool/coins.js';
import { randomUtxo } from '../../src/utils.js';
import { TEST_ORACLE_POOL_KEY } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

/**
 * A pool minted with its deployment (`oraclePool: 'new'` or `{ create }`), shaped by what the contract and the
 * contracts it creates read, and the owner's keeper loop. Mocknet only.
 */

const CLOCK = `
contract PoolClock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
        this.reads = this.reads + 1;
    }
}`;

const HASHES = `
contract PoolHashes() {
    int reads;
    function at(int n, bytes32 expected) {
        require(blockhash(n) == expected);
        this.reads = this.reads + 1;
    }
}`;

const ZERO_TXID = `0x${'00'.repeat(32)}`;

// The creator reads nothing itself; its child reads block.*.
const CREATOR = `
contract Clock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
        this.reads = this.reads + 1;
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

const TXID = /^[0-9a-f]{64}$/;

type Clocks = { check(timestamp: bigint, number: bigint): Promise<{ txid: string }> };
type Hashes = { at(n: bigint, expected: Uint8Array): Promise<{ txid: string }> };

interface Chain { provider: MockNetworkProvider; signer: Signer }

async function chain(): Promise<Chain> {
  const provider = new MockNetworkProvider();
  const signer = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 6; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return { provider, signer };
}

/** The pool's coins by kind, as the owner's keeper lists them. */
async function shape(provider: MockNetworkProvider, category: string): Promise<{
  info: number; slots: number; depths: number[]; batonDepth: number | undefined;
}> {
  const keeper = new PoolKeeper({ provider, category, ownerKey: provider.oraclePoolOwnerKey });
  const slots = await keeper.slots();
  return {
    info: (await keeper.infoCoins()).length,
    slots: slots.length,
    depths: [...new Set(slots.map(({ fields }) => fields.depth))],
    batonDepth: (await keeper.baton())?.fields.depth,
  };
}

/** A pool the mock does not keep, owned by the test key at the chain's tip: one info coin and a ring of `depth`. */
async function ownPool(provider: MockNetworkProvider, depth: number): Promise<{ keeper: PoolKeeper; category: string }> {
  await provider.addUtxo(binToHex(p2pkhLockOf(TEST_ORACLE_POOL_KEY)), randomUtxo({ vout: 0, satoshis: 10_000_000n }));
  const { category } = await createOraclePool(provider, {
    ownerKey: TEST_ORACLE_POOL_KEY, funder: TEST_ORACLE_POOL_KEY, infoCoins: 1, ringDepth: depth,
  });
  return { keeper: new PoolKeeper({ provider, category, ownerKey: TEST_ORACLE_POOL_KEY }), category };
}

describe('oracle pool minted with its deployment', () => {
  it('a stateful block.* reader deployed with \'new\' gets info coins only, reads them, and the mock keeps them',
    async () => {
      const { provider, signer } = await chain();
      const artifact = compileString(CLOCK);
      const sc = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n }, oraclePool: 'new' });
      const pool = (sc as unknown as StatefulContract).inner.oraclePool!;
      expect(pool).toMatch(TXID);
      // One info coin per master, no ring; the baton keeps the default depth.
      expect(await shape(provider, pool)).toEqual({ info: 1, slots: 0, depths: [], batonDepth: POOL_MAX_DEPTH });

      const { fields } = (await selectPoolInfoCoin(provider, pool))!;
      expect((await (sc as unknown as Clocks).check(fields.timestamp, fields.number)).txid).toMatch(TXID);

      await provider.mine(2);
      expect(provider.oraclePoolRefreshError).toBeUndefined();
      expect((await selectPoolInfoCoin(provider, pool))!.fields.number).toBe(BigInt(await provider.getBlockHeight()));
      expect(pool).not.toBe(provider.oraclePoolCategory);
    }, 300_000);

  it('a blockhash reader gets ring slots at its depth and no info coin', async () => {
    const { provider, signer } = await chain();
    const artifact = compileString(HASHES);
    expect(artifact.usesBlockOracle).toBeUndefined();
    const sc = await getContractFactory(artifact, signer).deploy({
      initialState: { reads: 0n }, oraclePool: { create: { ringDepth: 8, slotReplicas: 2 } },
    });
    const pool = (sc as unknown as StatefulContract).inner.oraclePool!;
    expect(await shape(provider, pool)).toEqual({ info: 0, slots: 16, depths: [8], batonDepth: 8 });

    const n = BigInt(await provider.getBlockHeight()) - 1n;
    expect((await selectPoolSlot(provider, pool, n))?.exact).toBe(true);
    const hash = hexToBin(await provider.getBlockHash(Number(n)));
    expect((await (sc as unknown as Hashes).at(n, hash)).txid).toMatch(TXID);

    // 'now' is a ring of one.
    const now = await resolveDeploymentOraclePool(provider, artifact, { create: { ringDepth: 'now' } }, 1);
    expect(await shape(provider, now!)).toEqual({ info: 0, slots: 1, depths: [1], batonDepth: 1 });
  }, 300_000);

  it('a factory deployed with \'new\' mints for its child\'s reads and passes the same pool to the child', async () => {
    const { provider, signer } = await chain();
    const { Clock, ClockMaker } = compileStringMulti(CREATOR, { allowUnsafeOperations: true });
    expect(ClockMaker.createdPoolReads).toEqual({ blockInfo: true });
    const make = ClockMaker.abi.find((fn) => fn.name === 'make')!;

    const maker = await getContractFactory(ClockMaker, signer).deploy({ initialState: { made: 0n }, oraclePool: 'new' });
    const pool = (maker as unknown as StatefulContract).inner.oraclePool!;
    expect(await shape(provider, pool)).toEqual({ info: 1, slots: 0, depths: [], batonDepth: POOL_MAX_DEPTH });

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
    expect(child.inner.constructorArgs.map((arg) => binToHex(arg as Uint8Array)))
      .toEqual([binToHex(oraclePoolBinding(hexToBin(pool)))]);
    expect(Clock.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);

    const { fields } = (await selectPoolInfoCoin(provider, pool))!;
    expect((await (child.connect(signer) as unknown as Clocks).check(fields.timestamp, fields.number)).txid)
      .toMatch(TXID);
  }, 300_000);

  it('refuses \'new\' on a provider with no oracle pool owner, naming create.ownerKey', async () => {
    await expect(resolveDeploymentOraclePool({} as NetworkProvider, compileString(CLOCK), 'new', 1))
      .rejects.toThrow(/PoolClock: oraclePool 'new' needs create.ownerKey/);
  });
});

describe('PoolKeeper', () => {
  it('start refreshes the info coin and writes each block\'s slot when the mock mines, until stopped', async () => {
    const { provider } = await chain();
    const { keeper } = await ownPool(provider, 4);
    let stepped: (() => void) | undefined;
    const nextStep = (): Promise<void> => new Promise((resolve) => { stepped = resolve; });
    const errors: unknown[] = [];

    let step = nextStep();
    const stop = keeper.start(10, { onError: (error) => errors.push(error), onStep: () => stepped?.() });
    await step;
    step = nextStep();
    await provider.mine(1);
    const mined = await provider.getBlockHeight();
    await step;
    await stop();
    expect(errors).toEqual([]);

    const [info] = await keeper.infoCoins();
    expect(info!.fields.number).toBe(BigInt(mined));
    const slots = await keeper.slots();
    expect(slots.some(({ fields }) => fields.n === BigInt(mined))).toBe(true);
    const newest = slots.find(({ fields }) => fields.n === BigInt(mined))!;
    expect(binToHex(newest.fields.hash)).toBe(await provider.getBlockHash(mined));

    // Stopped: a later block moves nothing.
    await provider.mine(1);
    expect((await keeper.infoCoins())[0]!.fields.number).toBe(BigInt(mined));
  }, 300_000);

  it('setDepth changes the baton\'s depth, which the slots it mints take', async () => {
    const { provider } = await chain();
    const { keeper } = await ownPool(provider, 4);
    expect((await keeper.baton())!.fields.depth).toBe(4);
    expect(await keeper.setDepth(16)).toMatch(TXID);
    expect((await keeper.baton())!.fields.depth).toBe(16);

    const n = BigInt(await provider.getBlockHeight());
    await keeper.growSlots([{ n, hash: hexToBin(await provider.getBlockHash(Number(n))) }]);
    const grown = (await keeper.slots()).filter(({ fields }) => fields.depth === 16);
    expect(grown.map(({ fields }) => fields.n)).toEqual([n]);

    await expect(keeper.setDepth(0)).rejects.toThrow(/from 1 to 256/);
    await expect(keeper.setDepth(POOL_MAX_DEPTH + 1)).rejects.toThrow(/from 1 to 256/);
  }, 300_000);
});
