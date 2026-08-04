import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { messageBus } from '../../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract MessageBatchEncoding() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function clear() public { this.counter = 0; require(true); }
}`;

const RETURN_SOURCE = `pragma solidcash >=0.8.0;
contract MessageBusReturningBatch() {
  function twice(int n) public pure returns (int) { return n * 2; }
  function positive(int n) public pure returns (bool) { return n > 0; }
  function pair(int n) public pure returns (int, bool) { return (n + 1, n > 0); }
}`;

const artifact = compileString(SOURCE, {
  forceStateful: true,
  messageBus: true,
});

describe('messageBus.encodeMessageBatch', () => {
  it('encodes real compiler handlers in canonical execution order', () => {
    const encoded = messageBus.encodeMessageBatch(artifact, [
      { function: 'add', args: [2n] },
      { function: 'clear' },
    ]);
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const clear = artifact.messageBus!.handlers.find((handler) => handler.name === 'clear')!;
    const hex = binToHex(encoded.blob);

    expect(encoded.rowCount).toBe(2);
    expect(encoded.routeWitnesses).toEqual([]);
    expect(encoded.results).toEqual([]);
    expect(encoded.rows.map(({ row, function: fn, selectorHex }) => ({ row, fn, selectorHex }))).toEqual([
      { row: 0, fn: 'add', selectorHex: add.selector },
      { row: 1, fn: 'clear', selectorHex: clear.selector },
    ]);
    expect(hex.startsWith(`53434231010002${add.selector}000000000000`)).toBe(true);
    expect(hex).toContain(`${clear.selector}0100000000000000`);
  });

  it('authenticates mixed static and ordinary rows for one participant in message-bus v2 order', () => {
    const encoded = messageBus.encodeMessageBatch(artifact, [
      { function: 'add', args: [2n], callMode: 'staticcall' },
      { function: 'clear', callMode: 'call' },
    ]);
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const clear = artifact.messageBus!.handlers.find((handler) => handler.name === 'clear')!;
    const hex = binToHex(encoded.blob);

    // Header version 2. Each mode byte follows its row's uint16 args length: 01 then 00.
    expect(hex.startsWith(`53434231020002${add.selector}000000000000010001`)).toBe(true);
    expect(hex).toContain(`${clear.selector}010000000000000000`);
  });

  it('carries the compiler-authored result schema for authenticated return-event decoding', () => {
    const returning = compileString(RETURN_SOURCE, {
      forceStateful: true,
      messageBus: true,
    });
    const encoded = messageBus.encodeMessageBatch(returning, [
      { function: 'twice', args: [3n] },
      { function: 'positive', args: [8n] },
      { function: 'pair', args: [4n] },
    ]);
    expect(encoded.results).toEqual([
      { row: 0, types: ['int256'] },
      { row: 1, types: ['bool'] },
      { row: 2, types: ['int256', 'bool'] },
    ]);
    expect(returning.messageBus!.route.outputs).toEqual([{ type: 'bytes' }]);

    const packed = scriptToBytecode([
      bigIntToVmNumber(6n), Uint8Array.of(1), bigIntToVmNumber(5n), Uint8Array.of(1),
    ]);
    const commitment = scriptToBytecode([packed]);
    expect(messageBus.decodeMessageBusResults(returning, encoded, commitment)).toEqual([
      { row: 0, type: 'int256', value: 6n },
      { row: 1, type: 'bool', value: true },
      { row: 2, type: '(int256,bool)', value: [5n, true] },
    ]);
    expect(() => messageBus.decodeMessageBusResults(
      returning, encoded, scriptToBytecode([Uint8Array.from([...packed, 0])]),
    )).toThrow(/unchecked suffix/);
  });

  it('rejects non-advertised, ineligible, and malformed invocation plans', () => {
    expect(() => messageBus.encodeMessageBatch(
      compileString(
        'pragma solidcash >=0.8.0; contract Plain() { function f() { require(true); } }',
        { messageBus: false },
      ),
      [{ function: 'f' }],
    )).toThrow(/does not advertise/);
    expect(() => messageBus.encodeMessageBatch(artifact, [])).toThrow(/row count/);
    expect(() => messageBus.encodeMessageBatch(artifact, [{ function: 'missing' }])).toThrow(/Unknown/);
    expect(() => messageBus.encodeMessageBatch(artifact, [{ function: 'add' }])).toThrow(/number of arguments/);

    const unsupported = {
      ...artifact,
      messageBus: { ...artifact.messageBus!, version: 2 },
    } as unknown as typeof artifact;
    expect(() => messageBus.encodeMessageBatch(unsupported, [{ function: 'clear' }])).toThrow(
      expect.objectContaining({
        code: 'L3_PROTOCOL_VERSION_UNSUPPORTED',
        context: expect.objectContaining({
          metadataField: 'messageBus.version', actual: 2, expected: 1,
          ownerIdentity: 'MessageBatchEncoding',
        }),
      }),
    );

    const malformed = {
      ...artifact,
      messageBus: { ...artifact.messageBus!, selector: '00000000' },
    } as unknown as typeof artifact;
    expect(() => messageBus.encodeMessageBatch(malformed, [{ function: 'clear' }])).toThrow(
      expect.objectContaining({
        code: 'L3_PROTOCOL_METADATA_MALFORMED',
        context: expect.objectContaining({ metadataField: 'messageBus' }),
      }),
    );
  });
});
