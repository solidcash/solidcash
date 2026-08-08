import {
  describe, it, expect, beforeAll,
} from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import { hexToBin } from '@bitauth/libauth';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import {
  Contract, StatefulContract, Signer, SignatureTemplate,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, setupStatefulUtxos, genesisFtContainer,
} from '../test-util.js';
import {
  alicePriv, bobPriv, carolPriv, aliceAddress, bobAddress, bobPkh, carolAddress,
} from '../fixture/vars.js';

// =============================================================================
// NativeUsdt: a drop-in port of Ethereum USDT backed by a real CashTokens FT,
// split across a proxy master + ONE branded delegate-library facet so every
// spending input stays under MAX_INPUT_BYTESIZE (10,000 B).
//
// The split is drawn by WRITE KIND: a mapping UPDATE settles through a delegate
// but a first-touch INSERT cannot (the proxy conserves its own-category mutable
// NFT count, and an insert mints a node), so every function that can create a key
// lives on the master and only update-only functions are delegated.
//
// The monolith is still unspendable, but the margin has collapsed: 32,644 B when
// this was written, 12,612 B now, against a 10,000 B cap. Splitting is still what
// makes the contract exist - it is no longer what makes it exist by a wide margin.
// =============================================================================

const MAX_INPUT_BYTESIZE = 10000;
const fx = (n: string): URL => new URL(`../fixture/${n}`, import.meta.url);
const scriptSize = (a: Artifact): number => scriptToBytecode(asmToScript(a.bytecode)).length;

const FACETS = {
  UsdtFacet: 'nusdt_facet.scash',
} as const;
type FacetName = keyof typeof FACETS;

let masterArt: Artifact;
const facetArt = {} as Record<FacetName, Artifact>;

// `messageBus: false` mirrors test/direct-compile.ts: this suite exercises direct facet calls, and the
// default `auto` mode spends its time building message-bus routes this contract never takes.
// Six scripts at a few seconds each also overrun the suite's 10 s hookTimeout, hence the explicit budget.
beforeAll(() => {
  masterArt = compileFile(fx('nusdt.scash'), { messageBus: false }) as Artifact;
  for (const [name, file] of Object.entries(FACETS)) {
    facetArt[name as FacetName] = compileFile(fx(file), { brandLibrary: true, messageBus: false }) as Artifact;
  }
}, 180000);

const DECIMALS = 6n;
const UNIT = 10n ** DECIMALS;
const PREMINT = 1_000_000n * UNIT; // 1M USDT of preminted reserve

const ADDR = {
  owner: () => addressToLockScript(aliceAddress),
  bob: () => addressToLockScript(bobAddress),
  carol: () => addressToLockScript(carolAddress),
};

// name/symbol are bytes32 (see the deviation note in nusdt.scash), right-padded.
function b32(s: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(s));
  return out;
}

function initialState(ownerAddr: Uint8Array): Record<string, unknown> {
  return {
    owner: ownerAddr,
    totalSupply: 0n,
    basisPointsRate: 0n,
    maximumFee: 0n,
    paused: false,
    name: b32('Tether USD'),
    symbol: b32('USDT'),
    decimals: DECIMALS,
    deprecated: false,
    upgradedAddress: ownerAddr,
    quarantineBlocks: 10n,
    backingCategory: new Uint8Array(32),
    backingSet: false,
    containerSeen: 0n,
    backedSupply: 0n,
    clock: 0n,
  };
}

interface Deployed {
  provider: ReturnType<typeof createTestProvider>;
  master: StatefulContract;
  facets: Record<FacetName, StatefulContract>;
  categoryId: string;
  ftCategory: string;
  containerAddress: string;
  signers: { owner: Signer; bob: Signer; carol: Signer };
  fund: (s: Signer) => Promise<void>;
  // Call AS `who`: connect(who) forces who's P2PKH funder input, which is what
  // emitTxOrigin - and therefore msg.sender - resolves to.
  as: (who: Signer) => StatefulContract;
}

let categorySeed = 0x10;

