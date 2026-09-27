import { hexToBin } from '@bitauth/libauth';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';

const artifact = {
  compiler: { options: { solidityImportCompat: true } },
  structs: [
    { name: 'Party', fields: [{ name: 'recipient', type: 'address' }, { name: 'fee', type: 'uint16' },
      { name: 'raw', type: 'bytes32' }] },
    { name: 'Record', fields: [{ name: 'party', type: 'Party' }] },
  ],
} as Artifact;
const base: ExternalCallExpression = { kind: 'stateAccess', name: 'records', type: 'Record',
  args: [{ kind: 'literal', type: 'bigint', value: '0' }] };
const party: ExternalCallExpression = { kind: 'field', name: 'party', expression: base };

describe('external expression struct field encoding', () => {
  it('keeps bytes fields intact even when they resemble padded addresses', () => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: [''], args: [{ kind: 'field', name: 'raw', expression: party }],
    };
    const raw = hexToBin('00'.repeat(12) + 'ab'.repeat(20));
    const result = evaluateExternalExpression({ resolveExternalArgs: () => undefined }, expression,
      [], artifact, { records: [{ party: { raw } }] });
    expect(result).toEqual(raw);
  });

  it('narrows a projected ABI address word without preserving its padding', () => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: [''], args: [{ kind: 'field', name: 'recipient', expression: party }],
    };
    const result = evaluateExternalExpression({ resolveExternalArgs: () => undefined }, expression,
      [], artifact, { records: [{ party: { recipient: hexToBin('00'.repeat(12) + 'ab'.repeat(20)) } }] });
    expect(result).toEqual(hexToBin('ab'.repeat(20)));
  });

  it.each(['recipient', 'fee'] as const)('recovers the declared packed width of nested %s fields', (name) => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: [''], args: [{ kind: 'field', name, expression: party }],
    };
    const address = hexToBin(`76a914${'ab'.repeat(20)}88ac`);
    const result = evaluateExternalExpression({ resolveExternalArgs: () => undefined }, expression,
      [], artifact, { records: [{ party: { recipient: address, fee: 258n } }] });
    expect(result).toEqual(name === 'recipient' ? hexToBin('ab'.repeat(20)) : hexToBin('0102'));
  });
});
