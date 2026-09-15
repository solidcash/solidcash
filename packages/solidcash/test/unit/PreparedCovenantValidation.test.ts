import {
  binToHex, encodeTransaction, hashTransactionUiOrder, type Output, type Transaction,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import {
  consumePreparedCovenantValidation,
  rememberPreparedCovenantValidation,
  rememberPartialCovenantValidation,
  takePartialCovenantValidation,
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

const tokenSourceOutputs = (): Output[] => [
  {
    lockingBytecode: Uint8Array.of(0x51, 0x51),
    valueSatoshis: 1_000n,
    token: {
      category: new Uint8Array(32).fill(2),
      amount: 7n,
      nft: { capability: 'mutable', commitment: Uint8Array.of(3, 4) },
    },
  },
  { lockingBytecode: Uint8Array.of(0x52), valueSatoshis: 2_000n },
];

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

  it('keeps partial receipts separate, provider-bound, merged, and one-use', () => {
    const provider = {} as NetworkProvider;
    const otherProvider = {} as NetworkProvider;
    const tx = transaction();
    const sources = sourceOutputs();

    tx.inputs.push({
      outpointIndex: 1,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.of(0x51),
    });
    sources.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n });

    rememberPartialCovenantValidation(provider, tx, sources, [0]);
    rememberPartialCovenantValidation(provider, tx, sources, [1]);
    expect([...takePartialCovenantValidation(otherProvider, tx, sources)]).toEqual([]);
    const rawBytes = encodeTransaction(tx);
    expect(consumePreparedCovenantValidation(provider, {
      rawBytes, rawHex: binToHex(rawBytes), transaction: tx,
    }, sources, binToHex(hashTransactionUiOrder(rawBytes)))).toBe(false);
    const rebuilt = {
      ...tx,
      inputs: tx.inputs.map((input) => ({
        ...input,
        outpointTransactionHash: input.outpointTransactionHash.slice(),
        unlockingBytecode: input.unlockingBytecode.slice(),
      })),
    };
    const rebuiltSources = sources.map((output) => ({
      ...output, lockingBytecode: output.lockingBytecode.slice(),
    }));
    expect([...takePartialCovenantValidation(provider, rebuilt, rebuiltSources)]).toEqual([0, 1]);
    expect([...takePartialCovenantValidation(provider, tx, sources)]).toEqual([]);

    rememberPreparedCovenantValidation(provider, tx, sources);
    expect([...takePartialCovenantValidation(provider, tx, sources)]).toEqual([]);
    expect(consumePreparedCovenantValidation(provider, {
      rawBytes, rawHex: binToHex(rawBytes), transaction: tx,
    }, sources, binToHex(hashTransactionUiOrder(rawBytes)))).toBe(true);

    expect(() => rememberPartialCovenantValidation(provider, tx, sources, [-1]))
      .toThrow(/must identify transaction inputs/);
    expect(() => rememberPartialCovenantValidation(provider, tx, sources, [2]))
      .toThrow(/must identify transaction inputs/);
  });

  it('invalidates a partial receipt for every transaction byte family', () => {
    const mutations: Array<(tx: Transaction) => void> = [
      (tx) => { tx.version = 1; },
      (tx) => { tx.locktime = 1; },
      (tx) => { tx.inputs[0].outpointTransactionHash[0] ^= 1; },
      (tx) => { tx.inputs[0].outpointIndex = 1; },
      (tx) => { tx.inputs[0].sequenceNumber = 1; },
      (tx) => { tx.inputs[0].unlockingBytecode[0] ^= 1; },
      (tx) => { tx.outputs[0].valueSatoshis -= 1n; },
      (tx) => { tx.outputs[0].lockingBytecode[0] ^= 1; },
    ];
    for (const mutate of mutations) {
      const provider = {} as NetworkProvider;
      const original = transaction();
      rememberPartialCovenantValidation(provider, original, sourceOutputs(), [0]);
      const changed = transaction();
      mutate(changed);
      expect([...takePartialCovenantValidation(provider, changed, sourceOutputs())]).toEqual([]);
    }
  });

  it('invalidates every source-output field, including in-place byte mutations', () => {
    const mutations: Array<(sources: Output[]) => void> = [
      (sources) => { sources[0].valueSatoshis -= 1n; },
      (sources) => { sources[0].lockingBytecode[0] ^= 1; },
      (sources) => { sources[0].token!.category[0] ^= 1; },
      (sources) => { sources[0].token!.amount += 1n; },
      (sources) => { sources[0].token!.nft!.capability = 'minting'; },
      (sources) => { sources[0].token!.nft!.commitment[0] ^= 1; },
      (sources) => { sources.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1n }); },
      (sources) => { sources.pop(); },
      (sources) => { [sources[0], sources[1]] = [sources[1], sources[0]]; },
    ];
    for (const mutate of mutations) {
      const provider = {} as NetworkProvider;
      const sources = tokenSourceOutputs();
      rememberPartialCovenantValidation(provider, transaction(), sources, [0]);
      mutate(sources);
      expect([...takePartialCovenantValidation(provider, transaction(), sources)]).toEqual([]);
      // A mismatch consumes the receipt, so restoring the source cannot revive it.
      expect([...takePartialCovenantValidation(provider, transaction(), tokenSourceOutputs())]).toEqual([]);
    }
  });
});
