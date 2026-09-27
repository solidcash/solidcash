import { bigIntToVmNumber } from '@bitauth/libauth';
import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { buildParticipantProbeProgram } from '../../src/stateful/participant-probe-program.js';

function fixture(anchor: bigint): {
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
      { name: '__internal__graphSelfIdentityInput', type: 'bigint' },
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

describe('participant probe identity coordinates', () => {
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
});
