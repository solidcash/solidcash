import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, hexToBin, secp256k1 } from '@bitauth/libauth';
import {
  POOL_COIN_SATS, POOL_FLAG_SLOT, decodePoolBatonCommitment, decodePoolInfoCommitment, decodePoolSlotCommitment,
  hash160, poolBatonLockingBytecode, poolInfoLockingBytecode, poolSlotLockingBytecode,
} from '@solidcash/utils';
import { MOCK_DEFAULT_BLOCK_TIME, MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  PoolKeeper, createOraclePool, selectPoolInfoCoin, selectPoolSlot, simulatorPoolFields, type OraclePool,
} from '../../src/oracle/pool/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { publicKeyToP2PKHLockingBytecode, randomUtxo } from '../../src/utils.js';

// A pool of the test's own beside the mock's: 3 info coins, a depth-4 ring with 2 slots per block, and the baton,
// minted at the mock's tip 133,700. Every transaction is an ordinary one the mock's verifier runs in full.
const TIP = 133_700;
const DEPTH = 4;
const TXID = /^[0-9a-f]{64}$/;

const publicKey = (key: Uint8Array): Uint8Array => secp256k1.derivePublicKeyCompressed(key) as Uint8Array;
const ownerKey = Uint8Array.from({ length: 32 }, (_v, i) => i + 1);
const newOwnerKey = Uint8Array.from({ length: 32 }, (_v, i) => 64 - i);
const owner = hash160(publicKey(ownerKey));
const newOwner = hash160(publicKey(newOwnerKey));

interface Pool { provider: MockNetworkProvider; category: string; keeper: PoolKeeper; pool: OraclePool }

async function setup(): Promise<Pool> {
  const provider = new MockNetworkProvider();
  await provider.addUtxo(binToHex(publicKeyToP2PKHLockingBytecode(publicKey(ownerKey))), randomUtxo({
    satoshis: 10_000_000n,
  }));
  const pool = await createOraclePool(provider, {
    ownerKey, infoCoins: 3, ringDepth: DEPTH, slotReplicas: 2, funder: ownerKey,
  });
  const keeper = new PoolKeeper({ provider, category: pool.category, ownerKey });
  return { provider, category: pool.category, keeper, pool };
}

async function blockHash(provider: MockNetworkProvider, n: number): Promise<Uint8Array> {
  return hexToBin(await provider.getBlockHash(n));
}

async function locktimeOf(provider: MockNetworkProvider, txid: string): Promise<number> {
  const decoded = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.locktime;
}

const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
const heights = (slots: { fields: { n: bigint } }[]): number[] => slots.map(({ fields }) => Number(fields.n))
  .sort((left, right) => left - right);

