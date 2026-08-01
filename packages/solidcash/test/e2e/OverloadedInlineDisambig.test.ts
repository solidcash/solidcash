/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Kashi RebaseLibrary.add shape: two same-arity (3) overloads differing by return count - `add(R, x, bool)` returns
// (R, base) and `add(R, x, base)` returns R. A using-for method call in the bodies (x.id()) marks them for inline;
// the ambiguous-inline is disambiguated by RETURN ARITY at the call site (a 1-value assign picks the 1-return
// overload, a tuple picks the 2-return one - Solidity assignment semantics). This proves each context runs the
// CORRECT overload's body (distinguishable: the 2-return one computes base = x+1, the 1-return uses the given base).
describe('overloaded returning-helper inline disambiguated by return arity (Kashi RebaseLibrary.add)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  const SRC = `struct R { int e; int b; }
    library M { function id(int a) internal pure returns (int) { return a; } }
    library L {
      using M for int;
      function add(R total, int x, bool up) internal pure returns (R, int base) {
        base = up ? x.id() + 1 : x.id(); total.e = total.e + x; total.b = total.b + base; return (total, base);
      }
      function add(R total, int x, int base) internal pure returns (R) {
        total.e = total.e + x.id(); total.b = total.b + base; return total;
      }
    }
    contract C() {
      using L for R;
      R rr;
      function useOne(int x, int base, pubkey pk, sig s) { require(checkSig(s, pk)); R t = R(0, 0); t = t.add(x, base); this.rr = t; }
      function useTwo(int x, pubkey pk, sig s) { require(checkSig(s, pk)); R t = R(0, 0); int bb; (t, bb) = t.add(x, true); this.rr = t; }
      function checkRr(int ee, int eb, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.rr.e == ee); require(this.rr.b == eb); }
    }`;

  // Module-scoped nonce: the two `it` blocks share the provider, so uids must never repeat across deploys.
  let nonce = 0x7c00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  const deploy = async (): Promise<{ c: Record<string, (...a: unknown[]) => { send: () => Promise<{ txid: string }> }>; fund: () => Promise<void> }> => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const fund = async (): Promise<void> => { await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n }); };
    return { c: contract as never, fund };
  };

  it('1-value assign picks the 1-return overload (uses the given base)', async () => {
    const { c, fund } = await deploy();
    await fund();
    expect((await c.useOne(5n, 3n, alicePub, sig).send()).txid).toBeDefined(); // R(0,0).add(5, 3) -> R(5, 3)
    await fund();
    expect((await c.checkRr(5n, 3n, alicePub, sig).send()).txid).toBeDefined(); // e=5, b=3 (base used directly)
  });

  it('tuple assign picks the 2-return overload (computes base = x + 1)', async () => {
    const { c, fund } = await deploy();
    await fund();
    expect((await c.useTwo(5n, alicePub, sig).send()).txid).toBeDefined(); // R(0,0).add(5, true) -> base=6, R(5, 6)
    await fund();
    expect((await c.checkRr(5n, 6n, alicePub, sig).send()).txid).toBeDefined(); // e=5, b=6 (base = x+1 computed)
  });
});
