import { describe, expect, it } from 'vitest';
import { encodeTransaction } from '@bitauth/libauth';
import { hash256 } from '@solidcash/utils';
import { fingerprintLibauthTransaction } from '../../src/stateful/StatefulContract.js';

const sampleTx = (unlocking: Uint8Array): Parameters<typeof encodeTransaction>[0] => ({
  version: 2,
  locktime: 0,
  inputs: [{
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: unlocking,
  }],
  outputs: [{
    lockingBytecode: new Uint8Array(25),
    valueSatoshis: 1000n,
  }],
});

describe('probe transaction fingerprint', () => {
  it('is content-sensitive and reuses bytecode identity without encoding the full transaction', () => {
    const unlocking = new Uint8Array(200_000).fill(9);
    const tx = sampleTx(unlocking);
    const cache = new WeakMap<Uint8Array, string>();
    const first = fingerprintLibauthTransaction(tx, cache);
    const second = fingerprintLibauthTransaction(tx, cache);
    expect(second).toBe(first);

    const mutated = sampleTx(new Uint8Array(200_000).fill(8));
    expect(fingerprintLibauthTransaction(mutated, cache)).not.toBe(first);

    const encoded = encodeTransaction(tx);
    const encodedHex = Buffer.from(hash256(encoded)).toString('hex');
    expect(first).not.toBe(encodedHex);
    expect(encoded.byteLength).toBeGreaterThan(unlocking.byteLength);
    expect(cache.get(unlocking)).toBeTypeOf('string');
  });
});
