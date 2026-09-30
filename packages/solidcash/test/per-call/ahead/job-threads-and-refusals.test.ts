import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { decodePushdataValue, validatorAddress, type Artifact, type StateValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import * as composer from '../../../src/per-call/composer/index.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { deploymentStateValues, type PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh, carolPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: the class-(d) L4 entries on a posted task, through the shipped hop (`callPerCallProxyEntry`).
 *
 * `Desk` (a proxied root) keeps a task array and a per-task allowlist; `Journal` (a proxied store) keeps members,
 * arbiters and per-task notes, gates its writes on the root proxy's address and stamps each note with the clock;
 * `Vault` (the escrow) and `Panel` (the dispute contract) are plain and refuse an escrow id they do not hold. The
 * entries replicate the thread message (title 47), the allowlist update (20, 30), the arbitration refusal on an
 * open and a closed task (64, 63) and the dispute of a closed task (56), with the fixture's reasons, call sites,
 * occurrences, reads and write facts (pinned first).
 *
 * Posting does not settle (pinned), so the task is written by two setup entries the replica adds: `open` (the
 * post's own writes and its first note, without the store reads and the allowlist loop) and `grant` (the allowlist
 * entry, with no call). Both settle and broadcast, and so does `close`, the close without its timeout arm.
 *
 * Each entry is pinned where it stands today. Beside them, `greet` and `setAllowedOnly` drop the task read,
 * `refuseOnce` the refund arm's note and `postUnlisted` the allowlist loop, each a wall its entry met; a second
 * deployment whose escrow and dispute contract accept escrow 0 shows what stands behind their reverts. The file runs
 * only under `PER_CALL_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4';
  return `${seed}${base}${base}`.slice(0, 64);
}

const VAULT_CATEGORY = category('0d');
const PANEL_CATEGORY = category('1e');
const JOURNAL_IMPL_CATEGORY = category('2f');
const JOURNAL_PROXY_CATEGORY = category('30');
const DESK_IMPL_CATEGORY = category('41');
const DESK_PROXY_CATEGORY = category('52');

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL_LOCK = encodeLockingBytecodeP2pkh(carolPkh);
const TITLE = 'Create a marketplace in solidity';
const HASH = Uint8Array.from({ length: 32 }, (_unused, index) => (index * 13 + 5) % 256);
const TASK = 0n;

const SOURCE = [
  'pragma solidcash ^0.13.0;',
  'struct Note { uint8 kind; bytes who; bytes data; uint32 at; }',
  'struct Member { address who; bytes key; string name; string bio; string avatar; int up; int down; }',
  'struct Arbiter {',
  '  address who; bytes key; string name; string bio; string avatar; int fee; int settled; int refused;',
  '}',
  'struct Roles { address creator; address arbiter; address worker; }',
  'struct Task { int state; bool gated; Roles roles; string title; int amount; int owed; int escrow; bool disputed; }',
  'interface IJournal {',
  '  function isMember(address who) view returns (bool);',
  '  function isArbiter(address who) view returns (bool);',
  '  function publish(int id, Note note);',
  '  function refused(address who);',
  '}',
  'interface IVault { function refund(int escrow); }',
  'interface IPanel { function challenge(int escrow); }',
  'contract Journal {',
  '  address public implementation;',
  '  address public desk;',
  '  address public owner;',
  '  bool public paused;',
  '  mapping(int => Note[]) notes;',
  '  mapping(address => Member) members;',
  '  mapping(address => Arbiter) arbiters;',
  '  event Posted(int indexed id, Note note);',
  '  modifier onlyDesk() { require(msg.sender == this.desk, "not desk"); _; }',
  '  function initialize(address hub) { this.desk = hub; this.owner = msg.sender; require(true); }',
  '  function join(bytes key, string name, string bio, string avatar) {',
  '    require(this.members[msg.sender].key.length == 0, "already registered");',
  '    this.members[msg.sender] = Member(msg.sender, key, name, bio, avatar, 0, 0);',
  '  }',
  '  function enlist(bytes key, string name, string bio, string avatar, int fee) {',
  '    require(this.arbiters[msg.sender].key.length == 0, "already registered");',
  '    this.arbiters[msg.sender] = Arbiter(msg.sender, key, name, bio, avatar, fee, 0, 0);',
  '  }',
  '  function isMember(address who) view returns (bool) { return this.members[who].key.length > 0; }',
  '  function isArbiter(address who) view returns (bool) { return this.arbiters[who].key.length > 0; }',
  '  function publish(int id, Note note) onlyDesk {',
  '    Note e = note;',
  '    e.at = uint32(block.timestamp);',
  '    this.notes[id].push(e);',
  '    emit Posted(id, e);',
  '  }',
  '  function refused(address who) onlyDesk {',
  '    this.arbiters[who].refused = this.arbiters[who].refused + 1;',
  '  }',
  '}',
  'contract Vault {',
  '  int public escrows;',
  '  int public last;',
  '  constructor(int count) { this.escrows = count; }',
  '  function refund(int escrow) { require(escrow < this.escrows, "no escrow"); this.last = escrow; }',
  '}',
  'contract Panel {',
  '  int public escrows;',
  '  int public last;',
  '  constructor(int count) { this.escrows = count; }',
  '  function challenge(int escrow) { require(escrow < this.escrows, "no escrow"); this.last = escrow; }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public journal;',
  '  address public vault;',
  '  address public panel;',
  '  Task[] tasks;',
  '  mapping(int => mapping(address => bool)) allowlist;',
  '  modifier onlyCreator(int taskId) {',
  '    require(this.tasks[taskId].roles.creator == msg.sender, "not creator");',
  '    _;',
  '  }',
  '  modifier onlyArbiter(int taskId) {',
  '    require(this.tasks[taskId].roles.arbiter == msg.sender, "not arbitrator");',
  '    _;',
  '  }',
  '  modifier onlyCreatorOrWorker(int taskId) {',
  '    require(this.tasks[taskId].roles.creator == msg.sender || this.tasks[taskId].roles.worker == msg.sender,',
  '      "not worker or creator");',
  '    _;',
  '  }',
  '  function initialize(address j, address v, address p) {',
  '    this.journal = j; this.vault = v; this.panel = p; require(true);',
  '  }',
  '  function publishNote(int id, Note n) internal { IJournal(this.journal).publish(id, n); }',
  '  function post(string title, int amount, address arbiter, address[] allowed) {',
  '    require(bytes(title).length > 0 && bytes(title).length < 255, "title too short or long");',
  '    require(amount > 0, "amount must be greater than 0");',
  '    if (arbiter != address(0)) {',
  '      require(IJournal(this.journal).isArbiter(arbiter), "arbitrator not registered");',
  '      require(arbiter != msg.sender, "arbitrator and job creator can not be the same person");',
  '    }',
  '    require(IJournal(this.journal).isMember(msg.sender), "not registered");',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].gated = allowed.length > 0;',
  '    this.tasks[id].roles.creator = msg.sender;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = amount;',
  '    this.tasks[id].roles.arbiter = arbiter;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), bytes(title), 0));',
  '    if (allowed.length > 0) {',
  '      _setAllowed(id, allowed, new address[](0));',
  '    }',
  '  }',
  '  function open(string title, int amount, address arbiter, bool gated) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].gated = gated;',
  '    this.tasks[id].roles.creator = msg.sender;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = amount;',
  '    this.tasks[id].roles.arbiter = arbiter;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), bytes(title), 0));',
  '  }',
  '  function grant(int id, address who) { this.allowlist[id][who] = true; }',
  '  function postUnlisted(string title, int amount, address arbiter) {',
  '    require(bytes(title).length > 0 && bytes(title).length < 255, "title too short or long");',
  '    require(amount > 0, "amount must be greater than 0");',
  '    if (arbiter != address(0)) {',
  '      require(IJournal(this.journal).isArbiter(arbiter), "arbitrator not registered");',
  '      require(arbiter != msg.sender, "arbitrator and job creator can not be the same person");',
  '    }',
  '    require(IJournal(this.journal).isMember(msg.sender), "not registered");',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].gated = false;',
  '    this.tasks[id].roles.creator = msg.sender;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = amount;',
  '    this.tasks[id].roles.arbiter = arbiter;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), bytes(title), 0));',
  '  }',
  '  function close(int id) onlyCreator(id) {',
  '    require(this.tasks[id].state == 0, "not open");',
  '    this.tasks[id].state = 2;',
  '    this.tasks[id].owed = this.tasks[id].owed + this.tasks[id].amount;',
  '    publishNote(id, Note(7, hex"", hex"", 0));',
  '  }',
  '  function message(int id, bytes32 hash, address to) {',
  '    require(this.tasks[id].state != 2, "job closed");',
  '    require(msg.sender != to, "can\'t message yourself");',
  '    bool isCreator = this.tasks[id].roles.creator == msg.sender;',
  '    address recipient = to;',
  '    if (!isCreator) {',
  '      require(IJournal(this.journal).isMember(msg.sender), "not registered");',
  '      if (this.tasks[id].state == 1) {',
  '        require(this.tasks[id].roles.worker == msg.sender, "taken/not worker");',
  '      } else {',
  '        require(!this.tasks[id].gated || this.allowlist[id][msg.sender], "not whitelisted");',
  '      }',
  '      recipient = this.tasks[id].roles.creator;',
  '    } else {',
  '      require(IJournal(this.journal).isMember(to), "not registered");',
  '    }',
  '    uint8 kind = isCreator ? 18 : 17;',
  '    publishNote(id, Note(kind, abi.encodePacked(msg.sender), abi.encodePacked(hash, recipient), 0));',
  '  }',
  '  function greet(int id, bytes32 hash, address to) {',
  '    require(msg.sender != to, "can\'t message yourself");',
  '    require(IJournal(this.journal).isMember(to), "not registered");',
  '    publishNote(id, Note(18, abi.encodePacked(msg.sender), abi.encodePacked(hash, to), 0));',
  '  }',
  '  function setAllowed(int id, address[] allowed, address[] disallowed) onlyCreator(id) {',
  '    _setAllowed(id, allowed, disallowed);',
  '  }',
  '  function _setAllowed(int id, address[] allowed, address[] disallowed) internal {',
  '    require(this.tasks[id].state == 0, "not open");',
  '    for (uint i = 0; i < allowed.length; i++) {',
  '      this.allowlist[id][allowed[i]] = true;',
  '      publishNote(id, Note(14, abi.encodePacked(allowed[i]), hex"", 0));',
  '    }',
  '    for (uint k = 0; k < disallowed.length; k++) {',
  '      this.allowlist[id][disallowed[k]] = false;',
  '      publishNote(id, Note(15, abi.encodePacked(disallowed[k]), hex"", 0));',
  '    }',
  '  }',
  '  function setAllowedOnly(int id, address[] allowed, address[] disallowed) {',
  '    for (uint i = 0; i < allowed.length; i++) {',
  '      this.allowlist[id][allowed[i]] = true;',
  '      publishNote(id, Note(14, abi.encodePacked(allowed[i]), hex"", 0));',
  '    }',
  '    for (uint k = 0; k < disallowed.length; k++) {',
  '      this.allowlist[id][disallowed[k]] = false;',
  '      publishNote(id, Note(15, abi.encodePacked(disallowed[k]), hex"", 0));',
  '    }',
  '  }',
  '  function _refund(int id) internal {',
  '    require(this.tasks[id].state == 1, "job in invalid state");',
  '    this.tasks[id].disputed = false;',
  '    IVault(this.vault).refund(this.tasks[id].escrow);',
  '    this.tasks[id].state = 0;',
  '    this.tasks[id].escrow = 0;',
  '    publishNote(id, Note(10, abi.encodePacked(this.tasks[id].roles.arbiter), hex"", 0));',
  '    this.tasks[id].roles.worker = address(0);',
  '  }',
  '  function refuse(int id) onlyArbiter(id) {',
  '    require(this.tasks[id].state != 2, "job in invalid state");',
  '    IJournal(this.journal).refused(msg.sender);',
  '    publishNote(id, Note(13, hex"", hex"", 0));',
  '    if (this.tasks[id].state == 1) {',
  '      _refund(id);',
  '    }',
  '    this.tasks[id].roles.arbiter = address(0);',
  '  }',
  '  function refuseOnce(int id) onlyArbiter(id) {',
  '    require(this.tasks[id].state != 2, "job in invalid state");',
  '    IJournal(this.journal).refused(msg.sender);',
  '    publishNote(id, Note(13, hex"", hex"", 0));',
  '    if (this.tasks[id].state == 1) {',
  '      this.tasks[id].disputed = false;',
  '      IVault(this.vault).refund(this.tasks[id].escrow);',
  '      this.tasks[id].state = 0;',
  '      this.tasks[id].escrow = 0;',
  '      this.tasks[id].roles.worker = address(0);',
  '    }',
  '    this.tasks[id].roles.arbiter = address(0);',
  '  }',
  '  function dispute(int id, bytes key, bytes content) onlyCreatorOrWorker(id) {',
  '    require(this.tasks[id].state == 1, "job in invalid state");',
  '    require(this.tasks[id].roles.arbiter != address(0), "no arbitrator");',
  '    require(!this.tasks[id].disputed, "already disputed");',
  '    this.tasks[id].disputed = true;',
  '    if (msg.sender == this.tasks[id].roles.creator) {',
  '      IPanel(this.panel).challenge(this.tasks[id].escrow);',
  '    }',
  '    publishNote(id, Note(11, abi.encodePacked(msg.sender), bytes.concat(key, content), 0));',
  '  }',
  '}',
].join('\n');

/** The 1-based line of the first source line containing `needle`, searching from the line containing `after`. */
function lineOf(needle: string, after = 'pragma'): number {
  const lines = SOURCE.split('\n');
  const start = lines.findIndex((line) => line.includes(after));
  return lines.findIndex((line, index) => index >= start && line.includes(needle)) + 1;
}

/** Where the escrow's and the dispute contract's own refusals are reported: their entries' lines. */
const REFUND_LINE = lineOf('function refund(', 'contract Vault');
const CHALLENGE_LINE = lineOf('function challenge(', 'contract Panel');
/** Where the allowlist update's failing read of the task array is reported: its own line or its modifier's. */
const ALLOWED_READ_LINES = [lineOf('function setAllowed('), lineOf('"not creator"')];

/**
 * The hop's refusal of an allowlist loop whose body also makes the store call: the hop plans the loop's write, and
 * the artifact publishes no segment for it (no write fact, pinned first), so it cannot be placed beside the calls.
 * Owner: the SDK hop (`proxy/deploy.ts`, `resolvedWriteSegment`), the call-in-loop shape handed to the ladder stream.
 */
function unplacedLoopWrite(entry: string): string {
  return `the implementation's "${entry}" entry writes a mapping record beside an external call, and the segment `
    + 'that write lands in is not fixed by the entry\'s own source, so the hop cannot declare it';
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledRun: ArtifactMap | undefined;
/** The contracts, compiled once and only when the file runs. */
function compiled(): ArtifactMap {
  compiledRun ??= compileStringMulti(SOURCE, { composition: 'per-call' });
  return compiledRun;
}

/** Every artifact a frame of a hop runs, for the refusal reporter. */
function everyArtifact(): readonly Artifact[] {
  const { Desk, Journal, Vault, Panel } = compiled();
  return [buildProxyArtifact(Desk!), Desk!, buildProxyArtifact(Journal!), Journal!, Vault!, Panel!];
}

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const CREATOR: Caller = { lock: ALICE_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };
const WORKER: Caller = { lock: BOB_LOCK, funder: new SignatureTemplate(bobPriv).unlockP2PKH() };
const ARBITER: Caller = { lock: CAROL_LOCK, funder: new SignatureTemplate(carolPriv).unlockP2PKH() };

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One deployment with one posted task, and the coins its hops are entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly desk: { readonly proxy: string; readonly implementation: string };
  readonly journal: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result, or its error with the last draft built and the stalls the settle caught. */
interface Outcome {
  readonly result?: PerCallProxyCallResult;
  readonly error?: Error;
  readonly draft?: composer.CompositionDraft;
  readonly stalls: readonly string[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one entry of the store or the root through its proxy, and returns what it left. */
async function enter(
  world: World, contract: 'Desk' | 'Journal', functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<Outcome> {
  const artifact = compiled()[contract]!;
  const ids = contract === 'Desk' ? world.desk : world.journal;
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(caller.lock), coin);
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: ids.proxy,
      implementationCategoryId: ids.implementation,
      functionName,
      args,
      ...(contract === 'Desk' ? { externals: world.externals } : {}),
      callerUtxo: coin,
      callerLockingBytecode: caller.lock,
      funder: caller.funder,
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
  const live = await world.network.getUtxosForLockingBytecode(caller.lock);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    ...(last?.type === 'return' ? { draft: last.value.draft } : {}),
    stalls,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** The hop settled: every verdict accepted and the transaction broadcast. */
function expectSettled(outcome: Outcome): PerCallProxyCallResult {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  return outcome.result!;
}

/** The hop was refused before anything was broadcast, with `message` in its words. */
function expectRefused(outcome: Outcome, message: string): Error {
  expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
  expect(outcome.error!.message).toContain(message);
  expect(outcome.coinLive).toBe(true);
  return outcome.error!;
}

/** The report the shipped reporter gives for the last draft of a refused hop. */
function reportOf(outcome: Outcome): composer.CompositionRefusal {
  return composer.reportCompositionRefusal({ draft: outcome.draft!, artifacts: everyArtifact(), vm: compositionMachine() });
}

/** The words a refusal of the root's entry `entry` carries for its own frame at `line`. */
function entryRefusal(entry: string, line: number, reason: string): string {
  return `the implementation's "${entry}" entry did not settle through the proxy: frame "implementation-master" of `
    + `Desk.${entry}() at line ${line}: ${reason} (Program failed an OP_VERIFY operation.)`;
}

/**
 * The line a refusal of the root's entry names for a check of the entry's own emitted code, which carries no source
 * message. It is the line the outlined code holding the check is attributed to, which moves with the program's
 * layout, so the caller bounds it rather than fixing it.
 */
function unnamedRefusalLine(outcome: Outcome, entry: string): number {
  const error = expectRefused(outcome, `the implementation's "${entry}" entry did not settle through the proxy: `
    + `frame "implementation-master" of Desk.${entry}() at line `);
  const line = /at line (\d+): no source message \(Program failed an OP_VERIFY operation\.\)/.exec(error.message);
  expect(line).not.toBeNull();
  return Number(line![1]);
}

/** The words a refusal of a callee frame carries. */
function calleeRefusal(callee: string, master: string, line: number, reason: string): string {
  return `the call's callee "${callee}()" did not settle through the proxy: frame "${master}" of ${callee}() at line `
    + `${line}: ${reason} (Program failed an OP_VERIFY operation.)`;
}

/** The published facts of one root entry: its call sites with their occurrence, its reads and its write facts. */
function publishedFacts(functionName: string): Record<string, unknown> {
  const desk = compiled().Desk!;
  const row = desk.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls?: readonly { interfaceName: string; functionName: string; occurrence?: string }[];
    readonly dynamicReads?: readonly string[];
    readonly dynamicWrites?: readonly string[];
  };
  const stops = (desk.composition as unknown as {
    readonly stopSites: { readonly entries: readonly { functionName: string; writeSegments?: unknown }[] };
  }).stopSites.entries.find((entry) => entry.functionName === `Desk.${functionName}()`);
  return {
    calls: (row.externalCalls ?? []).map((call) => `${call.interfaceName}.${call.functionName}@${call.occurrence}`),
    reads: row.dynamicReads ?? [],
    writes: row.dynamicWrites ?? [],
    writeFacts: stops?.writeSegments,
  };
}

/** A note the store emitted: its task id, its kind and its data bytes. */
interface Posted { readonly id: bigint; readonly kind: bigint; readonly data: string }

/** The notes the store emitted in a settled hop: its outputs whose commitment decodes exactly as the event's payload. */
function postedNotes(world: World, result: PerCallProxyCallResult): Posted[] {
  const journal = compiled().Journal!;
  const [idType, noteType] = journal.events![0]!.parameters.map((parameter) => parameter.type);
  const structs = journal.structs ?? journal.stateLayout?.structs;
  const posted: Posted[] = [];
  for (const output of result.transaction.outputs) {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || binToHex(output.token!.category) !== world.journal.proxy) continue;
    try {
      const id = decodePushdataValue(commitment, 0, idType!, structs);
      const note = decodePushdataValue(commitment, id.bytesConsumed, noteType!, structs);
      if (id.bytesConsumed + note.bytesConsumed !== commitment.length) continue;
      const fields = note.value as Record<string, StateValue>;
      posted.push({
        id: BigInt(id.value as bigint), kind: BigInt(fields.kind as bigint), data: binToHex(fields.data as Uint8Array),
      });
    } catch {
      // A record or node of the store's own category, which is not an event payload.
    }
  }
  return posted;
}

/** The root proxy's task array as its records hold it, parsed with the shipped decoder. */
async function tasksOf(world: World): Promise<readonly Record<string, unknown>[]> {
  const layout = buildProxyArtifact(compiled().Desk!).stateLayout!;
  const pools = await readPerCallDeployment(world.network, world.desk.proxy, layout);
  return deploymentStateValues(layout, world.desk.proxy, pools).tasks as readonly Record<string, unknown>[];
}

/**
 * Deploys the escrow and the dispute contract plain with `escrows` escrows, then the store and the root behind
 * generated proxies; registers the creator and the worker as members and the arbiter, opens the task with the
 * arbiter named and the allowlist gated, and grants the worker. Every setup hop settles and broadcasts.
 */
async function deployWorld(escrows: bigint): Promise<World> {
  const { Journal, Desk, Vault, Panel } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0x60;
  const nextCoin = (): Utxo => {
    serial += 1;
    return funding(category(serial.toString(16)));
  };

  for (const [artifact, id] of [[Vault!, VAULT_CATEGORY], [Panel!, PANEL_CATEGORY]] as const) {
    await network.addUtxo(wallet.address, funding(id));
    await deployStatefulContract(artifact, [escrows], {
      fundingUtxo: funding(id), funder, changeAddress, provider: network,
    });
  }
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);

  // The store gates on the root proxy's address, which its category fixes before the root is deployed.
  const journalInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), journalInit);
  const journal = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Journal!,
    proxyArtifact: buildProxyArtifact(Journal!),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: journalInit, funder: CREATOR.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(journal.initialize.broadcast).toBeDefined();
  const deskInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), deskInit);
  const desk = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress },
    initialize: {
      functionName: 'initialize', args: [journal.proxy.address, addressOf(VAULT_CATEGORY), addressOf(PANEL_CATEGORY)],
    },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: deskInit, funder: CREATOR.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  expect(binToHex(desk.proxy.address)).toBe(binToHex(addressOf(DESK_PROXY_CATEGORY)));

  const world: World = {
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
      IVault: { artifact: Vault!, categoryId: VAULT_CATEGORY },
      IPanel: { artifact: Panel!, categoryId: PANEL_CATEGORY },
    },
    changeAddress,
    nextCoin,
  };
  const key = (lead: number): Uint8Array => Uint8Array.from({ length: 33 }, (_unused, index) => (lead + index * 7) % 251);
  const avatar = 'https://example.com/avatar';
  expectSettled(await enter(world, 'Journal', 'join', [key(2), 'TestUser', 'TestBio', avatar], CREATOR));
  expectSettled(await enter(world, 'Journal', 'join', [key(3), 'TestUser', 'TestBio', avatar], WORKER));
  expectSettled(await enter(world, 'Journal', 'enlist', [key(4), 'TestArbitrator', 'TestBio', avatar, 100n], ARBITER));
  expectSettled(await enter(world, 'Desk', 'open', [TITLE, 100n, CAROL_LOCK, true], CREATOR));
  expectSettled(await enter(world, 'Desk', 'grant', [TASK, BOB_LOCK], CREATOR));
  return world;
}

