import { execFileSync } from 'child_process';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  bytecodeToAsm, encodeInt, Op, scriptToBytecode,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';
import { compileAddressToEvmIdentity } from '../../src/generation/utils.js';

const KERNEL = {
  forceStateful: true,
  evmCompat: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  optimizeForCompilationSpeed: false,
  suppressWarnings: true,
} as const;

describe('kernel graph result dependencies', () => {
  it('keeps a producer-result address as the authenticated target of a raw graph edge', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ITargetSource {
        function target(uint id) external returns (address);
      }

      interface IAction {
        function execute(uint id) external;
      }

      contract Coordinator {
        ITargetSource immutable source;
        uint touched;

        constructor(address source_) {
          source = ITargetSource(source_);
        }

        function apply(uint id) external {
          address target = source.target(id);
          (bool ok, bytes memory result) = target.call(abi.encodeCall(IAction.execute, (id)));
          require(ok);
          touched = result.length;
          require(true);
        }
      }
    `, KERNEL);

    const fn = artifact.abi.find((candidate) => candidate.name === 'apply');
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });

    const calls = fn?.externalCalls ?? [];
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      callsiteId: 0,
      returnTypes: ['address'],
      resultEncoding: 'evm-abi-v1',
    });
    expect(calls[1]).toMatchObject({
      callsiteId: 1,
      interfaceName: '__raw__',
      functionName: '__raw__',
      addressSource: {
        kind: 'expression',
        expression: { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'address' },
      },
      rawFunctionName: 'execute',
    });

    const functions = artifact.invocationAnalysis?.functions ?? [];
    const graphHandler = functions.find((candidate) => candidate.name === '__message_bus_handler_apply');
    expect(graphHandler).toBeDefined();
    expect(functions.find((candidate) => candidate.name === '__message_bus1')?.calls)
      .toContain(graphHandler?.id);
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');

    const invokeDebug = artifact.debug.invokeDebug ?? {};
    // The 12-zero-byte prefix check may be outlined into its own helper once the contract pushes that word twice.
    const zeroWord = binToHex(scriptToBytecode([new Uint8Array(12)]));
    const [head, tail] = binToHex(scriptToBytecode(compileAddressToEvmIdentity())).split(zeroWord);
    const projection = new RegExp(`^${head}(?:${zeroWord}|(?:5[1-9a-f]|60|01[0-9a-f]{2})8a)${tail}$`);
    const projectionHelper = Object.entries(invokeDebug)
      .find(([, entry]) => projection.test(entry.bytecode));
    expect(projectionHelper).toBeDefined();
    const projectionInvocation = bytecodeToAsm(scriptToBytecode([
      encodeInt(BigInt(projectionHelper![0])), Op.OP_INVOKE,
    ]));
    const handlerBody = Object.values(invokeDebug)
      .find((entry) => entry.name === '__message_bus_handler_apply');
    expect(handlerBody).toBeDefined();
    const handlerAsm = bytecodeToAsm(hexToBin(handlerBody!.bytecode));
    const rawSelector = calls[1].rawSelector!;
    expect(handlerAsm).toMatch(new RegExp([
      'OP_2 OP_SPLIT OP_SWAP OP_BIN2NUM OP_SPLIT OP_DROP OP_DUP',
      projectionInvocation,
      'OP_2 OP_PICK OP_EQUALVERIFY OP_NIP OP_ENDIF',
      '\\S+ OP_INVOKE 00 OP_CAT',
      `${rawSelector} OP_CAT`,
    ].join(' ')));
  });

  it('keeps a multi-result producer behind one invoke boundary when no later edge consumes it', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      interface IReader {
        function read(bigint id) returns (bigint value, bool accepted);
      }

      contract Recorder(address reader) {
        bigint recordedValue;
        bool recordedAcceptance;

        function capture(bigint id) public {
          bigint nextValue, bool nextAccepted = IReader(reader).read(id);
          recordedValue = nextValue;
          recordedAcceptance = nextAccepted;
          require(true);
        }
      }
    `, {
      ...KERNEL,
      evmCompat: false,
    });

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'capture'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((fn) => fn.name === 'capture')?.externalCalls).toMatchObject([{
      callsiteId: 0,
      functionName: 'read',
      returnTypes: ['bigint', 'bool'],
    }]);
    const graphHandler = artifact.invocationAnalysis?.functions.find((fn) =>
      fn.name === '__message_bus_handler_capture');
    expect(graphHandler).toBeDefined();
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === '__message_bus1')?.calls)
      .toContain(graphHandler?.id);
  });

  it('threads a prior typed struct result into a later void call', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Snapshot { uint value; address recipient; }

      interface ISource {
        function read(uint id) external returns (Snapshot memory);
      }

      interface ISink {
        function write(uint id, uint value, address recipient) external;
      }

      contract Coordinator {
        ISource immutable source;
        ISink immutable sink;
        uint touched;
        event Applied(uint id, uint value);

        constructor(address source_, address sink_) {
          source = ISource(source_);
          sink = ISink(sink_);
        }

        function apply(uint id) external {
          Snapshot memory snapshot = source.read(id);
          sink.write(id, snapshot.value, snapshot.recipient);
          touched = touched + 1;
          emit Applied(id, snapshot.value);
          require(true);
        }

        // A second event-bearing state writer makes the route exercise handler-local
        // event identities rather than compiling apply as an isolated leaf.
        function sibling(uint value) external {
          touched = value;
          emit Applied(0, value);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });

    const calls = artifact.abi.find((fn) => fn.name === 'apply')?.externalCalls ?? [];
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      callsiteId: 0,
      interfaceName: 'ISource',
      functionName: 'read',
      hasReturnValues: true,
      returnTypes: ['Snapshot'],
    });
    expect(calls[1]).toMatchObject({
      callsiteId: 1,
      interfaceName: 'ISink',
      functionName: 'write',
      argSources: [
        { kind: 'forward', paramIndex: 0 },
        { kind: 'expression', expression: { kind: 'field', expression: {
          kind: 'producerResult', callsiteId: 0, resultIndex: 0,
        } } },
        { kind: 'expression', expression: { kind: 'field', expression: {
          kind: 'producerResult', callsiteId: 0, resultIndex: 0,
        } } },
      ],
    });
  });

  it('publishes ordered multi-value producer identities for a conditional consumer', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IReader {
        function read(uint id) external returns (uint value, address recipient);
      }

      interface IWriter {
        function write(uint id, uint value, address recipient) external;
      }

      contract Coordinator {
        IReader immutable reader;
        IWriter immutable writer;
        uint touched;
        event Applied(uint value, address recipient);

        constructor(address reader_, address writer_) {
          reader = IReader(reader_);
          writer = IWriter(writer_);
        }

        function apply(uint id, bool forward) external {
          (uint value, address recipient) = reader.read(id);
          if (forward) {
            writer.write(id, value, recipient);
          }
          touched = value;
          emit Applied(value, recipient);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });

    const calls = artifact.abi.find((fn) => fn.name === 'apply')?.externalCalls ?? [];
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      callsiteId: 0,
      interfaceName: 'IReader',
      functionName: 'read',
      hasReturnValues: true,
      returnTypes: ['uint256', 'address'],
      occurrence: 'once',
    });
    expect(calls[1]).toMatchObject({
      callsiteId: 1,
      interfaceName: 'IWriter',
      functionName: 'write',
      occurrence: 'conditional',
      maximumOccurrences: 1,
      argSources: [
        { kind: 'forward', paramIndex: 0 },
        { kind: 'expression', expression: {
          kind: 'producerResult', callsiteId: 0, resultIndex: 0,
        } },
        { kind: 'expression', expression: {
          kind: 'producerResult', callsiteId: 0, resultIndex: 1,
        } },
      ],
    });
    expect(artifact.abi.find((fn) => fn.name === 'apply')?.resultConsumers).toEqual([
      { consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 1, argument: 2, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 1 },
    ]);
    const graphHandler = artifact.invocationAnalysis?.functions.find((fn) =>
      fn.name === '__message_bus_handler_apply');
    expect(graphHandler).toBeDefined();
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === '__message_bus1')?.calls)
      .toContain(graphHandler?.id);
  });

  it('keeps identical result schemas separately addressable by stable callsite and component', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IReader {
        function read(uint id) external returns (uint value, bool accepted);
      }

      interface ISink {
        function write(uint leftValue, bool leftAccepted, uint rightValue, bool rightAccepted) external;
      }

      contract Coordinator {
        IReader immutable left;
        IReader immutable right;
        ISink immutable sink;
        uint touched;

        constructor(address left_, address right_, address sink_) {
          left = IReader(left_);
          right = IReader(right_);
          sink = ISink(sink_);
        }

        function apply(uint id) external {
          (uint leftValue, bool leftAccepted) = left.read(id);
          (uint rightValue, bool rightAccepted) = right.read(id + 1);
          sink.write(leftValue, leftAccepted, rightValue, rightAccepted);
          touched = leftValue + rightValue;
          require(true);
        }
      }
    `, KERNEL);

    // Equal interfaces and equal result schemas are not interchangeable callsites.
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });

    const calls = artifact.abi.find((fn) => fn.name === 'apply')?.externalCalls ?? [];
    expect(calls.map((call) => ({
      callsiteId: call.callsiteId,
      functionName: call.functionName,
      returnTypes: call.returnTypes,
    }))).toEqual([
      { callsiteId: 0, functionName: 'read', returnTypes: ['uint256', 'bool'] },
      { callsiteId: 1, functionName: 'read', returnTypes: ['uint256', 'bool'] },
      { callsiteId: 2, functionName: 'write', returnTypes: undefined },
    ]);
    expect(calls[2].argSources).toEqual([
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 0,
      } },
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 1,
      } },
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 1, sourceCallsiteId: 1, resultIndex: 0,
      } },
      { kind: 'expression', expression: {
        kind: 'producerResult', callsiteId: 1, sourceCallsiteId: 1, resultIndex: 1,
      } },
    ]);
    expect(artifact.abi.find((fn) => fn.name === 'apply')?.resultConsumers).toEqual([
      { consumerCallsiteId: 2, argument: 0, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 2, argument: 1, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 1 },
      { consumerCallsiteId: 2, argument: 2, producerCallsiteId: 1, producerSourceCallsiteId: 1, resultIndex: 0 },
      { consumerCallsiteId: 2, argument: 3, producerCallsiteId: 1, producerSourceCallsiteId: 1, resultIndex: 1 },
    ]);
  });

  it('preserves one authenticated callsite graph when producer and consumer originate in a helper', () => {
    const source = `pragma solidity ^0.8.0;
      interface ISource {
        function read(uint id) external returns (uint value);
      }

      interface ISink {
        function write(uint id, uint value) external;
      }

      contract Coordinator {
        ISource immutable source;
        ISink immutable sink;
        uint touched;

        constructor(address source_, address sink_) {
          source = ISource(source_);
          sink = ISink(sink_);
        }

        function forward(uint id) internal returns (uint value) {
          value = source.read(id);
          sink.write(id, value);
        }

        function apply(uint id) external {
          touched = forward(id);
          require(true);
        }
      }
    `;
    const first = compileString(source, KERNEL);
    const second = compileString(source, KERNEL);

    expect(first.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const calls = first.abi.find((fn) => fn.name === 'apply')?.externalCalls ?? [];
    expect(calls.map((call) => ({
      callsiteId: call.callsiteId,
      functionName: call.functionName,
      sourceLocation: call.sourceLocation,
    }))).toEqual([
      { callsiteId: 0, functionName: 'read', sourceLocation: { line: 21, column: 18 } },
      { callsiteId: 1, functionName: 'write', sourceLocation: { line: 22, column: 10 } },
    ]);
    expect(calls[1].argSources).toEqual([
      { kind: 'forward', paramIndex: 0 },
      {
        kind: 'expression',
        expression: {
          kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 0, type: 'uint256',
        },
      },
    ]);
    expect(first.abi.find((fn) => fn.name === 'apply')?.resultConsumers).toEqual([
      { consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0 },
    ]);
    expect(second.abi.find((fn) => fn.name === 'apply')?.externalCalls).toEqual(calls);
    expect(second.abi.find((fn) => fn.name === 'apply')?.resultConsumers)
      .toEqual(first.abi.find((fn) => fn.name === 'apply')?.resultConsumers);

    const functions = first.invocationAnalysis?.functions ?? [];
    const route = functions.find((fn) => fn.name === '__message_bus1');
    const handler = functions.find((fn) => fn.name === '__message_bus_handler_apply');
    expect(handler).toBeDefined();
    expect(route?.calls.filter((id) => id === handler?.id)).toHaveLength(1);
    expect(Object.values(first.debug.invokeDebug ?? {})
      .filter((entry) => entry.name === '__message_bus_handler_apply')).toHaveLength(1);
  });

  it('publishes helper-origin graph metadata in a process-cold, cache-disabled kernel compile', () => {
    const source = `pragma solidity ^0.8.0;
      interface ISource { function read(uint id) external returns (uint value); }
      interface ISink { function write(uint id, uint value) external; }
      contract ColdGraphCoordinator {
        ISource immutable source; ISink immutable sink; uint touched;
        constructor(address source_, address sink_) { source = ISource(source_); sink = ISink(sink_); }
        function forward(uint id) internal returns (uint value) {
          value = source.read(id); sink.write(id, value);
        }
        function apply(uint id) external { touched = forward(id); require(true); }
      }`;
    const program = `import { compileString } from './dist/compiler.js';
      const source = Buffer.from(process.argv[1], 'base64').toString('utf8');
      const artifact = compileString(source, ${JSON.stringify(KERNEL)});
      const apply = artifact.abi.find((entry) => entry.name === 'apply');
      process.stdout.write(JSON.stringify({
        convention: artifact.messageBus?.convention,
        eligible: artifact.messageBus?.handlers.find((entry) => entry.name === 'apply')?.eligible,
        calls: apply?.externalCalls?.map((entry) => ({ callsiteId: entry.callsiteId, name: entry.functionName })),
        consumers: apply?.resultConsumers,
        graphHandlers: Object.values(artifact.debug.invokeDebug ?? {})
          .filter((entry) => entry.name === '__message_bus_handler_apply').length,
      }));`;
    const output = execFileSync(process.execPath, [
      '--input-type=module', '--eval', program, Buffer.from(source).toString('base64'),
    ], {
      cwd: process.cwd(), encoding: 'utf8', env: {
        ...process.env,
        SOLIDC_COMPILE_CACHE: '0', SOLIDC_COMPILE_CACHE_DIR: '',
      },
    });
    expect(JSON.parse(output)).toEqual({
      convention: 'kernel-row-loop', eligible: true,
      calls: [{ callsiteId: 0, name: 'read' }, { callsiteId: 1, name: 'write' }],
      consumers: [{
        consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0,
      }],
      graphHandlers: 1,
    });
  }, 120_000);

  it('does not authenticate ambiguous or non-dominating helper result aliases', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ISource {
        function read(uint id) external returns (uint value);
      }

      interface ISink {
        function write(uint id, uint value) external;
      }

      contract Coordinator {
        ISource immutable source;
        ISink immutable sink;
        uint touched;

        constructor(address source_, address sink_) {
          source = ISource(source_);
          sink = ISink(sink_);
        }

        function conditional(uint id, bool take) internal returns (uint value) {
          if (take) {
            value = source.read(id);
          }
          sink.write(id, value);
        }

        function reassigned(uint id) internal returns (uint value) {
          value = source.read(id);
          value = value + 1;
          sink.write(id, value);
        }

        function beforeProducer(uint id) internal returns (uint value) {
          sink.write(id, value);
          value = source.read(id);
        }

        function applyConditional(uint id, bool take) external {
          touched = conditional(id, take);
          require(true);
        }

        function applyReassigned(uint id) external {
          touched = reassigned(id);
          require(true);
        }

        function applyBeforeProducer(uint id) external {
          touched = beforeProducer(id);
          require(true);
        }
      }
    `, KERNEL);

    const assertNoAuthenticatedAlias = (name: string, functionNames: string[]): void => {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
      const fn = artifact.abi.find((candidate) => candidate.name === name);
      expect(fn?.externalCalls?.map((call) => call.functionName)).toEqual(functionNames);
      expect(fn?.resultConsumers ?? []).toEqual([]);
      expect(JSON.stringify(fn?.externalCalls)).not.toContain('producerResult');
    };
    assertNoAuthenticatedAlias('applyConditional', ['read', 'write']);
    assertNoAuthenticatedAlias('applyReassigned', ['read', 'write']);
    assertNoAuthenticatedAlias('applyBeforeProducer', ['write', 'read']);
  });

  it('authenticates an exact two-arm helper result join', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ISource {
        function read(uint id) external returns (uint value);
      }

      interface ISink {
        function write(uint value) external;
      }

      contract Coordinator {
        ISource immutable left;
        ISource immutable right;
        ISink immutable sink;
        uint touched;

        constructor(address left_, address right_, address sink_) {
          left = ISource(left_);
          right = ISource(right_);
          sink = ISink(sink_);
        }

        function select(uint id, bool chooseLeft) internal returns (uint value) {
          if (chooseLeft) {
            value = left.read(id);
          } else {
            value = right.read(id);
          }
          sink.write(value);
        }

        function apply(uint id, bool chooseLeft) external {
          touched = select(id, chooseLeft);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const fn = artifact.abi.find((candidate) => candidate.name === 'apply');
    expect(fn?.externalCalls?.map((call) => [call.callsiteId, call.functionName])).toEqual([
      [0, 'read'], [1, 'read'], [2, 'write'],
    ]);
    expect(fn?.externalCalls?.[2].argSources).toEqual([{
      kind: 'expression',
      expression: {
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        ifTrue: { kind: 'producerResult', callsiteId: 0, sourceCallsiteId: 0, resultIndex: 0, type: 'uint256' },
        ifFalse: { kind: 'producerResult', callsiteId: 1, sourceCallsiteId: 1, resultIndex: 0, type: 'uint256' },
      },
    }]);
    expect(fn?.resultConsumers).toEqual([
      { consumerCallsiteId: 2, argument: 0, producerCallsiteId: 0, producerSourceCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 2, argument: 0, producerCallsiteId: 1, producerSourceCallsiteId: 1, resultIndex: 0 },
    ]);
  });
});
