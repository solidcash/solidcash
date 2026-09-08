import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  solidityImportCompat: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  optimizeForCompilationSpeed: false,
  suppressWarnings: true,
} as const;

describe('kernel graph result dependencies', () => {
  it('keeps a multi-result producer behind one invoke boundary when no later edge consumes it', () => {
    const artifact = compileString(`pragma solidcash ^0.13.0;
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
      solidityImportCompat: false,
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
      { consumerCallsiteId: 1, argument: 1, producerCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 1, argument: 2, producerCallsiteId: 0, resultIndex: 1 },
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
      { kind: 'expression', expression: { kind: 'producerResult', callsiteId: 0, resultIndex: 0 } },
      { kind: 'expression', expression: { kind: 'producerResult', callsiteId: 0, resultIndex: 1 } },
      { kind: 'expression', expression: { kind: 'producerResult', callsiteId: 1, resultIndex: 0 } },
      { kind: 'expression', expression: { kind: 'producerResult', callsiteId: 1, resultIndex: 1 } },
    ]);
    expect(artifact.abi.find((fn) => fn.name === 'apply')?.resultConsumers).toEqual([
      { consumerCallsiteId: 2, argument: 0, producerCallsiteId: 0, resultIndex: 0 },
      { consumerCallsiteId: 2, argument: 1, producerCallsiteId: 0, resultIndex: 1 },
      { consumerCallsiteId: 2, argument: 2, producerCallsiteId: 1, resultIndex: 0 },
      { consumerCallsiteId: 2, argument: 3, producerCallsiteId: 1, resultIndex: 1 },
    ]);
  });
});
