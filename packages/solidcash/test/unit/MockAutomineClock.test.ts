import { describe, expect, it } from 'vitest';
import { SignatureTemplate } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { selectPoolInfoCoin } from '../../src/oracle/pool/index.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

/**
 * The mock chain mines each transaction it accepts in a block of its own, as Hardhat's automine does: a second after
 * the tip, or at the time `setNextBlockTimestamp` set. Its oracle pool publishes the second before the tip, so each
 * transaction reads a later `block.timestamp` than the one before it.
 */

/** Spends a fresh coin of Alice's back to her: one accepted transaction. */
async function send(provider: MockNetworkProvider): Promise<void> {
  const coin = await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 100_000n }));
  await new TransactionBuilder({ provider })
    .addInput(coin, new SignatureTemplate(alicePriv).unlockP2PKH())
    .addOutput({ to: aliceAddress, amount: 90_000n })
    .send();
}

/** The timestamp a `block.timestamp` read slices: that of a live info coin of the mock's pool. */
async function poolClock(provider: MockNetworkProvider): Promise<bigint> {
  return (await selectPoolInfoCoin(provider, provider.oraclePoolCategory!))!.fields.timestamp;
}

describe('the mock chain mines each transaction in a block of its own', () => {
  it('a second after the tip, so the pool moves a second per transaction', async () => {
    const provider = new MockNetworkProvider();
    const start = provider.getBlockTime();
    expect(await poolClock(provider)).toBe(BigInt(start - 1));
    await send(provider);
    expect(provider.getBlockTime()).toBe(start + 1);
    expect(await poolClock(provider)).toBe(BigInt(start));
    await send(provider);
    expect(provider.getBlockTime()).toBe(start + 2);
    expect(await poolClock(provider)).toBe(BigInt(start + 1));
  });

  it('at the time setNextBlockTimestamp set, then a second after it', async () => {
    const provider = new MockNetworkProvider();
    expect(provider.oraclePoolCategory).toBeDefined();
    const at = provider.getBlockTime() + 3_600;
    provider.setNextBlockTimestamp(at);
    await send(provider);
    expect(provider.getBlockTime()).toBe(at);
    expect(await poolClock(provider)).toBe(BigInt(at - 1));
    await send(provider);
    expect(provider.getBlockTime()).toBe(at + 1);
  });
});
