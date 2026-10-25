import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { buildSharedMethodExternalBatch } from '../../src/stateful/sc-build-shared-method-external-batch.js';

const address = (byte: string) => Uint8Array.from({ length: 20 }, () => Number.parseInt(byte, 16));

const tokenArtifact = (eligible = true): any => ({
  contractName: 'TestERC20',
  abi: [
    {
      name: 'transferFrom',
      selector: '23b872dd',
      inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
      outputs: [{ type: 'bool' }],
    },
    {
      name: 'balanceOf',
      selector: '70a08231',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
  ],
  messageBus: {
    version: 1,
    selector: '53434231',
    handlers: [
      {
        name: 'transferFrom', selector: '23b872dd', eligible,
        inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
        outputs: [{ type: 'bool' }],
      },
      {
        name: 'balanceOf', selector: '70a08231', eligible,
        inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }],
      },
    ],
    route: { inputs: [], blockLayout: { slots: [] } },
  },
});

const group = (functionName: string, functionArgs: any[]): any => ({
  functionName,
  functionArgs,
  externalContract: { inner: { artifact: tokenArtifact() } },
});

const caller = {
  artifact: { contractName: 'UniswapV2Router02', abi: [], compiler: { options: { evmCompat: true } } } as any,
  inputs: [],
};

const run = (shared: any, next: any, artifact: any) => {
  let captured: any[] | undefined;
  const sentinel = { abiFunction: { name: '__message_bus1' } } as any;
  const route = buildSharedMethodExternalBatch(
    { buildRepeatedExternalBatch: (...args: any[]) => { captured = args; return sentinel; } },
    shared,
    next,
    { inner: { artifact } },
    caller,
  );
  return { route, captured };
};

describe('shared-method message-bus batch', () => {
  it('turns a transferFrom and a balanceOf on the same token into two route rows', () => {
    const shared = group('transferFrom', [address('11'), address('22'), 10n]);
    const next = group('balanceOf', [address('22')]);
    const { route, captured } = run(shared, next, tokenArtifact());
    expect(route).toEqual({ abiFunction: { name: '__message_bus1' } });
    const synthetic = captured![0];
    expect(synthetic.batchInvocations.map((row: any) => row.selector)).toEqual(['23b872dd', '70a08231']);
    expect(synthetic.batchInvocations.map((row: any) => row.logicalIndex)).toEqual([0, 1]);
    expect(synthetic.batchInvocations[0].argSources).toEqual([
      { kind: 'literal', value: binToHex(address('11')), type: 'address' },
      { kind: 'literal', value: binToHex(address('22')), type: 'address' },
      { kind: 'literal', value: '10', type: 'bigint' },
    ]);
    expect(synthetic.batchInvocations[1].argSources)
      .toEqual([{ kind: 'literal', value: binToHex(address('22')), type: 'address' }]);
    // The shared group keeps its physical input, and the route reads the callee's own artifact.
    expect(captured![2].inner.artifact.contractName).toBe('TestERC20');
    expect(captured![5].contractName).toBe('TestERC20');
    expect(captured![6]).toBe(caller.inputs);
  });

  it('refuses a callee without a compatible route or with an ineligible handler', () => {
    const shared = group('transferFrom', [address('11'), address('22'), 10n]);
    const next = group('balanceOf', [address('22')]);
    const noBus = tokenArtifact();
    delete noBus.messageBus;
    expect(run(shared, next, noBus).route).toBeUndefined();
    expect(run(shared, next, tokenArtifact(false)).route).toBeUndefined();
  });

  it('does not batch one method with itself', () => {
    const shared = group('transferFrom', [address('11'), address('22'), 10n]);
    const next = group('transferFrom', [address('22'), address('33'), 1n]);
    expect(run(shared, next, tokenArtifact()).route).toBeUndefined();
  });
});
