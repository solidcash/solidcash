import { describe, it, expect } from 'vitest';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A RETURNING struct storage-pointer fn (BentoBox BoringRebase `addElastic(Rebase storage,..) returns(uint)`):
// InlineReturningStateHelpers now read-modify-writes the mapping element AND captures the return value, so the
// mutation persists AND the returned value is usable - in STATEMENT position (return discarded) and EXPRESSION
// position (return used in an assign / a require comparison, the exact BentoBox `require(bal >= addElastic(..))`).
describe('returning struct storage-pointer fn on a mapping element (RMW + return capture)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  const SRC = `struct T { int base; int elastic; }
    library L { function addElastic(T storage t, int e) returns (int newElastic) { newElastic = t.elastic = t.elastic + e; } }
    contract C() {
      using L for T;
      mapping(int => T) totals;
      int last;
      function setT(int k, int b, int el, pubkey pk, sig s) { require(checkSig(s, pk)); this.totals[k] = T(b, el); }
      function bumpStmt(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); this.totals[k].addElastic(e); }
      function bumpToLast(int k, int e, pubkey pk, sig s) { require(checkSig(s, pk)); this.last = L.addElastic(this.totals[k], e); }
      function bumpGuard(int k, int e, int max, pubkey pk, sig s) { require(checkSig(s, pk)); require(max >= L.addElastic(this.totals[k], e)); }
      function checkT(int k, int eb, int eel, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.totals[k].base == eb); require(this.totals[k].elastic == eel); }
      function checkLast(int e, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.last == e); }
    }`;

  const deploy = async (): Promise<{
    c: Record<string, (...a: unknown[]) => { send: () => Promise<{ txid: string }> }>;
    fund: () => Promise<void>; elasticOf: (k: bigint) => Promise<bigint | undefined>; inner: unknown; cat: string;
  }> => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x6a00;
    const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const fund = async (): Promise<void> => { await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n }); };
    const ea = getEntryNftAddress(contract.inner, categoryId, 'totals');
    const elasticOf = async (k: bigint): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(k));
      if (!e) return undefined;
      // struct value blob = base|elastic (two vm-numbers); read the second field is layout-specific, so this test
      // asserts via the on-chain checkT covenant instead. elasticOf is only used for a smoke existence check.
      return e.value.length > 0 ? 0n : undefined;
    };
    return { c: contract as never, fund, elasticOf, inner: contract.inner, cat: categoryId };
  };

  it('STATEMENT position: totals[k].addElastic(e) mutates elastic, preserves base, discards return', async () => {
    const { c, fund } = await deploy();
    await fund();
    expect((await c.setT(5n, 100n, 200n, alicePub, sig).send()).txid).toBeDefined(); // totals[5] = T(100, 200)
    await fund();
    expect((await c.bumpStmt(5n, 50n, alicePub, sig).send()).txid).toBeDefined(); // elastic 200 -> 250
    await fund();
    expect((await c.checkT(5n, 100n, 250n, alicePub, sig).send()).txid).toBeDefined(); // base=100, elastic=250
  });

  it('EXPRESSION position (assign): last = L.addElastic(totals[k], e) sets last to new elastic AND persists', async () => {
    const { c, fund } = await deploy();
    await fund();
    expect((await c.setT(3n, 10n, 300n, alicePub, sig).send()).txid).toBeDefined(); // totals[3] = T(10, 300)
    await fund();
    expect((await c.bumpToLast(3n, 25n, alicePub, sig).send()).txid).toBeDefined(); // elastic 300 -> 325; last = 325
    await fund();
    expect((await c.checkT(3n, 10n, 325n, alicePub, sig).send()).txid).toBeDefined(); // elastic persisted = 325
    await fund();
    expect((await c.checkLast(325n, alicePub, sig).send()).txid).toBeDefined(); // returned value captured = 325
  });

  it('EXPRESSION position (require guard, BentoBox shape): require(max >= addElastic(..)) both mutates + compares', async () => {
    const { c, fund } = await deploy();
    await fund();
    expect((await c.setT(7n, 1n, 400n, alicePub, sig).send()).txid).toBeDefined(); // totals[7] = T(1, 400)
    await fund();
    expect((await c.bumpGuard(7n, 100n, 600n, alicePub, sig).send()).txid).toBeDefined(); // elastic->500, 600>=500 OK
    await fund();
    expect((await c.checkT(7n, 1n, 500n, alicePub, sig).send()).txid).toBeDefined(); // elastic persisted = 500
  });
});
