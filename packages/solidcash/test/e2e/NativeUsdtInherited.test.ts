import {
  describe, it, expect, beforeAll,
} from 'vitest';
import { compileFile, compileFileSplit } from 'solidc';
import { URL } from 'url';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import type { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import { Signer, SplitContractBundle } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv, aliceAddress } from '../fixture/vars.js';

// =============================================================================
// The same USDT port composed by INHERITANCE and partitioned by the built-in
// splitter, instead of by six hand-written delegate-library facets.
//
// What this buys over nusdt*.scash (see docs/native-usdt-port.md s5):
//   one declaration of the state layout instead of six copies; `struct Pending`
//   back instead of two parallel mappings; no forwarders; 3 scripts totalling
//   15,995 B instead of 6 totalling 25,139 B; and a partition the compiler
//   re-plans instead of a hand-drawn line that rots.
//
// What still blocks it: msg.sender does not resolve inside an auto-split facet
// (SplitFacetMsgSender.test.ts has the minimal repro), and every USDT entry
// point is onlyOwner or reads msg.sender for the sender's own balance.
// =============================================================================

const MAX_INPUT_BYTESIZE = 10000;
const fx = (n: string): URL => new URL(`../fixture/${n}`, import.meta.url);
const scriptSize = (a: Artifact): number => scriptToBytecode(asmToScript(a.bytecode)).length;

let flat: Artifact;
let bundle: SplitArtifactBundle;

beforeAll(() => {
  flat = compileFile(fx('nusdt_inherited.scash'), { messageBus: false }) as Artifact;
  bundle = compileFileSplit(fx('nusdt_inherited.scash'), { messageBus: false });
}, 300000);

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
    // Fewer, smaller scripts than the hand-rolled six (25,139 B at the same commit).
    expect(rows.length).toBeLessThan(6);
    expect(rows.reduce((a, [, s]) => a + s, 0)).toBeLessThan(25139);
  });

  it('routes every ABI function to the root or a facet', () => {
    const routed = new Set(bundle.manifest.routes.map((r) => r.function));
    for (const fn of flat.abi.map((f) => f.name)) {
      expect(routed.has(fn), `${fn} has no split route`).toBe(true);
    }
  });

  it('deploys, and the constructor state lands on the root', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea', 'eb', 'ec']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const b32 = (s: string): Uint8Array => {
      const out = new Uint8Array(32);
      out.set(new TextEncoder().encode(s));
      return out;
    };
    const deployed = await SplitContractBundle.from(bundle, signer).deploy(
      [addressToLockScript(aliceAddress), b32('Tether USD'), b32('USDT'), 6n, 10n],
      {
        fundingUtxo: funding[0],
        facetOverrides: Object.fromEntries(bundle.manifest.facets.map((f, i) => [
          f.name, { fundingUtxo: funding[i + 1] },
        ])),
      },
    );
    expect(Object.keys(deployed.facets)).toHaveLength(bundle.manifest.facets.length);
    const state = await deployed.root.getState();
    expect(state.decimals).toBe(6n);
    expect(state.quarantineBlocks).toBe(10n);
    expect(state.owner).toStrictEqual(addressToLockScript(aliceAddress));

    // ...but no USDT entry point can be called, because all of them read
    // msg.sender. SplitFacetMsgSender.test.ts isolates why.
    await expect(deployed.call.pause().send()).rejects.toThrow(/OP_VERIFY/);
  }, 300000);
});
