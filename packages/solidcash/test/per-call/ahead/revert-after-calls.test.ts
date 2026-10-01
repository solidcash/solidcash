import { beforeAll, describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import * as composer from '../../../src/per-call/composer/index.js';
import { PerCallProxyDeployError, buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobAddress, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root that calls a proxied store, a registry and a token, then fails a check (PW1 step 1).
 *
 * `Desk.post` replicates a publish entry: argument checks, a write into a proxied store, two registry reads, three
 * token calls (`balanceOf`, `approve`, `transferFrom`) and a second store write. Each case fails one check through
 * `callPerCallProxyEntry`. Today a check in the entry stalls the settle at the call after it, and a revert in a
 * callee refuses that callee's own settle; either way the refusal reporter is asked, and its innermost frame is a
 * store proxy leg no attempt reached, refusing because its delegate reference is still the unfilled sentinel. The
 * error names that leg and carries neither the draft nor the report; the draft is reached here by spying on the
 * composer. Its report holds the failing frame's own reason, unless a callee the entry never reaches refuses first.
 *
 * The registry is plain; a value a proxied callee returns reaches its caller since PW8, and that read settles
 * (pinned last).
 */

const txid = (seed: string): string => `${seed.repeat(31)}c4`;
const COIN_CATEGORY = txid('31');
const ROSTER_CATEGORY = txid('32');
const JOURNAL_IMPL_CATEGORY = txid('33');
const JOURNAL_PROXY_CATEGORY = txid('34');
const DESK_IMPL_CATEGORY = txid('35');
const DESK_PROXY_CATEGORY = txid('36');
const JOURNAL_INIT_TXID = txid('37');
const DESK_INIT_TXID = txid('38');

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);

// `Roster` lists Alice as a member and a referee and Bob as a referee; `Coin` gives Alice 1000 and Bob 500.
// `Journal` holds the two keys `post` notes, so each note rewrites a node the deployment holds: two notes into an
// empty `marks` would each mint its head, which the hop refuses by name (`call/two-created-heads.test.ts`).
const SOURCE = [
  'pragma solidcash ^0.13.0;',
  'error ShortBalance(address holder, int balance, int needed);',
  'interface IJournal { function note(int id); function isOpen() returns (bool); }',
  'interface IRoster { function isReferee(address who) returns (bool); function isMember(address who) returns (bool); }',
  'interface ICoin {',
  '  function balanceOf(address who) returns (int);',
  '  function approve(address spender, int amount);',
  '  function transferFrom(address holder, address recipient, int amount);',
  '}',
  'contract Journal {',
  '  address public implementation;',
  '  int public opened;',
  '  mapping(int => int) marks;',
  '  function initialize() { this.opened = 1; this.marks[7] = 2; this.marks[9] = 2; require(this.opened > 0); }',
  '  function note(int id) { this.marks[id] = 1; require(true); }',
  '  function isOpen() returns (bool) { return this.opened == 1; }',
  '}',
  'contract Roster {',
  '  mapping(address => int) roles;',
  `  constructor() { this.roles[msg.sender] = 3; this.roles[0x${binToHex(BOB_LOCK)}] = 2; }`,
  '  function isReferee(address who) returns (bool) { return this.roles[who] >= 2; }',
  '  function isMember(address who) returns (bool) { return this.roles[who] % 2 == 1; }',
  '}',
  'contract Coin {',
  '  mapping(address => int) balances;',
  '  mapping(address => int) allowance;',
  `  constructor() { this.balances[msg.sender] = 1000; this.balances[0x${binToHex(BOB_LOCK)}] = 500; }`,
  '  function balanceOf(address who) returns (int) { return this.balances[who]; }',
  '  function approve(address spender, int amount) { this.allowance[spender] = amount; require(true); }',
  '  function transferFrom(address holder, address recipient, int amount) {',
  '    int held = this.balances[holder];',
  '    if (held < amount) { revert ShortBalance(holder, held, amount); }',
  '    this.balances[holder] = held - amount;',
  '    require(recipient.length > 0);',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public journal;',
  '  address public roster;',
  '  address public coin;',
  '  function initialize(address j, address r, address c) {',
  '    this.journal = j; this.roster = r; this.coin = c; require(true);',
  '  }',
  '  function post(int nameLength, int amount, int methodLength, address referee, address coinAt) {',
  '    require(nameLength > 0 && nameLength < 255, "name too short or long");',
  '    require(amount > 0, "amount must be positive");',
  '    IJournal(this.journal).note(7);',
  '    require(IRoster(this.roster).isReferee(referee), "referee not listed");',
  '    require(referee != msg.sender, "referee is the poster");',
  '    require(ICoin(this.coin).balanceOf(msg.sender) > 0 && coinAt == this.coin, "invalid coin");',
  '    ICoin(this.coin).approve(address(this), amount);',
  '    require(methodLength > 0 && methodLength < 255, "method too short or long");',
  '    require(IRoster(this.roster).isMember(msg.sender), "not a member");',
  '    ICoin(this.coin).transferFrom(msg.sender, address(this), amount);',
  '    IJournal(this.journal).note(9);',
  '    require(true);',
  '  }',
  '  function peek() { require(IJournal(this.journal).isOpen(), "journal closed"); }',
  '}',
].join('\n');

/** The input index a frame reads through an unfilled call record: the sentinel read as a script number. */
const UNFILLED_INDEX = -(composer.UNFILLED_CALLEE_REF & 0x7fff);

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

/** A coin a genesis or a call is funded from; a genesis coin's txid becomes the category it mints. */
function funding(id: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid: id, vout: 0, satoshis: 5_000_000n };
}

