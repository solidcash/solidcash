import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A fixed-inner nested array `uint256[2][]` is chunk-packed as a dynamic array of fixed-width (2*32=64 byte)
// rows, reusing the 1D fixed-width machinery. `a.push(row)` appends a row, `a[i]` reads a row, `a[i][j]` the
// scalar (read = index into the row value; write = read-modify-write via a temp), `a.length` = blob/64.
// Verified end-to-end on the VM via on-chain readers (all args scalar to avoid array-arg encoding).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  uint256[2][] a;
  function seed(uint256 v0, uint256 v1, pubkey pk, sig s) { require(checkSig(s, pk)); a.push([v0, v1]); }
  function seedAll(uint256 v0, uint256 v1, uint256 v2, uint256 v3, pubkey pk, sig s) {
    require(checkSig(s, pk)); a = [[v0, v1], [v2, v3]];
  }
  function setw(int i, int j, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); a[i][j] = v; }
  function get(int i, int j, uint256 e) { require(a[i][j] == e); }
  function len(int n) { require(a.length == n); }
}`;

describe('fixed-inner nested array uint256[2][] (chunk-packed)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('push rows, index a[i][j], write a[i][j]=v, length', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.seed(11n, 22n, alicePub, sig()).send();   // a = [[11,22]]
    await sc.len(1n).send();
    await sc.get(0n, 0n, 11n).send();
    await sc.get(0n, 1n, 22n).send();

    await sc.seed(33n, 44n, alicePub, sig()).send();   // a = [[11,22],[33,44]]
    await sc.len(2n).send();
    await sc.get(1n, 0n, 33n).send();
    await sc.get(1n, 1n, 44n).send();
    await sc.get(0n, 0n, 11n).send();                   // first row preserved

    await sc.setw(0n, 1n, 99n, alicePub, sig()).send(); // a[0][1] = 99
    await sc.get(0n, 1n, 99n).send();
    await sc.get(0n, 0n, 11n).send();                   // other element of the row unchanged
    await sc.get(1n, 0n, 33n).send();                   // other row unchanged
  });

  it('whole-array assign a = [[..],[..]] (rows encode flat)', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.seedAll(1n, 2n, 3n, 4n, alicePub, sig()).send(); // a = [[1,2],[3,4]]
    await sc.len(2n).send();
    await sc.get(0n, 0n, 1n).send();
    await sc.get(0n, 1n, 2n).send();
    await sc.get(1n, 0n, 3n).send();
    await sc.get(1n, 1n, 4n).send();
  });
});
