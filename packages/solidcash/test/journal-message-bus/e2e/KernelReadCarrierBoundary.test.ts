import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';

const SOURCE = `contract ReadRows() {
  mapping(int => int) source;
  mapping(int => int) destination;

  function seed(int key, int value) public {
    this.source[key] = value;
    this.destination[key] = 0;
    require(true);
  }

  function copy(int count) public {
    for (int index = 0; index < count; index = index + 1) {
      this.destination[index] = this.source[index];
    }
    require(true);
  }
}`;

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel read-carrier capability boundary', () => {
  it('rejects repeated clean reads before broadcast while the carrier protocol is unpublished', () => {
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus).toMatchObject({
      convention: 'kernel-row-loop',
      available: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.kernelEntryJournal?.capabilities?.some(
      (capability) => capability.kind === 'internal-read-carrier',
    ) ?? false).toBe(false);

    expect(() => encodeMessageBatch(artifact, [{ function: 'copy', args: [2n] }]))
      .toThrow(/not batch eligible: KERNEL_LAYOUT/);
  });
});
