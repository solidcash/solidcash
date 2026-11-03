import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  blockOracleLockingBytecode, blockOracleReadUnlocking, blockhashCommitmentNumber, blockhashOracleLockingBytecode,
  blockhashSlotReadUnlocking,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  BlockOracleUpdater, blockOracleUpdateUnlocker, type BlockOracleFields, type RpcLike,
} from '../../src/oracle/blockOracleUpdater.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, createTestProvider, expectScriptRejection } from '../test-util.js';
import { aliceAddress, alicePriv, bobAddress } from '../fixture/vars.js';

/**
 * The block-info oracle covenant refuses any spend that recreates a reader's own oracle with fewer satoshis, read
 * or owner update, so no reader can drain it until updates go out fee-less. The keeper pays update fees from its
 * own P2PKH. The blockhash slot covenant keeps a slot's value the same way, and the keeper's ring writes pay their
 * fees from that P2PKH too, so a sync past the ring's depth succeeds.
 */

const READ_BACK = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

const CONSUMER = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';

// Below the mock's median time past (its tip time), so a time-type locktime up to T0 + 600 is final.
const T0 = 1_699_990_000n;
const TXID = /^[0-9a-f]{64}$/;
const unusedRpc: RpcLike = { request: async (): Promise<never> => { throw new Error('unused'); } };

const fields = (number: bigint, timestamp: bigint): BlockOracleFields => ({
  number, timestamp, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
});

interface Owned {
  provider: MockNetworkProvider; reader: StatefulContract; category: string; lock: Uint8Array;
  updater: BlockOracleUpdater; n0: bigint;
}

// A reader whose own oracle holds (tip - 1, T0) and 10,000 satoshis. The mock's owner key keeps it.
async function owned(): Promise<Owned | undefined> {
  const provider = createTestProvider();
  if (!('setBlockOracleFields' in provider)) return undefined;
  const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
  const { contract: reader, categoryId: category } = await StatefulContract.deploy(compileString(READ_BACK), [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    blockOracleAmount: 10_000n,
  });
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  provider.setBlockOracleFields(fields(n0, T0), category);
  const updater = new BlockOracleUpdater({
    contract: reader.inner, categoryId: category, keeperKey: provider.blockOracleOwnerKey, rpc: unusedRpc,
  });
  return { provider, reader, category, lock: blockOracleLockingBytecode(hexToBin(category)), updater, n0 };
}

async function liveOracle(o: Owned): Promise<Utxo> {
  const utxos = await o.provider.getUtxosForLockingBytecode(o.lock);
  const oracle = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable');
  if (oracle === undefined) throw new Error('no live block oracle');
  return oracle;
}

