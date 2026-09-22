import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

const handler = (source: string, name: string): NonNullable<
ReturnType<typeof compileString>['messageBus']
>['handlers'][number] | undefined => compileString(source, OPTIONS)
  .messageBus?.handlers.find((candidate) => candidate.name === name);

describe('kernel dynamic arrays of struct results', () => {
  it.each([
    [
      'fixed-layout records',
      'struct Record { uint256 id; bool active; }',
      'records[0] = Record(7, true); records[1] = Record(9, false);',
    ],
    [
      'records with nested dynamic leaves',
      'struct Detail { string label; } struct Record { uint256 id; Detail detail; bytes payload; }',
      'records[0] = Record(7, Detail("first"), hex"aabb"); '
        + 'records[1] = Record(9, Detail("second"), hex"ccdd");',
    ],
  ])('admits runtime-constructed %s under the cumulative result ceiling', (
    _label, declarations, initialize,
  ) => {
    const selected = handler(`pragma solidity ^0.8.0;
      ${declarations}
      contract Source {
        function read() public pure returns (Record[] memory) {
          Record[] memory records = new Record[](2);
          ${initialize}
          return records;
        }
        function control() public { require(true); }
      }`, 'read');
    expect(selected).toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
  });

  it('keeps recursive struct-array layouts outside the result surface', () => {
    expect(() => handler(`pragma solidity ^0.8.0;
      struct Node { uint256 value; Node[] children; }
      contract Source {
        function read() public pure returns (Node[] memory) {
          Node[] memory nodes = new Node[](0);
          return nodes;
        }
      }`, 'read')).toThrow(/cannot be used as return values|recursive/i);
  });

  it('keeps mapping-bearing struct-array layouts outside the result surface', () => {
    expect(() => handler(`pragma solidity ^0.8.0;
      struct Record { uint256 id; mapping(uint256 => uint256) values; }
      contract Source {
        function read() public pure returns (Record[] memory) {
          Record[] memory records;
          return records;
        }
    }`, 'read')).toThrow(/mapping|return|memory/i);
  });

  it('admits a directly loaded state-backed struct array through authenticated dynamic reads', () => {
    const selected = handler(`pragma solidity ^0.8.0;
      struct Record { uint256 id; bool active; }
      contract Source {
        Record[] records;
        function read() public view returns (Record[] memory) { return this.records; }
      }`, 'read');
    expect(selected).toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
  });
});
