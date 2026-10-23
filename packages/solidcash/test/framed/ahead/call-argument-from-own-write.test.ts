import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { decodePushdataValue, validatorAddress, type StateValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import * as composer from '../../../src/framed/composer/index.js';
import * as resolution from '../../../src/framed/proxy/call-resolution.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: a store call whose argument reads a value the entry wrote earlier in the same entry, through the
 * shipped hop (`callFramedProxyEntry`).
 *
 * The post (18, 20) writes `jobPost.whitelistWorkers` through a storage pointer and then publishes its event with
 * `abi.encodePacked(jobPost.whitelistWorkers)`. `Desk` (a proxied root) replays that on a task array and calls the
 * proxied store `Journal`, which pushes the note and emits it. A struct field written earlier is forwarded by the
 * compiler to the value written, so the plan states it and the store keeps the right bytes: both gates settle, so
 * this is not the post's wall (`job-threads-and-refusals.test.ts` pins those). A plain state variable written
 * earlier is forwarded the same way, to the value its write leaves, so the plan states the gate or the key the entry
 * wrote and the store keeps it, whatever the deployment held. A packed `int` the compiler publishes without a width
 * is refused, beside its typed controls. The file runs only under `FRAMED_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9';
  return `${seed}${base}${base}`.slice(0, 64);
}

const JOURNAL_IMPL_CATEGORY = category('1a');
const JOURNAL_PROXY_CATEGORY = category('2b');
const DESK_IMPL_CATEGORY = category('3c');
const DESK_PROXY_CATEGORY = category('4d');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const TITLE = 'Create a marketplace in solidity';

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'struct Note { uint8 kind; bytes who; bytes data; uint32 at; }',
  'struct Roles { address creator; address arbiter; address worker; }',
  'struct Task { int state; bool gated; Roles roles; string title; int amount; int owed; int escrow; bool disputed; }',
  'interface IJournal {',
  '  function publish(int id, Note note);',
  '}',
  'contract Journal {',
  '  address public implementation;',
  '  address public desk;',
  '  address public owner;',
  '  bool public paused;',
  '  mapping(int => Note[]) notes;',
  '  event Posted(int indexed id, Note note);',
  '  modifier onlyDesk() { require(msg.sender == this.desk, "not desk"); _; }',
  '  function initialize(address hub) { this.desk = hub; this.owner = msg.sender; require(true); }',
  '  function publish(int id, Note note) onlyDesk {',
  '    Note e = note;',
  '    e.at = uint32(block.timestamp);',
  '    this.notes[id].push(e);',
  '    emit Posted(id, e);',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public journal;',
  '  int public count;',
  '  bool public flag;',
  '  Task[] tasks;',
  '  function initialize(address j) { this.journal = j; require(true); }',
  '  function publishNote(int id, Note n) internal { IJournal(this.journal).publish(id, n); }',
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
  '  function openConcat(string title, int amount, address[] allowed) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].gated = allowed.length > 0;',
  '    this.tasks[id].roles.creator = msg.sender;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = amount;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender),',
  '      bytes.concat(bytes(title), abi.encodePacked(this.tasks[id].gated)), 0));',
  '  }',
  '  function openPointer(string title, address[] allowed) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    Task storage t = this.tasks[id];',
  '    t.gated = allowed.length > 0;',
  '    t.title = title;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), bytes.concat(bytes(title), abi.encodePacked(t.gated)), 0));',
  '  }',
  '  function setFlag(bool v) { this.flag = v; }',
  '  function openFlag(string title, bool gated) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    this.flag = gated;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), bytes.concat(bytes(title), abi.encodePacked(this.flag)), 0));',
  '  }',
  '  function openCountId(string title, int amount) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    this.count = amount;',
  '    publishNote(this.count, Note(0, abi.encodePacked(msg.sender), bytes(title), 0));',
  '  }',
  '  function openParam(string title, int amount) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), abi.encodePacked(amount), 0));',
  '  }',
  '  function openLocalCast(string title, int amount) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    int doubled = amount * 2;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), abi.encodePacked(int256(doubled)), 0));',
  '  }',
  '  function openLocal(string title, int amount) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    int doubled = amount * 2;',
  '    publishNote(id, Note(0, abi.encodePacked(msg.sender), abi.encodePacked(doubled), 0));',
  '  }',
  '}',
].join('\n');

/** The post's own event construction (MarketplaceV1.publishJobPost), in the fixture's Solidity spelling. */
const POST_SOURCE = 'pragma solidity ^0.8.20;'
  + ' struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }'
  + ' interface IData { function publishJobEvent(uint256 jobId, JobEventData memory event_) external; }'
  + ' contract Post {'
  + '   struct JobPost { bool whitelistWorkers; address creator; string title; uint32 timestamp; }'
  + '   JobPost[] jobs;'
  + '   IData data;'
  + '   function publishJobEvent(uint256 jobId_, JobEventData memory event_) internal {'
  + '     data.publishJobEvent(jobId_, event_);'
  + '   }'
  + '   function publishJobPost(string calldata title_, address[] calldata allowedWorkers_) public returns (uint256) {'
  + '     jobs.push();'
  + '     uint256 jobId = jobs.length - 1;'
  + '     JobPost storage jobPost = jobs[jobId];'
  + '     jobPost.whitelistWorkers = allowedWorkers_.length > 0;'
  + '     jobPost.creator = msg.sender;'
  + '     jobPost.title = title_;'
  + '     jobPost.timestamp = uint32(block.timestamp);'
  + '     publishJobEvent(jobId, JobEventData({ type_: 0, address_: abi.encodePacked(msg.sender),'
  + '       data_: bytes.concat(bytes(title_), abi.encodePacked(jobPost.whitelistWorkers)), timestamp_: 0 }));'
  + '     return jobId;'
  + '   }'
  + ' }';

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledRun: ArtifactMap | undefined;
/** The contracts, compiled once and only when the file runs. */
function compiled(): ArtifactMap {
  compiledRun ??= compileStringMulti(SOURCE, { composition: 'framed' });
  return compiledRun;
}

/** The argument sources one root entry publishes for its store call. */
function argumentSources(artifact: ArtifactMap[string], functionName: string): unknown {
  const row = artifact!.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls: readonly { readonly argSources: unknown }[];
  };
  expect(row.externalCalls.length).toBe(1);
  return row.externalCalls[0]!.argSources;
}

/** One published expression node, as far as these checks read it. */
interface Published { readonly args?: readonly unknown[]; readonly fields?: readonly string[] }

/** The published data argument of the note (or event) an entry's store call passes second. */
function noteData(artifact: ArtifactMap[string], functionName: string): Published {
  const sources = argumentSources(artifact, functionName) as { readonly expression: Published }[];
  return sources[1]!.expression.args![2] as Published;
}

/** The packed-bool part `allowed.length > 0` of a forwarded note, the array being parameter `index`. */
function forwardedGate(index: number): unknown {
  const array = { kind: 'source', source: { kind: 'forward', paramIndex: index } };
  return {
    kind: 'abiEncodePacked',
    args: [{
      kind: 'binary', operator: '>', type: 'bool',
      left: { kind: 'unary', operator: '.length', expression: array },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    }],
    fields: [''],
  };
}

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const CREATOR: Caller = { lock: ALICE_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One deployment of the store and the root, and the coins its hops are entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly desk: { readonly proxy: string; readonly implementation: string };
  readonly journal: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result or error, the stalls the settle caught, and the call arguments its plan stated. */
interface Outcome {
  readonly result?: FramedProxyCallResult;
  readonly error?: Error;
  readonly stalls: readonly string[];
  /** The argument values each planned call states, in parameter order. */
  readonly stated: readonly (readonly FunctionArgument[])[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one root entry through its proxy, and returns what it left. */
async function enter(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<Outcome> {
  const artifact = compiled().Desk!;
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(CREATOR.lock), coin);
  const derivations = vi.spyOn(composer, 'deriveComposition');
  const resolved = vi.spyOn(resolution, 'resolvePublishedCall');
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: world.desk.proxy,
      implementationCategoryId: world.desk.implementation,
      functionName,
      args,
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: CREATOR.lock,
      funder: CREATOR.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const stalls = derivations.mock.results.filter((entry) => entry.type === 'throw')
    .map((entry) => String((entry.value as Error).message));
  const stated = resolved.mock.results.filter((entry) => entry.type === 'return')
    .map((entry) => (entry.value as resolution.ResolvedCall).argumentValues);
  derivations.mockRestore();
  resolved.mockRestore();
  const live = await world.network.getUtxosForLockingBytecode(CREATOR.lock);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    stalls,
    stated,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** A stored note: the store's key and the note's data bytes, as the store emitted them. */
interface Stored { readonly id: bigint; readonly data: string }

/** The notes the store emitted in a settled hop: its outputs that decode exactly as the event's declared payload. */
function storedNotes(world: World, result: FramedProxyCallResult): Stored[] {
  const journal = compiled().Journal!;
  const [idType, noteType] = journal.events![0]!.parameters.map((parameter) => parameter.type);
  const structs = journal.structs ?? journal.stateLayout?.structs;
  const stored: Stored[] = [];
  for (const output of result.transaction.outputs) {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || binToHex(output.token!.category) !== world.journal.proxy) continue;
    try {
      const id = decodePushdataValue(commitment, 0, idType!, structs);
      const note = decodePushdataValue(commitment, id.bytesConsumed, noteType!, structs);
      if (id.bytesConsumed + note.bytesConsumed !== commitment.length) continue;
      const data = (note.value as Record<string, StateValue>).data as Uint8Array;
      stored.push({ id: BigInt(id.value as bigint), data: binToHex(data) });
    } catch {
      // A record or node of the store's own category, which is not an event payload.
    }
  }
  return stored;
}

/** The hop settled and broadcast, and the store emitted exactly `expected`. */
function expectStored(world: World, outcome: Outcome, expected: Stored): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  expect(storedNotes(world, outcome.result!)).toStrictEqual([expected]);
}

/**
 * The hop was refused before anything was broadcast: the entry's own frame failed its call record's argument digest,
 * a check with no source message reported at the entry's line, after the settle stalled on it.
 */
function expectDigestRefused(outcome: Outcome, entry: string): void {
  expect(outcome.error).toBeInstanceOf(FramedProxyDeployError);
  expect(outcome.error!.message).toBe(`the implementation's "${entry}" entry did not settle through the proxy: frame `
    + `"implementation-master" of Desk.${entry}() at line ${lineOf(`function ${entry}(`)}: no source message (Program `
    + 'failed an OP_VERIFY operation.)');
  expect(outcome.stalls).toStrictEqual([`FRAMED_DERIVATION_STALLED: master "implementation-master" of Desk.${entry}() `
    + 'filled no witness at site 1 (close of segment 0)']);
  expect(outcome.coinLive).toBe(true);
}

