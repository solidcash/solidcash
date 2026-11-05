import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  POOL_FLAG_SLOT, encodePoolInfoCommitment, encodePoolSlotCommitment, hash256, poolInfoRedeemScript,
  poolInfoUpdateUnlocking, poolSlotRedeemScript, poolSlotWriteUnlocking,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { PoolKeeper, type PoolBlockFields, type PoolCoin } from '../../src/oracle/pool/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createSighashPreimage, randomUtxo } from '../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createFeeFunder, createTestProvider, expectScriptRejection, mintTestOraclePool,
  TEST_ORACLE_POOL_KEY,
} from '../test-util.js';
import { bobAddress } from '../fixture/vars.js';

/**
 * Audit CRYPTO-5 (docs/security/2026-10/CRYPTO.md), on oracle pools: the pool owner must not rewind block.number,
 * block.timestamp or a ring slot to replay an old window. A block-info coin requires each new value to be at least the
 * one in its commitment, a height update moving the number and a time-type update the timestamp, and a slot write
 * requires a block newer than the one the slot holds.
 */

const OWNED_ORACLE = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

// Below the mock's median time past (its tip time), so a time-type locktime up to T0 + 600 is final.
const T0 = 1_699_990_000n;
const TXID = /^[0-9a-f]{64}$/;
const H = hexToBin('ab'.repeat(32));

interface Owned { provider: MockNetworkProvider; category: string; keeper: PoolKeeper; contract: Contract; n0: bigint }

const fieldsAt = (number: bigint): PoolBlockFields => ({
  number, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
});

// The pool starts one below the tip, so a rewound height is still final and passes tx.time >= number. It holds one
// info coin and one depth-1 slot of block tip - 1, owned by TEST_ORACLE_POOL_KEY; the reader binds it.
async function deployOwned(): Promise<Owned> {
  const provider = createTestProvider() as MockNetworkProvider;
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  const category = await mintTestOraclePool(provider, fieldsAt(n0), { slots: true });
  const contract = new Contract(compileString(OWNED_ORACLE), [], { provider, oraclePool: category });
  const keeper = new PoolKeeper({ provider, category, ownerKey: TEST_ORACLE_POOL_KEY });
  return { provider, category, keeper, contract, n0 };
}

async function only<F>(coins: Promise<PoolCoin<F>[]>): Promise<PoolCoin<F>> {
  const [coin] = await coins;
  if (coin === undefined) throw new Error('no live pool coin');
  return coin;
}

// Broadcast the owner's spend of `coin` that recreates it with `commitment`; a funder pays the fee.
async function ownerSpend(
  o: Owned, coin: Utxo, redeem: Uint8Array, commitment: Uint8Array, locktime: number,
  unlocking: (pubkey: Uint8Array, signature: Uint8Array) => Uint8Array,
): Promise<string> {
  const template = new SignatureTemplate(TEST_ORACLE_POOL_KEY);
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

async function update(o: Owned, number: bigint, timestamp: bigint, locktime: bigint): Promise<string> {
  const coin = await only(o.keeper.infoCoins());
  const commitment = encodePoolInfoCommitment({ ...coin.fields, number, timestamp });
  const category = hexToBin(o.category);
  return ownerSpend(o, coin.utxo, poolInfoRedeemScript(category), commitment, Number(locktime),
    (pubkey, signature) => poolInfoUpdateUnlocking(category, pubkey, signature, commitment, Number(locktime)));
}

async function writeSlot(o: Owned, n: bigint, locktime: bigint): Promise<string> {
  const slot = await only(o.keeper.slots());
  const commitment = encodePoolSlotCommitment({ ...slot.fields, flags: POOL_FLAG_SLOT, n, hash: H });
  const category = hexToBin(o.category);
  return ownerSpend(o, slot.utxo, poolSlotRedeemScript(category), commitment, Number(locktime),
    (pubkey, signature) => poolSlotWriteUnlocking(category, pubkey, signature, n, H));
}

// Broadcast the owner's spend of `coin` that recreates it with `commitment`; a funder pays the fee.
async function ownerSpend(
  o: Owned, coin: Utxo, redeem: Uint8Array, commitment: Uint8Array, locktime: number,
  unlocking: (pubkey: Uint8Array, signature: Uint8Array) => Uint8Array,
): Promise<string> {
  const template = new SignatureTemplate(TEST_ORACLE_POOL_KEY);
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

async function update(o: Owned, number: bigint, timestamp: bigint, locktime: bigint): Promise<string> {
  const coin = await only(o.keeper.infoCoins());
  const commitment = encodePoolInfoCommitment({ ...coin.fields, number, timestamp });
  const category = hexToBin(o.category);
  return ownerSpend(o, coin.utxo, poolInfoRedeemScript(category), commitment, Number(locktime),
    (pubkey, signature) => poolInfoUpdateUnlocking(category, pubkey, signature, commitment, Number(locktime)));
}

async function writeSlot(o: Owned, n: bigint, locktime: bigint): Promise<string> {
  const slot = await only(o.keeper.slots());
  const commitment = encodePoolSlotCommitment({ ...slot.fields, flags: POOL_FLAG_SLOT, n, hash: H });
  const category = hexToBin(o.category);
  return ownerSpend(o, slot.utxo, poolSlotRedeemScript(category), commitment, Number(locktime),
    (pubkey, signature) => poolSlotWriteUnlocking(category, pubkey, signature, n, H));
}

/** A read of the pool through the reader, which is stateful as every block.* reader is: a call on its state. */
async function readBack(o: Owned, number: bigint, timestamp: bigint): Promise<string> {
  const { categoryId } = await setupStatefulUtxos(o.provider, o.contract, o.contract.artifact.stateLayout!, {});
  const reader = StatefulContract.withCategory(o.contract, categoryId);
  const tx = await (reader as any).readBack(number, timestamp).send();
  return tx.txid;
}

describe('CRYPTO-5: the pool owner cannot rewind number, timestamp or a slot', () => {
  it('refuses a rewound number and a rewound timestamp, leaving both', async () => {
    const o = await deployOwned();
    // A height update one block back, then a time-type update one second back. Each fails the >= check.
    expectScriptRejection(await update(o, o.n0 - 1n, T0, o.n0 - 1n), 0);
    expectScriptRejection(await update(o, o.n0, T0 - 1n, T0 - 1n), 0);
    expect(await readBack(o, o.n0, T0)).toMatch(TXID);
  });

  it('accepts an equal and then a higher number and timestamp', async () => {
    const o = await deployOwned();
    expect(await update(o, o.n0, T0, o.n0)).toBe('ACCEPTED');
    const tip = BigInt(await o.provider.getBlockHeight());
    expect(tip).toBeGreaterThan(o.n0);
    expect(await update(o, tip, T0, tip)).toBe('ACCEPTED');
    expect(await update(o, tip, T0 + 600n, T0 + 600n)).toBe('ACCEPTED');
    expect(await readBack(o, tip, T0 + 600n)).toMatch(TXID);
  });

  it('refuses a slot write of the block it holds or an older one, and admits a newer one', async () => {
    const o = await deployOwned();
    expectScriptRejection(await writeSlot(o, o.n0, o.n0), 0);
    expectScriptRejection(await writeSlot(o, o.n0 - 1n, o.n0), 0);
    expect(await writeSlot(o, o.n0 + 1n, o.n0 + 1n)).toBe('ACCEPTED');
    expect((await only(o.keeper.slots())).fields.n).toBe(o.n0 + 1n);
  });
});
