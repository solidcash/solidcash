import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// A local `bytes` buffer is lowered to a __yulmem pointer (a [length(32)][data] block, byte-packed) when every
// use is supported: `new bytes(n)`, byte-indexed read/write `b[i]`, `.length`, assembly on the shared buffer, and
// return. Byte access is byte-granular (stride 1). These tests read results back and require the exact value.
async function call(method: string, args: FunctionArgument[]): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(SRC, { solidityImportCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc[method](...args).send();
}

const SRC = `contract C {
  int counter;
  // Byte-indexed writes then byte-indexed reads: each b[i] is one byte at b+32+i. (v+3 < 128 keeps the
  // bytes1(uint8(..)) cast off the sign-magnitude NUM2BIN edge - orthogonal to the byte model.)
  function byteIndex(uint v) public {
    bytes memory b = new bytes(4);
    b[0] = bytes1(uint8(v));
    b[1] = bytes1(uint8(v + 1));
    b[3] = bytes1(uint8(v + 3));
    require(uint8(b[0]) == v);
    require(uint8(b[1]) == v + 1);
    require(uint8(b[3]) == v + 3);
    require(b.length == 4);
  }
  // High bytes (>= 0x80) via hex-literal writes round-trip through the byte model (a 1-byte splice/read, no
  // number<->byte cast, so no sign-magnitude encoding involved).
  function highBytes() public {
    bytes memory b = new bytes(2);
    b[0] = 0xc8;
    b[1] = 0xff;
    require(b[0] == 0xc8);
    require(b[1] == 0xff);
    require(b.length == 2);
  }
  // A byte-indexed write is visible to a later assembly read of the same buffer (one shared __yulmem). The byte
  // at b+32 is the low byte of the word at b+32 (little-endian), so masking with 0xff recovers b[0].
  function byteThenAsm(uint v) public {
    bytes memory b = new bytes(4);
    b[0] = bytes1(uint8(v));
    uint got;
    assembly { got := and(mload(add(b, 0x20)), 0xff) }
    require(got == v);
  }
  // The corpus pattern: a byte-indexed loop fills the buffer, assembly overwrites the first word, return the
  // buffer. Compiles + runs (BCH-native byte order); we require the length survives.
  function loopFillThenAsm() public {
    bytes memory x = new bytes(5);
    for (uint i = 0; i < x.length; ++i) x[i] = bytes1(uint8(i + 1));
    assembly { mstore(add(x, 32), 0) }
    require(x.length == 5);
  }
}`;

describe('bytes memory as a __yulmem pointer', () => {
  it('byte-indexed writes and reads round-trip', async () => {
    await call('byteIndex', [65n]);
  });
  it('high bytes (>= 0x80) via hex literals round-trip', async () => {
    await call('highBytes', []);
  });
  it('a byte-indexed write is visible to a later assembly read', async () => {
    await call('byteThenAsm', [100n]);
  });
  it('byte-indexed loop fill + assembly word store (corpus pattern) compiles and runs', async () => {
    await call('loopFillThenAsm', []);
  });
});
