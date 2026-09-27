import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const SOURCE = `contract Tally() {
  int count;
  event Tick(int count);
  function tick() public { this.count = this.count + 1; emit Tick(this.count); require(true); }
}`;
const OPTIONS = { forceStateful: true, messageBus: true, maximumInputBytes: 1_000_000, suppressWarnings: true };

describe('kernel batch row capacity', () => {
  it('derives the kernel row ceiling from the existing batch envelope, with matching effect frames', () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: true });
    // Seven header bytes; each no-argument row still has twelve framing bytes and one call-options byte.
    const maximum = Math.floor((artifact.messageBus!.maximumBlobBytes - 7) / 13);
    expect(maximum).toBe(39);
    expect(artifact.messageBus!.maximumRows).toBe(maximum);
    expect(artifact.messageBus!.resourceBudgets?.maximumRows).toBe(maximum);
    expect(artifact.messageBus!.route.blockLayout!.slots.filter((slot) => slot.kind === 'event')).toHaveLength(maximum);
  });

  it('preserves the explicit legacy unroll ceiling', () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusKernel: false });
    expect(artifact.messageBus!.maximumRows).toBe(8);
    expect(artifact.messageBus!.convention).toBe('legacy-unroll');
  });
});
