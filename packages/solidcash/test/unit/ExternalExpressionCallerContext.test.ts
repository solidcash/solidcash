import type { ArgSource, Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';
import { resolveExternalArgs, type ResolveExternalArgsHost } from '../../src/stateful/sc-resolve-external-args.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';

describe('external expression incoming caller context', () => {
  const artifact = { abi: [], constructorInputs: [] } as unknown as Artifact;
  const signer = new Signer(new Uint8Array(32).fill(0x70), createTestProvider());
  const host: ResolveExternalArgsHost = {
    inner: { encodedConstructorArgs: [], lockingBytecode: '51' },
    signer,
    evaluateExternalExpression: (...args) => evaluateExternalExpression({
      resolveExternalArgs: (...nested) => resolveExternalArgs(host, ...nested),
    }, ...args),
  };
  const sources: ArgSource[] = [
    { kind: 'msgSender' },
    { kind: 'selfAddress' },
    { kind: 'expression', expression: {
      kind: 'call', parameters: [], args: [], statements: [
        { kind: 'variable', name: 'sender', type: 'address', expression: {
          kind: 'source', source: { kind: 'msgSender' }, type: 'address',
        } },
        { kind: 'return', expression: { kind: 'identifier', name: 'sender', type: 'address' } },
      ],
    } },
  ];

  it('keeps the incoming caller distinct from self and isolated between invocation frames', () => {
    const self = Uint8Array.of(0x51);
    for (const caller of [Uint8Array.of(0x52), Uint8Array.of(0x53), Uint8Array.of(0x52)]) {
      expect(resolveExternalArgs(host, sources, [], artifact, {}, [], undefined, 0, false, self, caller))
        .toEqual([caller, self, caller]);
    }
  });

  it('retains the signer for direct calls with no incoming contract frame', () => {
    const sender = addressToLockScript(signer.getAddress());
    expect(resolveExternalArgs(host, sources, [], artifact)).toEqual([sender, Uint8Array.of(0x51), sender]);
  });

  it('can resolve a contract caller without a signer', () => {
    const caller = Uint8Array.of(0x52);
    expect(resolveExternalArgs({ ...host, signer: undefined }, [{ kind: 'msgSender' }], [], artifact,
      undefined, undefined, undefined, 0, false, undefined, caller)).toEqual([caller]);
    expect(resolveExternalArgs({ ...host, signer: undefined }, [{ kind: 'msgSender' }], [], artifact)).toBeUndefined();
  });
});
