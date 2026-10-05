import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertFinalizedTransactionCovenants, shouldCapturePreflightDiagnosticInput, snapshotPreflightDiagnosticState,
} from '../../src/message-bus/preflight.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

describe('preflight failure diagnostics', () => {
  it('retains an instruction pre-state when the VM reuses its state and stack items', () => {
    const state = { ip: 3, stack: [Uint8Array.of(1, 2), Uint8Array.of(3)] };
    const snapshot = snapshotPreflightDiagnosticState(state);

    state.ip = 4;
    state.stack[0][0] = 9;
    state.stack.pop();

    expect(snapshot.ip).toBe(3);
    expect(snapshot.stack).toEqual([Uint8Array.of(1, 2), Uint8Array.of(3)]);
  });
});

describe('preflight diagnostic input selection', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('records only the requested input, including input zero', () => {
    expect(shouldCapturePreflightDiagnosticInput(121, 121)).toBe(true);
    expect(shouldCapturePreflightDiagnosticInput(120, 121)).toBe(false);
    expect(shouldCapturePreflightDiagnosticInput(0, 0)).toBe(true);
    expect(shouldCapturePreflightDiagnosticInput(1, 0)).toBe(false);
  });

  it('records all inputs only when no selector was provided', () => {
    expect(shouldCapturePreflightDiagnosticInput(121)).toBe(true);
    expect(shouldCapturePreflightDiagnosticInput(0, Number.NaN)).toBe(false);
    expect(shouldCapturePreflightDiagnosticInput(0, -1)).toBe(false);
  });

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
      .toThrow('messageBus: BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.');
  });
});
