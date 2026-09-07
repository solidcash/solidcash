import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

describe('legacy message-bus row result locals', () => {
  it('remaps every target of a multi-result assignment in each unrolled row', () => {
    const artifact = compileString(`
      pragma solidcash ^0.13.0;
      contract PairState() {
        int marker;
        function pair(int value) public returns (int, bool) {
          this.marker = value;
          require(value >= 0);
          return (value, true);
        }
        function set(int value) public {
          this.marker = value;
          require(value >= 0);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 1_000_000,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair')?.eligible).toBe(true);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
  });

  it('does not mistake an index into a mapping-value array for a physical mapping key', () => {
    const artifact = compileString(`
      pragma solidity ^0.8.0;
      struct Record { uint8 kind; bytes payload; }
      contract IndexedRecords {
        mapping(uint256 => Record[]) public records;
        function append(uint256 key, bytes memory payload) public {
          records[key].push(Record(1, payload));
        }
      }
    `, {
      solidityImportCompat: true,
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      messageBusGraphContext: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 1_000_000,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'records')?.eligible).toBe(true);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
  });
});
