import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * keccak256 side-car slot accounting: straight-line calls beside a runtime keccak loop reserve one fixed slot
 * each, at their emission index, while the loop call takes none.
 */

interface AbiRow {
  name: string;
  keccakInLoop?: boolean;
  keccakPreimageParams?: (string | null)[];
  blockLayout?: { blockSize: number; slots: { kind: string; slotIndex?: number }[] };
}

const sideCarSlots = (row: AbiRow | undefined): (number | undefined)[] => (row?.blockLayout?.slots ?? [])
  .filter((slot) => slot.kind === 'keccakSideCar').map((slot) => slot.slotIndex);

const FIXED_AND_RUNTIME_LOOP = `
pragma solidity ^0.8.26;
contract DigestTree {
    bytes32[] public nodes;

    constructor() {
        string[2] memory leaves = ["left leaf", "right leaf"];
        for (uint256 i = 0; i < leaves.length; i++) {
            nodes.push(keccak256(abi.encodePacked(leaves[i])));
        }
        uint256 n = leaves.length;
        uint256 offset = 0;
        while (n > 1) {
            for (uint256 i = 0; i < n; i += 2) {
                bytes32 left = nodes[offset + i];
                bytes32 right;
                if (i + 1 < n) {
                    right = nodes[offset + i + 1];
                } else {
                    right = left;
                }
                nodes.push(keccak256(abi.encodePacked(left, right)));
            }
            offset += n;
            n = (n + 1) / 2;
        }
    }

    function root() public view returns (bytes32) {
        return nodes[nodes.length - 1];
    }
}
`;

describe('keccak256 side-car slots: straight-line calls beside a runtime keccak loop', () => {
  it('the unrolled calls reserve fixed slots at their emission indices; the loop call takes none', () => {
    const artifact = compileString(FIXED_AND_RUNTIME_LOOP, { evmCompat: true }) as unknown as { abi: AbiRow[] };
    const constructor = artifact.abi.find((row) => row.name === '__construct');
    expect(constructor?.keccakInLoop).toBe(true);
    expect(constructor?.keccakPreimageParams).toHaveLength(3);
    expect(sideCarSlots(constructor)).toEqual([0, 1]);
  });
});
