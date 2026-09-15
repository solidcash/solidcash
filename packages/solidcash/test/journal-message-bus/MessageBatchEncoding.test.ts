import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { scriptToBytecode, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { messageBus, SignatureTemplate } from '../../src/index.js';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { provisionalInvocationResult } from '../../src/message-bus/compose.js';
import { encodeEvmInvocationResult } from '../../src/stateful/evm-abi-result.js';

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

const SIGNATURE_DATA_SOURCE = `pragma solidcash >=0.8.0;
contract MessageBusSignatureData() {
  function echo(bytes value) public pure returns (sig) { return sig(value); }
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

const SHARED_LITERAL_COLLECTION_SOURCE = `pragma solidcash ^0.13.0;
contract SharedLiteralCollectionEncoding() {
  mapping(int => int) source;
  mapping(int => int) target;
  function seed(int value) public { this.source[0] = value; require(true); }
  function fill(int count) public {
    for (int i = 0; i < count; i = i + 1) this.target[i] = this.source[0];
    require(true);
  }
}`;

const OVERLOADED_SOURCE = `pragma solidcash >=0.8.0;
contract OverloadedBatchEncoding() {
  int counter;
  function apply(int value) public { this.counter = value; require(true); }
  function apply(bool enabled) public { this.counter = enabled ? 1 : 0; require(true); }
}`;

const artifact = compileString(SOURCE, {
  forceStateful: true,
  messageBus: true,
});

describe('messageBus.encodeMessageBatch', () => {
  it('selects an exact non-first overload and rejects ambiguous or mismatched identities', () => {
    const overloaded = compileString(OVERLOADED_SOURCE, { forceStateful: true, messageBus: true });
    const handlers = overloaded.messageBus!.handlers.filter((handler) => handler.name === 'apply');
    const boolHandler = handlers.find((handler) => handler.inputs[0]?.type === 'bool')!;
    expect(boolHandler).toBeDefined();

    const encoded = messageBus.encodeMessageBatch(overloaded, [{
      function: 'apply', selector: boolHandler.selector, args: [true],
    }]);
    expect(encoded.rows[0]).toMatchObject({ function: 'apply', selectorHex: boolHandler.selector });
    expect(() => messageBus.encodeMessageBatch(overloaded, [{ function: 'apply', args: [true] }]))
      .toThrow(/distinct ABI functions/);
    expect(() => messageBus.encodeMessageBatch(overloaded, [{
      function: 'apply', selector: 'ffffffff', args: [true],
    }])).toThrow(/does not identify ABI function 'apply'/);
  });

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

  it('enforces an aggregate fixed chunkable-write occurrence policy before encoding', () => {
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const bounded = {
      ...artifact,
      messageBus: {
        ...artifact.messageBus!,
        fixedChunkableWritePolicy: {
          version: 1 as const, maximumRows: 1 as const, selectors: [add.selector],
        },
      },
    };
    expect(() => messageBus.encodeMessageBatch(bounded, [{ function: 'add', args: [1n] }])).not.toThrow();
    expect(() => messageBus.encodeMessageBatch(bounded, [
      { function: 'add', args: [1n] },
      { function: 'clear' },
      { function: 'add', args: [2n] },
    ])).toThrow(/selects 2 direct chunkable-write rows/);

    const malformed = {
      ...bounded,
      messageBus: {
        ...bounded.messageBus,
        fixedChunkableWritePolicy: {
          version: 1 as const, maximumRows: 1 as const, selectors: [add.selector, add.selector],
        },
      },
    };
    expect(() => messageBus.encodeMessageBatch(malformed, [{ function: 'clear' }])).toThrow(
      expect.objectContaining({ code: 'L3_PROTOCOL_METADATA_MALFORMED' }),
    );
  });

  it('derives direct and composite KTS1 provenance from compiler policy without embedding signatures', () => {
    const selector = 'a1b2c3d4';
    const inputs = [{ name: 'direct', type: 'sig' }, { name: 'authorization', type: 'Authorization' }];
    const signed = {
      ...artifact,
      abi: [{ name: 'authorize', selector, inputs, outputs: [], modifiers: ['public'] }],
      structs: [{ name: 'Authorization', fields: [{ name: 'proof', type: 'sig' }, { name: 'key', type: 'pubkey' }] }],
      messageBus: {
        ...artifact.messageBus!,
        handlers: [{
          name: 'authorize', selector, inputs, outputs: [], eligible: true,
          usesTransactionSignature: true,
          transactionSignaturePolicy: {
            hashType: 'all' as const, parameterIndices: [0, 1],
            coveredBytecodes: [{ parameterIndex: 1, leafIndex: 0, bytecode: '52' }],
          },
          signatureBytecode: '51',
        }],
      },
    } as Artifact;
    const direct = new SignatureTemplate(new Uint8Array(32).fill(0x11));
    const nested = new SignatureTemplate(new Uint8Array(32).fill(0x22));
    const encoded = messageBus.encodeMessageBatch(signed, [{
      function: 'authorize', args: [direct, { proof: nested, key: new Uint8Array(33).fill(3) }],
    }]);
    const provenance = encoded.rows[0].transactionSignatureFrameHex;

    expect(provenance.startsWith('4b5453310102')).toBe(true);
    expect(provenance).not.toContain('11'.repeat(32));
    expect(provenance).not.toContain('22'.repeat(32));
    expect(provenance).toBe(messageBus.messageBusTransactionSignatureFrameHex(signed, 'authorize', selector));

    const reordered = structuredClone(signed);
    reordered.messageBus!.handlers[0].transactionSignaturePolicy!.parameterIndices = [1, 0];
    expect(() => messageBus.encodeMessageBatch(reordered, [{
      function: 'authorize', args: [direct, { proof: nested, key: new Uint8Array(33).fill(3) }],
    }])).toThrow(/non-canonical transaction-signature parameter index/);
    const uncovered = structuredClone(signed);
    delete uncovered.messageBus!.handlers[0].signatureBytecode;
    uncovered.messageBus!.handlers[0].transactionSignaturePolicy!.coveredBytecodes = [];
    expect(() => messageBus.encodeMessageBatch(uncovered, [{
      function: 'authorize', args: [direct, { proof: nested, key: new Uint8Array(33).fill(3) }],
    }])).toThrow(/has no covered bytecode/);
    const foreignCoverage = structuredClone(signed);
    foreignCoverage.messageBus!.handlers[0].transactionSignaturePolicy!.coveredBytecodes = [
      { parameterIndex: 2, leafIndex: 0, bytecode: '52' },
    ];
    expect(() => messageBus.encodeMessageBatch(foreignCoverage, [{
      function: 'authorize', args: [direct, { proof: nested, key: new Uint8Array(33).fill(3) }],
    }])).toThrow(/non-canonical covered-bytecode parameter index/);
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
      { row: 0, types: ['int256'], resultEncoding: 'compact-pushdata-v1' },
      { row: 1, types: ['bool'], resultEncoding: 'compact-pushdata-v1' },
      { row: 2, types: ['int256', 'bool'], resultEncoding: 'compact-pushdata-v1' },
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

  it('decodes mixed EVM ABI and compact result rows using each authenticated row encoding', () => {
    const returning = compileString(RETURN_SOURCE, {
      forceStateful: true,
      messageBus: true,
    });
    const encoded = messageBus.encodeMessageBatch(returning, [
      { function: 'twice', args: [3n] },
      { function: 'positive', args: [8n] },
      { function: 'pair', args: [4n] },
    ]);
    // Keep the compiler-produced batch framing and row order, but exercise the decoder with an authenticated
    // mixed schema. The artifact itself is native, proving result framing is selected per row rather than from
    // the artifact-wide compatibility mode.
    const mixedPlan = {
      ...encoded,
      results: [
        { row: 0, types: ['int256'], resultEncoding: 'evm-abi-v1' as const },
        { row: 1, types: ['bool'], resultEncoding: 'compact-pushdata-v1' as const },
        { row: 2, types: ['int256', 'bool'], resultEncoding: 'evm-abi-v1' as const },
      ],
    };
    const first = encodeEvmInvocationResult([6n], ['int256']);
    const compact = scriptToBytecode([Uint8Array.of(1)]);
    const last = encodeEvmInvocationResult([5n, true], ['int256', 'bool']);
    const packed = Uint8Array.from([...first, ...compact, ...last]);
    const commitment = scriptToBytecode([packed]);

    expect(messageBus.decodeMessageBusResults(returning, mixedPlan, commitment)).toEqual([
      { row: 0, type: 'int256', value: 6n },
      { row: 1, type: 'bool', value: true },
      { row: 2, type: '(int256,bool)', value: [5n, true] },
    ]);
  });

  it('encodes and decodes a data-only sig as compact bytes without a signing witness', () => {
    const signatureData = compileString(SIGNATURE_DATA_SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
    });
    const value = new Uint8Array(65).fill(0x2a);
    const encoded = messageBus.encodeMessageBatch(signatureData, [
      { function: 'echo', args: [value] },
    ]);

    expect(encoded.routeWitnesses).toEqual([]);
    expect(encoded.rows[0].argsHex).toBe(binToHex(scriptToBytecode([value])));
    expect(encoded.results).toEqual([{
      row: 0, types: ['sig'], resultEncoding: 'compact-pushdata-v1',
    }]);
    expect(provisionalInvocationResult(signatureData, ['sig'])).toBe('00');

    const commitment = scriptToBytecode([scriptToBytecode([value])]);
    expect(messageBus.decodeMessageBusResults(signatureData, encoded, commitment)).toEqual([
      { row: 0, type: 'sig', value },
    ]);
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
      messageBusKernel: false,
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
    const witness = (name: string): unknown => encoded.routeWitnesses[visibleRouteInputs
      .findIndex((input) => input.name === name)];

    expect(witness('__message_bus_key_balances_0_row_r0')).toEqual(
      messageBus.inactiveMessageBusRouteWitness('address'),
    );
    expect(witness('__message_bus_key_balances_0_row_r1')).toEqual(destination);
  });

  it('derives a literal witness when another handler owns the shared physical entry slot', () => {
    const shared = compileString(SHARED_LITERAL_COLLECTION_SOURCE, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const encoded = messageBus.encodeMessageBatch(shared, [{ function: 'fill', args: [3n] }]);
    const visibleRouteInputs = shared.messageBus!.route.inputs
      .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'));
    const sourceWitness = encoded.routeWitnesses[visibleRouteInputs
      .findIndex((input) => input.name === '__message_bus_key_source_0')];
    expect(sourceWitness).toBe(0n);
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
