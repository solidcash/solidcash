import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ORACLE_POOL_PARAMETER, POOL_FLAG_SLOT, POOL_FLAG_SLOT_STOPPED, oraclePoolBinding,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate, Signer, type TransactionBuilder } from '../../src/index.js';
import { StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import {
  PoolKeeper, createOraclePool, isPoolSlotInput, poolInfoUnlockable, poolSlotCoin, poolSlotUnlockable,
  selectPoolInfoCoin, selectPoolSlot, type PoolBlockFields,
} from '../../src/oracle/pool/index.js';
import { p2pkhLockOf } from '../../src/oracle/pool/coins.js';
import { resolveBlockhashCoSpend } from '../../src/oracle/index.js';
import type { UnlockableUtxo } from '../../src/interfaces.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { TEST_ORACLE_POOL_KEY, createTestProvider, mintTestOraclePool } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

/**
 * blockhash(n) readers on an oracle pool (oracle pools, phase 3). A read co-spends a ring slot of the pool its
 * `__oraclePool` input binds, which it recreates at its own index, and checks the coin's category, capability and
 * flags (0x80), no lock. It answers the slot's hash when the slot holds n, and zero when the slot holds a block of
 * n's residue at least 256 newer.
 */

const HASHES = `
contract PoolHashes() {
    int reads;
    function last(bytes32 expected) {
        require(blockhash(block.number - 1) == expected);
        this.reads = this.reads + 1;
    }
    function at(int n, bytes32 expected) {
        require(blockhash(n) == expected);
        this.reads = this.reads + 1;
    }
}`;

// No state of its own: the statefulness rule still makes a blockhash reader stateful.
const NO_STATE = `
contract PoolHash() {
    function check(int n, bytes32 expected) {
        require(blockhash(n) == expected);
    }
}`;

const ZERO_TXID = `0x${'00'.repeat(32)}`;

// The creator reads nothing; it binds the pool because the child it creates does.
const CREATOR = `
contract Hasher() {
    int reads;
    function check(int n, bytes32 expected) {
        require(blockhash(n) == expected);
        this.reads = this.reads + 1;
    }
}
contract HasherMaker() {
    int made;
    function make(int fundingInputIndex) {
        new Hasher();
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != ${ZERO_TXID});
        this.made = this.made + 1;
    }
}`;

const TXID = /^[0-9a-f]{64}$/;
const SCRIPT_FAILURE = /OP_VERIFY|EQUALVERIFY/;
const ZERO = new Uint8Array(32);

/** Fields of a pool the test mints, whose ring holds block `number`. */
const fieldsAt = (number: bigint): PoolBlockFields => ({
  number, timestamp: 1_690_000_000n, difficulty: 0x1d00ffffn, size: 4_321n, totalFees: 9_876n,
  coinbase: hexToBin(`76a914${'11'.repeat(20)}88ac`),
});

type Call = PromiseLike<{ txid: string }> & { build(): Promise<TransactionBuilder> };
interface Hashes {
  last(expected: Uint8Array): Call;
  at(n: bigint, expected: Uint8Array): Call;
}
interface Spend {
  readonly transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  readonly sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
}
interface Chain { provider: MockNetworkProvider; signer: Signer }

async function chain(): Promise<Chain> {
  const provider = createTestProvider() as MockNetworkProvider;
  const signer = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 6; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return { provider, signer };
}

/** The newest block a live slot of the pool holds. */
async function newestSlot(provider: MockNetworkProvider, category: string): Promise<bigint> {
  let newest = -1n;
  for (const utxo of await provider.getUtxosByTokenCategory(category)) {
    const fields = poolSlotCoin(utxo, category)?.fields;
    if (fields !== undefined && fields.flags === POOL_FLAG_SLOT && fields.n > newest) newest = fields.n;
  }
  return newest;
}

async function blockHash(provider: MockNetworkProvider, n: bigint): Promise<Uint8Array> {
  return hexToBin(await provider.getBlockHash(Number(n)));
}

function spendOf(builder: TransactionBuilder): Spend {
  return { transaction: builder.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(builder.inputs) };
}

/** The spend with the coin at `index` replaced by `coin`, recreated at the same index. */
function swapped(spend: Spend, index: number, coin: UnlockableUtxo): Spend {
  const [output] = generateLibauthSourceOutputs([coin]);
  return {
    sourceOutputs: spend.sourceOutputs.map((source, at) => (at === index ? output! : source)),
    transaction: {
      ...spend.transaction,
      outputs: spend.transaction.outputs.map((recreate, at) => (at === index ? output! : recreate)),
    },
  };
}

describe('oracle pool blockhash reads by direct contracts', () => {
  it('a stateful reader reads blockhash(block.number - 1) and a dynamic blockhash(n) from its pool', async () => {
    const { provider, signer } = await chain();
    const artifact = compileString(HASHES);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    expect(artifact.abi.find((fn) => fn.name === 'last')?.blockhashReads).toEqual(['<computed:0>']);
    expect(artifact.abi.find((fn) => fn.name === 'at')?.blockhashReads).toEqual(['n']);
    const sc = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n } });
    const pool = provider.oraclePoolCategory!;
    expect((sc as unknown as StatefulContract).inner.oraclePool).toBe(pool);
    const reader = sc as unknown as Hashes;

    // block.number is the number the pool's info coins publish.
    const { fields } = (await selectPoolInfoCoin(provider, pool))!;
    const previous = await blockHash(provider, fields.number - 1n);
    expect((await reader.last(previous)).txid).toMatch(TXID);
    const n = fields.number - 5n;
    expect((await reader.at(n, await blockHash(provider, n))).txid).toMatch(TXID);
    expect((await (sc as unknown as StatefulContract).getState()).reads).toBe(2n);

    await expect(reader.last(ZERO)).rejects.toThrow(SCRIPT_FAILURE);
    await expect(reader.at(n, previous)).rejects.toThrow(SCRIPT_FAILURE);
  }, 300_000);

  it('a reader with no state, which the statefulness rule keeps stateful, reads its pool', async () => {
    const { provider, signer } = await chain();
    const artifact = compileString(NO_STATE);
    expect(artifact.stateLayout).toBeDefined();
    const fundingUtxo = await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 500_000n }));
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: signer.getAddress(),
    });
    const pool = provider.oraclePoolCategory!;
    expect(deployed.contract.inner.oraclePool).toBe(pool);
    const n = (await newestSlot(provider, pool)) - 1n;
    await expect(deployed.contract.call.check(n, await blockHash(provider, n)).send()).resolves.toHaveProperty('txid');
    await expect(deployed.contract.call.check(n, ZERO).send()).rejects.toThrow(SCRIPT_FAILURE);
  }, 300_000);

  it('reads zero for a block 256 or more older than the newest slot of its residue', async () => {
    const { provider, signer } = await chain();
    const sc = await getContractFactory(compileString(HASHES), signer).deploy({ initialState: { reads: 0n } });
    const pool = provider.oraclePoolCategory!;
    const reader = sc as unknown as Hashes;
    const old = (await newestSlot(provider, pool)) - 256n;
    expect((await selectPoolSlot(provider, pool, old))?.exact).toBe(false);
    expect((await resolveBlockhashCoSpend(provider, pool, old))?.exact).toBe(false);
    expect((await resolveBlockhashCoSpend(provider, pool, old + 1n))?.exact).toBe(true);
    expect((await reader.at(old, ZERO)).txid).toMatch(TXID);
    await expect(reader.at(old, await blockHash(provider, old))).rejects.toThrow(SCRIPT_FAILURE);
  }, 300_000);

  it('refuses an unwritten block, a coin of another category, an info coin given as a slot and a stopped slot',
    async () => {
      const { provider, signer } = await chain();
      const foreign = provider.oraclePoolCategory!;
      const block = (await newestSlot(provider, foreign)) - 2n;
      // A pool whose two slots both hold `block`, and one info coin.
      await provider.addUtxo(binToHex(p2pkhLockOf(TEST_ORACLE_POOL_KEY)), randomUtxo({ vout: 0, satoshis: 10_000_000n }));
      const { category: pool } = await createOraclePool(provider, {
        ownerKey: TEST_ORACLE_POOL_KEY, funder: TEST_ORACLE_POOL_KEY, infoCoins: 1, ringDepth: 1, slotReplicas: 2,
        tip: fieldsAt(block),
      });
      const sc = await getContractFactory(compileString(HASHES), signer).deploy({
        initialState: { reads: 0n }, oraclePool: pool,
      });
      const reader = sc as unknown as Hashes;
      const hash = await blockHash(provider, block);
      const vm = createVirtualMachineBch2026ForProvider(provider);

      // Control: the reader's own input accepts the slot of the bound pool that holds the block.
      const builder = await reader.at(block, hash).build();
      const { categoryId } = sc as unknown as StatefulContract;
      const readerIndex = builder.inputs.findIndex((input) => input.token?.category === categoryId
        && input.token.nft?.capability === 'minting');
      const slotIndex = builder.inputs.findIndex((input) => isPoolSlotInput(input, pool));
      expect(readerIndex).toBeGreaterThanOrEqual(0);
      expect(slotIndex).toBeGreaterThan(readerIndex);
      const honest = spendOf(builder);
      const read = (spend: Spend): true | string => {
        const state = vm.evaluate({
          inputIndex: readerIndex, transaction: spend.transaction, sourceOutputs: spend.sourceOutputs,
        });
        const result = vm.stateSuccess(state);
        return result === true ? true : `${result}`;
      };
      expect(read(honest), 'the slot of the bound pool').toBe(true);
      const refused = (coin: UnlockableUtxo, label: string): void => {
        const outcome = read(swapped(honest, slotIndex, coin));
        expect(outcome, label).not.toBe(true);
        expect(outcome, label).toMatch(SCRIPT_FAILURE);
      };

      // A live slot of another pool that holds the block.
      const other = (await selectPoolSlot(provider, foreign, block))!;
      expect(other.exact).toBe(true);
      refused(poolSlotUnlockable(other.utxo, foreign), 'a slot of another pool');
      // A live info coin of the bound pool.
      refused(poolInfoUnlockable((await selectPoolInfoCoin(provider, pool))!.utxo, pool), 'an info coin');
      // A stopped replica of the block's slot.
      const keeper = new PoolKeeper({ provider, category: pool, ownerKey: TEST_ORACLE_POOL_KEY });
      const [replica] = await keeper.slots();
      await keeper.stop([replica!.utxo]);
      const stopped = (await keeper.slots()).find(({ fields }) => fields.flags !== POOL_FLAG_SLOT)!;
      expect(stopped.fields).toMatchObject({ flags: POOL_FLAG_SLOT | POOL_FLAG_SLOT_STOPPED, n: block });
      refused(poolSlotUnlockable(stopped.utxo, pool), 'a stopped slot');
      // The live replica moves on to the next block, so the pool no longer holds `block`: its slot holds a block less
      // than 256 newer, and the SDK finds none to spend.
      await keeper.writeSlots([{ n: block + 1n, hash: await blockHash(provider, block + 1n) }]);
      const moved = (await keeper.slots()).find(({ fields }) => fields.flags === POOL_FLAG_SLOT)!;
      expect(moved.fields.n).toBe(block + 1n);
      refused(poolSlotUnlockable(moved.utxo, pool), 'an unwritten block');
      expect(await selectPoolSlot(provider, pool, block)).toBeUndefined();
      await expect(reader.at(block, hash)).rejects.toThrow(/no live slot that answers block/);
    }, 300_000);

  it('a creator\'s child reads blockhash through its creator\'s pool', async () => {
    const { provider, signer } = await chain();
    const foreign = provider.oraclePoolCategory!;
    // The provider's pool reads this block as zero; only the creator's pool holds it.
    const old = (await newestSlot(provider, foreign)) - 1_000n;
    expect((await selectPoolSlot(provider, foreign, old))?.exact).toBe(false);
    const pool = await mintTestOraclePool(provider, fieldsAt(old), { slots: true });
    const { Hasher, HasherMaker } = compileStringMulti(CREATOR, { allowUnsafeOperations: true });
    expect(HasherMaker.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const make = HasherMaker.abi.find((fn) => fn.name === 'make')!;
    expect(make.deployTargets?.[0]?.constructorArgs).toEqual([ORACLE_POOL_PARAMETER]);

    const maker = await getContractFactory(HasherMaker, signer).deploy({ initialState: { made: 0n }, oraclePool: pool });
    expect((maker as unknown as StatefulContract).inner.oraclePool).toBe(pool);
    const fundingUtxo = await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 200_000n }));
    const { child } = await StatefulContract.deployFrom({
      provider,
      factory: maker,
      deployFunctionName: 'make',
      deployFunctionArgs: [BigInt(1 + (make.requiredNftIndices?.length ?? HasherMaker.stateLayout!.dataNftCount))],
      childArtifact: Hasher,
      childInitialState: { reads: 0n },
      fundingUtxo,
      funder: signer.unlockP2PKH(),
      changeAddress: signer.getAddress(),
    });
    expect(child.inner.oraclePool).toBe(pool);
    expect(binToHex(child.inner.constructorArgs[0] as Uint8Array)).toBe(binToHex(oraclePoolBinding(hexToBin(pool))));

    const reads = child.connect(signer) as unknown as { check(n: bigint, expected: Uint8Array): Call };
    expect((await reads.check(old, await blockHash(provider, old))).txid).toMatch(TXID);
    await expect(reads.check(old, ZERO)).rejects.toThrow(SCRIPT_FAILURE);
  }, 300_000);
});
