import { describe, expect, it } from 'vitest';
import { snapshotPreflightDiagnosticState } from '../../src/message-bus/preflight.js';

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