describe('oracle pool core', () => {
  it('mints the info coins, the ring and the baton by two ordinary transactions', async () => {
    const { provider, category, pool } = await setup();
    expect(category).toBe(pool.fundingTxid);
    const genesis = decodeTransaction(hexToBin(await provider.getRawTransaction(pool.genesisTxid)));
    if (typeof genesis === 'string') throw new Error(genesis);
    expect(genesis.inputs.map((input) => outpoint({
      txid: binToHex(input.outpointTransactionHash), vout: input.outpointIndex, satoshis: 0n,
    }))).toEqual([`${pool.fundingTxid}:0`]);

    const coins = await provider.getUtxosByTokenCategory(category);
    const at = (lock: Uint8Array): Utxo[] => coins.filter((utxo) => binToHex(utxo.lockingBytecode!) === binToHex(lock));
    const info = at(poolInfoLockingBytecode(hexToBin(category)));
    const slots = at(poolSlotLockingBytecode(hexToBin(category)));
    const batons = at(poolBatonLockingBytecode(hexToBin(category)));
    expect([coins.length, info.length, slots.length, batons.length]).toEqual([12, 3, 8, 1]);
    expect(coins.every((utxo) => utxo.satoshis === POOL_COIN_SATS)).toBe(true);

    const tip = simulatorPoolFields(TIP, MOCK_DEFAULT_BLOCK_TIME);
    for (const utxo of info) {
      expect(utxo.token?.nft?.capability).toBe('mutable');
      expect(decodePoolInfoCommitment(hexToBin(utxo.token!.nft!.commitment))).toEqual({ ...tip, flags: 0, owner });
    }
    const held = slots.map((utxo) => decodePoolSlotCommitment(hexToBin(utxo.token!.nft!.commitment)));
    expect(heights(held.map((fields) => ({ fields })))).toEqual([133_697, 133_697, 133_698, 133_698, 133_699, 133_699,
      133_700, 133_700]);
    for (const slot of held) {
      expect(slot).toEqual({
        flags: POOL_FLAG_SLOT, n: slot.n, hash: await blockHash(provider, Number(slot.n)), owner, depth: DEPTH,
      });
    }
    expect(batons[0]!.token?.nft?.capability).toBe('minting');
    expect(decodePoolBatonCommitment(hexToBin(batons[0]!.token!.nft!.commitment))).toEqual({ owner, depth: DEPTH });
  });

  it('refreshes every info coin by one height-locked, then one time-locked transaction, and leaves them equal', async () => {
    const { provider, keeper } = await setup();
    // A send mines at the tip's own time here, so the clock moves only when told to.
    await provider.send('evm_increaseTime', [60]);
    await provider.mine(5);
    const fields = {
      number: BigInt(TIP + 5), timestamp: BigInt(provider.getBlockTime() - 1), difficulty: 7n, size: 2_000n,
      totalFees: 300n, coinbase: hexToBin('51'),
    };
    const txids = await keeper.refreshInfo(fields);
    expect(await Promise.all(txids.map((txid) => locktimeOf(provider, txid)))).toEqual([
      TIP + 5, Number(fields.timestamp),
    ]);
    const coins = await keeper.infoCoins();
    expect(coins).toHaveLength(3);
    for (const coin of coins) expect(coin.fields).toEqual({ ...fields, flags: 0, owner });
    expect(new Set(coins.map(({ utxo }) => utxo.token!.nft!.commitment)).size).toBe(1);
    expect(await keeper.refreshInfo(fields)).toEqual([]);
  });

  it('moves the slots of the newest block residue forward', async () => {
    const { provider, keeper } = await setup();
    await provider.mine();
    const hash = await blockHash(provider, TIP + 1);
    expect(await keeper.writeNewestSlot(BigInt(TIP + 1), hash)).toMatch(TXID);
    const slots = await keeper.slots();
    expect(heights(slots)).toEqual([133_698, 133_698, 133_699, 133_699, 133_700, 133_700, 133_701, 133_701]);
    expect(slots.filter(({ fields }) => fields.n === BigInt(TIP + 1)).map(({ fields }) => fields)).toEqual(Array(2).fill({
      flags: POOL_FLAG_SLOT, n: BigInt(TIP + 1), hash, owner, depth: DEPTH,
    }));
    expect(await keeper.writeNewestSlot(BigInt(TIP + 1), hash)).toBeUndefined();
  });

  it('grows both kinds through the baton', async () => {
    const { provider, keeper } = await setup();
    const [template] = await keeper.infoCoins();
    expect(await keeper.growInfo(2)).toMatch(TXID);
    const info = await keeper.infoCoins();
    expect(info).toHaveLength(5);
    expect(new Set(info.map(({ utxo }) => utxo.token!.nft!.commitment))).toEqual(new Set([
      template!.utxo.token!.nft!.commitment,
    ]));

    const hash = await blockHash(provider, TIP);
    expect(await keeper.growSlots([{ n: BigInt(TIP), hash }])).toMatch(TXID);
    const held = (await keeper.slots()).filter(({ fields }) => fields.n === BigInt(TIP));
    expect(held.map(({ fields }) => fields)).toEqual(Array(3).fill({
      flags: POOL_FLAG_SLOT, n: BigInt(TIP), hash, owner, depth: DEPTH,
    }));
    expect((await keeper.baton())?.fields).toEqual({ owner, depth: DEPTH });
  });

  it('stops coins out of selection, then sweeps them away', async () => {
    const { provider, category, keeper } = await setup();
    const [kept, ...stopping] = await keeper.infoCoins();
    const tipSlots = (await keeper.slots()).filter(({ fields }) => fields.n === BigInt(TIP));
    await keeper.stop([...stopping, ...tipSlots].map(({ utxo }) => utxo));

    expect((await keeper.infoCoins()).map(({ fields }) => fields.flags).sort()).toEqual([0, 3, 3]);
    for (let draw = 0; draw < 8; draw += 1) {
      expect(outpoint((await selectPoolInfoCoin(provider, category))!.utxo)).toBe(outpoint(kept!.utxo));
    }
    expect(await selectPoolSlot(provider, category, BigInt(TIP))).toBeUndefined();
    expect((await selectPoolSlot(provider, category, BigInt(TIP - 1)))?.exact).toBe(true);

    const stopped = [...await keeper.infoCoins(), ...await keeper.slots()]
      .filter(({ fields }) => (fields.flags & 0x7f) !== 0);
    expect(stopped).toHaveLength(4);
    expect(await keeper.sweep(stopped.map(({ utxo }) => utxo))).toHaveLength(1);
    const left = await provider.getUtxosByTokenCategory(category);
    expect(left).toHaveLength(8);
    const swept = new Set(stopped.map(({ utxo }) => outpoint(utxo)));
    expect(left.some((utxo) => swept.has(outpoint(utxo)))).toBe(false);
  });

  it('rotates every coin and the baton to a new owner, then keeps the pool with the new key', async () => {
    const { provider, keeper } = await setup();
    expect(await keeper.rotate(newOwnerKey)).toHaveLength(1);
    const owners = [...await keeper.infoCoins(), ...await keeper.slots()].map(({ fields }) => binToHex(fields.owner));
    expect(owners).toEqual(Array(11).fill(binToHex(newOwner)));
    expect((await keeper.baton())?.fields).toEqual({ owner: newOwner, depth: DEPTH });
    expect(keeper.ownerKey).toEqual(newOwnerKey);

    await provider.mine();
    expect(await keeper.writeNewestSlot(BigInt(TIP + 1), await blockHash(provider, TIP + 1))).toMatch(TXID);
  });

  it('selects a live info coin, the slot holding n, and the zero case of its residue 256 newer', async () => {
    const { provider, category, keeper } = await setup();
    const info = await selectPoolInfoCoin(provider, category);
    expect(info?.fields.flags).toBe(0);
    expect((await keeper.infoCoins()).map(({ utxo }) => outpoint(utxo))).toContain(outpoint(info!.utxo));

    const exact = await selectPoolSlot(provider, category, BigInt(TIP - 1));
    expect([exact?.exact, exact?.fields.n]).toEqual([true, BigInt(TIP - 1)]);
    expect(exact?.fields.hash).toEqual(await blockHash(provider, TIP - 1));

    await provider.mine();
    await keeper.writeNewestSlot(BigInt(TIP + 1), await blockHash(provider, TIP + 1));
    const zero = await selectPoolSlot(provider, category, BigInt(TIP + 1 - 256));
    expect([zero?.exact, zero?.fields.n]).toEqual([false, BigInt(TIP + 1)]);
    expect(await selectPoolSlot(provider, category, BigInt(TIP + 2 - 256))).toBeUndefined();
    expect(await selectPoolSlot(provider, category, BigInt(TIP - 3))).toBeUndefined();
  });

  it('refreshes the mock pool when the mock mines and when its time moves', async () => {
    const provider = new MockNetworkProvider();
    const category = provider.oraclePoolCategory!;
    expect(category).toMatch(TXID);
    const keeper = new PoolKeeper({ provider, category, ownerKey: provider.oraclePoolOwnerKey });
    expect((await keeper.infoCoins()).map(({ fields }) => fields.number)).toEqual([BigInt(TIP), BigInt(TIP)]);
    expect(await keeper.slots()).toHaveLength(256);

    await provider.mine();
    expect(provider.oraclePoolRefreshError).toBeUndefined();
    expect((await keeper.infoCoins()).map(({ fields }) => fields.number)).toEqual([BigInt(TIP + 1), BigInt(TIP + 1)]);
    const slot = await selectPoolSlot(provider, category, BigInt(TIP + 1));
    expect(slot?.exact).toBe(true);
    expect(slot?.fields.hash).toEqual(await blockHash(provider, TIP + 1));
    expect((await selectPoolSlot(provider, category, BigInt(TIP + 1 - 256)))?.exact).toBe(false);

    await provider.send('evm_increaseTime', [600]);
    expect(provider.oraclePoolRefreshError).toBeUndefined();
    expect((await keeper.infoCoins()).map(({ fields }) => fields.timestamp)).toEqual(
      Array(2).fill(BigInt(provider.getBlockTime() - 1)),
    );
  });
});