// Stand up the whole diamond: proxy master, one branded facet registered for
// L.f() auto-wiring, and a premint of real FTs in the master's token container.
//
// Categories are pre-chosen because the link is circular: the master embeds each
// facet's ADDRESS (which depends on the facet's category) while each facet is
// BRANDED to the master's category. Picking both up front breaks the cycle. This
// is why the suite is mock-only - seeding a chosen category needs addUtxo.
async function deployAll(opts?: { premint?: bigint; quarantineBlocks?: bigint }): Promise<Deployed> {
  const provider = createTestProvider();
  const ownerAddr = ADDR.owner();
  categorySeed += 1;
  const tag = categorySeed.toString(16).padStart(2, '0');
  const masterCat = `${'a'.repeat(62)}${tag}`;
  const libCat: Record<FacetName, string> = {} as never;
  let n = 0;
  for (const name of Object.keys(FACETS) as FacetName[]) {
    n += 1;
    libCat[name] = `${String(n).repeat(62)}${tag}`;
  }

  // Facet contracts first (branded to the master's category), so their addresses
  // are known and can be baked into the master's __libAddr_* constructor args.
  const libContracts = {} as Record<FacetName, Contract>;
  for (const name of Object.keys(FACETS) as FacetName[]) {
    libContracts[name] = StatefulContract.brandedLibrary(facetArt[name], masterCat, { provider });
  }
  const libAddr = (name: FacetName): Uint8Array => hexToBin(
    libContracts[name].withCategory(hexToBin(libCat[name])).lockingBytecode,
  );

  // Constructor args must follow the declared order of constructorInputs.
  const ctorArgs = masterArt.constructorInputs.map((inp) => {
    if (inp.name === 'initialOwner') return ownerAddr;
    const m = inp.name.match(/^__libAddr_(.+)$/);
    if (m) return libAddr(m[1] as FacetName);
    throw new Error(`unexpected constructor input ${inp.name}`);
  });

  const masterContract = new Contract(masterArt, ctorArgs as never, { provider });
  const state = initialState(ownerAddr);
  if (opts?.quarantineBlocks !== undefined) state.quarantineBlocks = opts.quarantineBlocks;
  await setupStatefulUtxos(
    provider, masterContract, masterArt.stateLayout!, state,
    { saltContract: true, categoryOverride: masterCat },
  );
  const master = StatefulContract.withCategory(masterContract, masterCat);

  const facets = {} as Record<FacetName, StatefulContract>;
  for (const name of Object.keys(FACETS) as FacetName[]) {
    await setupStatefulUtxos(
      provider, libContracts[name], facetArt[name].stateLayout!, initialState(ownerAddr),
      { saltContract: true, categoryOverride: libCat[name] },
    );
    facets[name] = StatefulContract.withCategory(libContracts[name], libCat[name]);
    master.registerLibrary(name, facets[name]);
  }

  // Premint the backing FT into the master's token container.
  const ft = await genesisFtContainer(
    provider, masterContract, masterCat, [opts?.premint ?? PREMINT],
  );

  const signers = {
    owner: new Signer(alicePriv, provider),
    bob: new Signer(bobPriv, provider),
    carol: new Signer(carolPriv, provider),
  };
  let fundNonce = 0xbe00;
  // Two plain UTXOs per top-up: a facet call is a co-spend (master input + facet input) and the builder
  // now provisions one plain funder per covenant input, so one coin no longer covers a delegated call.
  const fund = async (sg: Signer): Promise<void> => {
    for (let i = 0; i < 2; i += 1) {
      fundNonce += 1;
      await provider.addUtxo(sg.getAddress(), {
        txid: `${fundNonce.toString(16)}${tag}`.padStart(64, '7'), vout: 0, satoshis: 300000n,
      });
    }
  };
  for (const sg of Object.values(signers)) await fund(sg);

  return {
    provider,
    master,
    facets,
    categoryId: masterCat,
    ftCategory: ft.category,
    containerAddress: ft.address,
    signers,
    fund,
    as: (who: Signer) => master.connect(who),
  };
}

// Read state through the SDK's own StateReader rather than by parsing tx outputs:
// the layout spans four data NFTs and a transaction only emits the ones it
// touches, so output position does not map to nftIndex.
async function readState(d: Deployed): Promise<Record<string, unknown>> {
  return (await d.master.getState()) as Record<string, unknown>;
}

// Readers over the sorted-mapping entry UTXOs.
export async function balanceOf(d: Deployed, addr: Uint8Array): Promise<bigint> {
  const v = await (d.master.state as Record<string, (k: Uint8Array) => Promise<unknown>>).balances(addr);
  return (v ?? 0n) as bigint;
}

async function allowanceOf(d: Deployed, owner: Uint8Array, spender: Uint8Array): Promise<bigint> {
  const read = (d.master.state as Record<string, (a: Uint8Array, b: Uint8Array) => Promise<unknown>>).allowed;
  return ((await read(owner, spender)) ?? 0n) as bigint;
}

