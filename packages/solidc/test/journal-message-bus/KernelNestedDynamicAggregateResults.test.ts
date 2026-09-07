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

const handler = (source: string, name: string) => compileString(source, OPTIONS)
  .messageBus?.handlers.find((candidate) => candidate.name === name);

describe('kernel nested dynamic aggregate results', () => {
  it('admits a mapping-backed struct result containing nested runtime arrays', () => {
    const selected = handler(`pragma solidity ^0.8.0;
      struct Record { uint256 id; string title; string[] labels; bytes payload; }
      contract Source {
        mapping(uint256 => Record) records;
        function read(uint256 id) public view returns (Record memory) { return records[id]; }
        function control() public { require(true); }
      }`, 'read');
    expect(selected).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Record' }],
    });
  });

  it.each([
    ['a struct with string[]', 'struct Record { string[] values; }', 'Record'],
    ['a fixed aggregate with uint256[][]', '', 'uint256[][2]'],
    ['a struct with nested string[][]', 'struct Record { string[][] values; }', 'Record'],
  ])('admits %s under the cumulative result ceiling', (_label, declarations, resultType) => {
    const selected = handler(`pragma solidity ^0.8.0;
      ${declarations}
      contract Source {
        function read() public pure returns (${resultType} memory) {
          ${resultType} memory value;
          return value;
        }
      }`, 'read');
    expect(selected).toMatchObject({ eligible: true, outputs: [{ type: resultType }] });
  });

  it('keeps a recursively materialized struct layout behind KERNEL_LAYOUT', () => {
    expect(() => handler(`pragma solidity ^0.8.0;
        struct Node { uint256 value; Node[] children; }
        contract Source {
          Node root;
          function read() public view returns (Node memory) { return root; }
          function control() public { require(true); }
        }`, 'read')).toThrow(/cannot be used as return values|recursive/i);
  });

  it('keeps an unbounded top-level array of structs behind KERNEL_LAYOUT', () => {
    const selected = handler(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string[] labels; }
      contract Source {
        Record[] records;
        function read() public view returns (Record[] memory) { return records; }
        function control() public { require(true); }
      }`, 'read');
    expect(selected).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
