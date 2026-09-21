import { describe, expect, it } from 'vitest';
import { blockInputOffset, blockInputSize } from '../src/block-layout.js';
describe('block input-coordinate projection', () => {
    const mixedTwoRowDeploy = {
        blockSize: 11,
        slots: [
            { kind: 'master', offset: 0 },
            { kind: 'dataNft', offset: 1, nftIndex: 0 },
            { kind: 'event', offset: 2, slotIndex: 0 },
            { kind: 'transfer', offset: 3, slotIndex: 0 },
            { kind: 'deploy', offset: 4, slotIndex: 0 },
            { kind: 'deployDataNft', offset: 5, slotIndex: 0, nftIndex: 0 },
            { kind: 'deployDataNft', offset: 6, slotIndex: 0, nftIndex: 1 },
            { kind: 'deploy', offset: 7, slotIndex: 1 },
            { kind: 'deployDataNft', offset: 8, slotIndex: 1, nftIndex: 0 },
            { kind: 'deployDataNft', offset: 9, slotIndex: 1, nftIndex: 1 },
            { kind: 'trailing', offset: 10 },
        ],
    };
    it('projects preceding effects and multi-row child data outputs out of input coordinates', () => {
        expect(blockInputOffset(mixedTwoRowDeploy, 4)).toBe(2);
        expect(blockInputOffset(mixedTwoRowDeploy, 7)).toBe(3);
        expect(blockInputOffset(mixedTwoRowDeploy, 10)).toBe(4);
        expect(blockInputSize(mixedTwoRowDeploy)).toBe(5);
    });
    it('rejects hostile out-of-range and multiply claimed layout coordinates', () => {
        expect(() => blockInputOffset(mixedTwoRowDeploy, 11)).toThrow(/outside/);
        expect(() => blockInputOffset({
            blockSize: 2,
            slots: [{ kind: 'master', offset: 0 }, { kind: 'dataNft', offset: 0 }],
        }, 0)).toThrow(/multiple slots/);
    });
});
//# sourceMappingURL=block-layout.test.js.map