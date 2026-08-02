import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// bytesN[k] returns the k-th byte (bytes1): literal index (b[1]) and variable index (b[k]).
// Compiled with { forceStateful: true } so each spend is the short `await sc.f(b, k)` self-poke covenant.
const SOURCE = `
contract BytesIndex() {
    function f(bytes4 b, int k) {
        require(b[1] == 0x11);   // literal index
        require(b[k] == 0x22);   // variable index
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('bytesN single-byte index', () => {
  it('indexes the k-th byte (literal and variable index)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    // 0x00112233: [1]=0x11, [2]=0x22
    await expect(sc.f(Uint8Array.from([0x00, 0x11, 0x22, 0x33]), 2n)).resolves.toBeDefined();
  });
  it('fails when the indexed byte does not match', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.f(Uint8Array.from([0x00, 0x11, 0x99, 0x33]), 2n)).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
});