interface Compiled {
  readonly journal: Artifact;
  readonly roster: Artifact;
  readonly coin: Artifact;
  readonly desk: Artifact;
  /** Every artifact a frame of the hop runs, for the refusal reporter. */
  readonly all: readonly Artifact[];
  readonly coinAddress: Uint8Array;
  readonly rosterAddress: Uint8Array;
}

/** Compiled when the suite runs, so a run that skips it compiles nothing. */
function compile(): Compiled {
  const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
  const [journal, roster, coin, desk] = [artifacts.Journal!, artifacts.Roster!, artifacts.Coin!, artifacts.Desk!];
  return {
    journal, roster, coin, desk,
    all: [buildProxyArtifact(desk), desk, buildProxyArtifact(journal), journal, roster, coin],
    coinAddress: deployMaster(coin, hexToBin(COIN_CATEGORY), VALIDATOR_PROGRAM).address,
    rosterAddress: deployMaster(roster, hexToBin(ROSTER_CATEGORY), VALIDATOR_PROGRAM).address,
  };
}

interface Caller {
  readonly lock: Uint8Array;
  readonly address: string;
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly deskProxyCategoryId: string;
  readonly deskImplementationCategoryId: string;
  readonly externals: Record<string, PerCallProxyExternal>;
  readonly alice: Caller;
  readonly bob: Caller;
  /** A caller of its own, for a case that broadcasts and so spends the coin it is given. */
  readonly newCaller: (seed: string) => Promise<Caller>;
}

let compiled: Compiled;
let deployed: Deployed;

/** Deploys the registry and the token, then the store and the root behind generated proxies. */
async function deployAll(): Promise<Deployed> {
  const { journal, roster, coin, desk } = compiled;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const aliceFunder = signature.unlockP2PKH();

  // Alice's own coin funds each plain genesis, so she is the constructor's `msg.sender`.
  for (const [artifact, id] of [[roster, ROSTER_CATEGORY], [coin, COIN_CATEGORY]] as const) {
    const genesisCoin = funding(id);
    await network.addUtxo(aliceAddress, genesisCoin);
    await deployStatefulContract(artifact, [], {
      fundingUtxo: genesisCoin, funder: aliceFunder, changeAddress: aliceAddress, provider: network, threadCount: 4,
    });
  }
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(id));
  }
  const journalInitCoin = funding(JOURNAL_INIT_TXID);
  const deskInitCoin = funding(DESK_INIT_TXID);
  for (const initCoin of [journalInitCoin, deskInitCoin]) await network.addUtxo(binToHex(ALICE_LOCK), initCoin);
  await fundShippedFacets(network);

  const journalDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: journal,
    proxyArtifact: buildProxyArtifact(journal),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: journalInitCoin, funder: aliceFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(journalDeployment.initialize.broadcast).toBeDefined();

  const deskDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: {
      functionName: 'initialize',
      args: [journalDeployment.proxy.address, compiled.rosterAddress, compiled.coinAddress],
    },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: deskInitCoin, funder: aliceFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deskDeployment.initialize.broadcast).toBeDefined();

  const caller = async (lock: Uint8Array, address: string, key: Uint8Array, seed: string): Promise<Caller> => {
    const callCoin = funding(txid(seed));
    await network.addUtxo(binToHex(lock), callCoin);
    return { lock, address, coin: callCoin, funder: new SignatureTemplate(key).unlockP2PKH() };
  };
  return {
    network,
    deskProxyCategoryId: deskDeployment.proxy.categoryId,
    deskImplementationCategoryId: deskDeployment.implementation.categoryId,
    externals: {
      IJournal: {
        artifact: journal,
        categoryId: journalDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(journal),
        implementationCategoryId: journalDeployment.implementation.categoryId,
      },
      IRoster: { artifact: roster, categoryId: ROSTER_CATEGORY },
      ICoin: { artifact: coin, categoryId: COIN_CATEGORY },
    },
    alice: await caller(ALICE_LOCK, aliceAddress, alicePriv, '39'),
    bob: await caller(BOB_LOCK, bobAddress, bobPriv, '3a'),
    newCaller: (seed: string) => caller(ALICE_LOCK, aliceAddress, alicePriv, seed),
  };
}

