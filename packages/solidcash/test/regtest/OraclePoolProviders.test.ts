import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransaction, hexToBin, secp256k1,
} from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';
import { ElectrumWebSocket } from '@electrum-cash/web-socket';
import {
  ORACLE_POOL_PARAMETER, POOL_FLAG_SLOT, POOL_MAX_DEPTH,
  type PoolBatonFields, type PoolInfoFields, type PoolSlotFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, Signer, TransactionBuilder } from '../../src/index.js';
import { type StatefulContract, getContractFactory } from '../../src/stateful/index.js';
import RegtestNetworkProvider from '../../src/network/RegtestNetworkProvider.js';
import ElectrumNetworkProvider from '../../src/network/ElectrumNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { Network, type Utxo } from '../../src/interfaces.js';
import {
  type PoolCoin, poolBatonCoin, poolInfoCoin, poolSlotCoin, selectPoolInfoCoin, selectPoolSlot,
} from '../../src/oracle/pool/index.js';
import { poolLocks, poolOwnerOf } from '../../src/oracle/pool/coins.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

/**
 * The oracle pool code of the live providers, on the BCHN regtest stack. RegtestNetworkProvider mints its pool at
 * startup and refreshes it on every block it mines; ElectrumNetworkProvider, pointed at the stack's Fulcrum with
 * that pool's category, lists the pool coins at their locks and reads one in a transaction it broadcasts. The tests
 * share one chain and run in order.
 */

const describeRegtest = process.env.TESTS_USE_REGTEST === 'true' ? describe : describe.skip;

const CLOCK = `
contract PoolClock() {
    int reads;
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
    }
}`;

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

const READER = `
contract PoolReader() {
    function check(int eTimestamp, int eNumber) {
        require(block.timestamp == eTimestamp);
        require(block.number == eNumber);
    }
}`;

const TXID = /^[0-9a-f]{64}$/;
const LONG = 600_000;

const provider = new RegtestNetworkProvider({
  rpcUrl: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
  rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
  rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
});
const ELECTRUM_HOST = process.env.REGTEST_ELECTRUM_HOST ?? '127.0.0.1';
const ELECTRUM_PORT = Number(process.env.REGTEST_ELECTRUM_PORT ?? '50003');

type Sent = PromiseLike<{ txid: string }>;
interface Clock { check(timestamp: bigint, number: bigint): Sent }
interface Hashes { last(expected: Uint8Array): Sent }

const outpoint = ({ txid, vout }: Pick<Utxo, 'txid' | 'vout'>): string => `${txid}:${vout}`;
const defined = <T>(value: T | undefined): value is T => value !== undefined;

interface PoolView {
  readonly info: PoolCoin<PoolInfoFields>[];
  readonly slots: PoolCoin<PoolSlotFields>[];
  readonly batons: PoolCoin<PoolBatonFields>[];
}

/** The pool's live coins as the regtest provider lists them. */
async function poolView(category: string): Promise<PoolView> {
  const coins = await provider.getUtxosByTokenCategory(category);
  return {
    info: coins.map((utxo) => poolInfoCoin(utxo, category)).filter(defined),
    slots: coins.map((utxo) => poolSlotCoin(utxo, category)).filter(defined),
    batons: coins.map((utxo) => poolBatonCoin(utxo, category)).filter(defined),
  };
}

/** Both info coins publish the tip's height and the second before its median time past; returns their fields. */
async function infoAtTip(category: string): Promise<PoolInfoFields> {
  expect(provider.oraclePoolRefreshError).toBeUndefined();
  const { info } = await poolView(category);
  const tip = [0, BigInt(await provider.getBlockHeight()), BigInt(provider.getBlockTime() - 1)];
  expect(info).toHaveLength(2);
  for (const { fields } of info) expect([fields.flags, fields.number, fields.timestamp]).toEqual(tip);
  return info[0]!.fields;
}

/** A live slot, as `on` lists the pool, holds exactly block n with the node's hash of it. */
async function expectSlotAt(category: string, n: number, on: NetworkProvider = provider): Promise<void> {
  const slot = await selectPoolSlot(on, category, BigInt(n));
  expect(slot?.exact).toBe(true);
  expect(binToHex(slot!.fields.hash)).toBe(await provider.getBlockHash(n));
}

/** The sorted heights the live slots hold. */
const heldBlocks = (slots: readonly PoolCoin<PoolSlotFields>[]): number[] => slots
  .map(({ fields }) => Number(fields.n)).sort((left, right) => left - right);

const run = (from: number, length: number): number[] => Array.from({ length }, (_value, index) => from + index);

