import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  POOL_FLAG_SLOT, encodePoolInfoCommitment, encodePoolSlotCommitment, hash160, hash256, poolInfoRedeemScript,
  poolInfoRotateUnlocking, poolInfoUpdateUnlocking, poolSlotRedeemScript, poolSlotWriteUnlocking,
  type PoolInfoFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { PoolKeeper, type PoolBlockFields, type PoolCoin } from '../../src/oracle/pool/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createSighashPreimage } from '../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, expectScriptRejection, mintTestOraclePool, setupStatefulUtxos,
  TEST_ORACLE_POOL_KEY,
} from '../test-util.js';
import { bobAddress, bobPriv } from '../fixture/vars.js';

/**
 * Audit CRYPTO-4 / CRYPTO-5 (docs/security/2026-10/CRYPTO.md), on oracle pools.
 *
 * CRYPTO-4: a blockhash writer must not be able to act as anything but the oracle. A pool coin belongs to no
 * contract, so it is no minting NFT of a reader's category, and only the key its commitment names can write it.
 *
 * CRYPTO-5: the owner must not report block.number as a time-type value (>= 500,000,000), which a time-type
 * nLockTime would satisfy under OP_CHECKLOCKTIMEVERIFY. A pool's block-info coin moves the number only under a
 * height-type nLockTime, which CLTV bounds below 500,000,000.
 */

const CONSUMER = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';
const H = hexToBin('cd'.repeat(32));
// Below the mock's median time past, so a time-type nLockTime alone would not stop the update.
const T0 = 1_699_990_000n;

interface Pool { provider: MockNetworkProvider; category: string; keeper: PoolKeeper; n0: bigint }

const fieldsAt = (number: bigint): PoolBlockFields => ({
  number, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
});

// A pool of one info coin at (tip - 1, T0) and one depth-1 slot holding block tip - 1. TEST_ORACLE_POOL_KEY owns it.
async function pool(): Promise<Pool> {
  const provider = createTestProvider() as MockNetworkProvider;
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  const category = await mintTestOraclePool(provider, fieldsAt(n0), { slots: true });
  return { provider, category, keeper: new PoolKeeper({ provider, category, ownerKey: TEST_ORACLE_POOL_KEY }), n0 };
}

async function only<F>(coins: Promise<PoolCoin<F>[]>): Promise<PoolCoin<F>> {
  const [coin] = await coins;
  if (coin === undefined) throw new Error('no live pool coin');
  return coin;
}

/**
 * Broadcast an owner-path spend of `coin`, signed by `key`, that recreates it with `commitment`; a funder pays the
 * fee. The verdict is the mock node's.
 */
async function ownerSpend(
  o: Pool, coin: Utxo, redeem: Uint8Array, commitment: Uint8Array, locktime: number, key: Uint8Array,
  unlocking: (pubkey: Uint8Array, signature: Uint8Array) => Uint8Array,
): Promise<string> {
  const template = new SignatureTemplate(key);
  const unlocker: Unlocker = {
    generateLockingBytecode: (): Uint8Array => coin.lockingBytecode!,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }): Uint8Array => unlocking(
      template.publicKey, template.generateSignature(hash256(createSighashPreimage(
        transaction, sourceOutputs, inputIndex, redeem, template.sighashType,
      ))),
    ),
  };
  const funder = await createBareP2pkhFeeFunder(o.provider, 20_000n);
  const builder = new TransactionBuilder({ provider: o.provider })
    .addInput(coin, unlocker)
    .addOutput({
      to: coin.lockingBytecode!, amount: coin.satoshis,
      token: { ...coin.token!, nft: { capability: 'mutable', commitment: binToHex(commitment) } },
    })
    .addInput(funder.utxo, funder.unlocker)
    .addOutput({ to: bobAddress, amount: 19_000n })
    .setLocktime(locktime);
  const hex = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
  return o.provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
}

