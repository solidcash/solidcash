import { describe, it, expect } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  blockhashKeeperBatonLockingBytecode, blockhashOracleLockingBytecode, buildBlockhashCommitment,
  buildDataNftCovenantScript, buildEntryNftCovenantScript, computeCollectionHash, encodeInt, hash256,
  scriptToBytecode,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  BlockOracleUpdater, RpcLike, blockhashKeeperBatonUnlocker, type BlockOracleFields,
} from '../../src/oracle/blockOracleUpdater.js';
import type { Output, Unlocker, Utxo } from '../../src/interfaces.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

/**
 * Audit CRYPTO-4 / CRYPTO-5 (docs/security/2026-10/CRYPTO.md).
 *
 * CRYPTO-4: a blockhash() consumer's keeper holds a minting NFT of the consumer's own category, and the data and
 * entry covenants accept any minting NFT of that category as the master's authority. A bare baton (an OP_1
 * P2SH32 here) rewrote a data record before the fix. The baton now sits at the keeper baton covenant, which only
 * mints (n -> hash) oracles: it cannot co-spend a record, mint any other NFT of the category, or move.
 *
 * CRYPTO-5: the owner must not report block.number as a time-type value (>= 500,000,000), which a time-type
 * nLockTime would satisfy under OP_CHECKLOCKTIMEVERIFY. The block oracle covenant moves the number only under a
 * height-type nLockTime, below 500,000,000.
 */

const CONSUMER = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';
const H = hexToBin('cd'.repeat(32));

const fakeRpc = (): RpcLike => ({ request: async (): Promise<never> => { throw new Error('unused'); } });
const p2sh32 = (redeem: Uint8Array): Uint8Array => Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]);

type Provider = ReturnType<typeof createTestProvider>;

interface Deployed {
  provider: Provider; consumer: Contract; cat: string; baton: Utxo; keeper: Unlocker; n: bigint;
}

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(CONSUMER);
  const consumer = new Contract(artifact, [], { provider });
  const { categoryId, extraUtxos } = await setupStatefulUtxos(provider, consumer, artifact.stateLayout!, {}, {
    saltContract: true,
    extraOutputs: (cat) => [{
      address: binToHex(blockhashKeeperBatonLockingBytecode(hexToBin(cat), alicePub)),
      satoshis: 10000n,
      token: { nft: { capability: 'minting', commitment: '' } },
    }],
  });
  const before = await provider.getBlockHeight();
  await provider.mine(1);
  return {
    provider, consumer, cat: categoryId, baton: extraUtxos![0],
    keeper: blockhashKeeperBatonUnlocker(categoryId, alicePriv), n: BigInt(before + 1),
  };
}

const batonBack = (d: Deployed): Output => ({
  to: d.keeper.generateLockingBytecode(), amount: d.baton.satoshis - 2000n, token: d.baton.token,
});

const oracle = (d: Deployed): Output => ({
  to: blockhashOracleLockingBytecode(hexToBin(d.cat)), amount: 1000n,
  token: {
    category: d.cat, amount: 0n, nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(d.n, H)) },
  },
});

const forgedRecord = (d: Deployed, lock: Uint8Array): Output => ({
  to: lock, amount: 1000n, token: { category: d.cat, amount: 0n, nft: { capability: 'mutable', commitment: '01ff' } },
});

let recordCount = 0;

// A genuine own-category record at the covenant of `redeem`, unlocked as `<master index 0> <flag>`.
async function record(
  d: Deployed, redeem: Uint8Array, flag: bigint,
): Promise<{ utxo: Utxo; unlocker: Unlocker; lock: Uint8Array }> {
  const lock = p2sh32(redeem);
  recordCount += 1;
  const utxo: Utxo = {
    txid: (0xe400 + recordCount).toString(16).padStart(64, '0'), vout: 0, satoshis: 1000n,
    token: { category: d.cat, amount: 0n, nft: { capability: 'mutable', commitment: '0101' } },
  };
  await (d.provider as any).addUtxo(binToHex(lock), utxo);
  const unlock = scriptToBytecode([encodeInt(0n), encodeInt(flag), redeem]);
  return { utxo, lock, unlocker: { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => unlock } };
}

