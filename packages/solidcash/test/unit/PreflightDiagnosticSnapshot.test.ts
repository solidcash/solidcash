import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertFinalizedTransactionCovenants } from '../../src/finalization.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

describe('preflight diagnostic input selection', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('still rejects a failing input outside the selected diagnostic input', () => {
    vi.stubEnv('SOLIDC_DEBUG_FAILURE_POINT_PRE_STATE', '1');
    vi.stubEnv('SOLIDC_TRACE_INPUT', '0');
    const builder = new TransactionBuilder({ provider: new MockNetworkProvider() });
    for (const [index, lockingBytecode] of [Uint8Array.of(0x51), Uint8Array.of(0x00, 0x69)].entries()) {
      builder.addInput({ txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 10_000n }, {
        generateUnlockingBytecode: () => new Uint8Array(),
        generateLockingBytecode: () => lockingBytecode,
      });
    }
    builder.addOutput({ to: Uint8Array.of(0x51), amount: 19_000n });
    expect(() => assertFinalizedTransactionCovenants(builder, builder.buildLibauthTransaction(true)))
      .toThrow('BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.');
  });
});
