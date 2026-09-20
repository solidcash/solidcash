import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel ecrecoverEvm + keccak sidecar under composition', () => {
  it('ecrecoverEvm handler publishes keccakSideCar beside ecrecoverSideCar under KERNEL', () => {
    // Product-default cells use ecrecoverPubKey. This thin structural Kernel* proves ecrecoverEvm
    // reserves an extra keccakSideCar (uncompressed-key digest) in the kernel route layout.
    // Full compose settle under messageBusKernel currently fails closed on invalid sidecar input
    // indexing; keep that as a named SDK gap rather than a false green settle.
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc(bytes20 owner) {
        int counter;
        function recoverEvm(bytes32 digest, int vv, bytes32 rr, bytes32 ss) public {
          require(ecrecoverEvm(digest, vv, rr, ss) == owner);
          this.counter = this.counter + 1;
        }
      }`, KERNEL);
    const recoverAbi = artifact.abi.find((entry) => entry.name === 'recoverEvm');
    expect(recoverAbi?.ecrecoverEvmFlags).toEqual([true]);
    expect(recoverAbi?.ecrecoverCompute).toBe(true);

    const slots = artifact.messageBus!.route.blockLayout!.slots;
    const ecrecoverSlots = slots.filter((slot) => slot.kind === 'ecrecoverSideCar');
    const keccakSlots = slots.filter((slot) => slot.kind === 'keccakSideCar');
    expect(ecrecoverSlots.length).toBeGreaterThanOrEqual(2);
    expect(keccakSlots.length).toBeGreaterThanOrEqual(1);
    // Keccak slot sits in the Acc block (extra co-spend for EVM projection), not only ecrecover A/B.
    expect(keccakSlots[0].offset).toBeGreaterThanOrEqual(0);
    expect(ecrecoverSlots.every((slot) => slot.offset !== keccakSlots[0].offset)).toBe(true);
  });
});
