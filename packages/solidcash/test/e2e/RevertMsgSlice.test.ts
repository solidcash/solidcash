import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// The OZ/BoringCrypto `_getRevertMsg` idiom advances a bytes-memory pointer past the 4-byte Error(string)
// selector via `_returnData := add(_returnData, 0x04)`. On BCH bytes are values, so this lowers to the slice
// `_returnData[4:]`. The covenant re-derives the tail and requires it byte-for-byte, so the spend only
// validates if `add(bytes, N)` sliced exactly the first N bytes off on the VM.
const SOURCE = `
contract RevertMsgSlice() {
    function check(bytes _returnData) {
        require(_returnData.length >= 10);
        assembly { _returnData := add(_returnData, 0x04) }
        require(_returnData == 0x040506070809);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

// 10 bytes 0x00..0x09; slicing the first 4 leaves 0x040506070809.
const INPUT = hexToBin('00010203040506070809');

describe('revert-msg slice (add(bytes,4) -> bytes[4:])', () => {
  it('slices exactly the first N bytes off a bytes value on the VM', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.check(INPUT)).resolves.toBeDefined();
  });
});
