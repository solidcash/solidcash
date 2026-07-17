import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A conditional mapping WRITE `if(cond){ m[k] = v; }` has the same not-taken-preservation gap a conditional
// delete does. IfConvertConditionalEntryOp rewrites it to `m[k] = cond ? v : m[k]` (an unconditional predicated
// write, byte-identical to the hand-written form), so the taken path writes v and the not-taken path preserves
// the current value. (A bare `m[k] = v` parses to ArrayAssignNode pre-semantic, resolved to a mapping by name.)
describe('conditional entry write (if-converted)', () => {
  const art = compileString(`
    contract C {
      mapping(uint256 => uint256) m;
      function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
      function setIf(uint256 k, uint256 v, bool d) external { if (d) { m[k] = v; } require(true); }
      function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
    }
  `, { forceStateful: true });

  it('existing key: not-taken preserves, taken updates', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(2n, 9n).send();
    await sc.setIf(2n, 7n, false).send();
    await expect(sc.chk(2n, 9n).send()).resolves.toBeDefined();   // preserved
    await sc.setIf(2n, 7n, true).send();
    await expect(sc.chk(2n, 7n).send()).resolves.toBeDefined();   // updated
  });

  it('new key: not-taken leaves default, taken creates', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.setIf(5n, 42n, false).send();
    await expect(sc.chk(5n, 0n).send()).resolves.toBeDefined();   // not created
    await sc.setIf(5n, 42n, true).send();
    await expect(sc.chk(5n, 42n).send()).resolves.toBeDefined();  // created
  });

  it('mixed write + delete in one branch', async () => {
    const mixed = compileString(`
      contract C {
        mapping(uint256 => uint256) a;
        mapping(uint256 => uint256) b;
        function put(uint256 k, uint256 va, uint256 vb) external { a[k] = va; b[k] = vb; require(true); }
        function upd(uint256 k, uint256 va, bool d) external { if (d) { a[k] = va; delete b[k]; } require(true); }
        function chk(uint256 k, uint256 ea, uint256 eb) external { require(a[k] == ea); require(b[k] == eb); }
      }
    `, { forceStateful: true });
    const sc = await getContractFactory(mixed, await fundedSigner()).deploy();
    await sc.put(1n, 3n, 4n).send();
    await sc.upd(1n, 8n, false).send();                          // not taken
    await expect(sc.chk(1n, 3n, 4n)).resolves.toBeDefined();     // both preserved
    await sc.upd(1n, 8n, true).send();                           // taken: a[1]=8, delete b[1]
    await expect(sc.chk(1n, 8n, 0n)).resolves.toBeDefined();
  });
});
