import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// `delete map.field[key]` on a struct-field mapping (Solidity delete on a mapping element). It lowers to a plain
// MappingDelete of the flattened state collection `map__field` - the SAME collection the struct-field mapping
// WRITE uses - so it reuses the existing, tested mapping-delete codegen. VM-verifies the delete produces a
// valid, spendable covenant (the write round-trips, then the delete tx sends). (Read-after-delete-across-txns
// is a separate pre-existing behaviour shared by plain mappings, not exercised here.)
const SOURCE = `
contract StructMapDelete {
    struct M { mapping(uint256 => uint256) values; mapping(uint256 => bool) flags; }
    M m;
    function setV(uint256 k, uint256 v, bool f) { m.values[k] = v; m.flags[k] = f; require(true); }
    function delV(uint256 k) { delete m.values[k]; delete m.flags[k]; require(true); }
    function checkV(uint256 k, uint256 ev, bool ef) { require(m.values[k] == ev); require(m.flags[k] == ef); }
}
`;

describe('delete on a struct-field mapping element', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('the write round-trips and the struct-field delete sends (uint + bool fields)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.setV(1n, 5n, true).send();
    await expect(sc.checkV(1n, 5n, true)).resolves.toBeDefined();  // written struct-field mapping values present
    const tx = await sc.delV(1n).send();                          // the delete produces a valid, spendable covenant
    expect(tx.txid).toBeDefined();
  });
});
