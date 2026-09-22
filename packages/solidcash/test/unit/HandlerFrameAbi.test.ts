import { describe, expect, it } from 'vitest';
import {
  buildHandlerFrameSchema,
  validateHandlerFrame,
} from '../../src/message-bus/handler-frame-abi.js';

describe('handler frame ABI (item 3)', () => {
  it('accepts a representative DEFINE frame with balanced effects', () => {
    const schema = buildHandlerFrameSchema({
      handlerId: 'h-set',
      handlerName: 'set',
      arguments: ['key', 'value'],
      routeContext: ['batchBlob', 'owner'],
      journals: ['journalCursor'],
      cursors: ['entryCursor'],
      results: ['returnSlot'],
    });
    const result = validateHandlerFrame(schema, [
      { helperId: 'read-key', reads: ['key'] },
      { helperId: 'write-journal', reads: ['journalCursor'], writes: ['journalCursor'] },
      {
        helperId: 'temp-work',
        anonymousPushes: 1,
        anonymousPops: 1,
        altStackDelta: 1,
      },
      { helperId: 'drop-alt', altStackDelta: -1 },
      { helperId: 'settle-result', writes: ['returnSlot'] },
    ]);
    expect(result.ok).toBe(true);
    expect(result.anonymousLive).toBe(0);
    expect(result.altStackDepth).toBe(0);
  });

  it('rejects live anonymous cells (top/bottom bookkeeping drift)', () => {
    const schema = buildHandlerFrameSchema({
      handlerId: 'h-bad',
      arguments: ['x'],
      routeContext: [],
    });
    const result = validateHandlerFrame(schema, [
      { helperId: 'leak', anonymousPushes: 2, anonymousPops: 0 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.invariantId === 'live-anonymous-at-settlement')).toBe(true);
  });

  it('rejects unknown slot reads and alt-stack imbalance', () => {
    const schema = buildHandlerFrameSchema({
      handlerId: 'h-unk',
      arguments: ['x'],
    });
    const result = validateHandlerFrame(schema, [
      { helperId: 'bad-read', reads: ['notInFrame'] },
      { helperId: 'alt-leak', altStackDelta: 1 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.invariantId === 'unknown-frame-read')).toBe(true);
    expect(result.failures.some((f) => f.invariantId === 'alt-stack-imbalance')).toBe(true);
  });
});
