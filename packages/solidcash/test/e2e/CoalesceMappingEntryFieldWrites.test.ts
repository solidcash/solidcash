import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Behavioral proof for CoalesceMappingEntryFieldWrites (docs/coalesce-mapping-entry-field-writes.md). Consecutive
// whole-field writes to the same C2 mapping entry are collapsed to one entry read + one whole-struct write. Each
// `chk*` reads the stored entry back and requires the exact values on the VM, so a miscompile fails the spend.
describe('CoalesceMappingEntryFieldWrites: VM behavioral parity', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  const SRC = `contract C() {
    struct S { uint256 a; uint256 b; uint256 c; uint256 d; }
    mapping(uint256 => S) m;
    function seed(uint256 k, uint256 a, uint256 b, uint256 c, uint256 d, pubkey pk, sig s) {
      require(checkSig(s, pk)); m[k] = S(a, b, c, d);
    }
    function updTwo(uint256 k, uint256 x, uint256 y, pubkey pk, sig s) {
      require(checkSig(s, pk)); m[k].a = x; m[k].b = y;
    }
    function updAll(uint256 k, uint256 a, uint256 b, uint256 c, uint256 d, pubkey pk, sig s) {
      require(checkSig(s, pk)); m[k].a = a; m[k].b = b; m[k].c = c; m[k].d = d;
    }
    function chk(uint256 k, uint256 ea, uint256 eb, uint256 ec, uint256 ed, pubkey pk, sig s) {
      require(checkSig(s, pk));
      require(m[k].a == ea); require(m[k].b == eb); require(m[k].c == ec); require(m[k].d == ed);
    }
  }`;

  const setup = async (): Promise<Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'] & { fund: () => Promise<void> } | any> => {
    const art = compileString(SRC);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x9c00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n });
    };
    return Object.assign(contract, { fund });
  };

  it('partial write preserves untouched fields of an existing entry', async () => {
    const c = await setup();
    await c.fund(); await c.seed(1n, 10n, 20n, 30n, 40n, alicePub, sig).send();      // m[1] = {10,20,30,40}
    await c.fund(); await c.updTwo(1n, 111n, 222n, alicePub, sig).send();            // coalesced a=111,b=222
    await c.fund();
    await expect(c.chk(1n, 111n, 222n, 30n, 40n, alicePub, sig).send()).resolves.toBeDefined(); // c,d preserved
  });

  it('partial write to a fresh entry zero-fills the untouched fields', async () => {
    const c = await setup();
    await c.fund(); await c.updTwo(7n, 5n, 6n, alicePub, sig).send();                // fresh key -> {5,6,0,0}
    await c.fund();
    await expect(c.chk(7n, 5n, 6n, 0n, 0n, alicePub, sig).send()).resolves.toBeDefined();
  });

  it('whole-struct cover writes every field in one go', async () => {
    const c = await setup();
    await c.fund(); await c.seed(2n, 1n, 1n, 1n, 1n, alicePub, sig).send();
    await c.fund(); await c.updAll(2n, 8n, 9n, 10n, 11n, alicePub, sig).send();      // all 4 fields (full cover)
    await c.fund();
    await expect(c.chk(2n, 8n, 9n, 10n, 11n, alicePub, sig).send()).resolves.toBeDefined();
  });

  // The gate leaves a same-entry self-read (`m[k].b = m[k].a`) uncoalesced (it would need the progressively-updated
  // entry). Asserted at compile level: the self-read stays two upserts, larger than the coalesced no-self-read form.
  it('gate leaves a same-entry self-read uncoalesced', () => {
    const sz = (src: string): number => {
      const bc = compileString(src).bytecode.trim().split(/\s+/);
      return bc.reduce((n, t) => n + (t.startsWith('OP_') ? 1 : t.length / 2), 0);
    };
    const base = 'struct S { uint256 a; uint256 b; uint256 c; } mapping(uint256 => S) m;';
    const selfRead = sz(`contract C() { ${base} function f(uint256 k, uint256 x) public { m[k].a = x; m[k].b = m[k].a; require(true); } }`);
    const noSelf = sz(`contract C() { ${base} function f(uint256 k, uint256 x, uint256 y) public { m[k].a = x; m[k].b = y; require(true); } }`);
    expect(selfRead).toBeGreaterThan(noSelf);
  });

  it('rejects a wrong expected value (oracle is live)', async () => {
    const c = await setup();
    await c.fund(); await c.updTwo(4n, 111n, 222n, alicePub, sig).send();
    await c.fund();
    await expect(c.chk(4n, 111n, 999n, 0n, 0n, alicePub, sig).send()).rejects.toThrow(); // eb wrong
  });
});
