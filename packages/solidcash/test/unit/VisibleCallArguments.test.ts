import { describe, expect, it } from 'vitest';
import { selectVisibleCallArguments } from '../../src/stateful/StatefulContract.js';

describe('selectVisibleCallArguments', () => {
  const visibleInputs = [
    { name: 'recordId', type: 'int' },
    { name: 'record', type: 'Record' },
  ];

  it('selects matching source-level arguments independently of handler naming', () => {
    const logical = [7n, { active: true }];
    const routed = [new Uint8Array([1]), 99n, 100n];
    const renamedInputs = [
      { name: 'auditKey', type: 'int' },
      { name: 'payload', type: 'Record' },
    ];

    expect(selectVisibleCallArguments(visibleInputs, logical, routed)).toBe(logical);
    expect(selectVisibleCallArguments(renamedInputs, logical, routed)).toBe(logical);
  });

  it('falls back when the source-level argument count does not match', () => {
    const incomplete = [7n];
    const routed = [new Uint8Array([1]), 99n, 100n];

    expect(selectVisibleCallArguments(visibleInputs, incomplete, routed)).toBe(routed);
  });

  it('excludes compiler-owned ABI inputs from the visible arity', () => {
    const inputs = [
      visibleInputs[0],
      { name: '__internal__valueChunkOutputBase', type: 'int' },
      visibleInputs[1],
      { name: '__internal__returnOutputIdx', type: 'int' },
    ];
    const logical = [7n, { active: true }];

    expect(selectVisibleCallArguments(inputs, logical, [0n, 0n, 0n, 0n])).toBe(logical);
  });

  it('preserves direct-call arguments when no source-level projection exists', () => {
    const direct = [11n, { active: false }];

    expect(selectVisibleCallArguments(visibleInputs, undefined, direct)).toBe(direct);
  });
});
