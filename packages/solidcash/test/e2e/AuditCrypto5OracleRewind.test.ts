import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { BlockOracleUpdater, type RpcLike } from '../../src/oracle/blockOracleUpdater.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider } from '../test-util.js';

/**
 * Audit CRYPTO-5 (docs/security-audit-2026-10/CRYPTO.md): the oracle owner must not rewind block.number or
 * block.timestamp to replay an old window. The block oracle covenant requires each value to be >= the one in
 * its commitment: a height update moves the number, a time-type update moves the timestamp.
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
const unusedRpc: RpcLike = { request: async (): Promise<never> => { throw new Error('unused'); } };

interface Owned { provider: MockNetworkProvider; contract: Contract; updater: BlockOracleUpdater; n0: bigint }

// The oracle starts one below the tip, so a rewound height is still final and passes tx.time >= number.
async function deployOwned(): Promise<Owned | undefined> {
  const provider = createTestProvider();
  if (!('setBlockOracleFields' in provider)) return undefined;
  const n0 = BigInt(await provider.getBlockHeight()) - 1n;
  provider.setBlockOracleFields({
    number: n0, timestamp: T0, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
  });
  const contract = new Contract(compileString(OWNED_ORACLE), [], { provider });
  const updater = new BlockOracleUpdater({
    contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: unusedRpc,
  });
  return { provider, contract, updater, n0 };
}

function update(o: Owned, number: bigint, timestamp: bigint, locktime: bigint): Promise<string> {
  return o.updater.pushUpdate({
    number, timestamp, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
  }, Number(locktime));
}

async function readBack(o: Owned, number: bigint, timestamp: bigint): Promise<string> {
  const utxo = await o.provider.addUtxo(o.contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(o.provider, 20000n);
  const tx = await new TransactionBuilder({ provider: o.provider })
    .addInput(utxo, o.contract.unlock.readBack(number, timestamp))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: o.contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('CRYPTO-5: the block oracle owner cannot rewind number or timestamp', () => {
  it('refuses a rewound number and a rewound timestamp, leaving both', async () => {
    const o = await deployOwned();
    if (o === undefined) return;
    // A height update one block back, then a time-type update one second back. Each fails the >= check.
    await expect(update(o, o.n0 - 1n, T0, o.n0 - 1n)).rejects.toThrow(/OP_VERIFY/);
    await expect(update(o, o.n0, T0 - 1n, T0 - 1n)).rejects.toThrow(/OP_VERIFY/);
    expect(await readBack(o, o.n0, T0)).toMatch(TXID);
  });

  it('accepts an equal and then a higher number and timestamp', async () => {
    const o = await deployOwned();
    if (o === undefined) return;
    expect(await update(o, o.n0, T0, o.n0)).toMatch(TXID);
    const tip = BigInt(await o.provider.getBlockHeight());
    expect(tip).toBeGreaterThan(o.n0);
    expect(await update(o, tip, T0, tip)).toMatch(TXID);
    expect(await update(o, tip, T0 + 600n, T0 + 600n)).toMatch(TXID);
    expect(await readBack(o, tip, T0 + 600n)).toMatch(TXID);
  });
});
