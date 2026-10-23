import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';

describe('recursive derived invariant mapping key authentication', () => {
  it('fails closed while read and write streams require different settlement phases', () => {
    const artifact = compileString(`contract Register() {
      mapping(int => mapping(int => int)) source;
      mapping(int => int) result;
      function seed(int outer, int inner, int value) public {
        this.source[outer][inner] = value;
        require(true);
      }
      function copy(int remaining, int scope) public returns (int) {
        if (remaining == 0) return 0;
        int terminal = copy(remaining - 1, scope);
        this.result[remaining] = this.source[remaining][scope + 1] + terminal;
        return terminal;
      }
      function check(int key, int expected) public { require(this.result[key] == expected); }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });

    const copy = artifact.messageBus?.handlers.find((handler) => handler.name === 'copy');
    const streams = artifact.abi.find((entry) => entry.name === 'copy')?.sortedUpsertLoopInfo;
    expect(streams?.map((stream) => stream.settlementIdentity?.recordDispositionSource)).toEqual([
      'authenticated-carrier', 'mutation-settlement',
    ]);
    expect(copy).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(() => encodeMessageBatch(artifact, [{ function: 'copy', args: [3n, 8n] }]))
      .toThrow("Handler 'copy' is not batch eligible: KERNEL_LAYOUT");
  });
});
