import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { encodeMessageBatch } from '../../src/message-bus/message-bus.js';

const artifact = compileString(`contract Counter() {
  int counter;
  function add(int amount) public { this.counter = this.counter + amount; require(true); }
  function clear() public { this.counter = 0; require(true); }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!.selector;
const clear = artifact.messageBus!.handlers.find((handler) => handler.name === 'clear')!.selector;
const bounded = (pooledSelectors?: string[]): Artifact => ({
  ...artifact,
  messageBus: {
    ...artifact.messageBus!,
    fixedChunkableWritePolicy: { version: 1 as const, maximumRows: 1 as const, selectors: [add, clear], pooledSelectors },
  },
});

describe('pooled chunkable-write encoding policy', () => {
  it('exempts only proven pooled selectors from the remaining aggregate bound', () => {
    expect(() => encodeMessageBatch(bounded([add]), [
      { function: 'add', args: [1n] }, { function: 'clear' }, { function: 'add', args: [2n] },
    ])).not.toThrow();
    expect(() => encodeMessageBatch(bounded([add]), [
      { function: 'clear' }, { function: 'add', args: [1n] }, { function: 'clear' },
    ])).toThrow(/selects 2 direct chunkable-write rows/);
    expect(() => encodeMessageBatch(bounded(), [
      { function: 'add', args: [1n] }, { function: 'add', args: [2n] },
    ])).toThrow(/selects 2 direct chunkable-write rows/);
  });

  it.each([[add, add], ['ffffffff'], ['invalid']])('rejects malformed pooled selector subsets: %j', (...selectors) => {
    expect(() => encodeMessageBatch(bounded(selectors), [{ function: 'add', args: [1n] }]))
      .toThrow(expect.objectContaining({ code: 'L3_PROTOCOL_METADATA_MALFORMED' }));
  });
});
