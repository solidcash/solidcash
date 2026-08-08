import {
  describe, it, expect, beforeAll,
} from 'vitest';
import { compileFile, compileFileSplit } from 'solidc';
import { URL } from 'url';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import type { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import { Signer, SplitContractBundle } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, aliceAddress } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// =============================================================================
// The same USDT port composed by INHERITANCE and partitioned by the built-in
// splitter, instead of by hand-written delegate-library facets.
//
// What this buys over nusdt*.scash (see docs/native-usdt-port.md s5):
//   one declaration of the state layout instead of four copies; `struct Pending`
//   back instead of two parallel mappings; no forwarders; 3 scripts totalling
//   15,995 B instead of 4 totalling 18,671 B; and a partition the compiler
//   re-plans instead of a hand-drawn line that rots.
//
// Owner-gated routes settle here now: the two bugs that blocked them - msg.sender
// not resolving in a facet, and a zero-parameter event emitted twice - are fixed
// and pinned by SplitFacetMsgSender.test.ts.
//
// What still does not work is the mapping surface, and for the same reason as in
// the hand-split arrangement: a delegated first-touch INSERT is refused by the
// proxy. The hand-split works around it by keeping the insert path on the master;
// here the splitter chooses the partition, so that lever is not available.
// =============================================================================

const MAX_INPUT_BYTESIZE = 10000;
const fx = (n: string): URL => new URL(`../fixture/${n}`, import.meta.url);
const scriptSize = (a: Artifact): number => scriptToBytecode(asmToScript(a.bytecode)).length;

let flat: Artifact;
let bundle: SplitArtifactBundle;

// The splitter's probe explores facet groupings and recompiles each one, which is ~60 s on an idle machine
// and several times that when the suite runs in parallel with others - hence the outsized hook budget.
beforeAll(() => {
  flat = compileFile(fx('nusdt_inherited.scash'), { messageBus: false }) as Artifact;
  bundle = compileFileSplit(fx('nusdt_inherited.scash'), { messageBus: false });
}, 900000);

describe('NativeUsdtInherited / composition', () => {
  // Ownable is reached along five paths (Pausable, BasicToken via StandardToken and
  // BlackList, Freezable, Backed). C3 has to collapse those into one `owner`.
  it('C3 linearization gives the diamond base exactly one state slot', () => {
    const names = (flat.stateLayout?.variables ?? []).map((v) => v.name);
    expect(names.filter((n) => n === 'owner')).toHaveLength(1);
    expect(names.filter((n) => n === 'paused')).toHaveLength(1);
    // BasicToken is inherited by both StandardToken and BlackList.
    expect(names.filter((n) => n === 'totalSupply')).toHaveLength(1);
    const collections = (flat.stateLayout?.collections ?? []).map((c) => c.name);
    expect(collections.filter((n) => n === 'balances')).toHaveLength(1);
  });

  it('exposes the whole USDT surface from one file', () => {
    const abi = new Set(flat.abi.map((f) => f.name));
    for (const fn of [
      'transfer', 'transferFrom', 'approve', 'issue', 'redeem', 'destroyBlackFunds',
      'addBlackList', 'removeBlackList', 'freeze', 'unfreeze', 'pause', 'unpause',
      'transferOwnership', 'setParams', 'deprecate', 'setBacking', 'withdraw',
      'tick', 'deposit', 'claimDeposit', 'cancelDeposit', 'setQuarantineBlocks',
    ]) {
      expect(abi.has(fn), `${fn} missing from the inherited contract`).toBe(true);
    }
  });

  // The facet split had to degrade Pending to two parallel mappings, because every
  // facet importing the struct collided on "Redefinition of struct Pending". One
  // file, one declaration, so the struct survives.
  it('keeps struct Pending, which the facet split could not', () => {
    const collections = (flat.stateLayout?.collections ?? []).map((c) => c.name);
    expect(collections).toContain('pendingDeposits');
    expect(collections).not.toContain('pendingAmount');
    expect(collections).not.toContain('pendingUnlockAt');
  });
});

