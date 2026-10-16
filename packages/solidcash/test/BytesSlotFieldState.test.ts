import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

/**
 * Stateful round-trips for the EVM byte-array slot encodings lowered by inline assembly. `sstore(b.slot, oddX)`
 * resizes a `bytes` var to (X-1)/2 zero bytes (the long-string marker), and `sstore(keccak256(0, b.slot), w)`
 * writes a raw 32-byte word into the data region; both must land in the high-level `b` value so `getState()` reads
 * the exact bytes back. The short (<32B) inline encoding is covered by the short-slot write below.
 */
const SOURCE = `contract BytesSlotBox {
  bytes b;

  // sstore(b.slot, 65) = the long marker 2*32+1 -> resize b to 32 zero bytes; the keccak data-region store then
  // writes w over b[0:32], so the final value is exactly w.
  function resizeWrite(bytes32 w) public {
    assembly {
      sstore(b.slot, 65)
      mstore(0, b.slot)
      sstore(keccak256(0, 32), w)
    }
  }

  // Short inline encoding: or("deadbeef", 0x08) = data "deadbeef" left-aligned with 2*4 in the low byte -> b =
  // hex"deadbeef" (4 bytes).
  function shortWrite() public {
    assembly {
      sstore(b.slot, or("deadbeef", 0x08))
    }
  }

  function clear() public {
    assembly { sstore(b.slot, 0) }
  }
}`;

async function setup(): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { evmCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { b: new Uint8Array(0) }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

function word32(prefix: string): Uint8Array {
  const w = new Uint8Array(32);
  for (let i = 0; i < prefix.length; i += 1) w[i] = prefix.charCodeAt(i);
  return w;
}

type Sc = StatefulContract & {
  getState: () => Promise<{ b: Uint8Array }>;
  resizeWrite: (w: Uint8Array) => { send: () => Promise<unknown> };
  shortWrite: () => { send: () => Promise<unknown> };
  clear: () => { send: () => Promise<unknown> };
};

describe('EVM byte-array slot encodings land in the high-level bytes state', () => {
  it('long-string resize + keccak data-region write round-trips through getState', async () => {
    const sc = await setup() as unknown as Sc;
    const w = word32('deadbeefdeadbeefdeadbeefdeadbeef');
    await sc.resizeWrite(w).send();
    expect((await sc.getState()).b).toEqual(w);
  });

  it('short inline-data write decodes the high bytes and the low length byte', async () => {
    const sc = await setup() as unknown as Sc;
    await sc.shortWrite().send();
    // or("deadbeef", 0x08): the ASCII bytes "deadbeef" left-aligned, len 4 (low byte 0x08) -> the top 4 bytes.
    expect((await sc.getState()).b).toEqual(new Uint8Array([0x64, 0x65, 0x61, 0x64]));
  });

  it('sstore(b.slot, 0) clears the bytes value', async () => {
    const sc = await setup() as unknown as Sc;
    await sc.clear().send();
    expect((await sc.getState()).b).toEqual(new Uint8Array(0));
  });
});
