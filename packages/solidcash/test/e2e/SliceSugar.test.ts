import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// `x[a:b]` index-range syntax is sugar for `x.slice(a, b)` (byte-identical output).
const SOURCE = `
contract SliceSugar() {
    function check(bytes data) {
        // data = 0x00112233; data[1:3] == 0x1122
        require(data[1:3] == 0x1122);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('Index-range slice sugar x[a:b]', () => {
  it('slices the same bytes as .slice() on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(Uint8Array.from([0x00, 0x11, 0x22, 0x33]))).resolves.toBeDefined();
  });

  it('fails when the slice does not match', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(Uint8Array.from([0x00, 0x99, 0x99, 0x33])))
      .rejects.toThrow(verifyFailure);
  });
});
