import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Tuple destructuring with skipped slots: the skipped value is dropped, the kept value bound.
const SOURCE = `
contract TupleSkip() {
    function keepSecond(bytes b) {
        (, bytes y) = b.split(2);   // drop first half, keep second
        require(y == 0x2233);
    }
    function keepFirst(bytes b) {
        (bytes x, ) = b.split(2);   // keep first half, drop second
        require(x == 0x0011);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('Tuple destructuring with skipped slots', () => {
  it('(, y) keeps the second value', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.keepSecond(Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
  it('(x, ) keeps the first value', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.keepFirst(Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
});
