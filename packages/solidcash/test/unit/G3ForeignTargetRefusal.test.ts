/**
 * G3 residual: planCompiledGraph refuses a foreign targetLockingBytecode that is not an
 * authenticated identity of the callee participant. Full live-compose wrong-lock wedges remain post-beta.
 */
import { describe, expect, it } from 'vitest';
import { planCompiledGraph } from '../../src/message-bus/graph.js';
import { compileString } from '@solidcash/solidc';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  evmCompat: true,
  suppressWarnings: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('G3 foreign target refusal', () => {
  it('refuses a targetLockingBytecode that is not an authenticated callee identity', () => {
    const leaf = compileString(`pragma solidity ^0.8.0;
      contract Leaf { function read() public pure returns (uint256) { return 1; } }`, KERNEL);
    const root = compileString(`pragma solidity ^0.8.0;
      interface LeafApi { function read() external view returns (uint256); }
      contract Root(address leaf) {
        function check() public view returns (uint256) { return LeafApi(leaf).read(); }
      }`, KERNEL);
    const lockRoot = `aa20${'11'.repeat(32)}87`;
    const lockLeaf = `aa20${'22'.repeat(32)}87`;
    const foreign = `aa20${'33'.repeat(32)}87`;
    expect(() => planCompiledGraph(
      [
        { artifact: root, lockingBytecode: lockRoot },
        { artifact: leaf, lockingBytecode: lockLeaf },
      ],
      [
        { parent: null, callee: 0, function: 'check', args: [] },
        {
          parent: 0,
          callee: 1,
          function: 'read',
          args: [],
          targetLockingBytecode: foreign,
          consumerCallsiteId: root.abi.find((entry) => entry.name === 'check')!.externalCalls![0]!.callsiteId!,
        },
      ],
    )).toThrow(/not an authenticated identity|target is not an authenticated/);
  });
});
