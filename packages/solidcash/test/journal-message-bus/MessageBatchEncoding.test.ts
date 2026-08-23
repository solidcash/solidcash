import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { messageBus } from '../../src/index.js';
import { encodeFunctionArgument } from '../../src/Argument.js';

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

const COMPOSITE_SOURCE = `pragma solidcash >=0.8.0;
contract MessageBusCompositeEncoding() {
  struct Payload { uint8 kind; bytes note; bytes32[] tags; }
  function publish(address target, Payload memory payload) public {
    require(target == address(0) && payload.kind > 0);
  }
}`;

const ROUTED_COLLECTION_SOURCE = `pragma solidity ^0.8.0;
contract RoutedCollectionEncoding() {
  mapping(address => uint) balances;
  mapping(address => mapping(address => uint)) allowances;
  function approve(address spender, address owner, uint amount) public {
    allowances[owner][spender] = amount;
    require(amount >= 0);
  }
  function transferFrom(address from, address to, address spender, uint amount) public {
    allowances[from][spender] = allowances[from][spender] - amount;
    balances[from] = balances[from] - amount;
    balances[to] = balances[to] + amount;
    require(amount >= 0);
  }
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

  it('uses one canonical inline representation for composite row arguments', () => {
    const composite = compileString(COMPOSITE_SOURCE, {
      forceStateful: true,
      messageBus: true,
      solidityImportCompat: true,
    });
    const payload = {
      kind: 4n,
      note: Uint8Array.of(0xaa, 0xbb),
      tags: [new Uint8Array(32).fill(0x11), new Uint8Array(32).fill(0x22)],
    };
    const payloadBytes = encodeFunctionArgument(payload, 'Payload', composite.structs) as Uint8Array;
    const encoded = messageBus.encodeMessageBatch(composite, [{
      function: 'publish', args: [new Uint8Array(), payload],
    }]);

    // The zero address is a scalar OP_0 field. The struct follows inline and begins with its own first field
    // (OP_4), not an SDK-path-dependent outer pushdata frame.
    expect(encoded.rows[0].argsHex).toBe(`00${binToHex(payloadBytes)}`);
    expect(payloadBytes[0]).toBe(0x54);
  });

  it('keeps inactive row-local collection witnesses distinct from active identities', () => {
    const routed = compileString(ROUTED_COLLECTION_SOURCE, {
      forceStateful: true,
      messageBus: true,
      solidityImportCompat: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const source = new Uint8Array(25).fill(0x11);
    const destination = new Uint8Array(25).fill(0x22);
    const spender = new Uint8Array(25).fill(0x33);
    const encoded = messageBus.encodeMessageBatch(routed, [
      { function: 'approve', args: [spender, source, 80n] },
      { function: 'transferFrom', args: [source, destination, spender, 30n] },
    ]);
    const visibleRouteInputs = routed.messageBus!.route.inputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'));
    const witness = (name: string) => encoded.routeWitnesses[visibleRouteInputs
      .findIndex((input) => input.name === name)];

    expect(witness('__message_bus_key_balances_0_row_r0')).toEqual(
      messageBus.inactiveMessageBusRouteWitness('address'),
    );
    expect(witness('__message_bus_key_balances_0_row_r1')).toEqual(destination);
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
