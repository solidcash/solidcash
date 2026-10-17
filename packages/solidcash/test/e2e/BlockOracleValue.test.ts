import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  blockOracleReadUnlocking, blockhashCommitmentNumber, blockhashKeeperBatonLockingBytecode,
  blockhashOracleLockingBytecode,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import {
  BLOCKHASH_WINDOW, BlockOracleUpdater, blockOracleUpdateUnlocker, type BlockOracleFields, type RpcLike,
} from '../../src/oracle/blockOracleUpdater.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';
import { alicePriv, alicePub, bobAddress } from '../fixture/vars.js';

/**
 * The block-info oracle covenant refuses any spend that recreates the oracle with fewer satoshis, read or owner
 * update, so no reader can drain it until updates go out fee-less. The keeper pays update fees from its own
 * P2PKH. Its blockhash sweep pays its fee out of the pairs it reclaims, so a sync past 256 blocks succeeds.
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

interface Owned { provider: MockNetworkProvider; contract: Contract; updater: BlockOracleUpdater; n0: bigint }

// The oracle holds (tip - 1, T0). The mock's owner key keeps it.
async function owned(): Promise<Owned | undefined> {
  const provider = createTestProvider();
  if (!('setBlockOracleFields' in provider)) return undefined;
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  provider.setBlockOracleFields(fields(n0, T0));
  const contract = new Contract(compileString(READ_BACK), [], { provider });
  const updater = new BlockOracleUpdater({
    contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: unusedRpc,
  });
  return { provider, contract, updater, n0 };
}

async function liveOracle(provider: MockNetworkProvider): Promise<Utxo> {
  const utxos = await provider.getUtxosForLockingBytecode(provider.blockOracleLock);
  const oracle = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable');
  if (oracle === undefined) throw new Error('no live block oracle');
  return oracle;
}

async function balance(provider: MockNetworkProvider, lock: Uint8Array): Promise<bigint> {
  return (await provider.getUtxosForLockingBytecode(lock)).reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

const outpoints = async (provider: MockNetworkProvider, lock: Uint8Array): Promise<string[]> => (
  (await provider.getUtxosForLockingBytecode(lock)).map((utxo) => `${utxo.txid}:${utxo.vout}`)
);

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
    .addOutput({ to: o.provider.blockOracleLock, amount: kept, token: oracle.token })
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
    const oracle = await liveOracle(o.provider);
    const read: Unlocker = {
      generateLockingBytecode: (): Uint8Array => o.provider.blockOracleLock,
      generateUnlockingBytecode: (): Uint8Array => blockOracleReadUnlocking(o.provider.blockOracleCategory),
    };
    expectScriptRejection(await spendOracle(o, oracle, read, oracle.satoshis - 5_000n), 0);
    expect(await spendOracle(o, oracle, read, oracle.satoshis)).toBe('ACCEPTED');
  });

  it('refuses an owner-signed update that lowers the oracle value, and admits one that keeps it', async () => {
    const o = await owned();
    if (o === undefined) return;
    const oracle = await liveOracle(o.provider);
    // The same commitment under a height locktime at its number passes every update check but the value.
    const update = blockOracleUpdateUnlocker(
      o.provider.blockOracleCategory, o.provider.blockOracleLock, o.provider.blockOracleOwnerKey,
      hexToBin(oracle.token!.nft!.commitment),
    );
    expectScriptRejection(await spendOracle(o, oracle, update, oracle.satoshis - 5_000n, Number(o.n0)), 0);
    expect(await spendOracle(o, oracle, update, oracle.satoshis, Number(o.n0))).toBe('ACCEPTED');
  });

  it('an SDK read recreates the oracle at its full value', async () => {
    const o = await owned();
    if (o === undefined) return;
    const value = (await liveOracle(o.provider)).satoshis;
    const utxo = await o.provider.addUtxo(o.contract.address, randomUtxo({ satoshis: 100_000n }));
    const feeFunder = await createFeeFunder(o.provider, 20_000n);
    const tx = await new TransactionBuilder({ provider: o.provider })
      .addInput(utxo, o.contract.unlock.readBack(o.n0, T0))
      .addInput(feeFunder.utxo, feeFunder.unlocker)
      .addOutput({ to: o.contract.address, amount: 110_000n })
      .send();
    const after = await liveOracle(o.provider);
    expect(after.txid).toBe(tx.txid);
    expect(after.satoshis).toBe(value);
  });

  it('SDK updates keep the oracle value, and the keeper P2PKH pays their fees', async () => {
    const o = await owned();
    if (o === undefined) return;
    const keeper = new SignatureTemplate(o.provider.blockOracleOwnerKey).unlockP2PKH().generateLockingBytecode();
    const value = (await liveOracle(o.provider)).satoshis;
    const funds = await balance(o.provider, keeper);
    const tip = BigInt(await o.provider.getBlockHeight());
    // A height update, then a time update: the old keeper took 2,000 satoshis from the oracle for each.
    expect(await o.updater.pushUpdate(fields(tip, T0), Number(tip))).toMatch(TXID);
    expect(await o.updater.pushUpdate(fields(tip, T0 + 600n), Number(T0 + 600n))).toMatch(TXID);
    expect(await o.updater.oracleTimestamp()).toBe(T0 + 600n);
    expect((await liveOracle(o.provider)).satoshis).toBe(value);
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

describe('the blockhash keeper sweep', () => {
  it('syncs past 256 blocks and sweeps the aged pairs to the keeper in one batch', async () => {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return;
    const artifact = compileString(CONSUMER);
    const consumer = new Contract(artifact, [], { provider });
    const { categoryId: cat } = await setupStatefulUtxos(provider, consumer, artifact.stateLayout!, {}, {
      saltContract: true,
      extraOutputs: (category) => [{
        address: binToHex(blockhashKeeperBatonLockingBytecode(hexToBin(category), alicePub)),
        satoshis: 100_000n,
        token: { nft: { capability: 'minting', commitment: '' } },
      }],
    });
    const keeper = new BlockOracleUpdater({
      contract: consumer, categoryId: cat, keeperKey: alicePriv, rpc: chainRpc(provider), blockhashOracleCategory: cat,
    });
    const pairLock = blockhashOracleLockingBytecode(hexToBin(cat));
    const pairs = async (): Promise<bigint[]> => (await provider.getUtxosForLockingBytecode(pairLock))
      .map((utxo) => blockhashCommitmentNumber(hexToBin(utxo.token?.nft?.commitment ?? '')))
      .sort((a, b) => Number(a - b));
    const keeperLock = new SignatureTemplate(alicePriv).unlockP2PKH().generateLockingBytecode();

    const first = BigInt(await provider.getBlockHeight());
    expect(await keeper.syncOnce()).toBeNull();
    await provider.mine(1);
    expect(await keeper.syncOnce()).toBeNull();
    expect(await pairs()).toEqual([first, first + 1n]);

    const held = new Set(await outpoints(provider, keeperLock));
    await provider.mine(BLOCKHASH_WINDOW);
    const tip = BigInt(await provider.getBlockHeight());
    expect(tip).toBe(first + 1n + BigInt(BLOCKHASH_WINDOW));
    // Both pairs are out of the window: the old sweep built a 0-satoshi output for one 1,000-satoshi pair.
    expect(await keeper.syncOnce()).toBeNull();
    expect(await pairs()).toEqual([tip]);
    const swept = (await provider.getUtxosForLockingBytecode(keeperLock))
      .filter((utxo) => !held.has(`${utxo.txid}:${utxo.vout}`));
    expect(swept).toHaveLength(1);
    // 2,000 reclaimed satoshis less a size-priced fee, above dust.
    expect(swept[0].satoshis).toBeGreaterThan(546n);
    expect(swept[0].satoshis).toBeLessThan(2_000n);
  });
});
