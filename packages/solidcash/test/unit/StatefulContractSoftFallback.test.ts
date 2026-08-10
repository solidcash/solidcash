import { describe, expect, it } from 'vitest';
import { StatefulFunctionCall } from '../../src/stateful/StatefulContract.js';

describe('stateful compatibility receipts', () => {
  it('never converts a real-provider rejection into a successful receipt', () => {
    const call = Object.create(StatefulFunctionCall.prototype) as StatefulFunctionCall;
    Object.assign(call as unknown as Record<string, unknown>, {
      functionName: 'convert',
      parentContract: {
        provider: {},
        inner: { artifact: { contractName: 'SushiMaker' } },
      },
    });

    const result = (call as unknown as {
      _softApplyNoopReceipt: (error: unknown) => unknown;
    })._softApplyNoopReceipt(new Error('Program failed an OP_VERIFY operation'));
    expect(result).toBeUndefined();
  });
});
