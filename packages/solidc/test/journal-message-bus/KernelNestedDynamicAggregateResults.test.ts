import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const handler = (source: string, name: string):
NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number] | undefined => compileString(source, OPTIONS)
  .messageBus?.handlers.find((candidate) => candidate.name === name);

describe('kernel nested dynamic aggregate results', () => {
  it('publishes a raw preimage witness for a dynamically sized external struct result', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string label; }
      interface ISource { function read() external returns (Record memory); }
      contract Consumer {
        address source;
        constructor(address source_) { source = source_; }
        function consume() public {
          Record memory record = ISource(source).read();
          require(record.value == 7);
        }
      }`, OPTIONS);
    const inputNames = artifact.abi.find((entry) => entry.name === 'consume')?.inputs.map((input) => input.name);
    expect(inputNames).toContain('__internal__externalReturnPreimage');
  });

  it('caps mixed top-level and nested runtime-sized results as one cumulative vector', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Envelope { string[] labels; }
      contract Source {
        function read(bytes memory payload) public pure
          returns (bytes memory, uint256[] memory, Envelope memory) {
          uint256[] memory values = new uint256[](1);
          values[0] = payload.length;
          string[] memory labels = new string[](1);
          labels[0] = "ready";
          return (payload, values, Envelope(labels));
        }
      }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [
        { type: 'bytes' }, { type: 'uint256[]' }, { type: 'Envelope' },
      ] });
    const route = artifact.functionBodies?.['53434231'];
    expect(route).toBeDefined();
    const asm = bytecodeToAsm(Uint8Array.from(Buffer.from(route!, 'hex')));
    // 0x2710 (10,000) is minimally encoded little-endian as 0x1027. The guard applies after every row result
    // has been concatenated, so separate dynamic components and repeated rows share one BCH item budget.
    expect(asm).toMatch(/OP_SIZE OP_NIP 1027 OP_LESSTHANOREQUAL OP_VERIFY/);
  });

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

  it('publishes an authenticated dynamic-read run for a state-backed struct array', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; string[] labels; }
      contract Source {
        Record[] records;
        function read() public view returns (Record[] memory) { return records; }
        function control() public { require(true); }
      }`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record[]' }] });
    expect(artifact.abi.find((entry) => entry.name === 'read')?.dynamicReads).toEqual(['records']);
    expect(artifact.messageBus?.route.dynamicReads).toEqual(['records']);
    expect(artifact.messageBus?.route.blockLayout).toMatchObject({
      trailingBase: expect.any(Number), trailingCapacity: 64,
    });
  });
});