const OBJECTION = [new Uint8Array(32), new TextEncoder().encode('Objection!')] as const;

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead (L4): thread messages, allowlists and refusals', () => {
  it('compiles every entry with the call sites, occurrences, reads and write facts the fixture publishes', () => {
    for (const artifact of Object.values(compiled())) {
      if (artifact.composition === undefined) continue;
      expect((artifact.composition as { refusedEntries?: unknown[] }).refusedEntries ?? []).toStrictEqual([]);
    }
    // As `postThreadMessage`: reads the task array, writes nothing of its own.
    expect(publishedFacts('message')).toStrictEqual({
      calls: ['IJournal.isMember@conditional', 'IJournal.isMember@conditional', 'IJournal.publish@once'],
      reads: ['tasks'], writes: [], writeFacts: [],
    });
    // As `updateJobWhitelist`: reads the task array, and its loop upsert publishes no write fact.
    expect(publishedFacts('setAllowed')).toStrictEqual({
      calls: ['IJournal.publish@loop', 'IJournal.publish@loop'], reads: ['tasks'], writes: [], writeFacts: undefined,
    });
    // As `refuseArbitration` and `dispute`: the escrow and dispute calls are conditional, the task written last.
    const lastWrites = [{ record: 1, segment: 'last' }, { variable: 'tasks', segment: 'last' }];
    expect(publishedFacts('refuse')).toStrictEqual({
      calls: ['IJournal.refused@once', 'IJournal.publish@once', 'IVault.refund@conditional',
        'IJournal.publish@conditional'],
      reads: ['tasks'], writes: ['tasks'], writeFacts: lastWrites,
    });
    expect(publishedFacts('dispute')).toStrictEqual({
      calls: ['IPanel.challenge@conditional', 'IJournal.publish@once'], reads: ['tasks'], writes: ['tasks'],
      writeFacts: lastWrites,
    });
  });

  describe('beside an escrow and a dispute contract that hold no escrow', () => {
    let world: World;
    it('setup: the store registrations, the task and its allowlist entry settle and broadcast', async () => {
      world = await deployWorld(0n);
    }, 600_000);

    it('posting with an allowlist (20) stops in its frame: the loop\'s key is planned at the task before the push',
      async () => {
        const outcome = await enter(world, 'Desk', 'post', [TITLE, 100n, CAROL_LOCK, [BOB_LOCK]], CREATOR);
        // The store reads' `true` reaches the root (PW8), the two notes no longer stop the plan (547db26d7), and the
        // loop's write is planned (225b23731), its fixed key `tasks.length - 1` read from the records before the
        // transaction: the plan spends the node `grant` wrote for task 0, where the body pushes task 1 and writes
        // there. Owner: the SDK hop's loop plan (`proxy/entry-writes.ts`, `planHopLoopBatch`, keys from
        // `call/entry-records.ts`, `planCallLoopWrites`, over the live state).
        const line = unnamedRefusalLine(outcome, 'post');
        expect(line).toBeGreaterThanOrEqual(lineOf('function post('));
        expect(line).toBeLessThan(lineOf('function open('));
        const draft = outcome.draft!;
        expect(draft.blockOf('implementation-master').calls.slice(0, 2).map((call) => binToHex(call.result)))
          .toStrictEqual(['51', '51']);
        const planned = (id: Uint8Array): boolean => draft.layout.participants
          .some((placed) => placed.id === `mapping-node-${binToHex(keyToSlotMulti([id, BOB_LOCK]))}`);
        expect([planned(new Uint8Array(0)), planned(Uint8Array.of(1))]).toStrictEqual([true, false]);
      }, 300_000);

    it('posting without an allowlist (18) stops at its push, its loop running no turn', async () => {
      const outcome = await enter(world, 'Desk', 'post', [TITLE, 100n, CAROL_LOCK, []], CREATOR);
      // The store reads' `true` reaches the root and the frame declares the records `postUnlisted` declares, which
      // settles below; `post`'s block layout also publishes the loop's conditional entry slot, which a plan with no
      // turn leaves unstated, and the frame fails an unnamed check at its push. Owner: the SDK hop's loop plan
      // (`proxy/entry-writes.ts`, `planHopLoopBatch`) beside the compiler's conditional loop slot.
      const line = unnamedRefusalLine(outcome, 'post');
      expect(line).toBeGreaterThanOrEqual(lineOf('function post('));
      expect(line).toBeLessThan(lineOf('function open('));
      const draft = outcome.draft!;
      const byIndex = new Map(draft.layout.participants.map((placed) => [placed.index, placed.id]));
      expect(draft.blockOf('implementation-master').segments[0]!.map((entry) => byIndex.get(entry.in)))
        .toStrictEqual(['proxy-record-0', 'proxy-record-1', 'dynamic-chunk-tasks-0']);
      expect(compiled().Desk!.abi.find((entry) => entry.name === 'post')!.blockLayout!.slots.at(-1))
        .toStrictEqual({ kind: 'entry', offset: 3, slotIndex: 0, conditional: true });
    }, 300_000);

    it('a thread message from the creator (47) stops at its first read of the task array', async () => {
      const outcome = await enter(world, 'Desk', 'message', [TASK, HASH, BOB_LOCK], CREATOR);
      // The entry only reads the array, and the hop lays a dynamic value's chunk records only for an entry that
      // writes it, so no chunk of `tasks` is spent. Owner: the SDK hop (`proxy/entry-writes.ts`, `hopEntryWrites`
      // lays runs from `dynamicWrites`; nothing under proxy/ reads `dynamicReads`).
      expect([lineOf('function message('), lineOf('"job closed"')]).toContain(unnamedRefusalLine(outcome, 'message'));
      expect(outcome.draft!.layout.participants.some((placed) => placed.id.startsWith('dynamic-chunk-tasks-')))
        .toBe(false);
      expect(outcome.stalls).toStrictEqual([
        'PER_CALL_DERIVATION_STALLED: master "implementation-master" of Desk.message() filled no witness at site 2 '
        + '(call 1)',
      ]);
    }, 300_000);

    it('a thread message from the allowlisted worker (47) stops at the same read', async () => {
      const outcome = await enter(world, 'Desk', 'message', [TASK, HASH, ALICE_LOCK], WORKER);
      // Owner: the SDK hop, as the creator's message.
      expect([lineOf('function message('), lineOf('"job closed"')]).toContain(unnamedRefusalLine(outcome, 'message'));
      expect(outcome.draft!.layout.participants.some((placed) => placed.id.startsWith('dynamic-chunk-tasks-')))
        .toBe(false);
    }, 300_000);

    it('with the task read stepped around, the creator\'s message settles and the store posts its note', async () => {
      const settled = expectSettled(await enter(world, 'Desk', 'greet', [TASK, HASH, BOB_LOCK], CREATOR));
      // The generated fallback returns its delegate's bytes (PW8), so the store's `true` is the entry's call result.
      expect(binToHex(settled.draft.blockOf('implementation-master').calls[0]!.result)).toBe('51');
      expect(settled.completed.map((frame) => frame.functionName)).toStrictEqual([
        'Journal.isMember()', 'JournalProxy.__fallback()', 'Journal.publish()', 'JournalProxy.__fallback()',
        'Desk.greet()', 'DeskProxy.__fallback()',
      ]);
      expect(postedNotes(world, settled)).toStrictEqual([
        { id: TASK, kind: 18n, data: `${binToHex(HASH)}${binToHex(BOB_LOCK)}` },
      ]);
    }, 300_000);

    it('an allowlist update from a non-creator (30) is refused for its loop write, before "not creator"', async () => {
      const outcome = await enter(world, 'Desk', 'setAllowed', [TASK, [BOB_LOCK], []], WORKER);
      // Refused before anything is derived, so the task read it stopped at before is not reached. Owner: the SDK hop,
      // as `unplacedLoopWrite` names.
      expectRefused(outcome, unplacedLoopWrite('setAllowed'));
      expect(outcome.draft).toBeUndefined();
    }, 300_000);

    it('an allowlist update adding a worker (20, 30) is refused the same way', async () => {
      const outcome = await enter(world, 'Desk', 'setAllowed', [TASK, [ALICE_LOCK], []], CREATOR);
      // Owner: the SDK hop, as above. The loop's call site is no longer reached.
      expectRefused(outcome, unplacedLoopWrite('setAllowed'));
      expect(outcome.stalls).toStrictEqual([]);
    }, 300_000);

    it('with the task read stepped around, the allowlist loop is refused the same way', async () => {
      const outcome = await enter(world, 'Desk', 'setAllowedOnly', [TASK, [ALICE_LOCK], []], CREATOR);
      // The upsert the body's own code refused (PW3's wall) is planned by the hop now, and refused where it lands
      // beside the loop's store calls. Owner: the SDK hop, as above.
      expectRefused(outcome, unplacedLoopWrite('setAllowedOnly'));
      expect(outcome.draft).toBeUndefined();
    }, 300_000);

    it('a refusal from a non-arbiter (64) reports the escrow\'s revert, not its own "not arbitrator"', async () => {
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], CREATOR);
      // The two note reaches no longer stop the plan, so `refuse` meets `refuseOnce`'s wall: the refund arm is planned
      // and settled first, and the escrow refuses escrow 0. Owner: the SDK hop (`proxy/external-calls.ts`,
      // `occurrenceCountOf`; `deploy.ts`, `settleCallees` first).
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
      expect(outcome.stalls).toStrictEqual([]);
      expect(reportOf(outcome).refusals.find((refusal) => refusal.master === 'implementation-master')?.reason)
        .toStrictEqual({ line: lineOf('"not arbitrator"'), message: 'not arbitrator' });
    }, 300_000);

    it('the arbiter\'s refusal of an open task (64) reports the same', async () => {
      // Owner: the SDK hop, as above.
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], ARBITER);
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
      expect(reportOf(outcome).innermost?.master).toBe('callee-master-5');
    }, 300_000);

    it('with the arm\'s note stepped around, a non-arbiter\'s refusal (64) reports the escrow\'s revert', async () => {
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], CREATOR);
      // The escrow call sits in an arm the execution skips, but its condition reads the array the entry rewrites,
      // so the planner states it; the callees settle before the entry is derived, and the escrow refuses escrow 0.
      // Owner: the SDK hop (`proxy/external-calls.ts`, `occurrenceCountOf`; `deploy.ts`, `settleCallees` first).
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
      expect(outcome.stalls).toStrictEqual([]);
    }, 300_000);

    it('with the arm\'s note stepped around, the arbiter\'s refusal of an open task (64) reports the same', async () => {
      // Owner: the SDK hop, as above.
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], ARBITER);
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
    }, 300_000);

    it('closing the task settles', async () => {
      const closed = expectSettled(await enter(world, 'Desk', 'close', [TASK], CREATOR));
      // An entry that also writes the array spends its chunk, which is the read the others are refused.
      expect(closed.draft.layout.participants.some((placed) => placed.id === 'dynamic-chunk-tasks-0')).toBe(true);
    }, 600_000);

    it('the arbiter\'s refusal of a closed task (63) reports the escrow\'s revert', async () => {
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], ARBITER);
      // Owner: the SDK hop, as above. The entry's own reason is in the report, below the callee's.
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
      const report = reportOf(outcome);
      expect(report.innermost?.master).toBe('callee-master-5');
      expect(report.refusals.find((refusal) => refusal.master === 'implementation-master')?.reason).toStrictEqual({
        line: lineOf('"job in invalid state"', 'function refuse('), message: 'job in invalid state',
      });
    }, 300_000);

    it('with the arm\'s note stepped around, the refusal of a closed task (63) reports the escrow\'s revert', async () => {
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], ARBITER);
      // Owner: the SDK hop, as above. The entry's own reason is in the report, below the callee's.
      expectRefused(outcome, calleeRefusal('Vault.refund', 'callee-master-5', REFUND_LINE, 'no escrow'));
      const report = reportOf(outcome);
      expect(report.innermost?.master).toBe('callee-master-5');
      expect(report.refusals.find((refusal) => refusal.master === 'implementation-master')?.reason).toStrictEqual({
        line: lineOf('"job in invalid state"', 'function refuseOnce('), message: 'job in invalid state',
      });
    }, 300_000);

    it('the creator\'s dispute of a closed task (56) reports the dispute contract\'s revert', async () => {
      const outcome = await enter(world, 'Desk', 'dispute', [TASK, ...OBJECTION], CREATOR);
      // The challenge's condition holds for the creator, so it is planned and settled before the entry, whose own
      // check fails before the call. Owner: the SDK hop settle order (`deploy.ts`, `settleCallees`).
      expectRefused(outcome, calleeRefusal('Panel.challenge', 'callee-master-1', CHALLENGE_LINE, 'no escrow'));
      const report = reportOf(outcome);
      expect(report.innermost?.master).toBe('callee-master-1');
      expect(report.refusals.find((refusal) => refusal.master === 'implementation-master')?.reason).toStrictEqual({
        line: lineOf('"job in invalid state"', 'function dispute('), message: 'job in invalid state',
      });
    }, 300_000);

    it('an allowlist update of a closed task (30) stops at the task read, before its own "not open"', async () => {
      const outcome = await enter(world, 'Desk', 'setAllowed', [TASK, [], []], CREATOR);
      // Empty lists run no turn and plan no call, so the loop write is placed and the read `onlyCreator` makes of
      // the array the entry never writes fails first. Owner: the SDK hop, as the thread message.
      expect(ALLOWED_READ_LINES).toContain(unnamedRefusalLine(outcome, 'setAllowed'));
    }, 300_000);

    it('with the allowlist loop stepped around, posting (18) settles and stores the task', async () => {
      // Run last: it appends a second task. The store reads' `true` reaches the root (PW8).
      const settled = expectSettled(await enter(world, 'Desk', 'postUnlisted', [TITLE, 100n, CAROL_LOCK], CREATOR));
      expect(settled.draft.blockOf('implementation-master').calls.map((call) => binToHex(call.result)))
        .toStrictEqual(['51', '51', '']);
      const tasks = await tasksOf(world);
      expect(tasks).toHaveLength(2);
      const task = tasks[1]!;
      const roles = task.roles as Readonly<Record<string, Uint8Array>>;
      expect([task.state, task.gated, task.title, task.amount]).toStrictEqual([0n, false, TITLE, 100n]);
      expect([binToHex(roles.creator!), binToHex(roles.arbiter!)])
        .toStrictEqual([binToHex(ALICE_LOCK), binToHex(CAROL_LOCK)]);
      expect(postedNotes(world, settled)).toStrictEqual([{ id: 1n, kind: 0n, data: binToHex(utf8ToBin(TITLE)) }]);
    }, 300_000);
  });

  describe('beside an escrow and a dispute contract that accept escrow 0 (the callee revert stepped around)', () => {
    let world: World;
    it('setup: the store registrations, the task and its allowlist entry settle and broadcast', async () => {
      world = await deployWorld(1n);
    }, 600_000);

    it('with the arm\'s note stepped around, a non-arbiter\'s refusal (64) reports its own reason', async () => {
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], CREATOR);
      expectRefused(outcome, entryRefusal('refuseOnce', lineOf('"not arbitrator"'), 'not arbitrator'));
    }, 300_000);

    it('a non-arbiter\'s refusal (64) reports its own reason, as its stepped-around form does', async () => {
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], CREATOR);
      expectRefused(outcome, entryRefusal('refuse', lineOf('"not arbitrator"'), 'not arbitrator'));
    }, 300_000);

    it('with the arm\'s note stepped around, the arbiter\'s refusal of an open task (64) stops at call 1', async () => {
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], ARBITER);
      // Every callee settles, the escrow's too, and the entry is refused after its first call with no source message
      // while the plan still states the skipped escrow call as its third record. Owner: the SDK hop.
      const line = unnamedRefusalLine(outcome, 'refuseOnce');
      expect(line).toBeGreaterThanOrEqual(lineOf('function refuseOnce('));
      expect(line).toBeLessThan(lineOf('function dispute('));
      expect(outcome.stalls.at(-1)).toBe('PER_CALL_DERIVATION_STALLED: master "implementation-master" of '
        + 'Desk.refuseOnce() filled no witness at site 1 (call 1)');
      const calls = outcome.draft!.blockOf('implementation-master').calls;
      expect(calls.map((call) => call.calleeRef === composer.UNFILLED_CALLEE_REF)).toStrictEqual([false, false, true]);
    }, 300_000);

    it('the arbiter\'s refusal of an open task (64) stops at call 1 the same way', async () => {
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], ARBITER);
      // As above, with both of the skipped arm's calls stated as the third and fourth records. Owner: the SDK hop.
      const line = unnamedRefusalLine(outcome, 'refuse');
      expect(line).toBeGreaterThanOrEqual(lineOf('function refuse('));
      expect(line).toBeLessThan(lineOf('function refuseOnce('));
      expect(outcome.stalls.at(-1)).toBe('PER_CALL_DERIVATION_STALLED: master "implementation-master" of '
        + 'Desk.refuse() filled no witness at site 1 (call 1)');
      const calls = outcome.draft!.blockOf('implementation-master').calls;
      expect(calls.map((call) => call.calleeRef === composer.UNFILLED_CALLEE_REF))
        .toStrictEqual([false, false, true, true]);
    }, 300_000);

    it('closing the task settles', async () => {
      expectSettled(await enter(world, 'Desk', 'close', [TASK], CREATOR));
    }, 600_000);

    it('with the arm\'s note stepped around, the refusal of a closed task (63) reports its own reason', async () => {
      const outcome = await enter(world, 'Desk', 'refuseOnce', [TASK], ARBITER);
      expectRefused(outcome, entryRefusal('refuseOnce', lineOf('"job in invalid state"', 'function refuseOnce('),
        'job in invalid state'));
    }, 300_000);

    it('the refusal of a closed task (63) reports its own reason', async () => {
      const outcome = await enter(world, 'Desk', 'refuse', [TASK], ARBITER);
      expectRefused(outcome, entryRefusal('refuse', lineOf('"job in invalid state"', 'function refuse('),
        'job in invalid state'));
    }, 300_000);

    it('the creator\'s dispute of a closed task (56) reports its own "job in invalid state"', async () => {
      const outcome = await enter(world, 'Desk', 'dispute', [TASK, ...OBJECTION], CREATOR);
      expectRefused(outcome, entryRefusal('dispute', lineOf('"job in invalid state"', 'function dispute('),
        'job in invalid state'));
    }, 300_000);
  });
});