async function flagOf(d: Deployed, name: 'isBlackListed' | 'frozen', addr: Uint8Array): Promise<boolean> {
  const read = (d.master.state as Record<string, (k: Uint8Array) => Promise<unknown>>)[name];
  return ((await read(addr)) ?? false) as boolean;
}

describe('NativeUsdt / structural: the split is what makes the contract deployable', () => {
  it('every script - master and the facet - fits the 10,000 B per-input limit', () => {
    const rows: Array<[string, number]> = [['nusdt.scash (master)', scriptSize(masterArt)]];
    for (const name of Object.keys(FACETS) as FacetName[]) {
      rows.push([FACETS[name], scriptSize(facetArt[name])]);
    }
    for (const [name, size] of rows) {
      expect(size, `${name} is ${size} B, over the ${MAX_INPUT_BYTESIZE} B per-input limit`)
        .toBeLessThanOrEqual(MAX_INPUT_BYTESIZE);
    }
    // And the point of the exercise: the sum does not fit one input. Asserting a fixed multiple of
    // the cap re-rots every time the optimiser improves (this said 3x and the total has fallen from
    // 44,031 B to 25,139 B), so assert the property that actually justifies the split.
    const total = rows.reduce((a, [, s]) => a + s, 0);
    expect(total).toBeGreaterThan(MAX_INPUT_BYTESIZE);
  });

  // A delegate library writes the CALLER's state BY SLOT, so a divergent layout
  // silently writes the wrong field. `constructorInputs` is excluded: only the
  // master has a constructor, and it does not affect slot assignment.
  // The monolith is kept as the reference spec (native_usdt.scash): one file with
  // the whole USDT surface plus the extensions, which is far easier to read and
  // audit than six. It compiles, and it can never be SPENT - this pins the exact
  // reason the split exists rather than leaving it as a claim in a comment.
  //
  // The overshoot is now 2,612 B, not 22,644 B: upstream outlining took the
  // monolith from 32,644 B to 12,612 B and the largest single body from 6,555 B
  // to under 1 KB. Asserting a fixed multiple of the cap would re-rot, so assert
  // the shape that actually matters - over the cap, no single body responsible.
  it('the single-file monolith compiles but is unspendable, which is why we split', () => {
    const mono = compileFile(fx('native_usdt.scash'), { messageBus: false }) as Artifact;
    expect(scriptSize(mono)).toBeGreaterThan(MAX_INPUT_BYTESIZE);
    // No individual function is the problem - the sum is.
    const bodies = Object.values(mono.functionBodies ?? {}) as string[];
    const largest = Math.max(...bodies.map((b) => (typeof b === 'string' ? b.length / 2 : 0)));
    expect(largest).toBeLessThan(MAX_INPUT_BYTESIZE);
  });

  it('all facets declare a state layout identical to the master (delegate writes by slot)', () => {
    const slots = (a: Artifact): string => JSON.stringify({
      variables: a.stateLayout?.variables,
      collections: a.stateLayout?.collections,
      structs: a.stateLayout?.structs,
      dataNftCount: a.stateLayout?.dataNftCount,
    });
    const ref = slots(masterArt);
    for (const name of Object.keys(FACETS) as FacetName[]) {
      expect(slots(facetArt[name]), `${name} layout diverges from the master`).toBe(ref);
    }
  });

  it('every facet is a branded library (brand pins the co-spent master category)', () => {
    for (const name of Object.keys(FACETS) as FacetName[]) {
      expect(facetArt[name].isLibrary, `${name} is not a library`).toBe(true);
      expect(facetArt[name].brandedLibrary, `${name} is not branded`).toBe(true);
    }
  });

  it('exposes the full deployed-USDT function surface across master + facets', () => {
    const all = new Set<string>(masterArt.abi.map((f) => f.name));
    for (const name of Object.keys(FACETS) as FacetName[]) {
      for (const f of facetArt[name].abi) all.add(f.name);
    }
    // Every mutating entry point of the real TetherToken.
    for (const fn of ['transfer', 'transferFrom', 'approve', 'issue', 'redeem', 'setParams',
      'pause', 'unpause', 'deprecate', 'transferOwnership',
      'addBlackList', 'removeBlackList', 'destroyBlackFunds']) {
      expect(all, `missing USDT entry point ${fn}`).toContain(fn);
    }
    // The three extensions.
    for (const fn of ['freeze', 'unfreeze', 'withdraw', 'deposit', 'claimDeposit', 'cancelDeposit',
      'setQuarantineBlocks', 'setBacking', 'tick']) {
      expect(all, `missing extension entry point ${fn}`).toContain(fn);
    }
  });

  it('keeps the FT-moving functions in the master (delegate mode cannot touch a token container)', () => {
    const masterFns = masterArt.abi.map((f) => f.name);
    for (const fn of ['withdraw', 'cancelDeposit', 'setBacking']) {
      expect(masterFns, `${fn} must live in the master`).toContain(fn);
    }
    for (const name of Object.keys(FACETS) as FacetName[]) {
      for (const f of facetArt[name].abi) {
        expect(['withdraw', 'cancelDeposit', 'setBacking']).not.toContain(f.name);
      }
    }
  });
});

