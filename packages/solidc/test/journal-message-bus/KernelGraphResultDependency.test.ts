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
          kind: 'externalCall', callsiteId: 0,
        } } },
        { kind: 'expression', expression: { kind: 'field', expression: {
          kind: 'externalCall', callsiteId: 0,
        } } },
      ],
    });
  });
});
