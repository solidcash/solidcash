import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A mapping access that reads another entry inside its own element index or key, on the direct convention: the
// inner read is an entry access of its own, so the SDK co-spends its entry beside the outer one. The framed frames
// of the same shapes are settled on the machine in solidc's `nested-entry-read.test.ts`.
const ARRAYS = `contract Arrays() {
  mapping(int => int[]) m;
  mapping(int => int) at;
  function checkLast(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][m[k].length - 1] == e); }
  function checkAt(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(m[k][at[k]] == e); }
  function putLast(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][m[k].length - 1] = v; }
}`;

// Each check requires the value a key read from another entry names: the honest expectation is accepted on the
// machine and another value is refused. The SDK takes the inner read's value as the outer entry's key.
const KEYS = `contract Keys() {
  mapping(int => int) at;
  mapping(int => int) seen;
  mapping(int => mapping(int => int)) grid;
  function setAt(int k, int i, pubkey pk, sig s) { require(checkSig(s, pk)); at[k] = i; }
  function setSeen(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); seen[k] = v; }
  function setCell(int k, int j, int v, pubkey pk, sig s) { require(checkSig(s, pk)); grid[k][j] = v; }
  function checkSeen(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(seen[at[k]] == e); }
  function checkCell(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(grid[k][at[k]] == e); }
  function putSeen(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); seen[at[k]] = v; }
  function clearSeen(int k, pubkey pk, sig s) { require(checkSig(s, pk)); delete seen[at[k]]; }
}`;

type Accesses = (string | readonly string[])[][] | undefined;

/** The contract's own covenant refuses the spend: the required value is not the one the nested read names. */
const REFUSED = /failed an OP_VERIFY operation/;

describe('direct convention: a mapping read nested in an index or a key', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('compiles each nested read as an entry access of its own', () => {
    const accessesOf = (source: string): ((name: string) => Accesses) => {
      const art = compileString(source);
      return (name: string): Accesses => art.abi.find((row) => row.name === name)?.entryAccesses
        ?.map((access) => [access.collection, access.operations]);
    };
    const arrays = accessesOf(ARRAYS);
    expect(arrays('checkLast')).toStrictEqual([['m', ['read']]]);
    expect(arrays('checkAt')).toStrictEqual([['m', ['read']], ['at', ['read']]]);
    expect(arrays('putLast')).toStrictEqual([['m', ['read', 'write']]]);
    const keys = accessesOf(KEYS);
    expect(keys('checkSeen')).toStrictEqual([['seen', ['read']], ['at', ['read']]]);
    expect(keys('checkCell')).toStrictEqual([['grid', ['read']], ['at', ['read']]]);
    expect(keys('putSeen')).toStrictEqual([['seen', ['write']], ['at', ['read']]]);
    expect(keys('clearSeen')).toStrictEqual([['seen', ['write']], ['at', ['read']]]);
  });

  it('reads, writes and deletes the node a key read from another entry names, and refuses another value', async () => {
    const art = compileString(KEYS);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x4e00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const fund = async (addr: string): Promise<void> => {
      await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const sent = async (call: { send: () => Promise<{ txid: string }> }): Promise<string> => {
      await fund(contract.address);
      return (await call.send()).txid;
    };

    expect(await sent(contract.setAt(5n, 1n, alicePub, sig))).toBeDefined();
    expect(await sent(contract.setSeen(1n, 77n, alicePub, sig))).toBeDefined();
    expect(await sent(contract.checkSeen(5n, 77n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    await expect(sent(contract.checkSeen(5n, 76n, alicePub, sig).withEntryKey(0, 1n))).rejects.toThrow(REFUSED);

    expect(await sent(contract.setCell(5n, 1n, 33n, alicePub, sig))).toBeDefined();
    expect(await sent(contract.checkCell(5n, 33n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    await expect(sent(contract.checkCell(5n, 32n, alicePub, sig).withEntryKey(0, 1n))).rejects.toThrow(REFUSED);

    expect(await sent(contract.putSeen(5n, 44n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    expect(await sent(contract.checkSeen(5n, 44n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    await expect(sent(contract.checkSeen(5n, 77n, alicePub, sig).withEntryKey(0, 1n))).rejects.toThrow(REFUSED);

    expect(await sent(contract.clearSeen(5n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    expect(await sent(contract.checkSeen(5n, 0n, alicePub, sig).withEntryKey(0, 1n))).toBeDefined();
    await expect(sent(contract.checkSeen(5n, 44n, alicePub, sig).withEntryKey(0, 1n))).rejects.toThrow(REFUSED);
  });
});