describe('NativeUsdt / genesis, supply and the FT boundary', () => {
  it('setBacking reads the premint from the container itself, not from an argument', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    const st = await readState(d);
    expect(st.backingSet).toBe(true);
    // containerSeen came from this.tokens[cat].tokenAmount - the physical reserve -
    // so the owner cannot overstate the premint and inflate what issue may release.
    expect(st.containerSeen).toBe(PREMINT);
  });

  it('setBacking is one-shot: the backing category can never be repointed', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    await d.fund(d.signers.owner);
    await expect(d.as(d.signers.owner).call.setBacking(d.ftCategory).send()).rejects.toThrow();
  });

  it('only the owner can pin the backing', async () => {
    const d = await deployAll();
    await expect(d.as(d.signers.bob).call.setBacking(d.ftCategory).send()).rejects.toThrow();
  });

  it('withdraw is balance-gated, not container-gated', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    // The container holds the full premint, but no ledger balance has been issued
    // yet, so withdraw must refuse: unwrapping burns YOUR balance, it does not let
    // a caller drain the reserve.
    await d.fund(d.signers.owner);
    await expect(
      d.as(d.signers.owner).call.withdraw(d.ftCategory, bobPkh, 1n * UNIT)
        .tokenContainerTransfer(d.ftCategory, addressToLockScript(bobAddress), 1n * UNIT).send(),
    ).rejects.toThrow();
  });

  it('withdraw rejects a category that is not the pinned backing', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    await d.fund(d.signers.owner);
    const wrong = `${'de'.repeat(31)}ad`;
    await expect(
      d.as(d.signers.owner).call.withdraw(wrong, bobPkh, 1n * UNIT).send(),
    ).rejects.toThrow();
  });
});

describe('NativeUsdt / admin surface (scalar-state facet routes, working end-to-end)', () => {
  it('pause and unpause round-trip through the facet', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.pause().send();
    expect((await readState(d)).paused).toBe(true);
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.unpause().send();
    expect((await readState(d)).paused).toBe(false);
  });

  it('pause is owner-only (msg.sender gate inside the facet)', async () => {
    const d = await deployAll();
    await expect(d.as(d.signers.bob).call.pause().send()).rejects.toThrow();
  });

  it('setParams enforces USDT fee ceilings and scales maximumFee by decimals', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setParams(10n, 5n).send();
    const st = await readState(d);
    expect(st.basisPointsRate).toBe(10n);
    // maximumFee = newMaxFee * 10**decimals, exactly as deployed USDT computes it.
    expect(st.maximumFee).toBe(5n * UNIT);
  });

  it('setParams refuses basisPointsRate >= 20 and maxFee >= 50 (transparency bounds)', async () => {
    const d = await deployAll();
    await expect(d.as(d.signers.owner).call.setParams(20n, 5n).send()).rejects.toThrow();
    await d.fund(d.signers.owner);
    await expect(d.as(d.signers.owner).call.setParams(10n, 50n).send()).rejects.toThrow();
  });

  it('transferOwnership moves the owner and locks the old owner out', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.transferOwnership(ADDR.bob()).send();
    expect((await readState(d)).owner).toStrictEqual(ADDR.bob());
    await d.fund(d.signers.owner);
    await expect(d.as(d.signers.owner).call.pause().send()).rejects.toThrow();
  });

  it('setQuarantineBlocks adjusts the admission window and rejects a negative one', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.setQuarantineBlocks(7n).send();
    expect((await readState(d)).quarantineBlocks).toBe(7n);
    await d.fund(d.signers.owner);
    await expect(d.as(d.signers.owner).call.setQuarantineBlocks(-1n).send()).rejects.toThrow();
  });

  it('deprecate sets the flag and records the successor address', async () => {
    const d = await deployAll();
    await d.as(d.signers.owner).call.deprecate(ADDR.bob()).send();
    const st = await readState(d);
    expect(st.deprecated).toBe(true);
    expect(st.upgradedAddress).toStrictEqual(ADDR.bob());
  });
});

