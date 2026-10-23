import { describe, expect, it, vi } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { deployMaster, eventLockingBytecode, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import * as composer from '../../../src/framed/composer/index.js';
import { FramedProxyDeployError, buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 5: a revert after state-changing calls (7 checks).
 *
 * The row counts seven checks made after calls that changed state, in three entry shapes, each replicated by an entry
 * of `Desk`, behind a generated proxy, calling a plain `Ledger`:
 * - `post`: a token approve (an allowance write and its event), then two method length checks (empty, too long)
 *   and a membership read, before the pull that moves the balance;
 * - `settle`: a store write (a mark and its event, rewriting the caller's node), then the desk's own state checks
 *   (not open, not flagged), before the release of the escrow the desk opened;
 * - `close`: a payout that moves two balances and the desk's own write, then the desk's text check and the score
 *   check inside the next callee.
 * The transaction is atomic and the innermost revert is reported (spec 18): a refusal names the frame that reverted,
 * its line and its reason, the entry's derivation stops only past the calls the source makes before its check,
 * nothing is broadcast, and no record, mapping node, event output or balance moves on chain. Each shape's accepted
 * control settles the same entry and shows the changes those calls make. A custom error raised inside the pull after
 * the approve is reported by the pull's own frame, and the refusal carries the values it was raised with
 * (`errorArgs`), as the shipped reporter reads them from the refused draft.
 *
 * The hop settles every callee before it derives the entry, so a check whose entry would next call a callee that
 * refuses in the same state meets that callee's refusal first (the desk not open: the release of escrow 0). The
 * failure reported is the one the execution meets first (spec V6): the entry stopped before that call, so all seven
 * checks report their own reason. A first mark, which inserts a node beside the release, settles. The plain call path
 * on the implementation's own deployment, whose records hold no ledger, refuses the entry by name.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`revert after calls rows ${label}`)));
}

const LEDGER_CATEGORY = idOf('ledger');
const DESK_IMPL_CATEGORY = idOf('desk implementation');
const DESK_PROXY_CATEGORY = idOf('desk proxy');
/** A member: a holder of at least the member balance. */
const MEMBER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A holder below the member balance, and the worker a close pays. */
const OUTSIDER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const WORKER = OUTSIDER_LOCK;
const MEMBER_BALANCE = 1000n;
const OUTSIDER_BALANCE = 500n;
const AMOUNT = 100n;
/** The escrow an open desk holds; a desk never opened holds none. */
const ESCROW_ID = 7n;

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'error ShortBalance(address holder, int balance, int needed);',
  'interface ILedger {',
  '  function isMember(address who) view returns (bool);',
  '  function approve(address spender, int amount);',
  '  function transferFrom(address holder, address recipient, int amount);',
  '  function mark(address who);',
  '  function release(int escrowId);',
  '  function rate(address who, int score);',
  '}',
  'contract Ledger {',
  '  mapping(address => int) balances;',
  '  mapping(address => int) allowance;',
  '  mapping(address => int) marks;',
  '  mapping(address => int) scores;',
  '  event Approval(address spender, int amount);',
  '  event Transfer(address holder, address recipient, int amount);',
  '  event Marked(address who);',
  '  event Released(int escrowId);',
  '  event Rated(address who, int score);',
  '  constructor(address member, address outsider) {',
  `    this.balances[member] = ${MEMBER_BALANCE}; this.balances[outsider] = ${OUTSIDER_BALANCE};`,
  '  }',
  `  function isMember(address who) view returns (bool) { return this.balances[who] >= ${MEMBER_BALANCE}; }`,
  '  function approve(address spender, int amount) { this.allowance[spender] = amount; emit Approval(spender, amount); }',
  '  function transferFrom(address holder, address recipient, int amount) {',
  '    int held = this.balances[holder];',
  '    if (held < amount) { revert ShortBalance(holder, held, amount); }',
  '    this.balances[holder] = held - amount;',
  '    this.balances[recipient] = this.balances[recipient] + amount;',
  '    emit Transfer(holder, recipient, amount);',
  '  }',
  '  function mark(address who) { this.marks[who] = this.marks[who] + 1; emit Marked(who); }',
  '  function release(int escrowId) { require(escrowId > 0, "no escrow"); emit Released(escrowId); }',
  '  function rate(address who, int score) {',
  '    require(score >= 1 && score <= 5, "invalid score");',
  '    this.scores[who] = score;',
  '    emit Rated(who, score);',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public ledger;',
  '  int public posts;',
  '  int public escrowed;',
  '  int public stage;',
  '  int public flagged;',
  '  int public escrow;',
  '  int public rated;',
  '  event Posted(address poster, int amount);',
  '  function initialize(address l) { this.ledger = l; require(true); }',
  '  function post(int methodLength, int amount) {',
  '    ILedger(this.ledger).approve(address(this), amount);',
  '    require(methodLength > 0 && methodLength < 255, "method too short or long");',
  '    require(ILedger(this.ledger).isMember(msg.sender), "not a member");',
  '    ILedger(this.ledger).transferFrom(msg.sender, address(this), amount);',
  '    this.posts = this.posts + 1;',
  '    this.escrowed = this.escrowed + amount;',
  '    emit Posted(msg.sender, amount);',
  '  }',
  `  function open() { this.stage = 1; this.escrow = ${ESCROW_ID}; require(true); }`,
  '  function flag() { this.flagged = 1; require(true); }',
  '  function settle() {',
  '    ILedger(this.ledger).mark(msg.sender);',
  '    require(this.stage == 1, "invalid state");',
  '    require(this.flagged == 1, "not flagged");',
  '    this.flagged = 0;',
  '    this.stage = 2;',
  '    ILedger(this.ledger).release(this.escrow);',
  '  }',
  '  function close(address worker, int amount, int score, int textLength) {',
  '    ILedger(this.ledger).transferFrom(msg.sender, worker, amount);',
  '    this.stage = 3;',
  '    require(textLength <= 100, "text too long");',
  '    ILedger(this.ledger).rate(worker, score);',
  '    this.rated = score;',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;
const desk = artifacts.Desk!;
const deskProxy = buildProxyArtifact(desk);
const LEDGER_ADDRESS = deployMaster(ledger, hexToBin(LEDGER_CATEGORY), VALIDATOR_PROGRAM).address;

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** The ledger, then the desk behind its proxy, and the chain as it stood when both were done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly proxyAddress: Uint8Array;
  readonly changeAddress: string;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly snapshot: SnapshotRestorer;
}

let deployedRun: Promise<Deployed> | undefined;

/** One deployment serves every case; each rewinds the chain to it first, so none reads another's broadcast. */
async function deployed(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, signature);
    await fundShippedFacets(network);
    const ledgerCoin = funding(LEDGER_CATEGORY);
    await network.addUtxo(wallet.address, ledgerCoin);
    await deployStatefulContract(ledger, [MEMBER_LOCK, OUTSIDER_LOCK], {
      fundingUtxo: ledgerCoin, funder, changeAddress: wallet.address, provider: network,
    });
    for (const txid of [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(txid));
    const initCoin = funding(idOf('initialize coin'));
    await network.addUtxo(binToHex(MEMBER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: desk,
      proxyArtifact: deskProxy,
      implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [LEDGER_ADDRESS] },
      callerLockingBytecode: MEMBER_LOCK,
      callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    // The member's mark is made once here, on the plain path, so the store write a settle makes rewrites a node the
    // ledger holds, as the row's store write does; an outsider's first mark inserts one.
    const markCoin = funding(idOf('seed mark coin'));
    await network.addUtxo(binToHex(MEMBER_LOCK), markCoin);
    const seeded = await callFramedEntry({
      provider: network, artifact: ledger, categoryId: LEDGER_CATEGORY, functionName: 'mark', args: [MEMBER_LOCK],
      callerUtxo: markCoin, callerLockingBytecode: MEMBER_LOCK, funder: signature.unlockP2PKH(),
      changeAddress: wallet.address, vm: compositionMachine(),
    });
    expect(seeded.broadcast).toBeDefined();
    return {
      network,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      proxyAddress: deployment.proxy.address,
      changeAddress: wallet.address,
      externals: { ILedger: { artifact: ledger, categoryId: LEDGER_CATEGORY } },
      snapshot: await network.takeSnapshot(),
    };
  })();
  const shared = await deployedRun;
  await shared.snapshot.restore();
  return shared;
}

