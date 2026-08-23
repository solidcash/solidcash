import {
  binToHex, encodeTransaction, hashTransactionUiOrder, type Output, type Transaction,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import {
  consumePreparedCovenantValidation,
  rememberPreparedCovenantValidation,
} from '../../src/network/createPreparedTxVerifier.js';

const transaction = (): Transaction => ({
  version: 2,
  inputs: [{
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.of(0x51),
  }],
  outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 900n }],
  locktime: 0,
});

const sourceOutputs = (): Output[] => [{
  lockingBytecode: Uint8Array.of(0x51),
  valueSatoshis: 1_000n,
}];

describe('prepared covenant validation receipts', () => {
  it('is one-use and bound to provider, exact bytes, and source outputs', () => {
    const provider = {} as NetworkProvider;
    const otherProvider = {} as NetworkProvider;
    const tx = transaction();
    const sources = sourceOutputs();
    const rawBytes = encodeTransaction(tx);
    const prepared = { rawBytes, rawHex: binToHex(rawBytes), transaction: tx };
    const txid = binToHex(hashTransactionUiOrder(rawBytes));

    rememberPreparedCovenantValidation(provider, tx, sources);
    expect(consumePreparedCovenantValidation(otherProvider, prepared, sources, txid)).toBe(false);
    expect(consumePreparedCovenantValidation(provider, prepared, [
      { ...sources[0], valueSatoshis: 999n },
    ], txid)).toBe(false);
    expect(consumePreparedCovenantValidation(provider, prepared, sources, txid)).toBe(true);
    expect(consumePreparedCovenantValidation(provider, prepared, sources, txid)).toBe(false);

    rememberPreparedCovenantValidation(provider, tx, sources);
    const rebuiltTransaction = transaction();
    const rebuiltBytes = encodeTransaction(rebuiltTransaction);
    expect(consumePreparedCovenantValidation(provider, {
      rawBytes: rebuiltBytes,
      rawHex: binToHex(rebuiltBytes),
      transaction: rebuiltTransaction,
    }, sources, txid)).toBe(true);

    rememberPreparedCovenantValidation(provider, tx, sources);
    const inconsistentTransaction = transaction();
    inconsistentTransaction.outputs[0].valueSatoshis = 899n;
    expect(consumePreparedCovenantValidation(provider, {
      rawBytes,
      rawHex: binToHex(rawBytes),
      transaction: inconsistentTransaction,
    }, sources, txid)).toBe(false);

    rememberPreparedCovenantValidation(provider, tx, sources);
    const changedBytes = rawBytes.slice();
    changedBytes[changedBytes.length - 1] ^= 1;
    const changedPrepared = { ...prepared, rawBytes: changedBytes, rawHex: binToHex(changedBytes) };
    const changedTxid = binToHex(hashTransactionUiOrder(changedBytes));
    expect(consumePreparedCovenantValidation(provider, changedPrepared, sources, changedTxid)).toBe(false);
  });
});
