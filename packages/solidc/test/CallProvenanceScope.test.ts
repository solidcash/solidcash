import { describe, expect, it } from 'vitest';
import type { ExternalCallArgSource } from '@solidcash/utils';
import { compileString } from '../src/compiler.js';

describe('external-call operand provenance stays in its executable body', () => {
  it('does not count an uninvoked function pointer target as an array push', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function ping(uint256 count) external; }
      contract Counter {
        uint256[] values;
        function hidden() internal { values.push(9); }
        function read(address sink) public {
          function() internal unused = hidden;
          ISink(sink).ping(values.length);
        }
        function add(address sink) public {
          function() internal unused = hidden;
          values.push(1);
          ISink(sink).ping(values.length);
        }
      }
    `, { evmCompat: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
    const length = (entry: string): ExternalCallArgSource => artifact.abi.find((fn) => fn.name === entry)!
      .externalCalls![0]!.argSources![0]!;
    expect(length('read')).toEqual({
      kind: 'expression',
      expression: { kind: 'unary', operator: '.length', expression: { kind: 'state', name: 'values' } },
    });
    expect(length('add')).toEqual({
      kind: 'expression',
      expression: { kind: 'unary', operator: '.length', expression: { kind: 'state', name: 'values' }, value: '1' },
    });
  });

  it('keeps the statement prefix when reconstructing successive writes to one local', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function ping(uint256 first, uint256 second) external; }
      contract Counter {
        function go(address sink, uint256 seed) public {
          uint256 value = seed;
          value = value + 1;
          value = value * 2;
          ISink(sink).ping(value, value + 1);
        }
      }
    `, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    const incremented = {
      kind: 'binary', operator: '+', type: 'uint256',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    };
    const doubled = {
      kind: 'binary', operator: '*', type: 'uint256', left: incremented,
      right: { kind: 'literal', type: 'bigint', value: '2' },
    };
    expect(artifact.abi.find((fn) => fn.name === 'go')!.externalCalls![0]!.argSources).toEqual([
      { kind: 'expression', expression: doubled },
      {
        kind: 'expression',
        expression: {
          kind: 'binary', operator: '+', left: doubled,
          right: { kind: 'literal', type: 'bigint', value: '1' },
        },
      },
    ]);
  });

  it('projects typed fields through a framed struct join without depending on unused producer fields', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      struct Details { uint8 status; bool active; string note; uint256 unused; }
      interface IProducer { function value() external returns (uint256); }
      interface ISink { function ping(uint8 status, bool active) external; }
      contract Registry {
        function go(address producer, address sink, bool choose) public {
          uint256 produced = IProducer(producer).value();
          Details memory row = Details(2, true, "original", produced);
          if (choose) { row = Details(3, false, "alternate", produced); }
          else { row = Details(2, true, "original", produced); }
          ISink(sink).ping(row.status, row.active);
        }
      }
    `, { composition: 'framed', evmCompat: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
    const fn = artifact.abi.find((entry) => entry.name === 'go')!;
    expect(fn.externalCalls).toHaveLength(2);
    expect(fn.resultConsumers ?? []).toEqual([]);
    const condition = { kind: 'source', source: { kind: 'forward', paramIndex: 2 } };
    expect(fn.externalCalls![1]!.argSources).toEqual([
      {
        kind: 'expression',
        expression: {
          kind: 'ternary', type: 'uint8', condition,
          ifTrue: { kind: 'literal', type: 'uint8', value: '3' },
          ifFalse: { kind: 'literal', type: 'uint8', value: '2' },
        },
      },
      {
        kind: 'expression',
        expression: {
          kind: 'ternary', type: 'bool', condition,
          ifTrue: { kind: 'literal', type: 'bool', value: false },
          ifFalse: { kind: 'literal', type: 'bool', value: true },
        },
      },
    ]);
  });

  it('serializes an untouched field without retaining successive whole-struct rebuilds', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      struct Row { uint8 status; uint256 second; uint256 third; uint256 fourth; string note; address owner; }
      interface ISink { function ping(uint8 status) external; }
      contract Registry {
        Row[] rows;
        function go(uint256 id, address sink) public {
          Row storage row = rows[id];
          row.status = 1; row.second = 2; row.third = 3; row.fourth = 4;
          require(row.owner == msg.sender);
          ISink(sink).ping(row.status);
        }
      }
    `, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    const calls = artifact.abi.find((entry) => entry.name === 'go')!.externalCalls!;
    expect(calls[0]!.preCallRequires).toEqual([
      {
        kind: 'binary', operator: '==',
        left: {
          kind: 'field', name: 'owner', type: 'address',
          expression: {
            kind: 'stateAccess', name: 'rows', type: 'Row',
            args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }],
          },
        },
        right: { kind: 'source', source: { kind: 'msgSender' }, type: 'address' },
      },
    ]);
    expect(JSON.stringify(calls).length).toBeLessThan(2_000);
  });
});