/**
 * A deployer of a fresh key. The regtest provider seeds no CREATE nonce from the chain, so a second Signer of a used
 * key starts at nonce 0 again and its deployment meets the earlier one's identity anchor.
 */
async function fundedSigner(coins: number): Promise<Signer> {
  let key = new Uint8Array(randomBytes(32));
  while (!secp256k1.validatePrivateKey(key)) key = new Uint8Array(randomBytes(32));
  const signer = new Signer(key, provider);
  for (let coin = 0; coin < coins; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return signer;
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

async function waitFor<T>(what: string, probe: () => Promise<T | undefined>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await pause(500);
  }
}

describeRegtest('oracle pools of the live providers on BCHN regtest', () => {
  it('RegtestNetworkProvider mints its pool at startup: info coins, a slot per recent block, and the baton', async () => {
    const height = await provider.getBlockHeight();
    const category = provider.oraclePoolCategory!;
    expect(category).toMatch(TXID);
    // The category is the funding transaction's txid.
    await expect(provider.getRawTransaction(category)).resolves.toMatch(/^[0-9a-f]+$/);
    const owner = binToHex(poolOwnerOf(provider.oraclePoolOwnerKey));
    const { info, slots, batons } = await poolView(category);

    // The genesis publishes the tip below its own block, and a ring of the blocks up to it, 256 at most.
    const tip = height - 1;
    expect(info).toHaveLength(2);
    for (const { fields } of info) expect([fields.flags, fields.number]).toEqual([0, BigInt(tip)]);
    const ring = Math.min(POOL_MAX_DEPTH, tip + 1);
    expect(heldBlocks(slots)).toEqual(run(tip + 1 - ring, ring));
    for (const { fields } of slots) expect([fields.flags, fields.depth]).toEqual([POOL_FLAG_SLOT, POOL_MAX_DEPTH]);
    expect(batons).toHaveLength(1);
    expect(batons[0]!.fields.depth).toBe(POOL_MAX_DEPTH);
    for (const { fields } of [...info, ...slots, ...batons]) expect(binToHex(fields.owner)).toBe(owner);
    await expectSlotAt(category, tip);
    await expectSlotAt(category, tip - 1);
  }, LONG);

  it('RegtestNetworkProvider refreshes the info coins to the tip and puts every new block in the ring', async () => {
    const category = provider.oraclePoolCategory!;
    await provider.mine(2);
    const { number } = await infoAtTip(category);
    // On a chain younger than the ring, these residues have no slot until the baton mints it.
    for (let n = Number(number) - 2; n <= Number(number); n += 1) await expectSlotAt(category, n);

    // Past the ring's depth, the newest block moves the slot of its residue forward.
    await provider.mine(Math.max(1, POOL_MAX_DEPTH - Number(number)));
    const height = Number((await infoAtTip(category)).number);
    expect(height).toBeGreaterThanOrEqual(POOL_MAX_DEPTH);
    expect(heldBlocks((await poolView(category)).slots)).toEqual(run(height - POOL_MAX_DEPTH + 1, POOL_MAX_DEPTH));
    await expectSlotAt(category, height);
    await expectSlotAt(category, height - POOL_MAX_DEPTH + 1);
    expect((await selectPoolSlot(provider, category, BigInt(height - POOL_MAX_DEPTH)))?.exact).toBe(false);
  }, LONG);

  it('a stateful block.timestamp reader deploys, reads the pool, and reads the clock increaseTime moves', async () => {
    const category = provider.oraclePoolCategory!;
    const signer = await fundedSigner(6);
    const artifact = compileString(CLOCK);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const sc = await getContractFactory(artifact, signer).deploy({ initialState: { reads: 0n } });
    expect((sc as unknown as StatefulContract).inner.oraclePool).toBe(category);
    const reader = sc as unknown as Clock;

    await provider.mine(1);
    const now = await infoAtTip(category);
    expect((await reader.check(now.timestamp, now.number)).txid).toMatch(TXID);

    const clock = provider.getBlockTime();
    const advanced = await provider.increaseTime(3600);
    expect(advanced).toBeGreaterThanOrEqual(clock + 3601);
    expect(provider.getBlockTime()).toBe(advanced);
    const later = await infoAtTip(category);
    expect(later.timestamp).toBe(BigInt(advanced - 1));
    expect((await reader.check(later.timestamp, later.number)).txid).toMatch(TXID);
    const current = await infoAtTip(category);
    await expect(reader.check(now.timestamp, current.number)).rejects.toThrow();
  }, LONG);

  it('a stateful blockhash(block.number - 1) reader deploys and reads the slot of the block below the tip', async () => {
    const category = provider.oraclePoolCategory!;
    const signer = await fundedSigner(6);
    const sc = await getContractFactory(compileString(HASHES), signer).deploy({ initialState: { reads: 0n } });
    expect((sc as unknown as StatefulContract).inner.oraclePool).toBe(category);
    const reader = sc as unknown as Hashes;

    await provider.mine(1);
    const { number } = await infoAtTip(category);
    await expectSlotAt(category, Number(number) - 1);
    const previous = hexToBin(await provider.getBlockHash(Number(number) - 1));
    expect((await reader.last(previous)).txid).toMatch(TXID);
    expect((await (sc as unknown as StatefulContract).getState()).reads).toBe(1n);
    await expect(reader.last(new Uint8Array(32))).rejects.toThrow();
  }, LONG);

  it('ElectrumNetworkProvider lists the pool through Fulcrum, selects a live info coin, and reads it', async () => {
    const category = provider.oraclePoolCategory!;
    const socket = new ElectrumWebSocket(ELECTRUM_HOST, { port: ELECTRUM_PORT, encrypted: false });
    const electrum = new ElectrumNetworkProvider(Network.REGTEST, {
      electrum: new ElectrumClient('solidcash-regtest', '1.5.0', socket),
      oraclePoolCategory: category.toUpperCase(),
    });
    expect(electrum.oraclePoolCategory).toBe(category);

    const reader = new Contract(compileString(READER), [], { provider: electrum });
    expect(reader.oraclePool).toBe(category);
    const readerCoin = await provider.addUtxo(reader.address, randomUtxo({ satoshis: 100_000n }));
    const feeCoin = await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 20_000n }));

    // Funding mines without a pool refresh, so the pool holds still while Fulcrum catches up with the node.
    const locks = poolLocks(category);
    const live = await poolView(category);
    const want = [live.info, live.slots, live.batons].map((coins) => coins.map(({ utxo }) => outpoint(utxo)).sort());
    expect(want.map((coins) => coins.length)).toEqual([2, POOL_MAX_DEPTH, 1]);
    const listed = await waitFor('Fulcrum to list the pool coins the node holds', async () => {
      if (await electrum.getBlockHeight() !== await provider.getBlockHeight()) return undefined;
      const coins = await Promise.all([locks.info, locks.slot, locks.baton]
        .map((lock) => electrum.getUtxosForLockingBytecode(lock)));
      const got = coins.map((at) => at.map(outpoint).sort());
      return JSON.stringify(got) === JSON.stringify(want) ? coins : undefined;
    });
    const [infoListed, slotListed, batonListed] = listed;
    expect(infoListed!.map((utxo) => poolInfoCoin({ ...utxo, lockingBytecode: locks.info }, category)?.fields.number))
      .toEqual(live.info.map(({ fields }) => fields.number));
    expect(slotListed!.every((utxo) => poolSlotCoin({ ...utxo, lockingBytecode: locks.slot }, category) !== undefined))
      .toBe(true);
    expect(poolBatonCoin({ ...batonListed![0]!, lockingBytecode: locks.baton }, category)?.fields.depth)
      .toBe(POOL_MAX_DEPTH);

    const selected = await selectPoolInfoCoin(electrum, category);
    expect(selected).toBeDefined();
    expect(selected!.fields.flags).toBe(0);
    expect(want[0]).toContain(outpoint(selected!.utxo));
    await expectSlotAt(category, Number(selected!.fields.number) - 1, electrum);

    const { timestamp, number } = selected!.fields;
    const { txid } = await new TransactionBuilder({ provider: electrum })
      .addInput(readerCoin, reader.unlock.check(timestamp, number))
      .addOutput({ to: reader.address, amount: readerCoin.satoshis })
      .addInput(feeCoin, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: aliceAddress, amount: feeCoin.satoshis - 5_000n })
      .send();
    expect(txid).toMatch(TXID);

    // The read co-spent an info coin Fulcrum listed and recreated it at its own index.
    const sent = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
    if (typeof sent === 'string') throw new Error(sent);
    const index = sent.inputs.findIndex((input) => want[0]!.includes(
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`,
    ));
    expect(index).toBeGreaterThan(-1);
    const recreated = sent.outputs[index]!;
    expect(binToHex(recreated.lockingBytecode)).toBe(binToHex(locks.info));
    expect(binToHex(recreated.token!.category)).toBe(category);
    expect(binToHex(recreated.token!.nft!.commitment)).toBe(selected!.utxo.token!.nft!.commitment);

    // The regtest provider keeps both info coins current, the one recreated by another wallet's transaction included.
    await provider.mine(1);
    await infoAtTip(category);
  }, LONG);
});
