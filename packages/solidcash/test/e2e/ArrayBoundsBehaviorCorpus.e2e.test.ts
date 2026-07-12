import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Behavioral parity of compiling array/ corpus files vs Solidity `// ----` outputs (bench is compile-only).
// Focus: default (zeroed) elements + bounds/pop reverts, where a value-copy array model could silently diverge
// from Solidity's Panic (0x32 out-of-bounds, 0x31 pop-empty) instead of reverting. int used for uint (small
// non-negative -> no int/uint divergence).

describe('array bounds/default behavioral parity', () => {
  // array_zeroed_memory_index_access.sol: `new uint[](n); x[a]` == 0 in-bounds; out-of-bounds reverts (Panic 0x32).
  it('zeroed memory array: in-bounds elements are 0', async () => {
    const art = compileString(`contract C {
      function get(int n, int a) internal returns (int) { int[] memory x = new int[](n); return x[a]; }
      function ok() public returns (bool) { require(get(5,0) == 0); require(get(5,4) == 0); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });

  it('memory array out-of-bounds access reverts (Solidity Panic 0x32)', async () => {
    const art = compileString(`contract C {
      function oob() public returns (bool) { int[] memory x = new int[](5); x[5]; return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.oob()).rejects.toThrow();
  });

  // array_storage_pop_zero_length.sol: pop() on an empty storage array reverts (Panic 0x31).
  it('storage array pop() on empty reverts (Solidity Panic 0x31)', async () => {
    const art = compileString(`contract C {
      int[] storageArray;
      function popEmpty() public returns (bool) { storageArray.pop(); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.popEmpty()).rejects.toThrow();
  });

  // array_storage_push_pop.sol: push() to len, pop() all -> length 0.
  it('storage array push/pop length management -> 0', async () => {
    const art = compileString(`contract C {
      int[] storageArray;
      function setGetLength(int len) public returns (int) {
        while (storageArray.length < len) storageArray.push();
        while (storageArray.length > 0) storageArray.pop();
        return storageArray.length;
      }
      function ok() public returns (bool) { require(setGetLength(10) == 0); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });
});
