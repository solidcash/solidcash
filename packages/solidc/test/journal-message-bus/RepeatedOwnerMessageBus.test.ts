import { describe, expect, it } from 'vitest';
import {
  compileString,
  compileStringMulti,
  compileStringSplit,
} from '../../src/compiler.js';

describe('inferred message-bus batching for repeated external callees', () => {
  const SOURCE = `
    interface ICounter { function add(int amount) external; }
    contract Caller(address counter) {
      function run(int first, int second) public {
        ICounter(counter).add(first);
        ICounter(counter).add(second);
        require(first >= 0 && second >= 0);
      }
    }
  `;

  it('collapses two straight-line calls to the same owner into one physical message-bus batch slot', () => {
    const artifact = compileString(SOURCE);
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(1);
    expect(run?.externalCalls?.[0]).toMatchObject({
      interfaceName: 'ICounter',
      functionName: 'add',
      needsSelectorVerification: true,
      batchInvocations: [
        {
          logicalIndex: 0,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 0 }],
        },
        {
          logicalIndex: 1,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 1 }],
        },
      ],
    });
    expect(run?.externalCalls?.[0].batchInvocations?.every((row) => row.selector.length === 8)).toBe(true);
  });

  it('publishes runtime loop cardinality for repeated calls to one owner', () => {
    const artifact = compileString(`
      interface ISink { function put(int value) external; }
      contract Caller(address sink) {
        function run(int first, int[] values) public {
          ISink(sink).put(first);
          for (int i = 0; i < values.length; i = i + 1) ISink(sink).put(values[i]);
          require(first >= 0);
        }
      }
    `);
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(1);
    expect(run?.externalCalls?.[0]).toMatchObject({
      occurrence: 'once',
      batchInvocations: [
        { logicalIndex: 0, argSources: [{ kind: 'forward', paramIndex: 0 }] },
        {
          logicalIndex: 1,
          occurrence: 'loop',
          argSources: [{ kind: 'arrayElement', paramIndex: 1, indexValue: 0 }],
        },
      ],
    });
  });

  it('collapses the supported repeated-owner shape by default', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.abi.find((fn) => fn.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('resolves a proxy delegate index to the authenticated compiler-route input', () => {
    const compact = compileString(SOURCE).bytecode.replace(/\s+/g, '');
    // Direct participants start at push4(SCB1). A proxy starts with its authenticated implementation-input index;
    // decode that witness and inspect the implementation unlocking bytecode before checking the exact route frame.
    expect(compact).toContain(
      'OP_INPUTBYTECODEOP_DUPOP_1OP_SPLITOP_DROPOP_4OP_EQUALOP_NOTIF',
    );
    expect(compact).toContain('OP_DROPOP_INPUTBYTECODEOP_ENDIFOP_5OP_SPLIT');
    expect(compact).toContain('OP_ENDIFOP_5OP_SPLITOP_SWAP0453434231OP_EQUALVERIFY');
  });

  it('replaces rather than retains the previous runtime batch count', () => {
    const compact = compileString(SOURCE).bytecode.replace(/\s+/g, '');
    // Rewriting SCB1's count splits after the six immutable header bytes, removes the old one-byte count, then
    // concatenates the replacement count with only the actual row payload. The optimizer outlines the split
    // prefix and shared tail under dynamically allocated helper ids. Both append sites must use the same pair;
    // no numeric helper id is part of the invariant.
    const sites = compact.match(
      /(?:OP_(?:1NEGATE|[1-9]|1[0-6])|[0-9a-f]+)OP_INVOKEOP_SPLITOP_1OP_SPLIT(?:OP_(?:1NEGATE|[1-9]|1[0-6])|[0-9a-f]+)OP_INVOKE/g,
    ) ?? [];
    expect(sites).toHaveLength(2);
    expect(new Set(sites).size).toBe(1);
  });

  it('publishes bounded pure-helper programs for external argument derivation', () => {
    const artifact = compileString(`
      pragma solidity >=0.8.0;
      function prefixItems(string[] values) pure returns (bytes) {
        bytes result = abi.encodePacked(uint8(values.length));
        for (uint i = 0; i < values.length; i = i + 1) {
          result = bytes.concat(result, abi.encodePacked(uint8(bytes(values[i]).length), values[i]));
        }
        return result;
      }
      interface ISink { function publish(bytes value) external; }
      contract Caller(address sink) {
        function run(string[] values) public {
          ISink(sink).publish(prefixItems(values));
          ISink(sink).publish(prefixItems(values));
          require(values.length >= 0);
        }
      }
    `, { solidityImportCompat: true });
    const run = artifact.abi.find((candidate) => candidate.name === 'run');
    const program = run?.externalCalls?.[0].batchInvocations?.[0]
      .argSources?.[0].expression;

    expect(program).toMatchObject({
      kind: 'call',
      parameters: ['values'],
      statements: expect.arrayContaining([
        expect.objectContaining({ kind: 'while' }),
        expect.objectContaining({ kind: 'return' }),
      ]),
    });
  });

  it('leaves an ungrouped single external call byte-identical to the explicit opt-out', () => {
    const source = `
      interface ICounter { function add(int amount) external; }
      contract Caller(address counter) {
        function run(int amount) public {
          ICounter(counter).add(amount);
          require(amount >= 0);
        }
      }
    `;
    const inferred = compileString(source);
    const direct = compileString(source, { messageBus: false });
    expect(inferred.bytecode).toBe(direct.bytecode);
    expect(inferred.abi.find((fn) => fn.name === 'run')?.externalCalls)
      .toEqual(direct.abi.find((fn) => fn.name === 'run')?.externalCalls);
  });

  it('leaves multiple repeated owners to the full message-bus planner', () => {
    const artifact = compileString(`
      interface ICounter { function add(int amount) external; }
      contract Caller(address firstCounter, address secondCounter) {
        function run(int amount) public {
          ICounter(firstCounter).add(amount);
          ICounter(firstCounter).add(amount);
          ICounter(secondCounter).add(amount);
          ICounter(secondCounter).add(amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('leaves a conditional repeated-owner chain to the full planner', () => {
    const artifact = compileString(`
      interface ICounter { function add(int amount) external; }
      contract Caller(address counter) {
        function run(bool includeFirst, int amount) public {
          if (includeFirst) ICounter(counter).add(amount);
          ICounter(counter).add(amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('infers the message bus and accepts an equivalent explicit request', () => {
    const inferred = compileString(SOURCE, { forceStateful: true });
    const explicit = compileString(SOURCE, { forceStateful: true, messageBus: true });
    expect(inferred.compiler.options?.messageBus).toBe(true);
    expect(explicit.bytecode).toBe(inferred.bytecode);
    expect(inferred.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('emits canonical PUSHDATA2 framing for BCH2026-sized batch blobs', () => {
    const artifact = compileString(`
      interface IBytes { function accept(bytes value) external; }
      contract Caller(address sink) {
        function run(bytes first, bytes second) public {
          IBytes(sink).accept(first);
          IBytes(sink).accept(second);
          require(first.length >= 0 && second.length >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });

    // OP_DUP 255 OP_LESSTHANOREQUAL OP_IF selects PUSHDATA1; its OP_ELSE uses
    // OP_2 OP_NUM2BIN 0x4d OP_SWAP OP_CAT OP_SWAP OP_CAT for canonical uint16-le PUSHDATA2 framing.
    expect(artifact.debug?.bytecode).toContain('7602ff00a163608a675280014d7c7e7c7e6868');
  });

  it('reconstructs deterministic raw calldata from constructor and handler arguments', () => {
    const artifact = compileString(`
      interface IERC20 { function transfer(address to, uint amount) external returns (bool); }
      library SafeTransfer {
        function send(address token, address to, uint amount) internal {
          (bool success, bytes data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
          );
          require(success);
        }
      }
      contract Caller(address token, address vault) {
        function withdraw(uint amount) public {
          SafeTransfer.send(token, vault, amount);
          require(amount >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });

    expect(artifact.contractName).toBe('Caller');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('rejects explicit messageBus false when one UTXO owner must serve repeated calls', () => {
    expect(() => compileString(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
  });

  it('enforces the explicit opt-out rule in multi-artifact and split compilation', () => {
    expect(() => compileStringMulti(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
    expect(() => compileStringSplit(SOURCE, { forceStateful: true, messageBus: false }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*cannot be built with `messageBus: false`/);
  });
});
