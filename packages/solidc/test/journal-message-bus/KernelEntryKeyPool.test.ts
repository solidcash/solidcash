import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const SOURCE = `contract Ledger() {
  mapping(int => int) balances;
  function move(int from, int to, int amount) public {
    require(this.balances[from] >= amount);
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
    require(true);
  }
}`;

describe('kernel physical entry key pool', () => {
  it('publishes every physical key lane independently of the requested row bound', () => {
    const artifacts = [2, 7].map((maximumRows) => compileString(SOURCE, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      __messageBusMaximumRows: maximumRows, suppressWarnings: true,
    }));
    for (const artifact of artifacts) {
      const capability = artifact.messageBus!;
      expect(capability.convention).toBe('kernel-row-loop');
      const handler = capability.handlers.find((candidate) => candidate.name === 'move')!;
      const pool = handler.batchKeyWitnesses!.find((binding) => binding.keyPool)!.keyPool!;
      expect(pool).toHaveLength(8);
      expect(capability.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
      const slots = pool.map((lane) => capability.route.entryAccesses!
        .find((entry) => entry.keyParams.length === 1 && entry.keyParams[0] === lane)!.slotIndex);
      expect(handler.physicalEntrySlotAlternatives).toContainEqual(slots);
      expect(capability.route.sortedBatchInfo?.[0].slotIndices).toHaveLength(9);
    }
    expect(artifacts[0].messageBus!.route.blockLayout).toEqual(artifacts[1].messageBus!.route.blockLayout);
    expect(artifacts[0].messageBus!.route.entryAccesses).toEqual(artifacts[1].messageBus!.route.entryAccesses);
    expect(artifacts[0].functionBodies!['53434231'].length)
      .toBe(artifacts[1].functionBodies!['53434231'].length);
  });
});
