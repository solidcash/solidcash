import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// A LOCAL `string memory str = new string(n)` used as a raw __yulmem pointer in assembly (OZ
// ShortStrings.toString: `mstore(str, len)` writes the length word at offset 0, `mstore(add(str, 0x20), w)`
// writes the data word at offset 32). A string local rides the same [length(32)][data...] __yulmem block as
// `bytes memory`, so `add(str, 0x20)` is plain uint arithmetic and the store/load hit the shared buffer - exactly
// as the bytes-local case already does. These tests read the buffer back and require the exact value, so any
// offset error rejects the transaction.
const SRC = `contract C {
  int counter;
  string text;
  // Write the length word (offset 0) + data word (offset 32) via asm, then read both back via asm.
  function ssRoundtrip(bytes32 w, uint len) public {
    string memory str = new string(32);
    assembly {
      mstore(str, len)
      mstore(add(str, 0x20), w)
    }
    uint gotLen;
    bytes32 gotData;
    assembly {
      gotLen := mload(str)
      gotData := mload(add(str, 0x20))
    }
    require(gotLen == len);
    require(gotData == w);
  }
  // Build the same way, then serialize the string across the STATE boundary: this.text = str goes through
  // serializeBytes, which slices __yulmem[str+32 : str+32+len] = the first len data bytes (= w[0:len]).
  function store(bytes32 w, uint len) public {
    string memory str = new string(32);
    assembly {
      mstore(str, len)
      mstore(add(str, 0x20), w)
    }
    this.text = str;
  }
}`;

async function setup(): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(SRC, { solidityImportCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n, text: '' }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

// 32-byte word: the given ASCII prefix followed by zero padding.
function word32(prefix: string): Uint8Array {
  const w = new Uint8Array(32);
  for (let i = 0; i < prefix.length; i++) w[i] = prefix.charCodeAt(i);
  return w;
}

describe('string memory as a __yulmem pointer (OZ ShortStrings.toString shape)', () => {
  it('asm writes then reads back the length word (offset 0) and data word (offset 32)', async () => {
    const sc = await setup();
    await (sc as unknown as Record<string, (...a: FunctionArgument[]) => { send(): Promise<unknown> }>)
      .ssRoundtrip(word32('Hello'), 5n).send();
  });

  it('serializes the asm-built string across the state boundary byte-exactly (text == w[0:len])', async () => {
    const sc = await setup();
    await (sc as unknown as Record<string, (...a: FunctionArgument[]) => { send(): Promise<unknown> }>)
      .store(word32('Hello'), 5n).send();
    expect((await (sc as unknown as { getState(): Promise<{ text: string }> }).getState()).text).toBe('Hello');
  });
});
