import { describe, expect, it } from 'vitest';
import {
  compileString,
  compileStringMulti,
  compileStringSplit,
} from '../../src/compiler.js';
import { createMapResolver } from '../../src/createMapResolver.js';
import { sourceEffectOrderForArtifact } from '../../src/artifact/Artifact.js';

describe('inferred message-bus batching for repeated external callees', () => {
  const SOURCE = `
    interface ICounter { function add(int amount) external; }
    contract Caller(address counter) {
      function run(int first, int second) public {
        ICounter(counter).add(first);
        ICounter(counter).add(second);
        require(first >= 0);
        require(second >= 0);
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
          sourceCallsiteId: 0,
          logicalIndex: 0,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 0 }],
        },
        {
          sourceCallsiteId: 1,
          logicalIndex: 1,
          inputs: [{ name: 'arg0', type: 'int256' }],
          argSources: [{ kind: 'forward', paramIndex: 1 }],
        },
      ],
    });
    expect(run?.externalCalls?.[0].batchInvocations?.every((row) => row.selector.length === 8)).toBe(true);
  });

  it('publishes deterministic pre-collapse source callsites for every batch row', () => {
    const projection = () => compileString(SOURCE).abi.find((fn) => fn.name === 'run')
      ?.externalCalls?.map((call) => ({
        physicalCallsiteId: call.callsiteId,
        rows: call.batchInvocations?.map((row) => ({
          sourceCallsiteId: row.sourceCallsiteId,
          logicalIndex: row.logicalIndex,
        })),
      }));
    const first = projection();
    const second = projection();
    expect(first).toEqual(second);
    expect(first).toEqual([{
      physicalCallsiteId: 0,
      rows: [
        { sourceCallsiteId: 0, logicalIndex: 0 },
        { sourceCallsiteId: 1, logicalIndex: 1 },
      ],
    }]);
  });

  it('publishes one shared source-effect order for entry writes and graph calls', () => {
    const artifact = compileString(`
      interface ISink { function put(int value) external; }
      contract Ordered(address sink) {
        mapping(int => int) public values;
        function writeBefore(int key) public {
          values[key] = 1;
          ISink(sink).put(1);
          require(key >= 0);
        }
        function writeAfter(int key) public {
          ISink(sink).put(1);
          values[key] = 1;
          require(key >= 0);
        }
      }
    `, { forceStateful: true });
    const before = artifact.abi.find((fn) => fn.name === 'writeBefore')!;
    const after = artifact.abi.find((fn) => fn.name === 'writeAfter')!;
    const beforeWrite = before.entryAccesses?.[0].mutationEffectOrdinals?.[0];
    const beforeCall = before.externalCalls?.[0].sourceEffectOrdinal;
    const afterWrite = after.entryAccesses?.[0].mutationEffectOrdinals?.[0];
    const afterCall = after.externalCalls?.[0].sourceEffectOrdinal;
    expect(beforeWrite).toBeLessThan(beforeCall!);
    expect(afterCall).toBeLessThan(afterWrite!);
  });

  it('retains source-effect identity when repeated calls collapse into one physical slot', () => {
    const rows = compileString(SOURCE).abi.find((fn) => fn.name === 'run')
      ?.externalCalls?.[0].batchInvocations;
    const identities = rows?.map((row) => ({
      sourceCallsiteId: row.sourceCallsiteId,
      logicalIndex: row.logicalIndex,
      sourceEffectOrdinal: row.sourceEffectOrdinal,
    }));
    expect(identities?.map(({ sourceCallsiteId, logicalIndex }) => ({
      sourceCallsiteId, logicalIndex,
    }))).toEqual([
      { sourceCallsiteId: 0, logicalIndex: 0 },
      { sourceCallsiteId: 1, logicalIndex: 1 },
    ]);
    expect(identities?.every(({ sourceEffectOrdinal }) => Number.isSafeInteger(sourceEffectOrdinal)))
      .toBe(true);
    expect(identities![0].sourceEffectOrdinal).toBeLessThan(identities![1].sourceEffectOrdinal!);
  });

  it('reserves source-effect program points for presemantic function calls', () => {
    const artifact = compileString(`
      interface ISink { function put(int value) external; }
      contract Ordered(address sink) {
        function helper() internal { require(true); }
        function run() public {
          helper();
          ISink(sink).put(1);
          require(true);
        }
      }
    `, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'run')?.externalCalls?.[0].sourceEffectOrdinal)
      .toBeGreaterThan(0);
  });

  it('marks ternary and short-circuit effect domains as unsupported flow', () => {
    const artifact = compileString(`
      interface ISink { function put(int value) external; }
      contract Ordered(address sink) {
        mapping(int => int) public values;
        function ternary(bool choose, int key) public {
          int value = choose ? 1 : 2;
          values[key] = value;
          ISink(sink).put(value);
          require(key >= 0);
        }
        function shortCircuit(bool enabled, int key) public {
          bool allowed = enabled && key >= 0;
          values[key] = 1;
          ISink(sink).put(1);
          require(allowed || !enabled);
        }
      }
    `, { forceStateful: true });
    for (const name of ['ternary', 'shortCircuit']) {
      const fn = artifact.abi.find((candidate) => candidate.name === name)!;
      expect(fn.sourceEffectOrder).toBe('unsupported-flow');
      expect(fn.entryAccesses?.[0].mutationEffectOrdinals).toBeUndefined();
      expect(fn.externalCalls?.[0].sourceEffectOrdinal).toBeUndefined();
    }
  });

  it('does not advertise incomplete late-rewritten graph effects as linear', () => {
    expect(sourceEffectOrderForArtifact('linear', [{}], []))
      .toBeUndefined();
    expect(sourceEffectOrderForArtifact('linear', [{
      sourceEffectOrdinal: 0,
      batchInvocations: [{ sourceEffectOrdinal: 0 }, {}],
    }], []))
      .toBeUndefined();
    expect(sourceEffectOrderForArtifact('linear', [], [{ operations: ['write'] }]))
      .toBeUndefined();
    expect(sourceEffectOrderForArtifact('linear', [{ sourceEffectOrdinal: 0 }], [{
      operations: ['write'], mutationEffectOrdinals: [1],
    }])).toBe('linear');
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

  it('uses the kernel row route rather than legacy runtime-count patch sites', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.route.inputs.map((input) => input.name)).toContain('batchBlob');
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const compact = artifact.bytecode.replace(/\s+/g, '');
    expect(compact).not.toMatch(/OP_SPLITOP_1OP_SPLITOP_5OP_INVOKE/);
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

  it('reconstructs deterministic raw calldata from constructor and handler arguments', () => {
    const source = `
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
    `;
    for (const [messageBusKernel, convention] of [
      [true, 'kernel-row-loop'], [false, 'legacy-unroll'],
    ] as const) {
      const attemptFailureBox = {
        failures: [] as Array<{
          stage: string; errorName: string; message: string; internalCodegen: boolean;
        }>,
      };
      const artifact = compileString(source, {
        forceStateful: true,
        messageBus: true,
        messageBusKernel,
        solidityImportCompat: true,
        suppressWarnings: true,
        __artifactCache: false,
        __attemptFailureBox: attemptFailureBox,
        __strictNoInternalRecovery: true,
      });

      expect(artifact.contractName).toBe('Caller');
      expect(artifact.bytecode.length).toBeGreaterThan(0);
      expect(artifact.messageBus?.convention).toBe(convention);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'withdraw'))
        .toMatchObject({ eligible: true });
      expect(attemptFailureBox.failures).toEqual([]);
    }
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

  // A batch is advertised in the caller's own bytecode, which then requires the callee's route to execute every
  // row. A route refuses a handler that writes a variable-width collection until its completed entry descriptor
  // is represented in the compact journal, so a repeated call to such a callee must keep its individual slots
  // rather than publish a batch the callee can never serve.
  const CALLEE_WITH_CHUNKED_WRITE = `
    contract Data {
      mapping(int => int[]) events;
      function append(int id, int value) external {
        events[id].push(value);
        require(value >= 0);
      }
    }
  `;
  const CALLEE_WITH_SCALAR_WRITE = `
    contract Data {
      mapping(int => int) counts;
      function bump(int id) external {
        counts[id] = counts[id] + 1;
        require(id >= 0);
      }
    }
  `;
  const repeatedCaller = (callee: string, handler: string): ReturnType<typeof compileString> =>
    compileString(`
      import "./Data.scash";
      contract BatchCaller(address data) {
        function run(int first, int second) public {
          Data(data).${handler}(0, first);
          Data(data).${handler}(0, second);
          require(first >= 0);
          require(second >= 0);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      solidityImportCompat: true,
      suppressWarnings: true,
      rootFileId: '/BatchCaller.scash',
      importResolver: createMapResolver({ '/Data.scash': callee }),
    });

  it('keeps repeated calls ungrouped when the callee handler writes a variable-width collection', () => {
    const artifact = repeatedCaller(CALLEE_WITH_CHUNKED_WRITE, 'append');
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(2);
    expect(run?.externalCalls?.every((call) => call.batchInvocations === undefined)).toBe(true);
  });

  it('still groups repeated calls when the callee route admits the handler', () => {
    const artifact = repeatedCaller(CALLEE_WITH_SCALAR_WRITE, 'bump');
    const run = artifact.abi.find((fn) => fn.name === 'run');
    expect(run?.externalCalls).toHaveLength(1);
    expect(run?.externalCalls?.[0].batchInvocations).toHaveLength(2);
  });
});
