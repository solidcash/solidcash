import { binToHex, encodeTransactionBch, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { VmTarget } from '../../src/index.js';
import {
  createLayer3SemanticTestProvider, LAYER3_SEMANTIC_TEST_PROFILE,
} from './layer3-semantic-profile.js';

describe('Layer-3 BCH-2026 semantic-only profile', () => {
  it('names its evidence level and changes only the documented capacity and mock-policy limits', () => {
    const provider = createLayer3SemanticTestProvider();

    expect(LAYER3_SEMANTIC_TEST_PROFILE).toEqual({
      name: 'layer3-bch2026-semantic-relaxed-v1',
      evidenceLevel: 'SEMANTIC',
      vm: VmTarget.BCH_2026_05,
      consensusLimits: {
        maximumInputBytes: 1_000_000,
        maximumStackItemBytes: 1_000_000,
        maximumTransactionBytes: 10_000_000,
        maximumNftCommitmentBytes: 128,
        operationCostBudgetPerByte: 10_000_000,
        hashDigestIterationsPerByte: 10_000_000,
      },
      policy: { enforceDust: false },
    });
    expect(provider.consensusLimits).toEqual(LAYER3_SEMANTIC_TEST_PROFILE.consensusLimits);
    expect(provider.policy).toEqual(LAYER3_SEMANTIC_TEST_PROFILE.policy);
    expect(provider.vmTarget).toBe(VmTarget.BCH_2026_05);
  });

  it('executes an oversized input under BCH-2026 semantics without claiming ordinary-limit fit', async () => {
    const provider = createLayer3SemanticTestProvider();
    const parentTxid = '91'.repeat(32);
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
      outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 9_900_000n }],
      locktime: 0,
    });

    await expect(provider.sendRawTransaction(binToHex(raw))).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect(unlockingBytecode.length).toBeGreaterThan(10_000);
    expect(LAYER3_SEMANTIC_TEST_PROFILE.evidenceLevel).toBe('SEMANTIC');
  });
});
