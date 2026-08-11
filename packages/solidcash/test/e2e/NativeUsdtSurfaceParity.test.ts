import { describe, it, expect, beforeAll } from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import type { Artifact } from '@solidcash/utils';

// =============================================================================
// The USDT port exists in three arrangements. The monolith and hand split are
// ABI-identical; the inheritance rewrite later evolved into the OZ/BchNative
// composition and intentionally exposes that platform's adapters and getters.
//
//   native_usdt.scash      the one-file reference spec (over the input limit)
//   nusdt.scash + nusdt_facet.scash   the hand-split master and its one facet
//   nusdt_inherited.scash  the inheritance rewrite the built-in splitter cuts up
//
// They HAD diverged. The monolith carried seven on-chain view functions the
// shipping split deliberately dropped, and lacked `authorize` which the split
// master has - so the "reference spec" described a contract nobody deploys, and
// the divergence was invisible because only a size test ever loaded it.
//
// This pins exact parity for the reference/hand split, then pins both the shared
// token operations and the intentional adapter delta for the inherited variant.
// `authorize` is split machinery, not part of the token.
// =============================================================================

const fx = (n: string): URL => new URL(`../fixture/${n}`, import.meta.url);
const MECHANISM_ONLY = new Set(['authorize', '__construct']);

const surfaceOf = (artifacts: Artifact[]): string[] => {
  const names = new Set<string>();
  for (const artifact of artifacts) {
    for (const fn of artifact.abi) if (!MECHANISM_ONLY.has(fn.name)) names.add(fn.name);
  }
  return [...names].sort();
};

let monolith: string[];
let facets: string[];
let inherited: string[];

beforeAll(() => {
  monolith = surfaceOf([compileFile(fx('native_usdt.scash'), { messageBus: false }) as Artifact]);
  facets = surfaceOf([
    compileFile(fx('nusdt.scash'), { messageBus: false }) as Artifact,
    compileFile(fx('nusdt_facet.scash'), { brandLibrary: true, messageBus: false }) as Artifact,
  ]);
  inherited = surfaceOf([compileFile(fx('nusdt_inherited.scash'), { messageBus: false }) as Artifact]);
}, 300000);

describe('NativeUsdt / one token, three arrangements', () => {
  it('the monolith and the hand-split facets expose the same functions', () => {
    expect(monolith).toEqual(facets);
  });

  it('the inheritance rewrite preserves the shared mutating token surface', () => {
    for (const fn of [
      'approve', 'cancelDeposit', 'claimDeposit', 'deposit', 'destroyBlackFunds',
      'issue', 'pause', 'redeem', 'setQuarantineBlocks', 'transfer', 'transferFrom',
      'transferOwnership', 'unpause', 'withdraw',
    ]) {
      expect(monolith, `${fn} missing from the hand split`).toContain(fn);
      expect(inherited, `${fn} missing from the inherited composition`).toContain(fn);
    }
  });

  it('pins the inherited OZ/BchNative adapter delta instead of mistaking it for erased USDT routes', () => {
    expect(inherited.filter((fn) => !monolith.includes(fn))).toEqual([
      '__updateBlockOracle', 'allowance', 'balanceOf', 'blacklist', 'decimals',
      'name', 'symbol', 'totalSupply', 'unblacklist', 'wrap',
    ]);
    expect(monolith.filter((fn) => !inherited.includes(fn))).toEqual([
      'addBlackList', 'deprecate', 'freeze', 'openSelf', 'removeBlackList',
      'setBacking', 'tick', 'unfreeze',
    ]);
  });

  // Guards the guard: if MECHANISM_ONLY ever swallowed a real entry point, the
  // comparisons above would pass while the surface silently shrank.
  it('that surface is the whole deployed-USDT API, not a subset', () => {
    for (const fn of [
      'transfer', 'transferFrom', 'approve', 'issue', 'redeem', 'destroyBlackFunds',
      'addBlackList', 'removeBlackList', 'pause', 'unpause', 'transferOwnership',
      'deprecate', 'freeze', 'unfreeze', 'setBacking', 'withdraw',
      'tick', 'deposit', 'claimDeposit', 'cancelDeposit', 'setQuarantineBlocks',
      // Platform-forced addition: an account opens its own keys before use.
      'openSelf',
    ]) {
      expect(monolith, `${fn} missing from the shared surface`).toContain(fn);
    }
    expect(monolith).toHaveLength(22);
  });

  // The deviation says the port reads views off-chain. If one comes back it has
  // to come back in all three, and be a deliberate change to that deviation.
  it('carries no on-chain view functions', () => {
    for (const view of [
      'balanceOf', 'allowance', 'getTotalSupply', 'getBlackListStatus',
      'getOwner', 'getFrozenStatus', 'getPendingAmount',
    ]) {
      expect(monolith, `${view} is an on-chain view the port documents as removed`).not.toContain(view);
    }
  });
});
