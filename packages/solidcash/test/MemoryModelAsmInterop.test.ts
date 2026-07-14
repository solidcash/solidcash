import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// Stage 4: a high-level `memory` array an assembly block reads/writes stays a __yulmem POINTER (a uint offset)
// instead of falling back to a value-copy. Both the memory model and the Yul lowering address the same __yulmem
// buffer with the EVM-faithful [length(32)][data...] layout, so `mload(a)` reads the length, `mload(add(a, 0x20))`
// reads element 0, and `mstore(add(a, 0x20*(i+1)), v)` writes element i - exactly as EVM assembly expects. Each
// test reads the result back and requires the exact value, so any addressing error rejects the transaction.
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
  struct S { uint a; uint b; }
  // Assembly READS an element the memory model wrote: a[0] via mload(add(a, 0x20)).
  function asmReadsElem(uint v) public {
    uint[] memory a = new uint[](2);
    a[0] = v;
    a[1] = v + 1;
    uint r;
    assembly { r := mload(add(a, 0x20)) }
    require(r == v);
  }
  // Assembly WRITES an element the memory model reads back: mstore(add(a, 0x20), v) then a[0].
  function asmWritesElem(uint v) public {
    uint[] memory a = new uint[](2);
    assembly { mstore(add(a, 0x20), v) }
    require(a[0] == v);
  }
  // The length word lives at offset 0 of the block (EVM layout): mload(a) == a.length.
  function asmReadsLength() public {
    uint[] memory a = new uint[](3);
    uint len;
    assembly { len := mload(a) }
    require(len == 3);
  }
  // Round-trip both ways: asm writes element 1, native reads it; native writes element 0, asm reads it.
  function roundTrip(uint v) public {
    uint[] memory a = new uint[](2);
    a[0] = v;
    assembly { mstore(add(a, 0x40), add(v, 7)) }
    uint fromAsm;
    assembly { fromAsm := mload(add(a, 0x20)) }
    require(a[1] == v + 7);
    require(fromAsm == v);
  }
  // A struct block has no length header: field i is at offset 32*i. Assembly reads a constructed field.
  function asmReadsStructField(uint v) public {
    S memory s = S(v, v + 1);
    uint f0; uint f1;
    assembly { f0 := mload(s) }
    assembly { f1 := mload(add(s, 0x20)) }
    require(f0 == v);
    require(f1 == v + 1);
  }
  // A native field write is visible to a later assembly read (same buffer, in-place store - no rebuild hazard).
  function asmReadsAfterNativeWrite(uint v) public {
    S memory s = S(1, 2);
    s.a = v;
    uint f0;
    assembly { f0 := mload(s) }
    require(f0 == v);
  }
  // An assembly field write is visible to a later native field read.
  function nativeReadsAfterAsmWrite(uint v) public {
    S memory s = S(1, 2);
    assembly { mstore(add(s, 0x20), v) }
    require(s.b == v);
  }
}`;

describe('Stage 4: assembly interop with memory-model pointers', () => {
  it('assembly reads an element the memory model wrote', async () => {
    await call('asmReadsElem', [123n]);
  });
  it('assembly writes an element the memory model reads back', async () => {
    await call('asmWritesElem', [456n]);
  });
  it('assembly reads the array length word at offset 0', async () => {
    await call('asmReadsLength', []);
  });
  it('round-trips element writes/reads across the asm/native boundary', async () => {
    await call('roundTrip', [1000n]);
  });
  it('assembly reads struct fields at 32*i offsets', async () => {
    await call('asmReadsStructField', [77n]);
  });
  it('assembly sees a native struct field write (in-place, no rebuild)', async () => {
    await call('asmReadsAfterNativeWrite', [888n]);
  });
  it('a native field read sees an assembly struct field write', async () => {
    await call('nativeReadsAfterAsmWrite', [4242n]);
  });
});
