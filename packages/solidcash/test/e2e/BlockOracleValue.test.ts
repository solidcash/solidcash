import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  hash256, poolInfoRedeemScript, poolInfoUpdateUnlocking, type PoolInfoFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  PoolKeeper, poolInfoUnlockable, type PoolBlockFields, type PoolCoin,
} from '../../src/oracle/pool/index.js';
import type { Unlocker } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createSighashPreimage } from '../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, expectScriptRejection, mintTestOraclePool,
  setupStatefulUtxos, TEST_ORACLE_POOL_KEY,
} from '../test-util.js';
import { bobAddress } from '../fixture/vars.js';

/**
 * A pool's block-info covenant refuses any spend that recreates a coin with fewer satoshis, read or owner update,
 * so no reader can drain it. The keeper pays update fees from its own P2PKH.
 */

const READ_BACK = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

// Below the mock's median time past (its tip time), so a time-type locktime up to T0 + 600 is final.
const T0 = 1_699_990_000n;
const TXID = /^[0-9a-f]{64}$/;

const fields = (number: bigint, timestamp: bigint): PoolBlockFields => ({
  number, timestamp, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
});

interface Owned {
  provider: MockNetworkProvider; category: string; keeper: PoolKeeper; contract: Contract; n0: bigint;
}

// A pool of one info coin at (tip - 1, T0), and a reader bound to it. TEST_ORACLE_POOL_KEY owns it.
async function owned(): Promise<Owned> {
  const provider = createTestProvider() as MockNetworkProvider;
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  const category = await mintTestOraclePool(provider, fields(n0, T0));
  const contract = new Contract(compileString(READ_BACK), [], { provider, oraclePool: category });
  const keeper = new PoolKeeper({ provider, category, ownerKey: TEST_ORACLE_POOL_KEY });
  return { provider, category, keeper, contract, n0 };
}

async function liveCoin(o: Owned): Promise<PoolCoin<PoolInfoFields>> {
  const [coin] = await o.keeper.infoCoins();
  if (coin === undefined) throw new Error('no live info coin');
  return coin;
}

async function balance(provider: MockNetworkProvider, lock: Uint8Array): Promise<bigint> {
  return (await provider.getUtxosForLockingBytecode(lock)).reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

// Broadcast the built bytes, so the verdict is the mock node's.
function broadcast(provider: MockNetworkProvider, builder: TransactionBuilder): Promise<string> {
  const hex = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
  return provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
}

// Spend the info coin through `unlocker`, recreating it with `kept` satoshis; a funder pays the fee.
async function spendCoin(
  o: Owned, coin: PoolCoin<PoolInfoFields>, unlocker: Unlocker, kept: bigint, locktime = 0,
): Promise<string> {
  const funder = await createBareP2pkhFeeFunder(o.provider, 20_000n);
  const builder = new TransactionBuilder({ provider: o.provider })
    .addInput(coin.utxo, unlocker)
    .addOutput({ to: unlocker.generateLockingBytecode(), amount: kept, token: coin.utxo.token })
    .addInput(funder.utxo, funder.unlocker)
    .addOutput({ to: bobAddress, amount: 19_000n })
    .setLocktime(locktime);
  return broadcast(o.provider, builder);
}

// The owner's update path to `commitment`, signed by TEST_ORACLE_POOL_KEY.
function ownerUpdate(category: string, lock: Uint8Array, commitment: Uint8Array, locktime: number): Unlocker {
  const template = new SignatureTemplate(TEST_ORACLE_POOL_KEY);
  const redeem = poolInfoRedeemScript(hexToBin(category));
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }): Uint8Array => {
      const signature = template.generateSignature(hash256(createSighashPreimage(
        transaction, sourceOutputs, inputIndex, redeem, template.sighashType,
      )));
      return poolInfoUpdateUnlocking(
        hexToBin(category), template.publicKey, signature, commitment, locktime,
      );
    },
  };
}

describe('a pool info coin keeps its value', () => {
  it('refuses a read that lowers the coin value, and admits one that keeps it', async () => {
    const o = await owned();
    const coin = await liveCoin(o);
    const { unlocker } = poolInfoUnlockable(coin.utxo, o.category);
    expectScriptRejection(await spendCoin(o, coin, unlocker, coin.utxo.satoshis - 500n), 0);
    expect(await spendCoin(o, coin, unlocker, coin.utxo.satoshis)).toBe('ACCEPTED');
  });

  it('refuses an owner-signed update that lowers the coin value, and admits one that keeps it', async () => {
    const o = await owned();
    const coin = await liveCoin(o);
    // The same commitment under a height locktime at its number passes every update check but the value.
    const update = ownerUpdate(
      o.category, coin.utxo.lockingBytecode!, hexToBin(coin.utxo.token!.nft!.commitment), Number(o.n0),
    );
    expectScriptRejection(await spendCoin(o, coin, update, coin.utxo.satoshis - 500n, Number(o.n0)), 0);
    expect(await spendCoin(o, coin, update, coin.utxo.satoshis, Number(o.n0))).toBe('ACCEPTED');
  });

  it('an SDK read recreates the coin at its full value', async () => {
    const o = await owned();
    const value = (await liveCoin(o)).utxo.satoshis;
    // Every block.* reader is stateful, so the read is a call on its deployed state.
    const { categoryId } = await setupStatefulUtxos(o.provider, o.contract, o.contract.artifact.stateLayout!, {});
    const reader = StatefulContract.withCategory(o.contract, categoryId);
    const tx = await (reader as any).readBack(o.n0, T0).send();
    const after = await liveCoin(o);
    expect(after.utxo.txid).toBe(tx.txid);
    expect(after.utxo.satoshis).toBe(value);
  });

  it('keeper refreshes keep the coin value, and the owner P2PKH pays their fees', async () => {
    const o = await owned();
    const owner = new SignatureTemplate(TEST_ORACLE_POOL_KEY).unlockP2PKH().generateLockingBytecode();
    const value = (await liveCoin(o)).utxo.satoshis;
    const funds = await balance(o.provider, owner);
    const tip = BigInt(await o.provider.getBlockHeight());
    // A height update, then a time update, each paid by the owner's P2PKH.
    const txids = await o.keeper.refreshInfo(fields(tip, T0 + 600n));
    expect(txids).toEqual([expect.stringMatching(TXID), expect.stringMatching(TXID)]);
    const after = await liveCoin(o);
    expect([after.fields.number, after.fields.timestamp]).toEqual([tip, T0 + 600n]);
    expect(after.utxo.satoshis).toBe(value);
    expect(await balance(o.provider, owner)).toBeLessThan(funds);
  });
});

