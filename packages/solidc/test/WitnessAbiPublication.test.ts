import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('compiler-owned witness ABI publication', () => {
  it.each([false, true])('does not invent fold witnesses on a direct writer (message bus: %s)', (messageBus) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Store {
        mapping(uint => string) left;
        mapping(uint => string) right;
        function write(uint key, string memory value) public {
          require(msg.sender != address(0));
          this.left[key] = value;
          if (value.length > 1) { this.right[key] = value; }
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    if (messageBus) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(false);
    }
    const inputs = artifact.abi.find((fn) => fn.name === 'write')!.inputs;
    expect(inputs.some((input) => input.name.startsWith('__internal__leadingPushValue_'))).toBe(true);
    // Complete-value folding is not part of this direct function's generated frame. An ABI-only extra
    // becomes a hidden item below that frame and shifts every bottom-relative caller/entry witness read.
    expect(inputs.some((input) => input.name.startsWith('__internal__completePushValue_'))).toBe(false);
  });
});
