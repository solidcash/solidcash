import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import * as composer from '../../../src/framed/composer/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { deploymentStateValues, type FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: a posted job updated, closed, reopened and its collateral withdrawn (L4, titles 31-40), through the
 * shipped hop, `callFramedProxyEntry`.
 *
 * `Desk` (a proxied root) keeps its jobs in a dynamic array of structs with `string` and `string[]` members and
 * reaches `Journal` (a proxied store) and `Coin` (a plain token) as the marketplace's entries do (MS2 by parameter):
 * `update` reads the judge's registration and each tag's label `STATIC`, pulls the token in when the amount rises
 * and pays it out when it falls a day after posting, and appends an entry (store up to 4, token 1); `close`,
 * `withdraw` and `reopen` move the token at most once and append an entry (store 1, token 1). A guarded entry runs
 * its pause check through an invoked helper, as the fixture's `whenNotPaused` does, so its block names both of the
 * root's records; `mark` is a job writer without it, as the fixture's `deliverResult` is.
 *
 * The clock is the root's own `block.timestamp` register, as in the fixture: the mock provider syncs the chain's own
 * time into it on every mine a send performs, so it carries that time from the framed proxy's first block on, and
 * the fixture's `evm_increaseTime` and `evm_mine` move it by the day they advance (pinned). A job posted a day before
 * that clock is written by a plain setup entry, `seed`, with a stamp of minus one day; posting itself settles
 * (pinned). Each deployment holds one job, id 0, with its opening entry, and the creator approves the root on the
 * token first, as the fixture's setup does.
 *
 * Each entry is pinned where it stands today; one that settles moves its case to every verdict accepted and the
 * broadcast. A last deployment steps the token's allowance read around and pins what stands behind it. The whole
 * file runs only under `FRAMED_AHEAD=1`.
 */

