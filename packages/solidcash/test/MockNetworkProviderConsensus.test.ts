import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransactionBch, hexToBin } from '@bitauth/libauth';
import { MOCK_CONSENSUS_LIMITS, MockNetworkProvider } from '../src/index.js';

describe('MockNetworkProvider consensus limits', () => {
  it('uses relaxed test-harness defaults', () => {
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits).toEqual({
      maximumInputBytes: 1_000_000,
      maximumStackItemBytes: 1_000_000,
      maximumTransactionBytes: 10_000_000,
      maximumNftCommitmentBytes: 1_000_000,
      operationCostBudgetPerByte: 10_000_000,
      hashDigestIterationsPerByte: 10_000_000,
    });
    expect(provider.consensusLimits).not.toBe(MOCK_CONSENSUS_LIMITS);
    expect(provider.policy).toEqual({ enforceDust: false });
  });

  it('allows individual limits to be overridden', () => {
    const provider = new MockNetworkProvider({
      consensusLimits: { maximumInputBytes: 20_000 },
    });
    expect(provider.consensusLimits).toEqual({
      ...MOCK_CONSENSUS_LIMITS,
      maximumInputBytes: 20_000,
    });
  });

  it('accepts dust outputs when the mock relay policy disables dust', async () => {
    const provider = new MockNetworkProvider();
    const parentTxid = 'ab'.repeat(32);
    const lockingBytecode = Uint8Array.of(0x61, 0x61, 0x61, 0x61, 0x51); // OP_NOP*4 OP_TRUE
    await provider.addUtxo(binToHex(lockingBytecode), { txid: parentTxid, vout: 0, satoshis: 10_000n });
    const raw = encodeTransactionBch({
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin(parentTxid), outpointIndex: 0,
        sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(),
      }],
      outputs: [{ lockingBytecode, valueSatoshis: 1n }],
      locktime: 0,
    });

    await expect(provider.sendRawTransaction(binToHex(raw))).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('evaluates unlocking bytecode above BCH\'s 10KB limit', async () => {
    const provider = new MockNetworkProvider();
    const parentTxid = 'aa'.repeat(32);
    const lockingBytecode = Uint8Array.of(0x75, 0x51); // OP_DROP OP_TRUE
    await provider.addUtxo(binToHex(lockingBytecode), {
      txid: parentTxid,
      vout: 0,
      satoshis: 10_000_000n,
    });

    const payload = new Uint8Array(20_000);
    const unlockingBytecode = new Uint8Array(3 + payload.length);
    unlockingBytecode[0] = 0x4d; // OP_PUSHDATA2
    new DataView(unlockingBytecode.buffer).setUint16(1, payload.length, true);
    unlockingBytecode.set(payload, 3);
    const raw = encodeTransactionBch({
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin(parentTxid),
        outpointIndex: 0,
        sequenceNumber: 0xffffffff,
        unlockingBytecode,
      }],
      outputs: [
        { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 9_000_000n },
        { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 900_000n },
      ],
      locktime: 0,
    });

    await expect(provider.sendRawTransaction(binToHex(raw))).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('evaluates token commitment introspection above the legacy 520-byte stack-item limit', async () => {
    const provider = new MockNetworkProvider();
    const parentTxid = 'bb'.repeat(32);
    const category = 'cc'.repeat(32);
    const commitment = 'dd'.repeat(1_364);
    const lockingBytecode = Uint8Array.of(0x00, 0xcf, 0x75, 0x51);
    await provider.addUtxo(binToHex(lockingBytecode), {
      txid: parentTxid,
      vout: 0,
      satoshis: 10_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
    const raw = encodeTransactionBch({
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin(parentTxid), outpointIndex: 0,
        sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(),
      }],
      outputs: [{
        lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 8_000n,
        token: {
          category: hexToBin(category), amount: 0n,
          nft: { capability: 'mutable', commitment: hexToBin(commitment) },
        },
      }],
      locktime: 0,
    });
    await expect(provider.sendRawTransaction(binToHex(raw))).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
