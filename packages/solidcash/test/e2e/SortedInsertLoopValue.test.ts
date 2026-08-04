import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// C2 diff-key INSERT loop with a LOOP-INVARIANT non-bool VALUE `for(i) bal[ks[i]] = v` (v a param, same for every
// key). The range-splice mints the sorted chain P' -> k1 -> .. -> kN -> P.oldNext with EACH node's value = v; the
// covenant body now PICKs v and EQUALVERIFYs node.value == v (was pinned to 0x01, which only ever matched v==1).
// SOUNDNESS: every inserted key must read back EXACTLY v (not empty, not the old 0x01 pin), and a wrong expected
// value must REVERT - proving the covenant bound each minted node to the real value, not a placeholder.
const SRC = `contract C() {
  mapping(int => bigint) bal;
  function setMany(int[] ks, int v, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { bal[ks[i]] = v; } }
  function chk(int k, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(bal[k] == exp); }
}`;

describe('C2 insert-in-loop with a loop-invariant VALUE (bal[ks[i]] = v) is sound', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x5a00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('inserts N keys all with value v=100; each reads back exactly 100, wrong value reverts, absent reads 0', async () => {
    const art = compileString(SRC, { forceStateful: true });
    // `= <param>` now routes to the UPSERT loop (op=set, valueScalarParam) - it gains UPDATE support while its same-gap
    // chaining keeps the N-in-one-gap behavior. (Was the insert-only range-splice / sortedInsertLoopInfo.)
    const info = art.abi.find((f) => f.name === 'setMany')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingArrayParam).toBe('ks');
    expect(info?.valueScalarParam).toBe('v');
    expect(info?.op).toBe('set');

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    // Three keys into a fresh map (all bracket HEAD = one gap = range-splice), each pinned to value 100.
    await fund(contract.address);
    expect((await contract.setMany([3n, 7n, 5n], 100n, alicePub, sig).send()).txid).toBeDefined();

    // Each inserted key reads back EXACTLY 100 (not empty, not the old 0x01=1 pin).
    for (const k of [3n, 5n, 7n]) {
      await fund(contract.address);
      expect((await contract.chk(k, 100n, alicePub, sig).send()).txid).toBeDefined();
    }
    // Adversarial: a wrong expected value reverts -> the stored value really is 100, and specifically NOT the bool pin 1.
    await fund(contract.address);
    await expect(contract.chk(3n, 1n, alicePub, sig).send()).rejects.toThrow(
      /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
    await fund(contract.address);
    await expect(contract.chk(7n, 99n, alicePub, sig).send()).rejects.toThrow(
      /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
    // An absent key is bracket-proven default (0).
    await fund(contract.address);
    expect((await contract.chk(9n, 0n, alicePub, sig).send()).txid).toBeDefined();

    // NEW capability (was insert-only): `= <param>` now UPDATES existing keys too. setMany([3, 9], 200) -> 3 updated
    // (100 -> 200), 9 inserted (new). The insert-only range-splice could not have updated 3.
    await fund(contract.address);
    expect((await contract.setMany([3n, 9n], 200n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(3n, 200n, alicePub, sig).send()).txid).toBeDefined(); // updated
    await fund(contract.address);
    expect((await contract.chk(9n, 200n, alicePub, sig).send()).txid).toBeDefined(); // inserted
    await fund(contract.address);
    expect((await contract.chk(7n, 100n, alicePub, sig).send()).txid).toBeDefined(); // untouched
  });
});
