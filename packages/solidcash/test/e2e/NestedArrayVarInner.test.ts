import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A variable-inner nested array `uint256[][]` (rows of differing lengths) chunk-packs with the framed layout:
// `pushdata(rowCount) ++ [pushdata(len_i) ++ tight_row_i] ...`. Access is scan-based. Verified end-to-end on
// the VM with rows of different lengths (all args scalar to avoid array-arg encoding).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256[][] a;
  function push2(uint256 v0, uint256 v1, pubkey pk, sig s) { require(checkSig(s, pk)); a.push([v0, v1]); }
  function push3(uint256 v0, uint256 v1, uint256 v2, pubkey pk, sig s) {
    require(checkSig(s, pk)); a.push([v0, v1, v2]);
  }
  function setw(int i, int j, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); a[i][j] = v; }
  function seedRagged(uint256 x, uint256 y, uint256 z, pubkey pk, sig s) {
    require(checkSig(s, pk)); a = [[x], [y, z]];
  }
  function get(int i, int j, uint256 e) { require(a[i][j] == e); }
  function rowlen(int i, int n) { require(a[i].length == n); }
  function len(int n) { require(a.length == n); }
}`;

describe('variable-inner nested array uint256[][] (framed, differing row lengths)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('push rows of length 2 then 3, index across the ragged rows, write an element', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.push2(11n, 22n, alicePub, sig()).send();       // a = [[11,22]]
    await sc.len(1n).send();
    await sc.rowlen(0n, 2n).send();
    await sc.get(0n, 0n, 11n).send();
    await sc.get(0n, 1n, 22n).send();

    await sc.push3(33n, 44n, 55n, alicePub, sig()).send();  // a = [[11,22],[33,44,55]]
    await sc.len(2n).send();
    await sc.rowlen(1n, 3n).send();                          // second row is longer
    await sc.rowlen(0n, 2n).send();                          // first row unchanged length
    await sc.get(1n, 0n, 33n).send();
    await sc.get(1n, 2n, 55n).send();                        // last elem of the longer row
    await sc.get(0n, 1n, 22n).send();                        // first row preserved past the longer second row

    await sc.setw(1n, 2n, 99n, alicePub, sig()).send();     // a[1][2] = 99 (write into the longer row)
    await sc.get(1n, 2n, 99n).send();
    await sc.get(1n, 0n, 33n).send();                        // other elements unchanged
    await sc.get(0n, 0n, 11n).send();
  });

  it('whole-array assign a ragged literal a = [[x], [y, z]]', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.seedRagged(7n, 8n, 9n, alicePub, sig()).send(); // a = [[7],[8,9]]
    await sc.len(2n).send();
    await sc.rowlen(0n, 1n).send();
    await sc.rowlen(1n, 2n).send();
    await sc.get(0n, 0n, 7n).send();
    await sc.get(1n, 0n, 8n).send();
    await sc.get(1n, 1n, 9n).send();
  });
});