/** Who enters the desk: the member or the outsider, each signing for a coin of their own. */
interface Caller {
  readonly lock: Uint8Array;
  readonly key: Uint8Array;
}

const MEMBER: Caller = { lock: MEMBER_LOCK, key: alicePriv };
const OUTSIDER: Caller = { lock: OUTSIDER_LOCK, key: bobPriv };

type Argument = bigint | Uint8Array;

interface Entered {
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly lock: Uint8Array;
  readonly call: Promise<FramedProxyCallResult>;
}

/** Funds the caller's coin and runs one desk entry through the shipped proxy hop. */
async function enter(
  run: Deployed, caller: Caller, functionName: string, args: readonly Argument[], label: string,
): Promise<Entered> {
  const coin = funding(idOf(`${label} coin`));
  await run.network.addUtxo(binToHex(caller.lock), coin);
  const call = callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: desk,
    proxyArtifact: deskProxy,
    proxyCategoryId: run.proxyCategoryId,
    implementationCategoryId: run.implementationCategoryId,
    functionName,
    args: [...args],
    externals: run.externals,
    callerUtxo: coin,
    callerLockingBytecode: caller.lock,
    funder: new SignatureTemplate(caller.key).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, lock: caller.lock, call };
}

/** Runs a desk entry the hop must settle and broadcast. */
async function settled(
  run: Deployed, caller: Caller, functionName: string, args: readonly Argument[], label: string,
): Promise<FramedProxyCallResult> {
  const result = await (await enter(run, caller, functionName, args, label)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** What the chain holds for the two deployments. */
interface ChainState {
  readonly tip: number | undefined;
  /** Every outpoint the ledger's and the desk's categories hold. */
  readonly outpoints: readonly string[];
  /** The desk's fields, as its proxy's records hold them. */
  readonly desk: Readonly<Record<string, unknown>>;
  /** Each ledger collection's nodes, the head left out: slot to value tail. */
  readonly nodes: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** How many outputs sit at each event's covenant, by event name. */
  readonly events: Readonly<Record<string, number>>;
}

async function chainState(run: Deployed): Promise<ChainState> {
  const { network } = run;
  const held = await Promise.all([LEDGER_CATEGORY, run.proxyCategoryId, run.implementationCategoryId]
    .map((categoryId) => network.getUtxosByTokenCategory(categoryId)));
  const proxyLayout = deskProxy.stateLayout!;
  const proxyPools = await readFramedDeployment(network, run.proxyCategoryId, proxyLayout);
  const ledgerPools = await readFramedDeployment(network, LEDGER_CATEGORY, ledger.stateLayout!);
  const head = bytesToHex(new Uint8Array(32));
  const nodes = Object.fromEntries([...ledgerPools.nodesByCollection].map(([collection, utxos]) => [
    collection,
    Object.fromEntries(utxos.map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
      .filter((entry) => bytesToHex(entry.slot) !== head)
      .map((entry) => [bytesToHex(entry.slot), bytesToHex(entry.value)])),
  ]));
  // A delegate frame emits under the proxy's category, so the desk's events sit at the proxy's covenants.
  const emitters: readonly (readonly [Artifact, string])[] = [[ledger, LEDGER_CATEGORY], [desk, run.proxyCategoryId]];
  const events: Record<string, number> = {};
  for (const [artifact, categoryId] of emitters) {
    for (const event of artifact.events ?? []) {
      const lock = eventLockingBytecode(hexToBin(categoryId), event.signature, false);
      events[event.name] = (await network.getUtxosForLockingBytecode(lock)).length;
    }
  }
  return {
    tip: network.indexer.getTip()?.height,
    outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
    desk: Object.assign({}, ...proxyPools.records.map((record, nftIndex) =>
      parsePushdataCommitment(record.token!.nft!.commitment, proxyLayout, nftIndex))) as Record<string, unknown>,
    nodes,
    events,
  };
}

/** The value tail a ledger collection holds for an address key, or undefined while it holds no node for it. */
function valueAt(state: ChainState, collection: string, key: Uint8Array): string | undefined {
  return state.nodes[collection]?.[bytesToHex(keyToSlotMulti([key]))];
}

/** An int value tail. */
const intValue = (value: bigint): string => binToHex(bigIntToVmNumber(value));

/** The master the reporter names the entry's own frame by. */
const ENTRY_FRAME = 'implementation-master';

/** The stall the settle catches when the entry's frame stops before the stop site `site`. */
function stalledAt(functionName: string, site: string): string {
  return `FRAMED_DERIVATION_STALLED: master "${ENTRY_FRAME}" of Desk.${functionName}() filled no witness at ${site}`;
}

/** What a refused call left: the thrown refusal, the stalls the settle caught and the last draft it built. */
interface Refused {
  readonly error: FramedProxyDeployError;
  readonly stalls: readonly string[];
  readonly draft: composer.CompositionDraft;
}

/**
 * Runs a desk entry the hop must refuse, and checks that nothing was broadcast and nothing on chain moved.
 *
 * Neither the error nor a result carries the draft, so the composer's own entry points are watched: the last draft
 * built is the one the refusal was read from, and a derivation that threw is a stall the settle caught.
 */
async function expectRefused(
  run: Deployed, caller: Caller, functionName: string, args: readonly Argument[], label: string,
): Promise<Refused> {
  const before = await chainState(run);
  const raw = vi.spyOn(run.network, 'sendRawTransaction');
  const prepared = vi.spyOn(run.network, 'sendPreparedTransaction');
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  try {
    const entered = await enter(run, caller, functionName, args, label);
    const error = await entered.call.then(() => undefined, (thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(FramedProxyDeployError);
    expect(raw.mock.calls.length + prepared.mock.calls.length).toBe(0);
    // The caller's coin is unspent, and every outpoint, field, node and event output is as it was.
    expect((await run.network.getUtxosForLockingBytecode(entered.lock))
      .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout)).toBe(true);
    expect(await chainState(run)).toStrictEqual(before);
    const last = hosts.mock.results.at(-1);
    if (last?.type !== 'return') throw new Error(`Desk.${functionName} built no draft`);
    return {
      error: error as FramedProxyDeployError,
      stalls: derivations.mock.results.filter((result) => result.type === 'throw')
        .map((result) => String((result.value as Error).message)),
      draft: last.value.draft,
    };
  } finally {
    raw.mockRestore();
    prepared.mockRestore();
    hosts.mockRestore();
    derivations.mockRestore();
  }
}

/** The refusal's message when `frame` of `functionName` reverted at the line of `needle` with `reason`. */
function refusalOf(subject: string, frame: string, functionName: string, needle: string, reason: string): string {
  return `${subject} did not settle through the proxy: frame "${frame}" of ${functionName} at line ${lineOf(needle)}: `
    + `${reason} (Program failed an OP_VERIFY operation.)`;
}

/** A check the hop reports by its own frame's reason: the entry, its caller and arguments, and how it reverts. */
interface Check {
  readonly title: string;
  readonly caller: Caller;
  readonly functionName: string;
  readonly args: readonly Argument[];
  /** Entries the case settles first, so the check meets the state they leave. */
  readonly before?: readonly string[];
  /** The callee frame that reverts, or undefined for the entry's own check. */
  readonly callee?: { readonly master: string; readonly functionName: string };
  readonly needle: string;
  readonly reason: string;
  /** For the entry's own check, the stop site its frame stalls before: past every call the source makes first. */
  readonly stopsAt?: string;
}

/** The row's seven checks. */
const CHECKS: readonly Check[] = [
  {
    title: 'an empty method after the approve', caller: MEMBER, functionName: 'post', args: [0n, AMOUNT],
    needle: '"method too short or long"', reason: 'method too short or long', stopsAt: 'site 1 (call 1)',
  },
  {
    title: 'a long method after the approve', caller: MEMBER, functionName: 'post', args: [255n, AMOUNT],
    needle: '"method too short or long"', reason: 'method too short or long', stopsAt: 'site 1 (call 1)',
  },
  {
    title: 'a non-member, read after the approve', caller: OUTSIDER, functionName: 'post', args: [7n, AMOUNT],
    needle: '"not a member"', reason: 'not a member', stopsAt: 'site 2 (call 2)',
  },
  {
    title: 'a desk not open, after the mark', caller: MEMBER, functionName: 'settle', args: [],
    needle: '"invalid state"', reason: 'invalid state', stopsAt: 'site 1 (call 1)',
  },
  {
    title: 'a desk not flagged, after the mark', caller: MEMBER, functionName: 'settle', args: [], before: ['open'],
    needle: '"not flagged"', reason: 'not flagged', stopsAt: 'site 1 (call 1)',
  },
  {
    title: 'a long text, after the payout', caller: MEMBER, functionName: 'close', args: [WORKER, AMOUNT, 5n, 150n],
    needle: '"text too long"', reason: 'text too long', stopsAt: 'site 1 (call 1)',
  },
  {
    title: 'a bad score, after the payout', caller: MEMBER, functionName: 'close', args: [WORKER, AMOUNT, 9n, 20n],
    callee: { master: 'callee-master-2', functionName: 'Ledger.rate()' }, needle: '"invalid score"',
    reason: 'invalid score',
  },
];

describe('spec section 23 row 5: a revert after state-changing calls', () => {
  it('settles the post, and the approve, the pull, the desk\'s writes and three events are on chain', async () => {
    const run = await deployed();
    const before = await chainState(run);
    const result = await settled(run, MEMBER, 'post', [7n, AMOUNT], 'post control');
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Ledger.approve()', 'Ledger.isMember()', 'Ledger.transferFrom()', 'Desk.post()', 'DeskProxy.__fallback()',
    ]);
    const after = await chainState(run);
    expect(after.desk).toMatchObject({ posts: 1n, escrowed: AMOUNT });
    expect(valueAt(after, 'allowance', run.proxyAddress)).toBe(intValue(AMOUNT));
    expect(valueAt(after, 'balances', MEMBER_LOCK)).toBe(intValue(MEMBER_BALANCE - AMOUNT));
    expect(valueAt(after, 'balances', run.proxyAddress)).toBe(intValue(AMOUNT));
    expect(after.events).toStrictEqual({ ...before.events, Approval: 1, Transfer: 1, Posted: 1 });
  });

  it('settles the settle on an open, flagged desk: the mark, the release and their events are on chain', async () => {
    const run = await deployed();
    await settled(run, MEMBER, 'open', [], 'settle control open');
    await settled(run, MEMBER, 'flag', [], 'settle control flag');
    const before = await chainState(run);
    expect(before.desk).toMatchObject({ stage: 1n, flagged: 1n, escrow: ESCROW_ID });
    await settled(run, MEMBER, 'settle', [], 'settle control');
    const after = await chainState(run);
    expect(after.desk).toMatchObject({ stage: 2n, flagged: 0n });
    expect(valueAt(before, 'marks', MEMBER_LOCK)).toBe(intValue(1n));
    expect(valueAt(after, 'marks', MEMBER_LOCK)).toBe(intValue(2n));
    expect(after.events).toStrictEqual({ ...before.events, Marked: before.events.Marked! + 1, Released: 1 });
  });

  it('settles the close, and the payout, the desk\'s writes and the score are on chain', async () => {
    const run = await deployed();
    const before = await chainState(run);
    await settled(run, MEMBER, 'close', [WORKER, AMOUNT, 5n, 20n], 'close control');
    const after = await chainState(run);
    expect(after.desk).toMatchObject({ stage: 3n, rated: 5n });
    expect(valueAt(after, 'balances', MEMBER_LOCK)).toBe(intValue(MEMBER_BALANCE - AMOUNT));
    expect(valueAt(after, 'balances', WORKER)).toBe(intValue(OUTSIDER_BALANCE + AMOUNT));
    expect(valueAt(after, 'scores', WORKER)).toBe(intValue(5n));
    expect(after.events).toStrictEqual({ ...before.events, Transfer: 1, Rated: 1 });
  });

  it.each(CHECKS)('refuses $title with the reverting frame\'s own reason, and nothing moves on chain',
    async (check) => {
      const run = await deployed();
      for (const [step, functionName] of (check.before ?? []).entries()) {
        await settled(run, check.caller, functionName, [], `${check.title} step ${step}`);
      }
      const refused = await expectRefused(run, check.caller, check.functionName, check.args, check.title);
      if (check.callee === undefined) {
        // The entry's own check: its frame filled every call the source makes before it, then stopped.
        expect(refused.error.message).toBe(refusalOf(`the implementation's "${check.functionName}" entry`,
          ENTRY_FRAME, `Desk.${check.functionName}()`, check.needle, check.reason));
        expect(refused.stalls).toStrictEqual([stalledAt(check.functionName, check.stopsAt!)]);
      } else {
        // The callee's own check: its frame refuses, and the entry's frame is derived too (so a check of the
        // entry's own, before the callee, would name its reason), so the refusal carries those stalls.
        expect(refused.error.message).toBe(refusalOf(`the call's callee "${check.callee.functionName}"`,
          check.callee.master, check.callee.functionName, check.needle, check.reason));
        expect(refused.stalls).toStrictEqual([
          'FRAMED_DERIVATION_STALLED: master "implementation-master" of Desk.close() filled no witness at '
          + 'site 1 (call 1)',
          'FRAMED_DERIVATION_STALLED: master "callee-master-2" of Ledger.rate() filled no witness at '
          + 'site 0 (close of segment 0)',
          'FRAMED_DERIVATION_STALLED: master "callee-master-2" of Ledger.rate() filled no witness at '
          + 'site 0 (close of segment 0)',
        ]);
      }
    });

  it('refuses a short balance inside the pull after the approve with the pull\'s custom error', async () => {
    const run = await deployed();
    const refused = await expectRefused(run, MEMBER, 'post', [7n, 1500n], 'short balance');
    expect(refused.error.message).toBe(refusalOf('the call\'s callee "Ledger.transferFrom()"', 'callee-master-3',
      'Ledger.transferFrom()', 'revert ShortBalance', 'revert ShortBalance(address, int256, int256)'));
    // Deriving the entry's own frame (to see whether it names a reason) stalls at the refusing callee each attempt.
    expect(refused.stalls).toStrictEqual([
      'FRAMED_DERIVATION_STALLED: master "callee-master-3" of Ledger.transferFrom() filled no witness at '
      + 'site 0 (close of segment 0)',
      'FRAMED_DERIVATION_STALLED: master "callee-master-3" of Ledger.transferFrom() filled no witness at '
      + 'site 0 (close of segment 0)',
      'FRAMED_DERIVATION_STALLED: master "callee-master-3" of Ledger.transferFrom() filled no witness at '
      + 'site 0 (close of segment 0)',
      'FRAMED_DERIVATION_STALLED: master "callee-master-3" of Ledger.transferFrom() filled no witness at '
      + 'site 0 (close of segment 0)',
    ]);
  });

  it('a desk not open reports its own state check, not the release it never makes', async () => {
    const run = await deployed();
    // The EVM stops at the desk's "invalid state" right after the mark, before the release. The release of the escrow
    // the unopened desk does not hold (0) is settled first and refuses, and the stalled step at the release's site
    // leaves its reference filled; the entry's frame stops at the same place with that reference unfilled, so it
    // never made the call and its own check is the refusal the execution meets first.
    const refused = await expectRefused(run, MEMBER, 'settle', [], 'desk not open');
    expect(refused.error.message).toBe(refusalOf('the implementation\'s "settle" entry', ENTRY_FRAME,
      'Desk.settle()', '"invalid state"', 'invalid state'));
    const report = composer.reportCompositionRefusal({
      draft: refused.draft, artifacts: [deskProxy, desk, ledger], vm: compositionMachine(),
    });
    expect(report.innermost?.master).toBe(ENTRY_FRAME);
    expect(report.refusals.find((refusal) => refusal.master === 'callee-master-2')?.reason.message).toBe('no escrow');
    expect(lineOf('"invalid state"')).toBeLessThan(lineOf('.release(this.escrow)'));
  });

  it('the refusal carries the custom error\'s arguments, which the refused draft holds', async () => {
    const run = await deployed();
    const refused = await expectRefused(run, MEMBER, 'post', [7n, 1500n], 'short balance arguments');
    // The pull's `revert ShortBalance(holder, held, amount)`: the member, the balance the ledger holds for it, and the
    // amount the pull asked for. The shipped reporter reads the same values from the draft the refusal was read from.
    expect(refused.error.errorArgs).toStrictEqual([`0x${binToHex(MEMBER_LOCK)}`, MEMBER_BALANCE, 1500n]);
    const report = composer.reportCompositionRefusal({
      draft: refused.draft, artifacts: [deskProxy, desk, ledger], vm: compositionMachine(),
    });
    const pull = report.refusals.find((refusal) => refusal.master === 'callee-master-3');
    expect(pull?.reason.error?.name).toBe('ShortBalance');
    expect(pull?.reason.arguments).toStrictEqual(refused.error.errorArgs);
  });

  it('settles a first mark beside the release: the inserted node, the release and their events are on chain',
    async () => {
      const run = await deployed();
      await settled(run, MEMBER, 'open', [], 'first mark open');
      await settled(run, MEMBER, 'flag', [], 'first mark flag');
      const before = await chainState(run);
      expect(valueAt(before, 'marks', OUTSIDER_LOCK)).toBeUndefined();
      // It differs from the settle control only in the caller, whose first mark inserts a node beside the release, a
      // frame of the ledger with no mapping access; the validator's census settles the node the marking frame declares.
      await settled(run, OUTSIDER, 'settle', [], 'first mark');
      const after = await chainState(run);
      expect(after.desk).toMatchObject({ stage: 2n, flagged: 0n });
      expect(valueAt(after, 'marks', OUTSIDER_LOCK)).toBe(intValue(1n));
      expect(after.events).toStrictEqual({ ...before.events, Marked: before.events.Marked! + 1, Released: 1 });
    });

  it('refuses the entry by name on the plain call path, whose implementation records hold no ledger', async () => {
    const run = await deployed();
    const coin = funding(idOf('plain path coin'));
    await run.network.addUtxo(binToHex(MEMBER_LOCK), coin);
    await expect(callFramedEntry({
      provider: run.network, artifact: desk, categoryId: run.implementationCategoryId, functionName: 'post',
      args: [7n, AMOUNT], callerUtxo: coin, callerLockingBytecode: MEMBER_LOCK,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "post" makes 3 external call\\(s\\): the call to "ILedger\\.approve" targets the state '
        + 'field "ledger", which the caller\'s own state does not hold as an address'),
    );
  });
});