// =============================================================================
// THE MAPPING SURFACE, unblocked.
//
// Two facts set the shape here. A mapping UPDATE through a delegate facet
// settles (X11, 837c8b8d, routed the implementation's entry accesses). A mapping
// INSERT does not, and cannot: an insert mints an entry node, so the
// transaction's own-category mutable NFT count rises, and a delegatecall master
// conserves that count. That is the same defence which refuses an appended
// fabricated entry node, so the proxy cannot admit one without admitting both.
//
// So the split is drawn by WRITE KIND, not by subject matter: every function
// that can first-touch a key runs directly on the master, and only update-only
// functions are delegated. `transfer`, `transferFrom`, `approve`, `issue`,
// `addBlackList` and `freeze` moved into the master (9,748 B, 252 B spare);
// `redeem`, `destroyBlackFunds`, `removeBlackList` and `unfreeze` stay on their
// facets because they only ever write a key that already exists.
//
// This also deleted two facets outright - nusdt_transfer.scash and
// nusdt_spend.scash held nothing else - so the port is four scripts, not six.
//
// Still refused: `deposit` and `claimDeposit`. Both first-touch (pendingAmount /
// pendingUnlockAt, and balances for a never-seen claimant) and neither fits in
// the master's remaining 252 B. They are pinned below.
// =============================================================================
describe('NativeUsdt / the mapping surface', () => {
  // Each account opens ITSELF once. Two platform rules force this: a first-touch INSERT
  // cannot settle through a delegate, and two ABSENT keys in one collection prove through
  // the SAME predecessor, which would co-spend one entry NFT twice. openSelf() is keyed on
  // msg.sender so it carries no address argument - the 10,000 B cap covers a call's
  // arguments too, and one address costs ~239 B of it.
  const open = async (d: Deployed, who: Signer): Promise<void> => {
    await d.as(who).call.openSelf().send();
    await d.fund(who);
  };

  const funded = async (): Promise<Deployed> => {
    const d = await deployAll();
    await open(d, d.signers.owner);
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.issue(1000n * UNIT).send();
    await d.fund(d.signers.owner);
    return d;
  };

  it('issue credits the owner and moves supply', async () => {
    const d = await funded();
    expect((await readState(d)).totalSupply).toBe(1000n * UNIT);
    expect(await balanceOf(d, ADDR.owner())).toBe(1000n * UNIT);
  });

  // THE headline. This was refused outright: crediting the fee to balances[this.owner] is a
  // SECOND write to the sender's own entry whenever the owner is the sender, and two writes
  // to one entry cannot compose (C2RuntimeSlotAlias.test.ts). Fees accrue to a scalar now.
  it('transfer from the OWNER settles, which is the whole supply path', async () => {
    const d = await funded();
    await open(d, d.signers.bob);
    await d.as(d.signers.owner).call.transfer(ADDR.bob(), 40n * UNIT).send();
    expect(await balanceOf(d, ADDR.bob())).toBe(40n * UNIT);
    expect(await balanceOf(d, ADDR.owner())).toBe(960n * UNIT);
  });

  it('a non-owner transfers on, so balances really move', async () => {
    const d = await funded();
    await open(d, d.signers.bob);
    await open(d, d.signers.carol);
    await d.as(d.signers.owner).call.transfer(ADDR.bob(), 40n * UNIT).send();
    await d.fund(d.signers.bob);
    await d.as(d.signers.bob).call.transfer(ADDR.carol(), 15n * UNIT).send();
    expect(await balanceOf(d, ADDR.bob())).toBe(25n * UNIT);
    expect(await balanceOf(d, ADDR.carol())).toBe(15n * UNIT);
  });

  it('the fee accrues and collectFees sweeps it into the owner balance', async () => {
    const d = await funded();
    await open(d, d.signers.bob);
    await d.as(d.signers.owner).call.setParams(10n, 5n).send();
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.transfer(ADDR.bob(), 40n * UNIT).send();
    const fee = (40n * UNIT * 10n) / 10000n;
    expect(await balanceOf(d, ADDR.bob()), 'recipient gets value - fee').toBe(40n * UNIT - fee);
    expect((await readState(d)).feeAccrued).toBe(fee);
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.collectFees().send();
    expect((await readState(d)).feeAccrued).toBe(0n);
    expect(await balanceOf(d, ADDR.owner())).toBe(1000n * UNIT - 40n * UNIT + fee);
  });

  it('refuses a self-transfer by name', async () => {
    const d = await funded();
    await expect(d.as(d.signers.owner).call.transfer(ADDR.owner(), 1n * UNIT).send()).rejects.toThrow();
    expect(await balanceOf(d, ADDR.owner())).toBe(1000n * UNIT);
  });

  it('approve records an allowance for a never-seen spender', async () => {
    const d = await deployAll();
    await open(d, d.signers.owner);
    await d.as(d.signers.owner).call.approve(ADDR.bob(), 7n * UNIT).send();
    expect(await allowanceOf(d, ADDR.owner(), ADDR.bob())).toBe(7n * UNIT);
  });

  it('addBlackList and freeze settle through the facet', async () => {
    const d = await deployAll();
    await open(d, d.signers.carol);
    await d.as(d.signers.owner).call.addBlackList(ADDR.carol()).send();
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.freeze(ADDR.carol()).send();
    expect(await flagOf(d, 'isBlackListed', ADDR.carol())).toBe(true);
    expect(await flagOf(d, 'frozen', ADDR.carol())).toBe(true);
  });

  it('removeBlackList settles through the facet, because it is an UPDATE', async () => {
    const d = await deployAll();
    await open(d, d.signers.carol);
    await d.as(d.signers.owner).call.addBlackList(ADDR.carol()).send();
    await d.fund(d.signers.owner);
    await d.as(d.signers.owner).call.removeBlackList(ADDR.carol()).send();
    expect(await flagOf(d, 'isBlackListed', ADDR.carol())).toBe(false);
  });

  // The whole quarantined re-entry path, end to end: wrap bearer FTs into the ledger, then
  // claim them out of quarantine. `deposit` proves delivery against the container itself, so
  // it runs on the master; `claimDeposit` is update-only and is delegated.
  // NativeUsdtDepositProof.test.ts pins the proof's two halves separately.
  it('deposit then claimDeposit moves bearer FTs into a ledger balance', async () => {
    const d = await deployAll({ quarantineBlocks: 0n });
    const h = await d.provider.getBlockHeight();
    await open(d, d.signers.owner);
    await d.as(d.signers.owner).call.setBacking(d.ftCategory).send();
    await d.fund(d.signers.owner);
    await open(d, d.signers.bob);
    await d.fund(d.signers.bob);

    const coin = {
      txid: 'de'.repeat(32), vout: 0, satoshis: 100000n,
      token: { category: d.ftCategory, amount: 5n * UNIT },
    };
    await d.provider.addUtxo(d.signers.bob.getAddress(), coin);

    const before = await readState(d);
    await d.as(d.signers.bob).call.deposit(d.ftCategory, BigInt(h), 5n * UNIT)
      .setLocktime(h)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(d.ftCategory, 5n * UNIT)
      .send();
    expect((await readState(d)).backedSupply).toBe((before.backedSupply as bigint) + 5n * UNIT);

    await d.fund(d.signers.bob);
    await d.as(d.signers.bob).call.claimDeposit().setLocktime(h).send();
    expect(await balanceOf(d, ADDR.bob())).toBe(5n * UNIT);
  });

  // Pins the SDK fix that made every `require(tx.time >= n)` in a stateful contract work: the
  // locktime now reaches the builder BEFORE state derivation, so the probe does not fail its
  // OP_CHECKLOCKTIMEVERIFY and derive state from a run that never reached the writes.
  it('tick advances the clock through the facet', async () => {
    const d = await deployAll({ quarantineBlocks: 0n });
    const h = await d.provider.getBlockHeight();
    await d.as(d.signers.owner).call.tick(BigInt(h)).setLocktime(h).send();
    expect((await d.master.getState()).clock).toBe(BigInt(h));
  });

  it('openSelf refuses to clobber a live balance', async () => {
    const d = await funded();
    await expect(d.as(d.signers.owner).call.openSelf().send()).rejects.toThrow();
    expect(await balanceOf(d, ADDR.owner())).toBe(1000n * UNIT);
  });
});
