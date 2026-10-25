import { describe, expect, it } from 'vitest';
import { defaultInternalFunctionArg } from '../../src/stateful/kernel-journal-helpers.js';

describe('synthetic function-argument defaults', () => {
  it('encodes an array witness as its empty pushdata form, not a host array', () => {
    // `__internal__loopTargets<n>` is an ABI `address[]` carried pushdata-encoded. An unreachable call still
    // needs a well-formed unlocking push so the covenant's own require can revert.
    expect(defaultInternalFunctionArg({ name: '__internal__loopTargets2', type: 'address[]' }))
      .toEqual(Uint8Array.of(0));
    expect(defaultInternalFunctionArg({ name: '__internal__viewReturn0', type: 'uint256[]' }))
      .toEqual(Uint8Array.of(0));
  });

  it('keeps the scalar defaults callers rely on', () => {
    expect(defaultInternalFunctionArg({ name: '__internal__externalCallSelector0', type: 'bytes4' }))
      .toEqual(new Uint8Array(4));
    expect(defaultInternalFunctionArg({ name: '__internal__externalReturnOutputIdx0', type: 'bigint' }))
      .toBe(-1n);
    expect(defaultInternalFunctionArg({ name: '__internal__graphSelfIdentityInput', type: 'bigint' }))
      .toBe(-1n);
  });
});
