import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// `if(guard) return; delete m[k];` - the delete lives in the else branch after EarlyReturnTransformation. It is
// lowered to an existence-gated SOFT-DELETE WRITE: the entry keeps an output (default when the delete branch ran,
// preserved input otherwise) iff it exists; an absent key is a no-op. Sound on all paths, stable output count.
describe('early-return delete (soft-delete)', () => {
  const art = compileString(`
    contract ErDel {
      mapping(uint256 => bool) active;
      mapping(uint256 => uint256) data;
      mapping(uint256 => uint256) more;
      function put(uint256 k, uint256 v) external { active[k] = true; data[k] = v; more[k] = v; require(true); }
      function clear(uint256 k) external { if (!active[k]) return; delete data[k]; require(true); }
      function clearBoth(uint256 k) external { if (!active[k]) return; delete data[k]; delete more[k]; require(true); }
      function chk(uint256 k, uint256 ed, uint256 em) external { require(data[k] == ed); require(more[k] == em); }
    }
  `, { forceStateful: true });

  it('existing key deletes; untouched mapping preserved', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(1n, 9n).send();
    await sc.clear(1n).send();
    await expect(sc.chk(1n, 0n, 9n)).resolves.toBeDefined();
  });

  it('absent key with another present is a no-op', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(1n, 9n).send();
    await sc.clear(2n).send();                              // key 2 absent -> guard returns
    await expect(sc.chk(1n, 9n, 9n)).resolves.toBeDefined(); // key 1 untouched
  });

  it('multiple deletes across mappings', async () => {
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(3n, 7n).send();
    await sc.clearBoth(3n).send();
    await expect(sc.chk(3n, 0n, 0n)).resolves.toBeDefined();
  });
});
