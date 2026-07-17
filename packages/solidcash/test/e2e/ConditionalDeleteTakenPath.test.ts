import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A mapping delete inside a branch, on the TAKEN path, must actually remove the entry (read back as default).
// The not-taken path preserves it. IfConvertConditionalDelete rewrites `if(d){delete m[k];}` into the
// unconditional predicated write `m[k] = d ? 0 : m[k]`, which round-trips soundly with no conditional-entry
// covenant machinery. Previously the taken-path delete left the old value readable.
describe('conditional delete taken-path (if-converted)', () => {
  const art = compileString(`
    contract C {
      mapping(uint256 => uint256) m;
      function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
      function delIf(uint256 k, bool d) external { if (d) { delete m[k]; } require(true); }
      function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
    }
  `, { forceStateful: true });

  it('taken path deletes; not-taken preserves', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(2n, 9n).send();
    await sc.delIf(2n, false).send();            // not taken
    await expect(sc.chk(2n, 9n)).resolves.toBeDefined();   // preserved
    await sc.delIf(2n, true).send();             // taken: delete
    await expect(sc.chk(2n, 0n)).resolves.toBeDefined();   // deleted -> default 0
  });

  it('a second key is independent', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(1n, 4n).send();
    await sc.put(2n, 9n).send();
    await sc.delIf(1n, true).send();             // delete only key 1
    await expect(sc.chk(1n, 0n)).resolves.toBeDefined();   // key 1 gone
    await expect(sc.chk(2n, 9n)).resolves.toBeDefined();   // key 2 intact
  });

  // A bool-valued mapping: delete -> false. Exercises a non-int scalar default in the if-conversion.
  const boolMap = compileString(`
    contract C {
      mapping(uint256 => bool) flag;
      function set(uint256 k) external { flag[k] = true; require(true); }
      function clearIf(uint256 k, bool d) external { if (d) { delete flag[k]; } require(true); }
      function chk(uint256 k, bool ev) external { require(flag[k] == ev); }
    }
  `, { forceStateful: true });

  it('bool-valued mapping: taken deletes to false, not-taken preserves true', async () => {
    const sc = await getContractFactory(boolMap, await fundedSigner()).deploy();
    await sc.set(1n).send();
    await sc.clearIf(1n, false).send();                    // not taken
    await expect(sc.chk(1n, true).send()).resolves.toBeDefined();   // still true
    await sc.clearIf(1n, true).send();                     // taken
    await expect(sc.chk(1n, false).send()).resolves.toBeDefined();  // now false
  });

  // Two deletes in one branch to DIFFERENT mappings: the condition is cloned into both predicated writes.
  const multi = compileString(`
    contract C {
      mapping(uint256 => uint256) a;
      mapping(uint256 => uint256) b;
      function put(uint256 k, uint256 va, uint256 vb) external { a[k] = va; b[k] = vb; require(true); }
      function delBoth(uint256 k, bool d) external { if (d) { delete a[k]; delete b[k]; } require(true); }
      function chk(uint256 k, uint256 ea, uint256 eb) external { require(a[k] == ea); require(b[k] == eb); }
    }
  `, { forceStateful: true });

  it('multiple deletes in one branch both take effect (taken) / preserve (not-taken)', async () => {
    const sc = await getContractFactory(multi, await fundedSigner()).deploy();
    await sc.put(1n, 3n, 4n).send();
    await sc.delBoth(1n, false).send();                        // not taken
    await expect(sc.chk(1n, 3n, 4n)).resolves.toBeDefined();   // both preserved
    await sc.delBoth(1n, true).send();                         // taken
    await expect(sc.chk(1n, 0n, 0n)).resolves.toBeDefined();   // both deleted
  });
});
