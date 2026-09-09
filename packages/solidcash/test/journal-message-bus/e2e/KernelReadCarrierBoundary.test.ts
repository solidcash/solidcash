import { compileString } from 'solidc';
import { describe, expect, it, vi } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

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
  it('rejects repeated clean reads before broadcast while the carrier protocol is unpublished', async () => {
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus).toMatchObject({
      convention: 'kernel-row-loop',
      available: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.kernelEntryJournal?.capabilities?.some(
      (capability) => capability.kind === 'internal-read-carrier',
    ) ?? false).toBe(false);

    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.seed(1n, 11n).send();
    await contract.call.seed(0n, 10n).send();

    const broadcast = vi.spyOn(provider, 'sendRawTransaction');
    try {
      const batch = contract.batch([
        { function: 'copy', args: [2n] },
        { function: 'copy', args: [2n] },
      ]);
      await expect(batch.send()).rejects.toThrow(
        /runtime mapping rows overlap the 'source' pre-state journal.*read-your-writes transition/s,
      );
      expect(broadcast).not.toHaveBeenCalled();
    } finally {
      broadcast.mockRestore();
    }
  }, 180_000);
});
