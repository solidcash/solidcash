import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A 2D array-value element write `m[k][i][j] = v` (mapping value is a multi-dim array). The parser makes one
// MappingAssignNode with all indices; DesugarNestedArrayWrite lowers it to whole-value-read + local nested-write +
// whole-value-write-back (`T[][] t = m[k]; t[i][j] = v; m[k] = t`). A fixed int[2][2] value has a well-defined
// zero default, so an absent key inserts cleanly. Independent cells must persist across writes.
const SRC = `contract C() {
  mapping(int => int[2][2]) grid;
  function setCell(int k, int i, int j, int v, pubkey pk, sig s) { require(checkSig(s, pk)); grid[k][i][j] = v; }
  function checkCell(int k, int i, int j, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(grid[k][i][j] == exp); }
}`;

describe('C2 mapping 2D array-value element write (m[k][i][j] = v)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xe20;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('sets independent cells and reads each back; untouched cells stay 0', async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    // Insert grid[7]: absent key -> default int[2][2] zeros, set cell [0][1] = 42.
    await fund(contract.address);
    expect((await contract.setCell(7n, 0n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.checkCell(7n, 0n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
    // A different cell of the same key is still 0 (write-back preserved the rest of the array).
    await fund(contract.address);
    expect((await contract.checkCell(7n, 1n, 0n, 0n, alicePub, sig).send()).txid).toBeDefined();

    // Update a second cell of the SAME key: this is an UPDATE (grid[7] now present).
    await fund(contract.address);
    expect((await contract.setCell(7n, 1n, 0n, 99n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.checkCell(7n, 1n, 0n, 99n, alicePub, sig).send()).txid).toBeDefined();
    // The first cell survived the update.
    await fund(contract.address);
    expect((await contract.checkCell(7n, 0n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();

    // A different key is independent (fresh insert).
    await fund(contract.address);
    expect((await contract.setCell(9n, 1n, 1n, 5n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.checkCell(9n, 1n, 1n, 5n, alicePub, sig).send()).txid).toBeDefined();
    // Key 7 untouched by the key-9 write.
    await fund(contract.address);
    expect((await contract.checkCell(7n, 0n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
  });

  // Nested mapping (keyCount=2) with a 2D array value: the desugar must split the first two indices as mapping keys
  // and the last two as array indices. A read used in arithmetic exercises the hoist outside a bare require compare.
  const NSRC = `contract C() {
    mapping(int => mapping(int => int[2][2])) g;
    function setCell(int a, int b, int i, int j, int v, pubkey pk, sig s) { require(checkSig(s, pk)); g[a][b][i][j] = v; }
    function checkPlus(int a, int b, int i, int j, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); int x = g[a][b][i][j] + 1; require(x == exp); }
  }`;
  it('splits keys from array indices for a nested-mapping 2D array value; read feeds arithmetic', async () => {
    const art = compileString(NSRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    await fund(contract.address);
    expect((await contract.setCell(3n, 4n, 1n, 1n, 41n, alicePub, sig).send()).txid).toBeDefined();
    // g[3][4][1][1] == 41, so +1 == 42.
    await fund(contract.address);
    expect((await contract.checkPlus(3n, 4n, 1n, 1n, 42n, alicePub, sig).send()).txid).toBeDefined();
    // A sibling outer key g[3][5] is a distinct entry, still default -> g[3][5][1][1]+1 == 1.
    await fund(contract.address);
    expect((await contract.checkPlus(3n, 5n, 1n, 1n, 1n, alicePub, sig).send()).txid).toBeDefined();
  });
});