/** What a refused call left: the error, the stalls the settle caught, the last draft built, and any broadcast. */
interface Refused {
  readonly error: Error & { readonly errorArgs?: readonly unknown[] };
  readonly stalls: readonly string[];
  readonly draft: composer.CompositionDraft;
  readonly broadcasts: number;
}

/**
 * Calls a `Desk` entry through its proxy and returns what the refusal left behind.
 *
 * Neither the error nor any result carries the draft, so the composer's own entry points are watched: the last draft
 * built is the one the thrown refusal was read from, and a derivation that threw is a stall the settle caught.
 */
async function refusedCall(
  caller: Caller, functionName: string, args: readonly FunctionArgument[],
): Promise<Refused> {
  const { network } = deployed;
  const raw = vi.spyOn(network, 'sendRawTransaction');
  const prepared = vi.spyOn(network, 'sendPreparedTransaction');
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  try {
    await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: compiled.desk,
      proxyArtifact: buildProxyArtifact(compiled.desk),
      proxyCategoryId: deployed.deskProxyCategoryId,
      implementationCategoryId: deployed.deskImplementationCategoryId,
      functionName,
      args,
      externals: deployed.externals,
      callerUtxo: caller.coin,
      callerLockingBytecode: caller.lock,
      funder: caller.funder,
      changeAddress: caller.address,
      vm: compositionMachine(),
    });
  } catch (error) {
    const last = hosts.mock.results.at(-1);
    if (last?.type !== 'return') throw error;
    return {
      error: error as Refused['error'],
      stalls: derivations.mock.results.filter((result) => result.type === 'throw')
        .map((result) => String((result.value as Error).message)),
      draft: last.value.draft,
      broadcasts: raw.mock.calls.length + prepared.mock.calls.length,
    };
  } finally {
    raw.mockRestore();
    prepared.mockRestore();
    hosts.mockRestore();
    derivations.mockRestore();
  }
  throw new Error(`Desk.${functionName} settled`);
}

/** Calls a `Desk` entry through its proxy and returns the settled hop. */
function settledCall(
  caller: Caller, functionName: string, args: readonly FunctionArgument[],
): Promise<PerCallProxyCallResult> {
  return callPerCallProxyEntry({
    provider: deployed.network,
    implementationArtifact: compiled.desk,
    proxyArtifact: buildProxyArtifact(compiled.desk),
    proxyCategoryId: deployed.deskProxyCategoryId,
    implementationCategoryId: deployed.deskImplementationCategoryId,
    functionName,
    args,
    externals: deployed.externals,
    callerUtxo: caller.coin,
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: caller.address,
    vm: compositionMachine(),
  });
}

/** The stall the settle catches when the entry's frame stops before call `call`, counted from zero. */
function stalledAt(call: number): string {
  return `PER_CALL_DERIVATION_STALLED: master "implementation-master" of Desk.post() filled no witness at site ${call} `
    + `(call ${call})`;
}

/** The report the shipped reporter gives for a draft, on the machine the hop ran. */
function reportOf(draft: composer.CompositionDraft): composer.CompositionRefusal {
  return composer.reportCompositionRefusal({ draft, artifacts: compiled.all, vm: compositionMachine() });
}

