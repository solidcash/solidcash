import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Entries of different collections share the master's category, so on-chain they are only distinguished by their
// per-collection entry covenant (locking bytecode). The SDK matched an accessed entry by KEY across the mixed
// (all-collections) entry set, so a[k] and b[k] with the same key resolved to whichever entry came first ->
// reading b[k] returned a[k]'s value. The entry lookup now fetches each collection's entries by its own entry
// address before matching by key (only when the contract has >1 collection).
describe('multiple distinct-collection entry writes', () => {
  it('two writes to different mappings, same key, read back independently', async () => {
    const art = compileString(`
      contract C {
        mapping(uint256 => uint256) a;
        mapping(uint256 => uint256) b;
        function put(uint256 k) external { a[k] = 1; b[k] = 2; require(true); }
        function chkA(uint256 k) external { require(a[k] == 1); }
        function chkB(uint256 k) external { require(b[k] == 2); }
      }
    `, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(1n).send();
    await expect(sc.chkA(1n).send()).resolves.toBeDefined();
    await expect(sc.chkB(1n).send()).resolves.toBeDefined();
  });

  it('three mappings with overlapping keys stay independent', async () => {
    const art = compileString(`
      contract C {
        mapping(uint256 => uint256) x;
        mapping(uint256 => uint256) y;
        mapping(uint256 => bool) z;
        function setX(uint256 k, uint256 v) external { x[k] = v; require(true); }
        function setY(uint256 k, uint256 v) external { y[k] = v; require(true); }
        function setZ(uint256 k, bool v) external { z[k] = v; require(true); }
        function chk(uint256 k, uint256 ex, uint256 ey, bool ez) external {
          require(x[k] == ex); require(y[k] == ey); require(z[k] == ez);
        }
      }
    `, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.setX(5n, 11n).send();
    await sc.setY(5n, 22n).send();
    await sc.setZ(5n, true).send();
    await expect(sc.chk(5n, 11n, 22n, true).send()).resolves.toBeDefined();
  });

  it('same mapping, different keys (baseline, unaffected)', async () => {
    const art = compileString(`
      contract C {
        mapping(uint256 => uint256) m;
        function put() external { m[1] = 10; m[2] = 20; require(true); }
        function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
      }
    `, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put().send();
    await expect(sc.chk(1n, 10n).send()).resolves.toBeDefined();
    await expect(sc.chk(2n, 20n).send()).resolves.toBeDefined();
  });
});