async function balance(provider: MockNetworkProvider, lock: Uint8Array): Promise<bigint> {
  return (await provider.getUtxosForLockingBytecode(lock)).reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

// Broadcast the built bytes, so the verdict is the mock node's.
function broadcast(provider: MockNetworkProvider, builder: TransactionBuilder): Promise<string> {
  const hex = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
  return provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
}

// Spend the oracle through `unlocker`, recreating it with `kept` satoshis; bob takes 4,000 of a lowered value.
async function spendOracle(
  o: Owned, oracle: Utxo, unlocker: Unlocker, kept: bigint, locktime = 0,
): Promise<string> {
  const builder = new TransactionBuilder({ provider: o.provider })
    .addInput(oracle, unlocker)
    .addOutput({ to: o.lock, amount: kept, token: oracle.token })
    .setLocktime(locktime);
  if (kept < oracle.satoshis) {
    builder.addOutput({ to: bobAddress, amount: 4_000n });
  } else {
    const funder = await createBareP2pkhFeeFunder(o.provider, 20_000n);
    builder.addInput(funder.utxo, funder.unlocker).addOutput({ to: bobAddress, amount: 19_000n });
  }
  return broadcast(o.provider, builder);
}

describe('the block oracle keeps its value', () => {
  it('refuses a read that lowers the oracle value, and admits one that keeps it', async () => {
    const o = await owned();
    if (o === undefined) return;
    const oracle = await liveOracle(o);
    const read: Unlocker = {
      generateLockingBytecode: (): Uint8Array => o.lock,
      generateUnlockingBytecode: (): Uint8Array => blockOracleReadUnlocking(hexToBin(o.category)),
    };
    expectScriptRejection(await spendOracle(o, oracle, read, oracle.satoshis - 5_000n), 0);
    expect(await spendOracle(o, oracle, read, oracle.satoshis)).toBe('ACCEPTED');
  });

  it('refuses an owner-signed update that lowers the oracle value, and admits one that keeps it', async () => {
    const o = await owned();
    if (o === undefined) return;
    const oracle = await liveOracle(o);
    // The same commitment under a height locktime at its number passes every update check but the value.
    const update = blockOracleUpdateUnlocker(
      hexToBin(o.category), o.lock, o.provider.blockOracleOwnerKey, hexToBin(oracle.token!.nft!.commitment),
    );
    expectScriptRejection(await spendOracle(o, oracle, update, oracle.satoshis - 5_000n, Number(o.n0)), 0);
    expect(await spendOracle(o, oracle, update, oracle.satoshis, Number(o.n0))).toBe('ACCEPTED');
  });

  it('an SDK read recreates the oracle at its full value', async () => {
    const o = await owned();
    if (o === undefined) return;
    const value = (await liveOracle(o)).satoshis;
    const tx = await o.reader.call.readBack(o.n0, T0).send();
    const after = await liveOracle(o);
    expect(after.txid).toBe(tx.txid);
    expect(after.satoshis).toBe(value);
  });

  it('SDK updates keep the oracle value, and the keeper P2PKH pays their fees', async () => {
    const o = await owned();
    if (o === undefined) return;
    const keeper = new SignatureTemplate(o.provider.blockOracleOwnerKey).unlockP2PKH().generateLockingBytecode();
    const value = (await liveOracle(o)).satoshis;
    const funds = await balance(o.provider, keeper);
    const tip = BigInt(await o.provider.getBlockHeight());
    // A height update, then a time update: the old keeper took 2,000 satoshis from the oracle for each.
    expect(await o.updater.pushUpdate(fields(tip, T0), Number(tip))).toMatch(TXID);
    expect(await o.updater.pushUpdate(fields(tip, T0 + 600n), Number(T0 + 600n))).toMatch(TXID);
    expect(await o.updater.oracleTimestamp()).toBe(T0 + 600n);
    expect((await liveOracle(o)).satoshis).toBe(value);
    expect(await balance(o.provider, keeper)).toBe(funds - 4_000n);
  });
});

// The mock chain over BCHN's two blockhash calls.
function chainRpc(provider: MockNetworkProvider): RpcLike {
  return {
    request: async (method: string, ...params: unknown[]): Promise<unknown> => {
      if (method === 'getblockcount') return provider.getBlockHeight();
      if (method === 'getblockhash') return provider.getBlockHash(Number(params[0]));
      throw new Error(`unexpected rpc ${method}`);
    },
  };
}

describe('the blockhash ring keeps its value', () => {
  // A reader of any n, whose ring holds 256 slots, kept by the mock's owner key.
  async function ring(): Promise<{ provider: MockNetworkProvider; lock: Uint8Array; keeper: BlockOracleUpdater }
  | undefined> {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return undefined;
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const { contract, categoryId } = await StatefulContract.deploy(compileString(CONSUMER), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
    });
    const keeper = new BlockOracleUpdater({
      contract: contract.inner, categoryId, keeperKey: provider.blockOracleOwnerKey, rpc: chainRpc(provider),
    });
    return { provider, lock: blockhashOracleLockingBytecode(hexToBin(categoryId)), keeper };
  }

  it('refuses a read that lowers a slot value, and admits one that keeps it', async () => {
    const r = await ring();
    if (r === undefined) return;
    const [slot] = await r.provider.getUtxosForLockingBytecode(r.lock);
    const read: Unlocker = {
      generateLockingBytecode: (): Uint8Array => r.lock,
      generateUnlockingBytecode: (): Uint8Array => blockhashSlotReadUnlocking(hexToBin(slot.token!.category)),
    };
    const spend = async (kept: bigint): Promise<string> => {
      const funder = await createBareP2pkhFeeFunder(r.provider, 20_000n);
      return broadcast(r.provider, new TransactionBuilder({ provider: r.provider })
        .addInput(slot, read)
        .addInput(funder.utxo, funder.unlocker)
        .addOutput({ to: r.lock, amount: kept, token: slot.token })
        .addOutput({ to: bobAddress, amount: 19_000n + slot.satoshis - kept }));
    };
    expectScriptRejection(await spend(slot.satoshis - 1n), 0);
    expect(await spend(slot.satoshis)).toBe('ACCEPTED');
  });

  it('syncs past the depth with every slot at its value, and the keeper P2PKH pays the fees', async () => {
    const r = await ring();
    if (r === undefined) return;
    const held = async (): Promise<Array<[bigint, bigint]>> => (await r.provider.getUtxosForLockingBytecode(r.lock))
      .map((utxo): [bigint, bigint] => [
        blockhashCommitmentNumber(hexToBin(utxo.token!.nft!.commitment)), utxo.satoshis,
      ])
      .sort(([a], [b]) => Number(a - b));
    const keeperLock = new SignatureTemplate(r.provider.blockOracleOwnerKey).unlockP2PKH().generateLockingBytecode();
    const funds = await balance(r.provider, keeperLock);
    // The slots no write reached still hold their genesis n, their residue.
    const unwritten = (written: readonly bigint[]): Array<[bigint, bigint]> => Array
      .from({ length: 256 }, (_s, s) => BigInt(s))
      .filter((s) => written.every((n) => n % 256n !== s)).map((s): [bigint, bigint] => [s, 1_200n]);

    const first = BigInt(await r.provider.getBlockHeight());
    expect(await r.keeper.syncOnce()).toBeNull();
    await r.provider.mine(1);
    expect(await r.keeper.syncOnce()).toBeNull();
    expect(await held()).toEqual([...unwritten([first, first + 1n]), [first, 1_200n], [first + 1n, 1_200n]]);
    // 256 blocks on, the tip's slot is the one holding first + 1, and it moves up by the depth.
    await r.provider.mine(256);
    expect(await r.keeper.syncOnce()).toBeNull();
    expect(await held()).toEqual([...unwritten([first, first + 257n]), [first, 1_200n], [first + 257n, 1_200n]]);
    expect(await balance(r.provider, keeperLock)).toBe(funds - 6_000n);
  });
});
