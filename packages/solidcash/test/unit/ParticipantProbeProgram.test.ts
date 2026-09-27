import { bigIntToVmNumber } from '@bitauth/libauth';
import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { buildParticipantProbeProgram } from '../../src/stateful/participant-probe-program.js';

function fixture(anchor: bigint, parameterName = '__internal__graphSelfIdentityInput'): {
  builder: TransactionBuilder;
  unlocker: ContractUnlocker;
  localGenerator: ReturnType<typeof vi.fn>;
  routeFactory: ReturnType<typeof vi.fn>;
} {
  const localGenerator = vi.fn((...params: FunctionArgument[]) => ({
    generateUnlockingBytecode: () => bigIntToVmNumber(params[0] as bigint),
  }));
  const routeFactory = vi.fn(() => localGenerator);
  const unlocker = {
    contract: { createCompilerRouteUnlocker: routeFactory },
    abiFunction: { name: '__message_bus', selector: '53434231', inputs: [
      { name: parameterName, type: 'bigint' },
      { name: 'unchanged', type: 'bigint' },
    ] },
    params: [anchor, 101n],
  } as unknown as ContractUnlocker;
  const builder = {
    inputs: [{ unlocker }],
    buildLibauthProgram: () => ({
      inputIndex: 0,
      sourceOutputs: Array.from({ length: 3 }, () => ({ lockingBytecode: new Uint8Array() })),
      transaction: { inputs: [{ unlockingBytecode: bigIntToVmNumber(anchor) }] },
    }),
  } as unknown as TransactionBuilder;
  return { builder, unlocker, localGenerator, routeFactory };
}

describe('participant probe input coordinates', () => {
  it('rebases only the generated probe, preserving shared final witnesses and other arguments', () => {
    const { builder, unlocker, localGenerator } = fixture(42n);
    const program = buildParticipantProbeProgram(builder, 40);
    expect(program.transaction.inputs[0].unlockingBytecode).toEqual(bigIntToVmNumber(2n));
    expect(localGenerator).toHaveBeenCalledWith(2n, 101n);
    expect(unlocker.params).toEqual([42n, 101n]);
    expect(builder.buildLibauthProgram().transaction.inputs[0].unlockingBytecode)
      .toEqual(bigIntToVmNumber(42n));
  });

  it.each([{ anchor: -1n, base: 40 }, { anchor: 2n, base: 0 }])(
    'preserves sentinel/root coordinates ($anchor at base $base)', ({ anchor, base }) => {
      const { builder, routeFactory } = fixture(anchor);
      expect(buildParticipantProbeProgram(builder, base).transaction.inputs[0].unlockingBytecode)
        .toEqual(bigIntToVmNumber(anchor));
      expect(routeFactory).not.toHaveBeenCalled();
    },
  );

  it.each([39n, 43n])('rejects an anchor outside this participant: %s', (anchor) => {
    const { builder, unlocker, routeFactory } = fixture(anchor);
    expect(() => buildParticipantProbeProgram(builder, 40)).toThrow(/outside its local probe/);
    expect(routeFactory).not.toHaveBeenCalled();
    expect(unlocker.params[0]).toBe(anchor);
  });

  it('does not leave local parameters behind when probe encoding throws', () => {
    const { builder, unlocker, localGenerator } = fixture(42n);
    localGenerator.mockImplementation(() => { throw new Error('encoding rejected'); });
    expect(() => buildParticipantProbeProgram(builder, 40)).toThrow('encoding rejected');
    expect(unlocker.params).toEqual([42n, 101n]);
  });

  it.each([
    { absolute: 42n, base: 40, local: 2n },
    // An absolute index can fit in the local frame by coincidence; size is not a coordinate-space tag.
    { absolute: 2n, base: 1, local: 1n },
    { absolute: -45n, base: 40, local: -5n },
    { absolute: -5n, base: 1, local: -4n },
  ])('rebases dynamic storage $absolute at base $base to $local', ({ absolute, base, local }) => {
    const { builder, unlocker, localGenerator } = fixture(absolute, '__internal__dynamicChunkInputBase');
    expect(buildParticipantProbeProgram(builder, base).transaction.inputs[0].unlockingBytecode)
      .toEqual(bigIntToVmNumber(local));
    expect(localGenerator).toHaveBeenCalledWith(local, 101n);
    expect(unlocker.params).toEqual([absolute, 101n]);
  });

  it.each([-1n, -2n])('preserves the dynamic-storage sentinel %s', (sentinel) => {
    const { builder, routeFactory } = fixture(sentinel, '__internal__dynamicChunkInputBase');
    expect(buildParticipantProbeProgram(builder, 40).transaction.inputs[0].unlockingBytecode)
      .toEqual(bigIntToVmNumber(sentinel));
    expect(routeFactory).not.toHaveBeenCalled();
  });

  it('rebases identity and dynamic storage together without changing the published frame', () => {
    const { builder, unlocker, localGenerator, routeFactory } = fixture(42n);
    unlocker.abiFunction.inputs[1].name = '__internal__dynamicChunkInputBase';
    unlocker.params[1] = -44n;
    buildParticipantProbeProgram(builder, 40);
    expect(localGenerator).toHaveBeenCalledWith(2n, -4n);
    expect(routeFactory).toHaveBeenCalledTimes(1);
    expect(unlocker.params).toEqual([42n, -44n]);
  });

  it.each([39n, 43n, -42n, -46n])('rejects dynamic storage outside the participant: %s', (absolute) => {
    const { builder, unlocker, routeFactory } = fixture(absolute, '__internal__dynamicChunkInputBase');
    expect(() => buildParticipantProbeProgram(builder, 40)).toThrow(/outside its local probe/);
    expect(routeFactory).not.toHaveBeenCalled();
    expect(unlocker.params[0]).toBe(absolute);
  });
});
