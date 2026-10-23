import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// Pins the canonical front-region order of the stateful block layout before the unified auxiliary-band
// refactor: master + dataNft first, then every auxiliary co-spend family (external read, blockhash oracle,
// block-info oracle, keccak side-car, ecrecover side-car) in one contiguous band. External-call reservations
// advance the offset without producing a slot, so they must not appear in `slots`; the entries/transfer/event
// tail must contain no auxiliary kind.

const SOURCE = `
pragma solidcash ^0.14.0;

interface ICounter {
    public int counter;
    function getAndIncrement() returns (int);
}

contract AuxBand(bytes counterAddr) {
    int last;

    function run(bytes32 x, bytes32 h, bytes32 r, bytes32 s, int n, bytes32 expect) {
        require(blockhash(n) == expect);
        require(block.timestamp >= 0);
        bytes32 kh = keccak256(x);
        address recovered = ecrecover(h, 1, r, s);
        int val = ICounter(counterAddr).counter;
        int result = ICounter(counterAddr).getAndIncrement();
        this.last = val + result;
        require(recovered != address(0) && kh != bytes32(0));
    }
}
`;

const AUX_KINDS = [
  'lowLevelCall',
  'readOnlyDataNft',
  'blockhashOracle',
  'blockInfoOracle',
  'keccakSideCar',
  'ecrecoverSideCar',
] as const;

describe('block layout: unified auxiliary front band', () => {
  it('places every auxiliary family in one contiguous front band after master + dataNft', () => {
    const artifact = compileString(SOURCE, { ecrecover: 'p2pkh' });
    const fn = artifact.abi.find((entry) => entry.name === 'run');
    expect(fn?.blockLayout).toBeDefined();
    const slots = fn!.blockLayout!.slots;

    // Master stays at offset 0.
    expect(slots[0]).toMatchObject({ kind: 'master', offset: 0 });

    // One packed int state variable -> one data NFT immediately after master.
    const dataNftCount = slots.filter((slot) => slot.kind === 'dataNft').length;
    expect(dataNftCount).toBe(1);
    expect(slots[1]).toMatchObject({ kind: 'dataNft', offset: 1 });

    const bandBase = 1 + dataNftCount;
    expect(bandBase).toBe(2);

    // The auxiliary band is contiguous: canonical order, consecutive offsets, then a tail with no aux kind.
    const auxEnd = slots.findIndex((slot, index) => index >= bandBase && !AUX_KINDS.includes(slot.kind as any));
    const band = slots.slice(bandBase, auxEnd === -1 ? undefined : auxEnd);
    expect(band.map((slot) => slot.kind)).toEqual([
      'readOnlyDataNft',
      'blockhashOracle',
      'blockInfoOracle',
      'keccakSideCar',
      'ecrecoverSideCar',
      'ecrecoverSideCar',
      'ecrecoverSideCar',
    ]);
    expect(band.map((slot) => slot.offset)).toEqual([2, 3, 4, 5, 6, 7, 8]);

    // No auxiliary kind appears before the band (after master/dataNft) or elsewhere in the tail.
    const tail = auxEnd === -1 ? [] : slots.slice(auxEnd);
    for (const slot of [...slots.slice(1, bandBase), ...tail]) {
      expect(AUX_KINDS.includes(slot.kind as any), `auxiliary slot ${slot.kind} leaked outside the band`).toBe(false);
    }

    // The external read is index 0; keccak is slot 0; ecrecover is one A/M/B triple.
    expect(band[0]).toMatchObject({ kind: 'readOnlyDataNft', slotIndex: 0 });
    expect(band[3]).toMatchObject({ kind: 'keccakSideCar', slotIndex: 0 });
    expect(band.slice(4).map((slot) => slot.slotIndex)).toEqual([0, 1, 2]);
  });
});
