import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';
import type { CompilerOptions } from '../../src/compiler.js';

describe('tuple assignment transfer footprints', () => {
  it('walks every expression in a synthetic unnamed result tuple', () => {
    const attemptFailureBox = { failures: [] as unknown[] };
    const artifact = compileString(`contract RecursivePair() {
      int calls;
      function pair(int value) public returns (int, bool) {
        this.calls = this.calls + 1;
        if (value == 0) return (this.calls, true);
        return pair(value - 1);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: attemptFailureBox,
      __strictNoInternalRecovery: true,
    } as CompilerOptions);

    expect(attemptFailureBox.failures).toEqual([]);
    expect(artifact.abi.find((fn) => fn.name === 'pair')?.outputs)
      .toEqual([{ type: 'int256' }, { type: 'bool' }]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });

  it('indexes a later value transfer after a tuple-literal assignment', () => {
    const attemptFailureBox = { failures: [] as unknown[] };
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract TupleThenTransfer() {
        function pay(address payable recipient, uint amount) public {
          (bool enabled, bool stopped) = (true, false);
          (bool sent, bytes memory result) = recipient.call{value: amount}("");
          require(enabled && !stopped && sent && result.length == 0);
        }
      }
    `, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: attemptFailureBox,
      __strictNoInternalRecovery: true,
    } as CompilerOptions);

    expect(attemptFailureBox.failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