describe('NativeUsdtInherited / the built-in splitter', () => {
  it('partitions the over-limit contract into shards that all fit', () => {
    expect(scriptSize(flat)).toBeGreaterThan(MAX_INPUT_BYTESIZE);
    const rows: Array<[string, number]> = [['root', scriptSize(bundle.root)]];
    for (const [name, art] of Object.entries(bundle.facets)) rows.push([name, scriptSize(art)]);
    for (const [name, size] of rows) {
      expect(size, `${name} is ${size} B, over the ${MAX_INPUT_BYTESIZE} B per-input limit`)
        .toBeLessThanOrEqual(MAX_INPUT_BYTESIZE);
    }
    // Fewer, smaller scripts than the hand-rolled four (18,671 B at the same commit).
    expect(rows.length).toBeLessThan(4);
    expect(rows.reduce((a, [, s]) => a + s, 0)).toBeLessThan(18671);
  });

  it('routes every ABI function to the root or a facet', () => {
    const routed = new Set(bundle.manifest.routes.map((r) => r.function));
    for (const fn of flat.abi.map((f) => f.name)) {
      expect(routed.has(fn), `${fn} has no split route`).toBe(true);
    }
  });

  // THE SPLITTER PLANS ON ARTIFACT SIZE, and the cap is on the deployed unlocking bytecode.
  // Every shard below passes the artifact check above and the bundle is still unspendable:
  // one shard's redeem script is over the limit once its constructor argument is baked in,
  // before any of its call arguments. Same three-layer budget as s1.2, inside the splitter.
  //
  // This is pinned rather than worked around because it is the splitter's to fix: nothing a
  // contract author writes can see it, and `compileFileSplit` reports success.
  it('can emit a bundle whose shards fit as artifacts but not as deployed scripts', async () => {
    // Every shard passes the check the splitter itself makes.
    for (const artifact of [bundle.root, ...Object.values(bundle.facets)]) {
      expect(scriptSize(artifact)).toBeLessThanOrEqual(MAX_INPUT_BYTESIZE);
    }

    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea', 'eb', 'ec']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const b32 = (text: string): Uint8Array => {
      const out = new Uint8Array(32);
      out.set(new TextEncoder().encode(text));
      return out;
    };
    // ...and the deploy is still refused, on the per-input script limit, because that limit
    // covers the redeem script PLUS its constructor argument PLUS the call's arguments and
    // the redeem push. The splitter plans on the first of those only.
    const deployed = await SplitContractBundle.from(bundle, signer).deploy(
      [addressToLockScript(aliceAddress), b32('Tether USD'), b32('USDT'), 6n, 10n],
      {
        fundingUtxo: funding[0],
        facetOverrides: Object.fromEntries(bundle.manifest.facets.map((f, i) => [
          f.name, { fundingUtxo: funding[i + 1] },
        ])),
      },
    );
    // The deploy goes through - a genesis does not carry the facet's own redeem script.
    // SPENDING it does, and that is where the limit bites.
    expect((await deployed.root.getState()).decimals).toBe(6n);

    // Some route lands on the oversized shard. Collect what each one says rather than
    // guessing which, so this keeps discriminating if the splitter re-plans.
    const messages: string[] = [];
    for (const call of [
      () => deployed.call.pause().send(),
      () => deployed.call.setParams(5n, 10n).send(),
      () => deployed.call.setQuarantineBlocks(25n).send(),
      () => deployed.call.deprecate(addressToLockScript(aliceAddress)).send(),
    ]) {
      try { await call(); } catch (error) { messages.push((error as Error).message); }
    }
    expect(
      messages.some((m) => /per-input script limit|consensus-unlocking-bytes/.test(m)),
      `no route hit the per-input limit; saw: ${messages.join(' || ') || '(all settled)'}`,
    ).toBe(true);
  }, 300000);
});
