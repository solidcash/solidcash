import { bigIntToVmNumber } from '@bitauth/libauth';
import { decodePushdataValue, encodePushdataValue, type AbiFunction, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { FunctionArgument } from '../../src/Argument.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { encodeStoredValueSource, type StoredValueIncomingEntry } from '../../src/stateful/sc-encode-stored-element-source.js';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';

const artifact = {
  structs: [{ name: 'Record', fields: [{ name: 'amount', type: 'int256' }, { name: 'payload', type: 'bytes' }] }],
  stateLayout: { collections: [{ name: 'records', signature: 'records:mapping(int256 => Record)',
    kind: 'mapping', keyType: 'int256', valueType: 'Record' }], variables: [] },
} as unknown as Artifact;
const handler: AbiFunction = {
  name: 'update', inputs: [{ name: 'key', type: 'int256' }, { name: 'amount', type: 'int256' }],
  entryAccesses: [{ collection: 'records', keyParams: ['key'], operations: ['read', 'write'],
    mutationEffectOrdinals: [1], storedValueSource: {
      version: 1, execution: 'unconditional-once', valueType: 'Record', mutationEffectOrdinal: 1,
      expression: { kind: 'call', name: 'Record', type: 'Record', args: [
        { kind: 'source', type: 'int256', source: { kind: 'forward', paramIndex: 1 } },
        { kind: 'field', name: 'payload', type: 'bytes', expression: {
          kind: 'entryPreValue', name: 'records', type: 'Record',
          args: [{ kind: 'source', type: 'int256', source: { kind: 'forward', paramIndex: 0 } }],
        } },
      ] },
    } }],
};
const payload = new Uint8Array(180).fill(0x56);
const incoming: StoredValueIncomingEntry = {
  collection: artifact.stateLayout!.collections![0].signature,
  slot: keyToSlotMulti([bigIntToVmNumber(7n)], artifact.stateLayout!.collections![0]),
  value: encodePushdataValue({ amount: 5n, payload }, 'Record', artifact.structs),
};
const host = {
  evaluateExternalExpression: (...args: Parameters<typeof evaluateExternalExpression> extends [unknown, ...infer Rest]
    ? Rest : never): FunctionArgument | undefined => evaluateExternalExpression({
    resolveExternalArgs: (sources, values) => sources?.map((source) => values[source.paramIndex!]),
  }, ...args),
};
const encode = (entries?: readonly StoredValueIncomingEntry[], key = 7n): Uint8Array | undefined => encodeStoredValueSource(
  host, handler.entryAccesses![0], 'Record', [key, 23n], handler, artifact,
  { records: { 7: { amount: 999n, payload: new Uint8Array() } } }, undefined, entries,
);

describe('stored incoming-entry recipes', () => {
  it('uses exact incoming collection/key bytes, not a pending state overlay', () => {
    expect(decodePushdataValue(encode([incoming])!, 0, 'Record', artifact.structs).value)
      .toEqual({ amount: 23n, payload });
  });
  it('refuses absent, wrong-key, wrong-collection, and malformed pre-values', () => {
    expect(encode()).toBeUndefined();
    expect(encode([incoming], 8n)).toBeUndefined();
    expect(encode([{ ...incoming, collection: 'other:mapping(int => Record)' }])).toBeUndefined();
    expect(encode([{ ...incoming, value: new Uint8Array([...incoming.value, 0]) }])).toBeUndefined();
    expect(() => encode([incoming, incoming])).toThrow(/duplicate entries/);
  });
  it('does not let the general scalar evaluator resolve an incoming-entry recipe', () => {
    const expression = handler.entryAccesses![0].storedValueSource!.expression.args![1].expression!;
    expect(host.evaluateExternalExpression(expression, [7n, 23n], artifact,
      { records: { 7: { amount: 5n, payload } } }, handler.inputs)).toBeUndefined();
  });
});
