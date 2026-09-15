import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { selectReturnAbiPlan } from '../../src/stateful/StatefulContract.js';

const abi = (
  name: string,
  outputType?: string,
  returnOffset?: number,
): AbiFunction => ({
  name,
  inputs: [],
  ...(outputType && { outputs: [{ name: '', type: outputType }] }),
  ...(returnOffset !== undefined && {
    blockLayout: {
      blockSize: returnOffset + 1,
      slots: [{ kind: 'returnEvent', offset: returnOffset }],
    },
  }),
});

describe('compiler route return identity', () => {
  it('uses the selected row for logical schema and the route for physical layout', () => {
    const route = abi('__route', 'bytes', 19);
    const handler = abi('readValue', 'uint256', 4);
    const decoy = abi('writeValue');
    const rowContext = { artifact: 'callee', args: [41n] };

    const plan = selectReturnAbiPlan('facadeRead', abi('facadeRead'), [
      { logicalFunction: decoy, physicalFunction: route, context: { artifact: 'callee', args: [0n] } },
      { logicalFunction: handler, physicalFunction: route, context: rowContext },
    ]);

    expect(plan?.logicalFunction).toBe(handler);
    expect(plan?.physicalFunction).toBe(route);
    expect(plan?.context).toBe(rowContext);
    expect(plan?.logicalFunction.blockLayout?.slots[0]?.offset).toBe(4);
    expect(plan?.physicalFunction.blockLayout?.slots[0]?.offset).toBe(19);
  });

  it('refuses an aggregate route with more than one logical result', () => {
    const route = abi('__route', 'bytes', 19);
    expect(() => selectReturnAbiPlan('facadeRead', abi('facadeRead'), [
      { logicalFunction: abi('readFirst', 'uint256', 4), physicalFunction: route, context: 1 },
      { logicalFunction: abi('readSecond', 'bool', 7), physicalFunction: route, context: 2 },
    ])).toThrow(/selects 2 logical return rows.*no single return value/);
  });
});
