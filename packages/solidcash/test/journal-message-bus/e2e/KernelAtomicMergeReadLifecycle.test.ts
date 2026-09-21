import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

/**
 * Read-bearing merge is admitted with a preserve resourcePrefix (same geometry as split-read).
 * Full compose settlement for merge tails that execute state reads remains a follow-up: consumed
 * masters share the route unlocker and currently re-enter the handler body, which is unsafe for
 * NFT-relative state reads. Split-read compose is the settled proof of the preserve prefix.
 */
describe('kernel atomic merge read lifecycle admission', () => {
  it('admits merge(count) that reads fixed state with a preserve resourcePrefix', () => {
    const artifact = compileString(`contract Threads() {
      int public marker;
      function combine(bytes32 tag, int count) public merge(count) {
        require(this.marker > 0 && count > 0);
      }
      function idle() public { require(true); }
    }`, KERNEL);

    const combine = artifact.messageBus?.handlers.find((handler) => handler.name === 'combine');
    expect(combine).toMatchObject({
      eligible: true,
      lifecycleTopology: {
        version: 2,
        kind: 'merge',
        resourcePrefix: { mode: 'preserve', dataNftCount: 1, nftIndices: [0] },
      },
    });
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
    expect(artifact.messageBus?.route.blockLayout).toMatchObject({
      blockSize: 2,
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'dataNft', offset: 1 },
      ],
    });
  });
});
