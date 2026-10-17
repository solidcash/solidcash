import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const OPTIONS = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true, optimizeForCompilationSpeed: true,
} as const;

const store = (guard: string): string => `pragma solidity ^0.8.20;
  contract Store {
    mapping(uint => bytes) public records;
    mapping(uint => bytes) public other;
    uint public limit;
    function update(uint key) public {
      require(msg.sender != address(0));
      if (${guard}) { this.records[key] = this.records[key] + hex"21"; }
    }
  }`;

describe('kernel admission of a chunkable write guarded by its own entry read', () => {
  it('batches the write: the route replays the one entry read its guard depends on', () => {
    const artifact = compileString(store('this.records[key].length > 1'), OPTIONS);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'update');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.fixedChunkableWritePolicy?.selectors).toContain(handler?.selector);
    // The guard is no argument predicate, so no activation is invented for the SDK.
    const records = (artifact.abi.find((candidate) => candidate.name === 'update')?.entryAccesses ?? [])
      .filter((access) => access.collection === 'records');
    expect(records.some((access) => access.operations.includes('write'))).toBe(true);
    expect(records.every((access) => access.activation === undefined)).toBe(true);
  });

  it.each([
    ['another entry', 'this.other[key].length > 1'],
    ['a state variable', 'this.records[key].length > this.limit'],
    ['its entry and another entry', 'this.records[key].length > 1 && this.other[key].length > 1'],
  ])('keeps a write guarded by %s refused', (_label, guard) => {
    const artifact = compileString(store(guard), OPTIONS);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'update'))
      .toMatchObject({ eligible: false });
  });
});
