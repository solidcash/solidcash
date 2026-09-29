import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { materializeInternalFunctionArgument } from '../../src/stateful/StatefulContract.js';
import { sortedLoopSurplusFunderCount } from '../../src/stateful/sc-allocate-create-builder-funders-accounting.js';
import { materializeCreateBuilderSyntheticArgs } from '../../src/stateful/sc-materialize-create-builder-synthetic-args.js';
import { orderPostBlockTrailingAndReadInputs } from '../../src/stateful/stb-build-inputs.js';

describe('stateful return argument materialization', () => {
  it('replaces a provisional return index without shifting later internal witnesses', () => {
    const inputs = [
      { name: 'value', type: 'int' },
      { name: '__internal__returnOutputIdx', type: 'int' },
      { name: '__internal__proof', type: 'bytes' },
    ];
    const proof = Uint8Array.of(1, 2, 3);
    expect(materializeInternalFunctionArgument(
      [7n, -1n, proof], inputs, '__internal__returnOutputIdx', 6n,
    )).toEqual([7n, 6n, proof]);
  });

  it('fills preceding internal slots but refuses to cross a missing visible argument', () => {
    expect(materializeInternalFunctionArgument(
      [7n],
      [
        { name: 'value', type: 'int' },
        { name: '__internal__proof', type: 'bytes' },
        { name: '__internal__returnOutputIdx', type: 'int' },
      ],
      '__internal__returnOutputIdx',
      6n,
    )).toEqual([7n, new Uint8Array(), 6n]);
    expect(() => materializeInternalFunctionArgument(
      [],
      [{ name: 'value', type: 'int' }, { name: '__internal__returnOutputIdx', type: 'int' }],
      '__internal__returnOutputIdx',
      6n,
    )).toThrow(/missing visible ABI argument 'value'/);
  });

  it('keeps later probe witnesses aligned when inserting a sender-anchor sentinel', () => {
    const inputs = [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: '__internal__msgSenderCategory', type: 'bytes32' },
      { name: '__internal__msgSenderAnchorIdx', type: 'bigint' },
      { name: '__internal__vmapBatchSlot_0', type: 'bytes32' },
      { name: '__internal__returnOutputIdx', type: 'bigint' },
    ];
    const category = new Uint8Array(32).fill(1);
    const slot = new Uint8Array(32).fill(2);
    expect(materializeInternalFunctionArgument(
      [new Uint8Array(20), 5n, category, 0n, slot, 9n],
      inputs,
      '__internal__msgSenderAnchorIdx',
      -1n,
    )).toEqual([new Uint8Array(20), 5n, category, -1n, slot, 9n]);
  });

  it('balances a direct sorted-loop output before a return probe caller band', () => {
    expect(sortedLoopSurplusFunderCount(1, 0, false)).toBe(1);
    expect(sortedLoopSurplusFunderCount(2, 1, false)).toBe(1);
    expect(sortedLoopSurplusFunderCount(1, 0, true)).toBe(0);
    expect(orderPostBlockTrailingAndReadInputs(['new-entry-pad'], ['caller-identity']))
      .toEqual(['new-entry-pad', 'caller-identity']);
  });

  it('fills internal holes before a later resolved value witness without replacing that witness', () => {
    const complete = Uint8Array.of(1, 2, 3);
    const sparse = [7n] as unknown[];
    sparse[3] = complete;
    const abiFunction = {
      name: 'seed',
      inputs: [
        { name: 'key', type: 'int' },
        { name: '__internal__leadingPushValue_2', type: 'bytes' },
        { name: '__internal__valueChunkOutputBase', type: 'bigint' },
        { name: '__internal__completePushValue_2', type: 'bytes' },
      ],
    } as AbiFunction;
    const { finalArgs } = materializeCreateBuilderSyntheticArgs(
      { selectActiveRootDelegateGroup: () => undefined },
      {
        abiFunction,
        finalArgs: sparse as Parameters<typeof materializeCreateBuilderSyntheticArgs>[1]['finalArgs'],
        activeDelegateGroupIndex: undefined,
        lowLevelCallUtxoGroups: [],
        lowLevelCallInputBase: 0,
        overrides: undefined,
        returnEmitOutputIndex: -1,
        functionName: 'seed',
        requiredNftIndices: [],
        externalReadUtxos: [],
        outStateInputCount: 0,
        iterationEntryInputs: [],
      },
    );
    expect(finalArgs).toEqual([7n, new Uint8Array(), 0n, complete]);
  });
});