/**
 * The refusal names `frame`, the innermost frame the execution reached: a store proxy leg no attempt reached, which
 * refuses reading the input its unfilled delegate reference names, is passed over. The error still carries no draft,
 * no report and no error arguments.
 */
function expectReported(refused: Refused, prefix: string, frame: string): composer.CompositionRefusal {
  const { error } = refused;
  expect(error).toBeInstanceOf(PerCallProxyDeployError);
  expect(error.message.startsWith(`${prefix} did not settle through the proxy: `)).toBe(true);
  expect(error.message).toContain(`frame "${frame}" of `);
  expect(error.message).not.toContain(`requested index: ${UNFILLED_INDEX}`);
  expect(error.errorArgs).toBeUndefined();
  expect('draft' in error || 'report' in error).toBe(false);
  expect(refused.broadcasts).toBe(0);

  // The message is the reporter's innermost frame on the last draft, so that draft is the one the refusal read.
  const report = reportOf(refused.draft);
  expect(report.innermost?.master).toBe(frame);
  expect(error.message).toContain(composer.describeInnermost(report.innermost));
  const unreached = report.refusals.filter((refusal) => refusal.objection.includes(`requested index: ${UNFILLED_INDEX}`));
  expect(unreached.every((refusal) => refusal.master !== frame)).toBe(true);
  return report;
}

