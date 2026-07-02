import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// An (unconditional) `delete m[k]` must remove the entry NFT: co-spend it as an input AND NOT recreate it as an
// output. The auto-derivation previously computed the delete for the output-count layout but never told the
// builder, so the entry was co-spent and re-emitted identically - a no-op update that left the old value
// readable. _createBuilder now applies builder.deleteEntry() for auto-derived (unconditional) delete slots.
describe('read-after-delete', () => {
  const artifact = compileString(`
    contract C {
      mapping(uint256 => uint256) m;
      function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
      function del(uint256 k) external { delete m[k]; require(true); }
      function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
    }
  `, { forceStateful: true });

  it('a deleted mapping entry reads back as the default value', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.put(1n, 5n).send();
    await expect(sc.chk(1n, 5n)).resolves.toBeDefined();   // present before delete
    await sc.del(1n).send();
    await expect(sc.chk(1n, 0n)).resolves.toBeDefined();   // default 0 after delete (was the old value before the fix)
  });

  it('a conditional (branch-guarded) delete is not regressed - both paths send, not-taken preserves', async () => {
    const art = compileString(`
      contract C {
        mapping(uint256 => uint256) m;
        function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
        function delIf(uint256 k, bool d) external { if (d) { delete m[k]; } require(true); }
        function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
      }
    `, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await sc.put(2n, 9n).send();
    expect((await sc.delIf(2n, false).send()).txid).toBeDefined();   // not taken
    await expect(sc.chk(2n, 9n)).resolves.toBeDefined();             // preserved
    expect((await sc.delIf(2n, true).send()).txid).toBeDefined();    // taken: valid spendable covenant
  });
});
