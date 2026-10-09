import { describe, expect, it } from 'vitest';
import { compileString, CompilerOptions } from '../../src/compiler.js';

const SOURCE = `pragma solidity ^0.8.20;
  contract TransferFallback {
    uint count;

    function settle(address payable recipient, uint amount) public {
      bool success = true;
      bytes memory result = "";
      if (amount > 0) {
        (success, result) = recipient.call{value: amount}("");
      }
      require(success && result.length == 0);
      count = count + 1;
      require(count > 0);
    }
  }
`;

describe('empty-calldata raw value transfers', () => {
  for (const [label, messageBusKernel] of [['kernel', true], ['legacy', false]] as const) {
    it(`keeps the transfer effect out of the ${label} selector-bearing call manifest`, () => {
      const failures: unknown[] = [];
      const artifact = compileString(SOURCE, {
        forceStateful: true,
        evmCompat: true,
        messageBus: true,
        messageBusKernel,
        messageBusGraphContext: true,
        maximumInputBytes: 1_000_000,
        optimizeForCompilationSpeed: true,
        suppressWarnings: true,
        __artifactCache: false,
        __attemptFailureBox: { failures },
        __strictNoInternalRecovery: true,
      } as CompilerOptions);

      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'settle');
      expect(failures).toEqual([]);
      expect(artifact.messageBus?.convention).toBe(
        messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll',
      );
      expect(handler).toMatchObject({ eligible: true, transfers: [{ transferIndex: 0 }] });
      expect(artifact.abi.find((candidate) => candidate.name === 'settle')?.externalCalls).toBeUndefined();
      expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
    });
  }
});
