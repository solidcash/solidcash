import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const tally = (emit: string): string => `contract Tally() {
  int count;
  event Tick(int count);
  function tick() public { this.count = this.count + 1; ${emit} require(true); }
}`;
const SOURCE = tally('emit Tick(this.count);');
const OPTIONS = { forceStateful: true, messageBus: true, maximumInputBytes: 1_000_000, suppressWarnings: true };

describe('kernel batch row capacity', () => {
  it('derives the kernel row ceiling from the existing batch envelope, with matching effect frames', () => {
    // A top-level kernel emit streams with no event band; a conditional one keeps one event window per row.
    const artifact = compileString(tally('if (this.count > 0) emit Tick(this.count);'), {
      ...OPTIONS, messageBusKernel: true,
    });
    // Seven header bytes, twelve bytes per SCB1 row, and a one-byte row count.
    const maximum = Math.min(255, Math.floor((artifact.messageBus!.maximumBlobBytes - 7) / 12));
    expect(maximum).toBe(255);
    expect(artifact.messageBus!.maximumBlobBytes).toBe(10_000);
    expect(artifact.messageBus!.maximumRows).toBe(maximum);
    expect(artifact.messageBus!.resourceBudgets?.maximumRows).toBe(maximum);
    expect(artifact.messageBus!.route.blockLayout!.slots.filter((slot) => slot.kind === 'event')).toHaveLength(maximum);
  });

  it('preserves the explicit legacy unroll ceiling', () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: false });
    expect(artifact.messageBus!.maximumRows).toBe(8);
    expect(artifact.messageBus!.maximumBlobBytes).toBe(520);
    expect(artifact.messageBus!.convention).toBe('legacy-unroll');
  });
});
