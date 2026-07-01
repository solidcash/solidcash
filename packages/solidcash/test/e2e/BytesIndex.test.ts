import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// bytesN[k] returns the k-th byte (bytes1): literal index (b[1]) and variable index (b[k]).
// Compiled with { forceStateful: true } so each spend is the short `await sc.call.f(b, k)` self-poke covenant.
const SOURCE = `
contract BytesIndex() {
    function f(bytes4 b, int k) {
        require(b[1] == 0x11);   // literal index
        require(b[k] == 0x22);   // variable index
    }
}
`;

async function spend(b: Uint8Array, k: bigint): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call.f(b, k); // thenable: the caller awaits, which sends
}

describe('bytesN single-byte index', () => {
  it('indexes the k-th byte (literal and variable index)', async () => {
    // 0x00112233: [1]=0x11, [2]=0x22
    await expect(spend(Uint8Array.from([0x00, 0x11, 0x22, 0x33]), 2n)).resolves.toBeDefined();
  });
  it('fails when the indexed byte does not match', async () => {
    await expect(spend(Uint8Array.from([0x00, 0x11, 0x99, 0x33]), 2n)).rejects.toThrow();
  });
});