/** The reason one frame of the report carries: its line and its `require` message or custom error. */
function reasonOf(report: composer.CompositionRefusal, master: string): composer.FrameRevertReason | undefined {
  return report.refusals.find((refusal) => refusal.master === master)?.reason;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('a revert after calls through the shipped proxy hop', () => {
  beforeAll(async () => {
    compiled = compile();
    deployed = await deployAll();
  }, 600_000);

  it('a check before any call reports the entry\'s own reason', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [0n, 100n, 7n, BOB_LOCK, compiled.coinAddress]);
    const report = expectReported(refused, 'the implementation\'s "post" entry', 'implementation-master');
    expect(refused.error.message).toContain(': name too short or long (Program failed an OP_VERIFY operation.)');
    expect(refused.stalls).toStrictEqual([stalledAt(0)]);
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"name too short or long"'), message: 'name too short or long' });
  });

  it('a check after a store write and a registry read reports the entry\'s own reason', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [5n, 100n, 7n, ALICE_LOCK, compiled.coinAddress]);
    const report = expectReported(refused, 'the implementation\'s "post" entry', 'implementation-master');
    expect(refused.error.message).toContain(': referee is the poster (Program failed an OP_VERIFY operation.)');
    expect(refused.stalls).toStrictEqual([stalledAt(2)]);
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"referee is the poster"'), message: 'referee is the poster' });
  });

  it('a check on the coin argument after a token read reports the entry\'s own reason', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [5n, 100n, 7n, BOB_LOCK, compiled.rosterAddress]);
    const report = expectReported(refused, 'the implementation\'s "post" entry', 'implementation-master');
    expect(refused.error.message).toContain(': invalid coin (Program failed an OP_VERIFY operation.)');
    expect(refused.stalls).toStrictEqual([stalledAt(3)]);
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"invalid coin"'), message: 'invalid coin' });
  });

  it('a check after the state-changing token call reports the entry\'s own reason', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [5n, 100n, 0n, BOB_LOCK, compiled.coinAddress]);
    const report = expectReported(refused, 'the implementation\'s "post" entry', 'implementation-master');
    expect(refused.error.message).toContain(': method too short or long (Program failed an OP_VERIFY operation.)');
    expect(refused.stalls).toStrictEqual([stalledAt(4)]);
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"method too short or long"'), message: 'method too short or long' });
  });

  it('a check on a registry read after state-changing calls reports the entry\'s own reason', async () => {
    const refused = await refusedCall(deployed.bob, 'post', [5n, 100n, 7n, ALICE_LOCK, compiled.coinAddress]);
    const report = expectReported(refused, 'the implementation\'s "post" entry', 'implementation-master');
    expect(refused.error.message).toContain(': not a member (Program failed an OP_VERIFY operation.)');
    expect(refused.stalls).toStrictEqual([stalledAt(5)]);
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"not a member"'), message: 'not a member' });
  });

  it('a revert inside the third token call reports the callee\'s custom error, without its arguments', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [5n, 1500n, 7n, BOB_LOCK, compiled.coinAddress]);
    // The settle loop still throws without `errorArgs`; the report carries them (the ladder stream's hook).
    const report = expectReported(refused, 'the call\'s callee "Coin.transferFrom()"', 'callee-master-7');
    expect(refused.error.message).toContain(': revert ShortBalance(address, int256, int256)');
    // The callees are settled before the entry's frame is derived, so no derivation stalled.
    expect(refused.stalls).toStrictEqual([]);
    const reason = reasonOf(report, 'callee-master-7');
    expect(reason?.line).toBe(lineOf('revert ShortBalance'));
    expect(reason?.error?.name).toBe('ShortBalance');
    expect(reason?.error?.parameters?.map((parameter) => parameter.type)).toStrictEqual(['address', 'int256', 'int256']);
    expect(reason?.arguments).toStrictEqual([`0x${binToHex(ALICE_LOCK)}`, 1000n, 1500n]);
  });

  it('a check before any call, beside a reverting callee it never reaches, still reports that callee', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [0n, 1500n, 7n, BOB_LOCK, compiled.coinAddress]);
    // The entry stops at its first check, so the EVM reports "name too short or long": the callees are settled first
    // (the ladder stream's settle loop), so the callee's revert is thrown before the entry is derived.
    const report = expectReported(refused, 'the call\'s callee "Coin.transferFrom()"', 'callee-master-7');
    expect(reasonOf(report, 'implementation-master'))
      .toStrictEqual({ line: lineOf('"name too short or long"'), message: 'name too short or long' });
    expect(reasonOf(report, 'callee-master-7')?.error?.name).toBe('ShortBalance');
  });

  it('a check between calls, beside a reverting callee it never reaches, still reports that callee', async () => {
    const refused = await refusedCall(deployed.alice, 'post', [5n, 1500n, 0n, BOB_LOCK, compiled.coinAddress]);
    // The EVM reports "method too short or long": the callees settle before the entry's frame is derived, so this
    // draft holds only the unreached callee's revert, and the entry has to be derived before a callee is reported.
    const report = expectReported(refused, 'the call\'s callee "Coin.transferFrom()"', 'callee-master-7');
    expect(refused.stalls).toStrictEqual([]);
    const entry = report.refusals.find((refusal) => refusal.master === 'implementation-master');
    expect(entry?.reason.message).toBeUndefined();
    expect(entry?.objection).toContain(`requested index: ${UNFILLED_INDEX}.`);
    expect(reasonOf(report, 'callee-master-7')?.error?.name).toBe('ShortBalance');
  });

  it('with every check passing, the read of a balance and the write of it share one participant and the hop settles',
    async () => {
      // Alice's balance node is read by the `balanceOf` reach and rewritten by the `transferFrom` reach. One
      // transaction carries one input at that outpoint, so the reading reach names the node under the id the
      // writing reach places: the two reaches' records are records of one participant, one per segment.
      const result = await settledCall(await deployed.newCaller('3b'), 'post',
        [5n, 100n, 7n, BOB_LOCK, compiled.coinAddress]);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

      // One input per outpoint, which is what the builder's duplicate check requires and what the reconciled plan
      // states: the reach that only reads the balance spends the node the reach that writes it declares.
      const spent = result.transaction.inputs.map(
        (input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
      expect(new Set(spent).size).toBe(spent.length);
      // Both reaches still ran: the read-only one reads the node from the segment its own frame declares.
      expect(result.completed.map((frame) => frame.functionName)).toContain('Coin.balanceOf()');
      expect(result.completed.map((frame) => frame.functionName)).toContain('Coin.transferFrom()');
    });

  it('a value a proxied store returns reaches its caller, and the read settles', async () => {
    const result = await settledCall(deployed.alice, 'peek', []);
    // The generated fallback returns the delegate's bytes (PW8), so the store's `true` passes the entry's check.
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const { draft } = result;
    expect(binToHex(draft.blockOf('callee-impl-master-2').retval)).toBe('51');
    expect(binToHex(draft.blockOf('callee-master-1').calls[0]!.result)).toBe('51');
    expect(binToHex(draft.blockOf('callee-master-1').retval)).toBe('51');
    expect(binToHex(draft.blockOf('implementation-master').calls[0]!.result)).toBe('51');
  });
});
