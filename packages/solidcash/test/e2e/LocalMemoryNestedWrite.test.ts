import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
// Nested writes to a local-memory struct's multi-dimensional array field (s.a[i][j] = v, s.a[i][j]++).
const SRC = `contract C {
  struct S { uint[][] a; }
  function ok() public pure {
    S memory s;
    s.a = new uint[][](2);
    s.a[0] = new uint[](3);
    s.a[1] = new uint[](3);
    s.a[0][1] = 42;
    s.a[1][2] = 7;
    s.a[0][1]++;
    require(s.a[0][1] == 43 && s.a[1][2] == 7 && s.a[0][0] == 0);
  }
  function wrong() public pure {
    S memory s;
    s.a = new uint[][](1);
    s.a[0] = new uint[](2);
    s.a[0][1] = 42;
    require(s.a[0][1] == 99);
  }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('local-memory nested struct-field array write (runtime)', () => {
  it('writes and reads s.a[i][j] and s.a[i][j]++ correctly', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });
  it('a wrong post-write expectation reverts', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow();
  });
});
