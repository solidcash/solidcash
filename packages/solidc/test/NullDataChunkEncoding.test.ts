import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { compileString } from './direct-compile.js';

// `LockingBytecodeNullData` must build the same OP_RETURN script as the SDK's `addOpReturnOutput()`, i.e. each
// chunk as a minimal `encodeDataPush` (OP_0 for an empty chunk, a direct push for 1-75 bytes, OP_PUSHDATA1 for
// 76-255 bytes). Chunks whose value is known at compile time are emitted as a precomputed push, so the built
// script reads `6a <chunk push> OP_CAT ...` in the published bytecode. Without the fix, empty and 128-255 byte
// chunks used the wrong push opcode, and known chunks were sized with a runtime OP_SIZE instead.
describe('LockingBytecodeNullData chunk encoding', () => {
  it('precomputes the SDK push opcode for compile-time chunks', () => {
    const bigHex = 'aa'.repeat(200);
    const artifact = compileString(`contract C() {
      function spend() {
        bytes lb = new LockingBytecodeNullData([0x6d02, bytes('memo'), hex"${bigHex}", hex""]);
        require(lb.length > 0);
      }
    }`);

    const chunks = [
      hexToBin('6d02'),
      utf8ToBin('memo'),
      hexToBin(bigHex),
      new Uint8Array(),
    ];
    const chunkPushes = chunks.map((chunk) => binToHex(encodeDataPush(chunk))).join(' OP_CAT ');

    expect(artifact.bytecode).toContain(`6a ${chunkPushes} OP_CAT`);
  });
});
