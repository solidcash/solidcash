import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

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

async function spend(fn: string, b: Uint8Array): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call[fn](b); // thenable: the caller awaits, which sends
}

describe('Tuple destructuring with skipped slots', () => {
  it('(, y) keeps the second value', async () => {
    await expect(spend('keepSecond', Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
  it('(x, ) keeps the first value', async () => {
    await expect(spend('keepFirst', Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });
});