// Broadcast the keeper-signed baton spend raw, so the verdict is the mock node's.
async function spend(
  d: Deployed, extra: { utxo: Utxo; unlocker: Unlocker } | undefined, outputs: Output[],
): Promise<string> {
  const builder = new TransactionBuilder({ provider: d.provider }).addInput(d.baton, d.keeper);
  if (extra) builder.addInput(extra.utxo, extra.unlocker);
  builder.addOutputs(outputs).setLocktime(Number(d.n));
  const hex = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
  return d.provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
}

describe('CRYPTO-4: the blockhash keeper baton cannot stand in for the master', () => {
  it('mints an oracle through the baton covenant, and the consumer reads it', async () => {
    const d = await deploy();
    const updater = new BlockOracleUpdater({
      contract: d.consumer, categoryId: d.cat, keeperKey: alicePriv, rpc: fakeRpc(), blockhashOracleCategory: d.cat,
    });
    expect(await updater.mintBlockhashPair(d.n, H)).toMatch(/^[0-9a-f]{64}$/);
    const tx = await (StatefulContract.withCategory(d.consumer, d.cat) as any).f(d.n, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a data-NFT write, a data-NFT destroy and an entry write authorised by the baton', async () => {
    const d = await deploy();
    const data = scriptToBytecode(buildDataNftCovenantScript(hexToBin(d.cat)));
    const entry = scriptToBytecode(
      buildEntryNftCovenantScript(hexToBin(d.cat), computeCollectionHash('m:mapping(int => int)')),
    );
    const cases: Array<[string, Uint8Array, bigint]> = [
      ['data write', data, 1n], ['data destroy', data, 2n], ['entry write', entry, 1n],
    ];
    for (const [name, redeem, flag] of cases) {
      const r = await record(d, redeem, flag);
      const second = flag === 2n ? oracle(d) : forgedRecord(d, r.lock);
      const outcome = await spend(d, r, [batonBack(d), second]);
      expect(outcome, name).not.toBe('ACCEPTED');
      expectScriptRejection(outcome, 0);
    }
  });

  it('refuses a forged record mint and a baton move, and accepts the oracle mint shape', async () => {
    const d = await deploy();
    const dataLock = p2sh32(scriptToBytecode(buildDataNftCovenantScript(hexToBin(d.cat))));
    expectScriptRejection(await spend(d, undefined, [batonBack(d), forgedRecord(d, dataLock)]), 0);
    // A P2SH32 lock with a long unlocking, which a lock-shape check on the master input would admit.
    const moved = { ...batonBack(d), to: p2sh32(Uint8Array.of(0x75, 0x51)) };
    expectScriptRejection(await spend(d, undefined, [moved, oracle(d)]), 0);
    expect(await spend(d, undefined, [batonBack(d), oracle(d)])).toBe('ACCEPTED');
  });
});

// Below the mock's median time past, so a time-type nLockTime alone would not stop the update.
const T0 = 1_699_990_000n;

const OWNED_ORACLE = `
contract BlockOracleOwned() {
    function readBack(int eNumber) { require(block.number == eNumber); }
}`;

describe('CRYPTO-5: block.number cannot be reported as a time-type value', () => {
  async function owned(): Promise<{ provider: MockNetworkProvider; updater: BlockOracleUpdater } | undefined> {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return undefined;
    provider.setBlockOracleFields({
      number: 0n, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
    });
    const contract = new Contract(compileString(OWNED_ORACLE), [], { provider });
    const updater = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: fakeRpc(),
    });
    return { provider, updater };
  }

  const fields = (number: bigint): BlockOracleFields => ({
    number, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
  });

  it('accepts an honest height update', async () => {
    const o = await owned();
    if (o === undefined) return;
    const n = await o.provider.getBlockHeight();
    expect(await o.updater.pushUpdate(fields(BigInt(n)), n)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects number >= 500,000,000 under a time-type locktime', async () => {
    const o = await owned();
    if (o === undefined) return;
    // The audit's shape: nLockTime is a final time just past the stored timestamp, and the number is time-sized.
    await expect(o.updater.pushUpdate(fields(500_000_001n), Number(T0 + 100n))).rejects.toThrow();
    expect(await o.updater.oracleHeight()).toBe(0n);
  });
});
