import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// P7: Yul memory the compile-time model cannot resolve (dynamic offset, mcopy, mstore8, msize) is re-lowered onto
// a runtime `__yulmem` byte buffer laid out like EVM memory (free pointer 0x80 stored at slot 0x40). These tests
// read the buffer back with mload and require the exact value, so any byte-level error rejects the transaction.
// (keccak256 over the runtime buffer is exercised separately in Keccak256.test.ts - it needs a side-car library.)
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
  // Free-pointer allocation + two dynamically-addressed stores; read both back independently (no corruption).
  function storeLoad(uint x, uint y) public {
    uint a; uint b;
    assembly {
      let p := mload(0x40)
      mstore(p, x)
      mstore(add(p, 0x20), y)
      a := mload(p)
      b := mload(add(p, 0x20))
    }
    require(a == x); require(b == y);
  }
  // Dynamic loop writing i at p+i*32, then summing the loaded values back: 0+1+..+(n-1).
  function loopStore(uint n) public {
    uint sum;
    assembly {
      let p := mload(0x40)
      for { let i := 0 } lt(i, n) { i := add(i, 1) } { mstore(add(p, mul(i, 0x20)), i) }
      for { let j := 0 } lt(j, n) { j := add(j, 1) } { sum := add(sum, mload(add(p, mul(j, 0x20)))) }
    }
    require(sum == n * (n - 1) / 2);
  }
  // mcopy with dynamic offsets: store at src, memmove to dst, read dst back.
  function copyBack(uint x, uint off) public {
    uint r;
    assembly {
      mstore(add(0x80, off), x)
      mcopy(add(0xc0, off), add(0x80, off), 0x20)
      r := mload(add(0xc0, off))
    }
    require(r == x);
  }
  // Two separate assembly blocks in one function share one memory buffer (EVM: memory is function-scoped).
  // The second block must read what the first wrote at the same dynamic offset.
  function sharedAcrossBlocks(uint x, uint off) public {
    uint b;
    assembly {
      mstore(add(0x80, off), x)
    }
    assembly {
      b := mload(add(0x80, off))
    }
    require(b == x);
  }
  // The high-level memory model and the Yul runtime buffer are ONE buffer. The memory model allocates the array
  // at 0x80 (element 0 at 0xa0, element 1 at 0xc0); assembly - not naming the array, so it stays convertible -
  // reads an element back by absolute address. Only possible if both passes address the same __yulmem buffer.
  function sharedWithMemoryModel(uint idx) public {
    uint[] memory a = new uint[](2);
    a[0] = 111;
    a[1] = 222;
    uint got;
    assembly {
      got := mload(add(0xa0, mul(idx, 0x20)))
    }
    require(got == 111 + idx * 111);
  }
  // mstore8 writes ONE byte (val's low byte) at position p. On BCH's little-endian word encoding that byte is the
  // LOW byte of the word read at p, so mload returns exactly the stored byte (consistent with mstore/mload).
  function byteStore(uint off, uint b) public {
    uint r;
    assembly {
      mstore8(add(0x80, off), b)
      r := mload(add(0x80, off))
    }
    require(r == b);
  }
  // mstore8 writes exactly one byte: two adjacent stores occupy distinct positions (no clobber). Little-endian, so
  // the byte at 0x80 is the low byte and the byte at 0x81 the next, giving mload(0x80) == 0xab + 0xcd*256.
  function twoBytes() public {
    uint r;
    assembly {
      mstore8(0x80, 0xab)
      mstore8(0x81, 0xcd)
      r := mload(0x80)
    }
    require(r == 0xab + 0xcd * 256);
  }
}`;

describe('P7: runtime Yul memory (readback)', () => {
  it('two dynamically-addressed stores read back independently', async () => {
    await call('storeLoad', [123n, 456n]);
  });
  it('dynamic loop store/load sums correctly', async () => {
    await call('loopStore', [5n]); // 0+1+2+3+4 = 10 = 5*4/2
  });
  it('mcopy memmove at dynamic offsets reads back', async () => {
    await call('copyBack', [7777n, 0n]);
  });
  it('two assembly blocks share one memory buffer', async () => {
    await call('sharedAcrossBlocks', [999n, 0n]);
  });
  it('assembly and the high-level memory model share one buffer (element 0)', async () => {
    await call('sharedWithMemoryModel', [0n]);
  });
  it('assembly and the high-level memory model share one buffer (element 1)', async () => {
    await call('sharedWithMemoryModel', [1n]);
  });
  it('mstore8 writes a single byte read back via mload', async () => {
    await call('byteStore', [0n, 0xabn]);
  });
  it('mstore8 at a nonzero dynamic offset', async () => {
    await call('byteStore', [7n, 0x5an]);
  });
  it('adjacent mstore8 bytes do not clobber each other', async () => {
    await call('twoBytes', []);
  });
});
