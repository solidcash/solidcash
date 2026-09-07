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

const source = (arrayType: 'Record[2]' | 'Record[]'): string => `pragma solidity ^0.8.0;
  struct Detail { uint16 code; uint8 status; }
  struct Record { uint256 value; Detail detail; bytes4 tag; }
  contract Source {
    function read() public pure returns (${arrayType} memory) {
      ${arrayType} memory records${arrayType === 'Record[]' ? ' = new Record[](2)' : ''};
      records[0] = Record(9, Detail(70, 1), hex"aabbccdd");
      records[1] = Record(12, Detail(80, 0), hex"01020304");
      return records;
    }
  }`;

describe('kernel arrays of struct results', () => {
  it('admits a fixed-size array with a finite struct element layout', () => {
    const artifact = compileString(source('Record[2]'), OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Record[2]' }],
    });
  });

  it('keeps an unbounded array of structs behind the layout fence', () => {
    const artifact = compileString(source('Record[]'), OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('keeps a fixed array with a dynamically-sized struct field behind the layout fence', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; bytes payload; }
      contract Source {
        function read() public pure returns (Record[2] memory) {
          Record[2] memory records;
          records[0] = Record(9, hex"aabb");
          records[1] = Record(12, hex"ccdd");
          return records;
        }
      }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
