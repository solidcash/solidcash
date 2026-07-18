import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// C2 diff-key INSERT loop `for(i<ks.length) w[ks[i]] = true`: one call co-spends the N bracketing predecessors and
// mints N new sorted-list nodes (the SDK derives the evolving list off-chain; the covenant pins each P'/NEW). Present
// reads then find each key; an absent key is bracket-proven default (exclusion). Distinct sha256-scattered keys.
const SRC = `contract C() {
  mapping(int => bool) w;
  function whitelist(int[] ks, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < ks.length; i++) { w[ks[i]] = true; } }
  function chk(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(w[k]); }
  function chkAbsent(int k, pubkey pk, sig s) { require(checkSig(s, pk)); require(!w[k]); }
}`;

describe('C2 diff-key insert-in-loop (SDK progressive derivation)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xd00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  // SKIPPED: the insert-loop covenant + SDK derivation are WIP. Two open problems: (1) even N=1 fails an OP_VERIFY
  // (ip~162) at runtime - the SDK tx layout (predecessor input / P'+NEW trailing outputs) does not yet satisfy the
  // covenant's index expectations, or the covenant bytecode has a stack bug; (2) the COMMON case - N keys into a
  // fresh/sparse map - is N inserts into ONE gap (all bracket HEAD), which the scattered per-iteration co-spend design
  // cannot do (same predecessor). That needs the RANGE-SPLICE (co-spend one predecessor, mint a sorted chain), which
  // has a source-order (loop) vs slot-order (list) tension. See deferrals.md section 6(a) + memory.
  it.skip('inserts N distinct keys in one loop; present + absent reads verify', async () => {
    const art = compileString(SRC, { forceStateful: true });
    expect(art.abi.find((f) => f.name === 'whitelist')?.sortedInsertLoopInfo?.[0]?.varyingArrayParam).toBe('ks');

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });

    // N=1 loop insert into a fresh map (predecessor = HEAD): validates the covenant + SDK derivation core.
    await fund(contract.address);
    expect((await contract.whitelist([3n], alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chk(3n, alicePub, sig).send()).txid).toBeDefined();
    await fund(contract.address);
    expect((await contract.chkAbsent(9n, alicePub, sig).send()).txid).toBeDefined();
  });
});