async function updateInfo(o: Pool, next: Partial<PoolInfoFields>, locktime: number, key = TEST_ORACLE_POOL_KEY):
Promise<string> {
  const coin = await only(o.keeper.infoCoins());
  const commitment = encodePoolInfoCommitment({ ...coin.fields, ...next });
  const category = hexToBin(o.category);
  return ownerSpend(o, coin.utxo, poolInfoRedeemScript(category), commitment, locktime, key,
    (pubkey, signature) => poolInfoUpdateUnlocking(category, pubkey, signature, commitment, locktime));
}

async function writeSlot(o: Pool, n: bigint, locktime: number, key: Uint8Array): Promise<string> {
  const slot = await only(o.keeper.slots());
  const commitment = encodePoolSlotCommitment({ ...slot.fields, flags: POOL_FLAG_SLOT, n, hash: H });
  const category = hexToBin(o.category);
  return ownerSpend(o, slot.utxo, poolSlotRedeemScript(category), commitment, locktime, key,
    (pubkey, signature) => poolSlotWriteUnlocking(category, pubkey, signature, n, H));
}

describe('CRYPTO-4: only the pool owner writes a pool coin', () => {
  it('the owner writes a slot, and a blockhash reader bound to the pool reads it', async () => {
    const o = await pool();
    const n = o.n0 + 1n;
    expect(await o.keeper.writeNewestSlot(n, H)).toMatch(/^[0-9a-f]{64}$/);
    const artifact = compileString(CONSUMER);
    const consumer = new Contract(artifact, [], { provider: o.provider, oraclePool: o.category });
    const { categoryId } = await setupStatefulUtxos(o.provider, consumer, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    // The pool coin is no minting NFT of the reader's category, so it can authorize none of its records.
    expect(categoryId).not.toBe(o.category);
    const tx = await (StatefulContract.withCategory(consumer, categoryId) as any).f(n, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a slot write, an info update and a rotation signed by another key', async () => {
    const o = await pool();
    const tip = Number(o.n0 + 1n);
    expectScriptRejection(await writeSlot(o, o.n0 + 1n, tip, bobPriv), 0);
    expectScriptRejection(await updateInfo(o, { number: o.n0 + 1n }, tip, bobPriv), 0);
    const coin = await only(o.keeper.infoCoins());
    const forger = hash160(new SignatureTemplate(bobPriv).publicKey);
    const category = hexToBin(o.category);
    expectScriptRejection(await ownerSpend(
      o, coin.utxo, poolInfoRedeemScript(category), encodePoolInfoCommitment({ ...coin.fields, owner: forger }), 0,
      bobPriv, (pubkey, signature) => poolInfoRotateUnlocking(category, pubkey, signature, forger),
    ), 0);
    // The owner's own write of the same slot is admitted.
    expect(await writeSlot(o, o.n0 + 1n, tip, TEST_ORACLE_POOL_KEY)).toBe('ACCEPTED');
  });

  it('refuses a slot write past its height locktime', async () => {
    const o = await pool();
    const tip = Number(o.n0 + 1n);
    expectScriptRejection(await writeSlot(o, o.n0 + 2n, tip, TEST_ORACLE_POOL_KEY), 0);
    expect((await only(o.keeper.slots())).fields.n).toBe(o.n0);
  });
});

describe('CRYPTO-5: block.number cannot be reported as a time-type value', () => {
  it('accepts an honest height update', async () => {
    const o = await pool();
    const tip = o.n0 + 1n;
    expect(await updateInfo(o, { number: tip }, Number(tip))).toBe('ACCEPTED');
    expect((await only(o.keeper.infoCoins())).fields.number).toBe(tip);
  });

  it('rejects a time-sized number under a time-type locktime, and a number past a height locktime', async () => {
    const o = await pool();
    // The audit's shape: nLockTime is a final time just past the stored timestamp, and the number is time-sized.
    expectScriptRejection(await updateInfo(o, { number: 500_000_001n }, Number(T0 + 100n)), 0);
    expectScriptRejection(await updateInfo(o, { number: o.n0 + 2n }, Number(o.n0 + 1n)), 0);
    expect((await only(o.keeper.infoCoins())).fields.number).toBe(o.n0);
  });
});
