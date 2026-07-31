import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { TransactionBuilder, layer3 } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { randomUtxo } from '../../src/utils.js';

const provider = (): MockNetworkProvider =>
  new MockNetworkProvider({ policy: { enforceDust: false } });

async function builderFor(lockingBytecode: Uint8Array): Promise<TransactionBuilder> {
  const network = provider();
  const utxo = { ...randomUtxo({ satoshis: 20_000n }), txid: '21'.repeat(32), vout: 0 };
  await network.addUtxo(binToHex(lockingBytecode), utxo);
  const builder = new TransactionBuilder({ provider: network });
  builder.addInput(utxo, {
    generateUnlockingBytecode: () => new Uint8Array(),
    generateLockingBytecode: () => lockingBytecode,
  } as never);
  builder.addOutput({ to: Uint8Array.of(0x51), amount: 15_000n });
  return builder;
}

describe('X210 - the ordinary stateful submit path verifies finalized covenants by default', () => {
  it('accepts an honest finalized transaction', async () => {
    const builder = await builderFor(Uint8Array.of(0x51));
    expect(() => layer3.assertFinalizedTransactionCovenants(
      builder, builder.buildLibauthTransaction(true),
    )).not.toThrow();
  });

  it('refuses a raised VM failure at its input index', async () => {
    const builder = await builderFor(Uint8Array.of(0x00, 0x69));
    expect(() => layer3.assertFinalizedTransactionCovenants(
      builder, builder.buildLibauthTransaction(true),
    )).toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });

  it('refuses the non-raised falsy-top failure class', async () => {
    const builder = await builderFor(Uint8Array.of(0x00));
    expect(() => layer3.assertFinalizedTransactionCovenants(
      builder, builder.buildLibauthTransaction(true),
    )).toThrow(
      'layer3: BCH-2026 preflight failed at input 0: Unsuccessful evaluation: completed with a '
      + 'non-truthy value on top of the stack. Top stack item: "".',
    );
  });

  it('wires the throwing gate into ordinary send independently of the recursive opt-in', () => {
    const source = readFileSync(fileURLToPath(new URL(
      '../../src/stateful/StatefulTransactionBuilder.ts', import.meta.url,
    )), 'utf8');
    const submit = source.slice(source.indexOf('async send(): Promise<TransactionDetails>'));
    expect(submit).toMatch(/if \(!this\.strictVmPreflight\) \{\s*assertFinalizedTransactionCovenants\(/);
    expect(submit.indexOf('assertFinalizedTransactionCovenants(')).toBeLessThan(submit.indexOf('const rawTx ='));
    expect(submit.indexOf('assertFinalizedTransactionCovenants('))
      .toBeLessThan(submit.indexOf('provider.sendRawTransaction(rawTx)'));
  });
});
