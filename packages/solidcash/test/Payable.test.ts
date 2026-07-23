import { describe, expect, it } from 'vitest';
import { StatefulFunctionCall } from '../src/stateful/StatefulContract.js';

const call = (modifiers?: string[]): StatefulFunctionCall => new StatefulFunctionCall(
  Promise.resolve({} as never),
  { inner: { artifact: { abi: [{ name: 'deposit', inputs: [], outputs: [], modifiers }] } } } as never,
  'deposit',
  [],
);

describe('payable function call boundary', () => {
  it('accepts positive value only for payable functions', () => {
    expect(() => call(['payable']).withValue(1n)).not.toThrow();
    expect(() => call().withValue(1n)).toThrow(/non-payable function 'deposit'/);
  });

  it('accepts zero on non-payable functions and rejects negative value', () => {
    expect(() => call().withValue(0n)).not.toThrow();
    expect(() => call(['payable']).withValue(-1n)).toThrow(/cannot be negative/);
  });
});
