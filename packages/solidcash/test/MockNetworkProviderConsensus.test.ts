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
    });
    expect(provider.consensusLimits).not.toBe(MOCK_CONSENSUS_LIMITS);
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
});