/** The data bytes of the note one planned call states. */
function statedData(outcome: Outcome): string {
  expect(outcome.stated.length).toBe(1);
  return binToHex((outcome.stated[0]![1] as unknown as FunctionArgument[])[2] as Uint8Array);
}

/** The title's bytes followed by one packed bool. */
const titleWith = (gate: boolean): string => `${binToHex(utf8ToBin(TITLE))}${gate ? '01' : '00'}`;

/** A packed `int256`: 33 bytes, little-endian, the width the body packs. */
const packedInt = (value: number): string => `${value.toString(16).padStart(2, '0')}${'00'.repeat(32)}`;

/** Deploys the store and the root behind generated proxies; the store gates its writes on the root's address. */
async function deployWorld(): Promise<World> {
  const { Journal, Desk } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0x70;
  const nextCoin = (): Utxo => {
    serial += 1;
    return funding(category(serial.toString(16)));
  };
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  const journalInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), journalInit);
  const journal = await deployFramedProxy({
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
  const desk = await deployFramedProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [journal.proxy.address] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: deskInit, funder: CREATOR.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  expect(binToHex(desk.proxy.address)).toBe(binToHex(addressOf(DESK_PROXY_CATEGORY)));
  return {
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
    },
    changeAddress,
    nextCoin,
  };
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: a call argument read from the entry\'s own write', () => {
  it('publishes a written struct field and a written state variable as the values written', () => {
    const { Desk } = compiled();
    expect(Desk!.composition!.refusedEntries ?? []).toStrictEqual([]);
    // The post's own spelling: the storage-pointer field is published as `allowedWorkers_.length > 0`.
    const post = compileStringMulti(POST_SOURCE, { composition: 'framed', evmCompat: true } as never);
    expect(noteData(post.Post, 'publishJobPost').args![1]).toStrictEqual(forwardedGate(1));
    expect(noteData(Desk, 'openConcat').args![1]).toStrictEqual(forwardedGate(2));
    expect(noteData(Desk, 'openPointer').args![1]).toStrictEqual(forwardedGate(1));
    // A plain state variable written earlier is published as the value written, the entry's own argument here.
    expect(noteData(Desk, 'openFlag').args![1]).toStrictEqual({
      kind: 'abiEncodePacked',
      args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 }, type: 'bool' }],
      fields: [''],
    });
    expect((argumentSources(Desk, 'openCountId') as unknown[])[0]).toStrictEqual({
      kind: 'expression', expression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 }, type: 'int256' },
    });
    // A computed `int` is published without a width; a cast carries one.
    expect(noteData(Desk, 'openLocal').fields).toStrictEqual(['']);
    expect(noteData(Desk, 'openLocalCast').fields).toStrictEqual(['int256']);
  });

  let world: World;
  it('setup: the store and the root deploy behind their proxies', async () => {
    world = await deployWorld();
  }, 600_000);

  it('a note built from parameters only, keyed by `length - 1` after the push, settles (control)', async () => {
    const outcome = await enter(world, 'open', [TITLE, 100n, BOB_LOCK, true]);
    expectStored(world, outcome, { id: 0n, data: binToHex(utf8ToBin(TITLE)) });
  }, 300_000);

  it('a packed `int256` parameter, and a computed one cast to `int256`, settle (controls)', async () => {
    expectStored(world, await enter(world, 'openParam', [TITLE, 21n]), { id: 1n, data: packedInt(21) });
    expectStored(world, await enter(world, 'openLocalCast', [TITLE, 21n]), { id: 2n, data: packedInt(42) });
  }, 600_000);

  it('the post\'s shape on the task array (20, 18) settles and stores the written gate', async () => {
    const gated = await enter(world, 'openConcat', [TITLE, 100n, [BOB_LOCK]]);
    expectStored(world, gated, { id: 3n, data: titleWith(true) });
    expect(statedData(gated)).toBe(titleWith(true));
    expectStored(world, await enter(world, 'openConcat', [TITLE, 100n, []]), { id: 4n, data: titleWith(false) });
  }, 600_000);

  it('the post\'s storage-pointer spelling (20, 18) settles and stores the written gate', async () => {
    expectStored(world, await enter(world, 'openPointer', [TITLE, [BOB_LOCK]]), { id: 5n, data: titleWith(true) });
    expectStored(world, await enter(world, 'openPointer', [TITLE, []]), { id: 6n, data: titleWith(false) });
  }, 600_000);

  it('a state variable written with the value it already held settles', async () => {
    // The plan states the `false` the entry wrote, which is also what the deployment held.
    const outcome = await enter(world, 'openFlag', [TITLE, false]);
    expectStored(world, outcome, { id: 7n, data: titleWith(false) });
    expect(statedData(outcome)).toBe(titleWith(false));
  }, 300_000);

  it('a state variable written with a new value settles: the plan states the value written', async () => {
    const outcome = await enter(world, 'openFlag', [TITLE, true]);
    expectStored(world, outcome, { id: 8n, data: titleWith(true) });
    expect(statedData(outcome)).toBe(titleWith(true));
  }, 300_000);

  it('with the variable set beforehand, changing it and writing it back unchanged both settle', async () => {
    const set = await enter(world, 'setFlag', [true]);
    expect(set.error).toBeUndefined();
    expect(set.coinLive).toBe(false);
    const changed = await enter(world, 'openFlag', [TITLE, false]);
    expectStored(world, changed, { id: 9n, data: titleWith(false) });
    expect(statedData(changed)).toBe(titleWith(false));
    const kept = await enter(world, 'openFlag', [TITLE, true]);
    expectStored(world, kept, { id: 10n, data: titleWith(true) });
  }, 600_000);

  it('a written state variable passed as the call\'s own argument follows the same rule', async () => {
    // The store key is `count`, which the deployment holds as 0: the note is keyed at the value the entry wrote.
    const kept = await enter(world, 'openCountId', [TITLE, 0n]);
    expectStored(world, kept, { id: 0n, data: binToHex(utf8ToBin(TITLE)) });
    const changed = await enter(world, 'openCountId', [TITLE, 7n]);
    expectStored(world, changed, { id: 7n, data: binToHex(utf8ToBin(TITLE)) });
    expect(changed.stated.map((values) => values[0])).toStrictEqual([7n]);
  }, 600_000);

  it('a packed `int` computed from a parameter is refused: the plan packs it at 32 bytes', async () => {
    const outcome = await enter(world, 'openLocal', [TITLE, 21n]);
    // The body packs `int256` at 33 bytes, as the settled controls store. Owner: the compiler publishes the
    // computed value without a width (`SymbolTableTraversal.serializeExpression`, `fields: ['']`), and the SDK's
    // evaluator packs an untyped number at 32 bytes (`stateful/sc-evaluate-external-expression.ts`, `asBytes`)
    // where the body packs `IntType.byteWidth` (`GenerateTargetTraversal.visitAbiEncodePacked`).
    expectDigestRefused(outcome, 'openLocal');
    expect(statedData(outcome)).toBe(packedInt(42).slice(0, 64));
  }, 300_000);
});
