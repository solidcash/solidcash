import { describe, expect, it } from 'vitest';
import { compileString, CompilerOptions } from '../../src/compiler.js';

describe('kernel interface compliance after frame lowering', () => {
  it('keeps compiler-authenticated witness operands outside the source interface signature', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface IRecorder { function record(bytes calldata value) external; }
      contract Recorder is IRecorder {
        bytes payload;
        function record(bytes calldata value) external override {
          payload = value;
          require(value.length >= 0);
        }
      }
    `, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: { failures },
      __strictNoInternalRecovery: true,
    } as CompilerOptions);

    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'record'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
