import { describe, expect, it } from 'vitest';
import type { AbiFunction } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

const options = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
};
const compileWriter = (body: string): AbiFunction => compileString(`pragma solidity ^0.8.0;
  struct Record { uint256 amount; bytes payload; uint32 writtenAt; }
  interface IMeasure { function read() external returns (uint256); }
  contract Archive {
    uint256 fee;
    mapping(uint256 => Record) records;
    function store(uint256 key, uint256 amount, bytes payload, bool measure, address meter) public {
      ${body}
      require(true);
    }
  }
`, options).abi.find((fn) => fn.name === 'store')!;

describe('computed whole-value mutation recipes', () => {
  it('publishes an exact incoming-entry read for a partial struct update', () => {
    const handler = compileWriter('records[key].amount = amount;');
    const recipe = handler.entryAccesses?.[0].storedValueSource;
    expect(recipe).toMatchObject({
      version: 1, execution: 'unconditional-once', valueType: 'Record',
      expression: { kind: 'call', name: 'Record', args: [
        { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        { kind: 'field', name: 'payload', expression: {
          kind: 'entryPreValue', name: 'records', type: 'Record',
          args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }],
        } },
        { kind: 'field', name: 'writtenAt', expression: { kind: 'entryPreValue', name: 'records' } },
      ] },
    });
  });

  it('tracks lowered fixed-array updates and scalar pure helper results', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { bytes payload; int16[2] marks; }
      function magnitude(int16 value) pure returns (int16) { return value >= 0 ? value : -value; }
      contract Archive {
        mapping(uint256 => Record) records;
        function update(uint256 key) public {
          Record memory record = records[key];
          record.marks[0] = magnitude(record.marks[0]) + 1;
          record.marks[1] = magnitude(record.marks[1]);
          records[key].marks = record.marks;
          require(true);
        }
      }`, options);
    const recipe = artifact.abi.find((fn) => fn.name === 'update')?.entryAccesses?.[0].storedValueSource;
    expect(recipe).toBeDefined();
    expect(JSON.stringify(recipe)).toContain('entryPreValue');
    expect(JSON.stringify(recipe)).toContain('ternary');
  });

  it('does not treat a read-only helper as memory-pure', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 amount; bytes payload; }
      contract Archive {
        mapping(uint256 => Record) records;
        function change(bytes memory value) internal pure returns (bool) {
          value[0] = bytes1(0x55);
          return true;
        }
        function store(uint256 key, bytes memory payload) public {
          bytes memory aliasValue = payload;
          require(change(aliasValue));
          records[key] = Record(1, payload);
          require(true);
        }
      }
    `, options);
    expect(artifact.abi.find((fn) => fn.name === 'store')?.entryAccesses?.[0].storedValueSource).toBeUndefined();
  });

  it('publishes typed struct fields, state reads, and joined branch-local assignments', () => {
    const handler = compileWriter(`
      uint256 adjusted = amount;
      if (measure) adjusted = amount + fee;
      Record value = Record(adjusted, payload, uint32(block.timestamp));
      records[key] = value;
    `);
    const access = handler.entryAccesses?.[0];
    expect(handler.sourceEffectOrder).toBe('unsupported-flow');
    expect(access?.storedValueSource).toMatchObject({
      version: 1, execution: 'unconditional-once', valueType: 'Record',
      mutationEffectOrdinal: access?.mutationEffectOrdinals?.[0],
      expression: {
        kind: 'call', name: 'Record', type: 'Record',
        args: [
          {
            kind: 'ternary', type: 'uint256',
            condition: { kind: 'source', source: { kind: 'forward', paramIndex: 3 } },
            ifTrue: { kind: 'binary', operator: '+', right: { kind: 'state', name: 'fee' } },
            ifFalse: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
          },
          { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
          { kind: 'cast', type: 'uint32', expression: { kind: 'state', name: '__block_timestamp' } },
        ],
      },
    });
  });

  it('binds a computed value to both returning callsites without reexecuting either producer', () => {
    const handler = compileWriter(`
      uint256 adjusted = amount;
      if (measure) {
        uint256 beforeValue = IMeasure(meter).read();
        uint256 afterValue = IMeasure(meter).read();
        adjusted = afterValue - beforeValue;
      }
      records[key] = Record(adjusted, payload, uint32(block.timestamp));
    `);
    const branch = handler.entryAccesses?.[0].storedValueSource?.expression.args?.[0];
    expect(branch?.ifTrue).toMatchObject({
      kind: 'binary', operator: '-',
      left: { kind: 'producerResult', callsiteId: 1, resultIndex: 0, type: 'uint256' },
      right: { kind: 'producerResult', callsiteId: 0, resultIndex: 0, type: 'uint256' },
    });
  });

  it.each([
    'if (measure) records[key] = Record(amount, payload, 0);',
    'if (measure) return; records[key] = Record(amount, payload, 0);',
    'records[key] = Record(amount, payload, 0); records[key + 1] = Record(amount, payload, 0);',
    'while (measure) { records[key] = Record(amount, payload, 0); }',
  ])('refuses an ambiguous or conditional whole-value producer: %s', (body) => {
    const handler = compileWriter(body);
    expect(handler.entryAccesses?.length).toBeGreaterThan(0);
    for (const access of handler.entryAccesses ?? []) expect(access.storedValueSource).toBeUndefined();
  });

  it('tracks an assignment in an unconditional require before the whole-value write', () => {
    const handler = compileWriter(
      'require((amount = amount + 1) > 0); records[key] = Record(amount, payload, 0);',
    );
    const access = handler.entryAccesses?.[0];
    expect(access?.storedValueSource).toMatchObject({
      version: 1, execution: 'unconditional-once',
      mutationEffectOrdinal: access?.mutationEffectOrdinals?.[0],
      expression: { kind: 'call', name: 'Record' },
    });
    // `amount = amount + 1` already has the uint256 field width, so the record field is that addition.
    expect(access?.storedValueSource?.expression.args?.[0]).toMatchObject({
      kind: 'binary', operator: '+', type: 'uint256',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      right: { kind: 'literal', value: '1' },
    });
  });

  it('publishes no recipe for a value a Yul word builtin computes', () => {
    // Yul add wraps mod 2^256, which a recipe's `+` does not state.
    const handler = compileWriter('uint256 r; assembly { r := add(amount, 1) } records[key].amount = r;');
    expect(handler.entryAccesses?.[0]).toBeDefined();
    expect(handler.entryAccesses?.[0].storedValueSource).toBeUndefined();
  });
});