/** A 32-byte id with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '8091a2b3c4d5e6f708192a3b4c5d6e7';
  return `${seed}${base}${base}`.slice(0, 64);
}

const COIN_CATEGORY = category('0c');
const JOURNAL_IMPL_CATEGORY = category('1d');
const JOURNAL_PROXY_CATEGORY = category('2e');
const DESK_IMPL_CATEGORY = category('3f');
const DESK_PROXY_CATEGORY = category('40');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const DAY = 86_400n;
const CREATOR = encodeLockingBytecodeP2pkh(alicePkh);
const JUDGE = encodeLockingBytecodeP2pkh(bobPkh);
const NO_JUDGE = new Uint8Array(0);
const DIGEST = hexToBin('a0b16ada95e7d6bd78efb91c368a3bd6d3b0f6b77cd3f27664475522ee138ae5');

/** The contracts; `pull` decides whether the token's `transferFrom` reads the allowance. */
function source(pull: Pull): string {
  return [
    'pragma solidcash ^0.14.0;',
    'struct Entry { int kind; bytes who; bytes data; int stamp; }',
    'struct Seat { bytes key; int fee; }',
    'struct Job {',
    '  int state; bool listed; address creator; address judge; string title; string[] tags; bytes32 digest;',
    '  uint amount; address coin; int stamp; int maxTime; string method; uint owed; bytes32 result;',
    '}',
    'interface IJournal {',
    '  function isJudge(address who) view returns (bool);',
    '  function labelOf(string key) view returns (string);',
    '  function log(int id, Entry entry);',
    '}',
    'interface ICoin {',
    '  function transfer(address to, uint amount) returns (bool);',
    '  function transferFrom(address from, address to, uint amount) returns (bool);',
    '}',
    'contract Journal {',
    '  address public implementation;',
    '  address public desk;',
    '  mapping(int => Entry[]) logs;',
    '  mapping(address => Seat) seats;',
    '  mapping(string => string) labels;',
    '  event Logged(int indexed id, Entry entry);',
    '  function initialize(address hub) { this.desk = hub; require(true); }',
    '  function label(string key, string value) { this.labels[key] = value; }',
    '  function enlist(address who, bytes key, int fee) { this.seats[who] = Seat(key, fee); }',
    '  function isJudge(address who) view returns (bool) { return this.seats[who].key.length > 0; }',
    '  function labelOf(string key) view returns (string) { return this.labels[key]; }',
    '  function log(int id, Entry entry) {',
    '    require(msg.sender == this.desk, "not desk");',
    '    Entry e = entry;',
    '    e.stamp = block.timestamp;',
    '    this.logs[id].push(e);',
    '    emit Logged(id, e);',
    '  }',
    '  function count(int id) view returns (int) { return this.logs[id].length; }',
    '}',
    'contract Coin {',
    '  mapping(address => uint) balances;',
    '  mapping(address => mapping(address => uint)) allowances;',
    '  constructor(address holder, uint held, address pool, uint pooled) {',
    '    this.balances[holder] = held;',
    '    this.balances[pool] = pooled;',
    '  }',
    '  function approve(address spender, uint amount) returns (bool) {',
    '    this.allowances[msg.sender][spender] = amount;',
    '    return true;',
    '  }',
    '  function balanceOf(address who) view returns (uint) { return this.balances[who]; }',
    '  function transfer(address to, uint amount) returns (bool) {',
    '    require(this.balances[msg.sender] >= amount, "short balance");',
    '    this.balances[msg.sender] = this.balances[msg.sender] - amount;',
    '    this.balances[to] = this.balances[to] + amount;',
    '    return true;',
    '  }',
    '  function transferFrom(address from, address to, uint amount) returns (bool) {',
    pull === 'allowance'
      ? '    require(this.allowances[from][msg.sender] >= amount, "short allowance");'
      : '    require(amount >= 0, "negative amount");',
    '    this.balances[from] = this.balances[from] - amount;',
    '    this.balances[to] = this.balances[to] + amount;',
    '    return true;',
    '  }',
    '}',
    'contract Desk {',
    '  address public implementation;',
    '  address public journal;',
    '  bool public paused;',
    '  Job[] jobs;',
    '  function initialize(address j) { this.journal = j; require(true); }',
    '  function unpaused(bool flag) internal pure returns (bool) { return !flag; }',
    '  function requireNotPaused() internal view { require(unpaused(this.paused), "paused"); }',
    '  function publish(int id, Entry entry) internal { IJournal(this.journal).log(id, entry); }',
    '  function checkParams(string title, string[] tags, uint amount, address judge, address creator) internal view {',
    '    require(bytes(title).length > 0 && bytes(title).length < 255, "title too short or long");',
    '    require(amount > 0, "amount must be greater than 0");',
    '    require(tags.length > 0, "at least one tag is required");',
    '    if (judge != address(0)) {',
    '      require(IJournal(this.journal).isJudge(judge), "judge not registered");',
    '      require(judge != creator, "judge and creator can not be the same");',
    '    }',
    '    int labelled = 0;',
    '    for (int i = 0; i < tags.length; i = i + 1) {',
    '      if (bytes(IJournal(this.journal).labelOf(tags[i])).length != 0) { labelled = labelled + 1; }',
    '    }',
    '    require(labelled == 1, "exactly one label is required");',
    '  }',
    '  function post(string title, bytes32 digest, string[] tags, address coin, uint amount, int maxTime, string method) {',
    '    requireNotPaused();',
    '    this.jobs.push();',
    '    int id = this.jobs.length - 1;',
    '    this.jobs[id].listed = true;',
    '    this.jobs[id].creator = msg.sender;',
    '    this.jobs[id].title = title;',
    '    this.jobs[id].digest = digest;',
    '    this.jobs[id].tags = tags;',
    '    this.jobs[id].coin = coin;',
    '    this.jobs[id].amount = amount;',
    '    this.jobs[id].stamp = block.timestamp;',
    '    this.jobs[id].maxTime = maxTime;',
    '    this.jobs[id].method = method;',
    '    publish(id, Entry(0, abi.encodePacked(msg.sender), bytes(title), 0));',
    '  }',
    '  function seed(int state, string title, string[] tags, uint amount, address coin, int stamp, uint owed) {',
    '    requireNotPaused();',
    '    this.jobs.push();',
    '    int id = this.jobs.length - 1;',
    '    this.jobs[id].state = state;',
    '    this.jobs[id].listed = true;',
    '    this.jobs[id].creator = msg.sender;',
    '    this.jobs[id].title = title;',
    '    this.jobs[id].tags = tags;',
    '    this.jobs[id].amount = amount;',
    '    this.jobs[id].coin = coin;',
    '    this.jobs[id].stamp = stamp;',
    '    this.jobs[id].maxTime = 240;',
    '    this.jobs[id].method = "IPFS";',
    '    this.jobs[id].owed = owed;',
    '  }',
    '  function note(int id, int kind) { publish(id, Entry(kind, abi.encodePacked(msg.sender), bytes(""), 0)); }',
    '  function update(',
    '    int id, string title, bytes32 digest, string[] tags, uint amount, int maxTime, address judge, bool listed',
    '  ) {',
    '    requireNotPaused();',
    '    require(this.jobs[id].creator == msg.sender, "not creator");',
    '    require(this.jobs[id].state == 0, "not open");',
    '    checkParams(title, tags, amount, judge, this.jobs[id].creator);',
    '    uint held = this.jobs[id].amount;',
    '    if (held != amount) {',
    '      if (amount > held) {',
    '        uint more = amount - held;',
    '        require(more >= this.jobs[id].owed, "invalid collateral-adjusted amount increase");',
    '        address payIn = this.jobs[id].coin;',
    '        ICoin(payIn).transferFrom(msg.sender, address(this), more - this.jobs[id].owed);',
    '        this.jobs[id].owed = 0;',
    '      } else {',
    '        uint less = held - amount;',
    `        if (block.timestamp >= this.jobs[id].stamp + ${DAY}) {`,
    '          address payOut = this.jobs[id].coin;',
    '          ICoin(payOut).transfer(msg.sender, less + this.jobs[id].owed);',
    '          this.jobs[id].owed = 0;',
    '        } else {',
    '          this.jobs[id].owed = this.jobs[id].owed + less;',
    '        }',
    '      }',
    '      this.jobs[id].amount = amount;',
    '    }',
    '    this.jobs[id].title = title;',
    '    this.jobs[id].digest = digest;',
    '    this.jobs[id].tags = tags;',
    '    this.jobs[id].listed = listed;',
    '    this.jobs[id].maxTime = maxTime;',
    '    this.jobs[id].judge = judge;',
    '    publish(id, Entry(3, bytes(""), abi.encodePacked(bytes(title), digest, amount), 0));',
    '  }',
    '  function close(int id) {',
    '    requireNotPaused();',
    '    require(this.jobs[id].creator == msg.sender, "not creator");',
    '    require(this.jobs[id].state == 0, "not open");',
    '    this.jobs[id].state = 2;',
    `    if (block.timestamp >= this.jobs[id].stamp + ${DAY}) {`,
    '      uint back = this.jobs[id].amount + this.jobs[id].owed;',
    '      this.jobs[id].owed = 0;',
    '      address coin = this.jobs[id].coin;',
    '      ICoin(coin).transfer(this.jobs[id].creator, back);',
    '    } else {',
    '      this.jobs[id].owed = this.jobs[id].owed + this.jobs[id].amount;',
    '    }',
    '    publish(id, Entry(7, bytes(""), bytes(""), 0));',
    '  }',
    '  function withdraw(int id) {',
    '    requireNotPaused();',
    '    require(this.jobs[id].state == 2, "not closed");',
    `    require(block.timestamp >= this.jobs[id].stamp + ${DAY}, "24 hours have not passed yet");`,
    '    require(this.jobs[id].owed > 0, "no collateral to withdraw");',
    '    uint back = this.jobs[id].owed;',
    '    address coin = this.jobs[id].coin;',
    '    ICoin(coin).transfer(this.jobs[id].creator, back);',
    '    this.jobs[id].owed = 0;',
    '    publish(id, Entry(16, bytes(""), bytes(""), 0));',
    '  }',
    '  function reopen(int id) {',
    '    requireNotPaused();',
    '    require(this.jobs[id].creator == msg.sender, "not creator");',
    '    require(this.jobs[id].state == 2, "not closed");',
    '    if (this.jobs[id].owed < this.jobs[id].amount) {',
    '      address coin = this.jobs[id].coin;',
    '      ICoin(coin).transferFrom(msg.sender, address(this), this.jobs[id].amount - this.jobs[id].owed);',
    '      this.jobs[id].owed = 0;',
    '    } else {',
    '      this.jobs[id].owed = this.jobs[id].owed - this.jobs[id].amount;',
    '    }',
    '    this.jobs[id].state = 0;',
    '    this.jobs[id].result = 0x0000000000000000000000000000000000000000000000000000000000000000;',
    '    this.jobs[id].stamp = block.timestamp;',
    '    publish(id, Entry(8, bytes(""), bytes(""), 0));',
    '  }',
    '  function mark(int id, bytes32 result) {',
    '    require(this.jobs[id].creator == msg.sender, "not creator");',
    '    this.jobs[id].result = result;',
    '    publish(id, Entry(6, abi.encodePacked(msg.sender), abi.encodePacked(result), 0));',
    '  }',
    '}',
  ].join('\n');
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
/** The token's pull as the fixture's reads the allowance, or stepped around it. */
type Pull = 'allowance' | 'unchecked';
const compiledRuns = new Map<Pull, ArtifactMap>();
/** The contracts of one variant, compiled once and only when a case runs it. */
function compiled(pull: Pull): ArtifactMap {
  let found = compiledRuns.get(pull);
  if (found === undefined) {
    found = compileStringMulti(source(pull), { composition: 'framed' });
    compiledRuns.set(pull, found);
  }
  return found;
}

/** A coin a genesis or a hop is funded from; a genesis mints its txid as the category. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One job as the setup writes it: `state` 0 is open and 2 closed, a hundred held, `owed` of it collateral. */
function job(state: bigint, stamp: bigint, owed: bigint): FunctionArgument[] {
  return [state, 'Job title', ['LA'], 100n, addressOf(COIN_CATEGORY), stamp, owed];
}

/** Each deployment holds one job, id 0, as each fixture title does. */
const JOB = 0n;

/** The arguments of an update of job 0 that sets its title and digest, `amount`, `tags` and `judge`. */
function updateArgs(amount: bigint, tags: readonly string[], judge: Uint8Array): FunctionArgument[] {
  return [JOB, 'New title', DIGEST, [...tags], amount, 240n, judge, true];
}

/** One deployment holding job 0, and what a hop is entered with. */
interface World {
  readonly artifacts: ArtifactMap;
  readonly network: MockNetworkProvider;
  readonly desk: { readonly proxy: string; readonly implementation: string };
  readonly journal: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly funder: Unlocker;
  readonly changeAddress: string;
  /** Hands out a fresh coin at the creator's lock per hop, distinct from every category. */
  readonly nextCoin: () => Promise<Utxo>;
}

/** What a hop left: its result, or its error with the last draft built and the stalls the settle caught. */
interface Outcome {
  readonly result?: FramedProxyCallResult;
  readonly error?: Error;
  readonly draft?: composer.CompositionDraft;
  readonly stalls: readonly string[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one entry of the store or the root through its proxy, as the creator, and returns what it left. */
async function enter(
  world: World, contract: 'Desk' | 'Journal', functionName: string, args: readonly FunctionArgument[],
): Promise<Outcome> {
  const artifact = world.artifacts[contract]!;
  const ids = contract === 'Desk' ? world.desk : world.journal;
  const coin = await world.nextCoin();
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: ids.proxy,
      implementationCategoryId: ids.implementation,
      functionName,
      args,
      ...(contract === 'Desk' ? { externals: world.externals } : {}),
      callerUtxo: coin,
      callerLockingBytecode: CREATOR,
      funder: world.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const last = hosts.mock.results.at(-1);
  const stalls = derivations.mock.results.filter((entry) => entry.type === 'throw')
    .map((entry) => String((entry.value as Error).message));
  hosts.mockRestore();
  derivations.mockRestore();
  const live = await world.network.getUtxosForLockingBytecode(CREATOR);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    ...(last?.type === 'return' ? { draft: last.value.draft } : {}),
    stalls,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** The hop settled: every verdict accepted and the transaction broadcast. */
function expectSettled(outcome: Outcome): FramedProxyCallResult {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  return outcome.result!;
}

/** The root proxy's live state, parsed with the shipped decoder, the jobs joined from their chunk records. */
async function deskState(world: World): Promise<Record<string, unknown>> {
  const layout = buildProxyArtifact(world.artifacts.Desk!).stateLayout!;
  const pools = await readFramedDeployment(world.network, world.desk.proxy, layout);
  return deploymentStateValues(layout, world.desk.proxy, pools);
}

/** The published facts of one root entry: its call sites with their occurrence, its records and its dynamic writes. */
function publishedFacts(desk: Artifact, functionName: string): Record<string, unknown> {
  const row = desk.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls?: readonly { interfaceName: string; functionName: string; occurrence?: string }[];
    readonly requiredNftIndices?: readonly number[];
    readonly dynamicWrites?: readonly string[];
  };
  return {
    calls: (row.externalCalls ?? []).map((call) => `${call.interfaceName}.${call.functionName}@${call.occurrence}`),
    records: row.requiredNftIndices,
    writes: row.dynamicWrites ?? [],
  };
}

/**
 * Deploys the token plain with the creator's 900 and the root's 100, has the creator approve the root on it, then
 * deploys the store and the root behind generated proxies, labels two tags and enlists the judge, seeds `seeded`
 * as job 0 when given and appends its opening entry. Every setup hop settles and broadcasts.
 */
async function deployWorld(pull: Pull, seeded: readonly FunctionArgument[] | undefined): Promise<World> {
  const artifacts = compiled(pull);
  const { Journal, Coin, Desk } = artifacts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const funder = signature.unlockP2PKH();
  const changeAddress = wallet.address;
  let serial = 0x60;
  const nextCoin = async (): Promise<Utxo> => {
    serial += 1;
    const coin = funding(category(serial.toString(16)));
    await network.addUtxo(binToHex(CREATOR), coin);
    return coin;
  };
  for (const id of [COIN_CATEGORY, JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY,
    DESK_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  await fundShippedFacets(network);

  // The token's constructor writes one collection, so the approval is its own call, as in the fixture's setup.
  await deployStatefulContract(Coin!, [CREATOR, 900n, addressOf(DESK_PROXY_CATEGORY), 100n], {
    fundingUtxo: funding(COIN_CATEGORY), funder: genesisFunder, changeAddress, provider: network,
  });
  const approved = await callFramedEntry({
    provider: network, artifact: Coin!, categoryId: COIN_CATEGORY, functionName: 'approve',
    args: [addressOf(DESK_PROXY_CATEGORY), 2000n], callerUtxo: await nextCoin(), callerLockingBytecode: CREATOR,
    funder, changeAddress, vm: compositionMachine(),
  });
  expect(approved.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

  // The store gates on the root proxy's address, which its category fixes before the root is deployed.
  const journal = await deployFramedProxy({
    provider: network,
    implementationArtifact: Journal!,
    proxyArtifact: buildProxyArtifact(Journal!),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY_CATEGORY)] },
    callerLockingBytecode: CREATOR,
    callerFunding: { utxo: await nextCoin(), funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(journal.initialize.broadcast).toBeDefined();
  const desk = await deployFramedProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [journal.proxy.address] },
    callerLockingBytecode: CREATOR,
    callerFunding: { utxo: await nextCoin(), funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  expect(binToHex(desk.proxy.address)).toBe(binToHex(addressOf(DESK_PROXY_CATEGORY)));

  const world: World = {
    artifacts,
    network,
    desk: { proxy: desk.proxy.categoryId, implementation: desk.implementation.categoryId },
    journal: { proxy: journal.proxy.categoryId, implementation: journal.implementation.categoryId },
    externals: {
      IJournal: {
        artifact: Journal!,
        categoryId: journal.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(Journal!),
        implementationCategoryId: journal.implementation.categoryId,
      },
      ICoin: { artifact: Coin!, categoryId: COIN_CATEGORY },
    },
    funder,
    changeAddress,
    nextCoin,
  };
  expectSettled(await enter(world, 'Journal', 'label', ['LA', 'LABEL_A']));
  expectSettled(await enter(world, 'Journal', 'label', ['LB', 'LABEL_B']));
  expectSettled(await enter(world, 'Journal', 'enlist', [JUDGE, JUDGE.slice(3, 23), 100n]));
  if (seeded !== undefined) await seedJob(world, seeded);
  return world;
}

/** Seeds job 0 with `seeded` and appends its opening entry, as a posted job holds one. */
async function seedJob(world: World, seeded: readonly FunctionArgument[]): Promise<void> {
  expectSettled(await enter(world, 'Desk', 'seed', seeded));
  expectSettled(await enter(world, 'Desk', 'note', [JOB, 0n]));
}

/** A token balance, read off chain through the shipped read path. */
async function balanceOf(world: World, who: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: world.artifacts.Coin!, categoryId: COIN_CATEGORY, functionName: 'balanceOf',
    args: [who], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** How many entries the store holds for job 0, read off chain through the store's proxy. */
async function entries(world: World): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: world.artifacts.Journal!, categoryId: world.journal.proxy,
    functionName: 'count', args: [JOB], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** Job 0 as the root proxy's records hold it. */
async function job0(world: World): Promise<Record<string, unknown>> {
  const jobs = (await deskState(world)).jobs as readonly Record<string, unknown>[];
  expect(jobs).toHaveLength(1);
  return jobs[0]!;
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead (L4): a job updated, closed, reopened and withdrawn', () => {
  it('compiles every entry with the call sites, records and writes the fixture publishes', () => {
    for (const artifact of Object.values(compiled('allowance'))) {
      if (artifact.composition === undefined) continue;
      expect(artifact.composition.refusedEntries ?? []).toStrictEqual([]);
    }
    const desk = compiled('allowance').Desk!;
    expect(desk.stateLayout?.dataNftCount).toBe(2);
    // As `updateJobPost`: the judge and each tag read `STATIC`, a pull or a payout on the amount's arms, the entry.
    expect(publishedFacts(desk, 'update')).toStrictEqual({
      calls: ['IJournal.isJudge@conditional', 'IJournal.labelOf@loop', 'ICoin.transferFrom@conditional',
        'ICoin.transfer@conditional', 'IJournal.log@once'],
      records: [0, 1], writes: ['jobs'],
    });
    // As `closeJob`, `withdrawCollateral` and `reopenJob`: one token call and the entry.
    expect(publishedFacts(desk, 'close')).toStrictEqual({
      calls: ['ICoin.transfer@conditional', 'IJournal.log@once'], records: [0, 1], writes: ['jobs'],
    });
    expect(publishedFacts(desk, 'withdraw')).toStrictEqual({
      calls: ['ICoin.transfer@once', 'IJournal.log@once'], records: [0, 1], writes: ['jobs'],
    });
    expect(publishedFacts(desk, 'reopen')).toStrictEqual({
      calls: ['ICoin.transferFrom@conditional', 'IJournal.log@once'], records: [0, 1], writes: ['jobs'],
    });
    expect(publishedFacts(desk, 'post')).toStrictEqual({ calls: ['IJournal.log@once'], records: [0, 1], writes: ['jobs'] });
    // As `deliverResult`: no pause check, so its block names only the first of the root's two records.
    expect(publishedFacts(desk, 'mark')).toStrictEqual({ calls: ['IJournal.log@once'], records: [0], writes: ['jobs'] });
  });

  describe('a job posted through the hop', () => {
    let world: World;
    /** The chain as it stands right after the job is posted, so each entry that settles is planned from it. */
    let pristine: SnapshotRestorer;
    /** The chain's own time the mock chain's day moved the root's register to. */
    let clock: bigint;
    it('setup: the approval, the store registrations and both proxies settle and broadcast', async () => {
      world = await deployWorld('allowance', undefined);
    }, 900_000);

    it('the clock the root reads is the chain\'s own time, and the mock chain\'s day moves it by that day', async () => {
      const before = world.network.getBlockTime();
      expect((await deskState(world)).__block_timestamp).toBe(BigInt(before));
      await world.network.send('evm_increaseTime', [Number(DAY)]);
      await world.network.send('evm_mine', []);
      expect(world.network.getBlockTime()).toBe(before + Number(DAY));
      // The mock clock (`oracle/blockOracleUpdater.ts`) rewrites the register in the proxy's own records, where the
      // implementation's delegate frames read it.
      clock = (await deskState(world)).__block_timestamp as bigint;
      expect(clock).toBe(BigInt(world.network.getBlockTime()));
    }, 600_000);

    it('posting the job (18) settles, stamped with that clock, and the history read answers its entry', async () => {
      expectSettled(await enter(world, 'Desk', 'post',
        ['Job title', DIGEST, ['LA'], addressOf(COIN_CATEGORY), 100n, 240n, 'IPFS']));
      const posted = await job0(world);
      expect([posted.state, posted.title, posted.amount, posted.stamp]).toStrictEqual([0n, 'Job title', 100n, clock]);
      expect(await entries(world)).toBe(1n);
      pristine = await world.network.takeSnapshot();
    }, 1_800_000);

    it('an update with a registered judge and a second tag (31, 33) settles, the unchanged amount skipping both arms',
      async () => {
        // The amount argument (100) equals the held amount, so both token arms' `held != amount` condition is decided
        // false against the entry's own facts and neither is planned; the entry's call and the plan's records agree.
        await pristine.restore();
        const outcome = await enter(world, 'Desk', 'update', updateArgs(100n, ['LA', 'Bug'], JUDGE));
        expectSettled(outcome);
        const updated = await job0(world);
        expect([updated.title, updated.tags, updated.amount]).toStrictEqual(['New title', ['LA', 'Bug'], 100n]);
      }, 900_000);

    it('an update with no judge (32) settles the same way', async () => {
      await pristine.restore();
      expectSettled(await enter(world, 'Desk', 'update', updateArgs(100n, ['LA'], NO_JUDGE)));
    }, 900_000);

    it('an update raising the amount (34) settles through the taken pull arm', async () => {
      // `amount_` (200) exceeds the held amount (100) read from the incoming state, so the pull arm is the one the
      // plan states; the skipped payout's `100 - 200` is never resolved.
      await pristine.restore();
      const outcome = await enter(world, 'Desk', 'update', updateArgs(200n, ['LA'], NO_JUDGE));
      expectSettled(outcome);
      expect((await job0(world)).amount).toBe(200n);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([800n, 200n]);
    }, 900_000);

    it('an update lowering the amount before a day (34) settles with the payout skipped', async () => {
      await pristine.restore();
      const outcome = await enter(world, 'Desk', 'update', updateArgs(50n, ['LA'], NO_JUDGE));
      expectSettled(outcome);
      const updated = await job0(world);
      expect([updated.amount, updated.owed]).toStrictEqual([50n, 50n]);
    }, 900_000);

    it('a job writer whose block names only the first record settles', async () => {
      // The delegate frame declares the one record the entry names (`buildHopPlan`, `frameDataRecordIndices`).
      await pristine.restore();
      expectSettled(await enter(world, 'Desk', 'mark', [JOB, DIGEST]));
    }, 900_000);

    it('closing before a day (36) settles and holds the collateral the skipped payout does not pay', async () => {
      const outcome = await enter(world, 'Desk', 'close', [JOB]);
      // The payout's condition reads the job's own stamp, a field the entry's element write copies back unchanged, so
      // the arm the body skips is never planned: the entry's one call and the plan's records agree and the spend
      // settles. Owner: the SDK hop planner (`proxy/external-calls.ts`, `occurrenceCountOf`).
      expectSettled(outcome);
      const closed = await job0(world);
      expect([closed.state, closed.owed]).toStrictEqual([2n, 100n]);
      // The collateral stays in the contract until it is withdrawn, so the creator's coin has only lost the amount.
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([900n, 100n]);
      // One history entry per event this shared world has appended for the job: its post, its mark and this close.
      expect(await entries(world)).toBe(3n);
    }, 1_800_000);
  });

  describe('a job posted a day before the clock', () => {
    let world: World;
    /** The chain as it stands right after the job is seeded, so each entry that settles is planned from it. */
    let pristine: SnapshotRestorer;
    it('setup: the job is seeded with its stamp and its opening entry', async () => {
      world = await deployWorld('allowance', job(0n, -DAY, 0n));
      pristine = await world.network.takeSnapshot();
    }, 900_000);

    it('an update lowering the amount a day later (34) settles through the taken payout arm', async () => {
      await pristine.restore();
      expectSettled(await enter(world, 'Desk', 'update', updateArgs(50n, ['LA'], NO_JUDGE)));
    }, 900_000);

    it('closing a day later (37) settles and pays the job back', async () => {
      await pristine.restore();
      expectSettled(await enter(world, 'Desk', 'close', [JOB]));
      const closed = await job0(world);
      expect([closed.state, closed.owed]).toStrictEqual([2n, 0n]);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([1000n, 0n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);
  });

  describe('a job closed before its day, holding its collateral', () => {
    let world: World;
    /** The chain as it stands right after the job is seeded closed, so each entry that settles is planned from it. */
    let pristine: SnapshotRestorer;
    it('setup: the job is seeded closed and its opening entry appended', async () => {
      world = await deployWorld('allowance', job(2n, 0n, 100n));
      pristine = await world.network.takeSnapshot();
    }, 900_000);

    it('reopening (38) settles, the pull its collateral makes unneeded decided skipped', async () => {
      // `owed` (100) is not less than `amount` (100), so the pull's condition is decided false against the incoming
      // state and the entry takes its own `owed -= amount` arm; its store call and the plan's records agree.
      await pristine.restore();
      expectSettled(await enter(world, 'Desk', 'reopen', [JOB]));
      const reopened = await job0(world);
      expect([reopened.state, reopened.owed]).toStrictEqual([0n, 0n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);

    it('withdrawing after the mock chain\'s day (40) settles and pays the collateral back', async () => {
      await pristine.restore();
      await world.network.send('evm_increaseTime', [Number(DAY)]);
      await world.network.send('evm_mine', []);
      expectSettled(await enter(world, 'Desk', 'withdraw', [JOB]));
      expect((await job0(world)).owed).toBe(0n);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([1000n, 0n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);
  });

  describe('a job closed a day before the clock, holding its collateral', () => {
    let world: World;
    it('setup: the job is seeded closed and its opening entry appended', async () => {
      world = await deployWorld('allowance', job(2n, -DAY, 100n));
    }, 900_000);

    it('withdrawing the collateral (40) settles and pays it back', async () => {
      expectSettled(await enter(world, 'Desk', 'withdraw', [JOB]));
      expect((await job0(world)).owed).toBe(0n);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([1000n, 0n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);
  });

  describe('a job closed and paid back a day before the clock', () => {
    let world: World;
    it('setup: the job is seeded closed with nothing owed and its opening entry appended', async () => {
      world = await deployWorld('allowance', job(2n, -DAY, 0n));
    }, 900_000);

    it('reopening (39) settles and pulls the amount back in, its allowance read beside its balance batch', async () => {
      // The pull's frame declares its allowance node kept, ahead of its batch's groups (`proxy/external-calls.ts`,
      // `calleeEntryWrites`; `proxy/entry-writes.ts`, `declaredReadSlots`).
      const chainTime = BigInt(world.network.getBlockTime());
      expectSettled(await enter(world, 'Desk', 'reopen', [JOB]));
      const reopened = await job0(world);
      expect([reopened.state, reopened.owed]).toStrictEqual([0n, 0n]);
      // The reopen stamps the job with the chain's own time, distinct from the minus-day the setup seeded it with.
      expect(reopened.stamp).toBe(chainTime);
      expect(reopened.stamp).not.toBe(-DAY);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([800n, 200n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);
  });

  describe('stepped: the token\'s pull reads no allowance', () => {
    let world: World;
    it('setup: the job is seeded closed with nothing owed and its opening entry appended', async () => {
      world = await deployWorld('unchecked', job(2n, -DAY, 0n));
    }, 900_000);

    it('reopening (39) settles and pulls the amount back in', async () => {
      const chainTime = BigInt(world.network.getBlockTime());
      expectSettled(await enter(world, 'Desk', 'reopen', [JOB]));
      const reopened = await job0(world);
      expect([reopened.state, reopened.owed]).toStrictEqual([0n, 0n]);
      expect(reopened.stamp).toBe(chainTime);
      expect(reopened.stamp).not.toBe(-DAY);
      expect([await balanceOf(world, CREATOR), await balanceOf(world, addressOf(DESK_PROXY_CATEGORY))])
        .toStrictEqual([800n, 200n]);
      expect(await entries(world)).toBe(2n);
    }, 1_800_000);

    it('an update beside it (31, 33) settles, the unchanged amount skipping both token arms', async () => {
      const outcome = await enter(world, 'Desk', 'update', updateArgs(100n, ['LA', 'Bug'], JUDGE));
      expectSettled(outcome);
      const updated = await job0(world);
      expect([updated.title, updated.tags, updated.amount]).toStrictEqual(['New title', ['LA', 'Bug'], 100n]);
    }, 900_000);
  });
});
