import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import * as composer from '../../../src/framed/composer/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: a proxied root that reads the block clock beside its task array, through the shipped hop.
 *
 * Reading `block.timestamp` once gave a contract a register beside its own fields and the oracle owner's key in a
 * data NFT of its own after every other record, and the hop's delegate frame declared that record where an append's
 * body looks for the array's chunk run. The clock is now a slice of one shared oracle covenant the entry co-spends,
 * so it adds no field and no record. The frame declares the records the entry names, as a callee frame does, and
 * each shape below settles (the post's, with the fixture's clock stamp beside a store call; the append alone; an
 * isolated field of the source's own after the record the entry names; a record the entry does not name ahead of
 * one it does). The direct call path declares the entry's own records the same way.
 *
 * A second wall, reported beside it and now gone: a proxied store's `view` read whose value the root ignores enters
 * the store's proxy as a STATIC frame whose fallback forwards as a DELEGATE leg, which V10 refused; since PW10 the
 * validator admits that leg and the read settles, as its non-`view` control does. What that refusal also showed
 * stands untested here: the hop broadcasts without reading its own verdicts (`proxy/deploy.ts`,
 * `callFramedProxyEntry`), so a refused derivation reaches the network as a raw script failure.
 *
 * Each case is pinned where it stands today, beside a control that settles. The file runs only under
 * `FRAMED_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4';
  return `${seed}${base}${base}`.slice(0, 64);
}

const JOURNAL_IMPL_CATEGORY = category('2f');
const JOURNAL_PROXY_CATEGORY = category('30');
const DESK_IMPL_CATEGORY = category('41');
const DESK_PROXY_CATEGORY = category('52');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const TITLE = 'Create a marketplace in solidity';

/** The store the post publishes its note to, stamping the note with the clock as the fixture's data contract does. */
const JOURNAL_LINES = [
  'struct Note { uint8 kind; bytes who; bytes data; uint32 at; }',
  'interface IJournal { function publish(int id, Note note); }',
  'contract Journal {',
  '  address public implementation;',
  '  address public desk;',
  '  mapping(int => Note[]) notes;',
  '  event Posted(int indexed id, Note note);',
  '  function initialize(address hub) { this.desk = hub; require(true); }',
  '  function publish(int id, Note note) {',
  '    require(msg.sender == this.desk, "not desk");',
  '    Note e = note;',
  '    e.at = uint32(block.timestamp);',
  '    this.notes[id].push(e);',
  '    emit Posted(id, e);',
  '  }',
  '}',
];

/** The post's own writes, as the fixture's `publishJobPost` makes them, with or without its clock stamp. */
function postSource(clock: boolean): string {
  return [
    'pragma solidcash ^0.14.0;',
    ...JOURNAL_LINES,
    'struct Task { int state; bool gated; address creator; string title; int amount; uint32 at; }',
    'contract Desk {',
    '  address public implementation;',
    '  address public journal;',
    '  Task[] tasks;',
    '  function initialize(address j) { this.journal = j; require(true); }',
    '  function open(string title, int amount, bool gated) {',
    '    this.tasks.push();',
    '    int id = this.tasks.length - 1;',
    '    this.tasks[id].gated = gated;',
    '    this.tasks[id].creator = msg.sender;',
    '    this.tasks[id].title = title;',
    '    this.tasks[id].amount = amount;',
    ...(clock ? ['    this.tasks[id].at = uint32(block.timestamp);'] : []),
    '    IJournal(this.journal).publish(id, Note(0, abi.encodePacked(msg.sender), bytes(title), 0));',
    '  }',
    '}',
  ].join('\n');
}

/** The append alone, with the clock stamp, with an isolated field of its own instead, or with neither. */
function appendSource(extra: 'clock' | 'spare' | 'none'): string {
  return [
    'pragma solidcash ^0.14.0;',
    'struct Task { int state; address creator; string title; int amount; uint32 at; }',
    'contract Desk {',
    '  address public implementation;',
    '  Task[] tasks;',
    ...(extra === 'spare' ? ['  uint32 external spare;'] : []),
    '  function initialize() { require(true); }',
    '  function open(string title, int amount) {',
    '    this.tasks.push();',
    '    int id = this.tasks.length - 1;',
    '    this.tasks[id].creator = msg.sender;',
    '    this.tasks[id].title = title;',
    '    this.tasks[id].amount = amount;',
    ...(extra === 'clock' ? ['    this.tasks[id].at = uint32(block.timestamp);'] : []),
    '  }',
    '}',
  ].join('\n');
}

/** The clock stamped into a scalar of the record the entry names, with no run after the records. */
const CLOCK_ONLY_SOURCE = [
  'pragma solidcash ^0.14.0;',
  'contract Desk {',
  '  address public implementation;',
  '  uint32 stamp;',
  '  function initialize() { require(true); }',
  '  function open() { this.stamp = uint32(block.timestamp); }',
  '}',
].join('\n');

/** A counter in the second record: the first holds only addresses the entry never reads. */
const SECOND_RECORD_SOURCE = [
  'pragma solidcash ^0.14.0;',
  'contract Desk {',
  '  address public implementation;',
  '  address a;',
  '  address b;',
  '  address c;',
  '  int count;',
  '  function initialize() { require(true); }',
  '  function open() {',
  '    this.count = this.count + 1;',
  '  }',
  '}',
].join('\n');

/** A root that reads a proxied store's registration and ignores the answer; `view` makes the read a STATIC frame. */
function readSource(view: boolean): string {
  const isMember = `function isMember(address who)${view ? ' view' : ''} returns (bool)`;
  return [
    'pragma solidcash ^0.14.0;',
    'struct Member { address who; bytes key; string name; int up; }',
    `interface IJournal { ${isMember}; }`,
    'contract Journal {',
    '  address public implementation;',
    '  address public desk;',
    '  mapping(address => Member) members;',
    '  function initialize(address hub) { this.desk = hub; require(true); }',
    '  function join(bytes key, string name) {',
    '    require(this.members[msg.sender].key.length == 0, "already registered");',
    '    this.members[msg.sender] = Member(msg.sender, key, name, 0);',
    '  }',
    `  ${isMember} { return this.members[who].key.length > 0; }`,
    '}',
    'contract Desk {',
    '  address public implementation;',
    '  address public journal;',
    '  function initialize(address j) { this.journal = j; require(true); }',
    '  function peek(address who) { IJournal(this.journal).isMember(who); require(true); }',
    '}',
  ].join('\n');
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
const compiledRuns = new Map<string, ArtifactMap>();
/** A source's contracts, compiled once and only when a case runs. */
function compiled(source: string): ArtifactMap {
  let artifacts = compiledRuns.get(source);
  if (artifacts === undefined) {
    artifacts = compileStringMulti(source, { composition: 'framed' });
    compiledRuns.set(source, artifacts);
  }
  return artifacts;
}

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One mock chain with the deployer's wallet and the coins every genesis and hop is funded from. */
interface Chain {
  readonly network: MockNetworkProvider;
  readonly funder: Unlocker;
  readonly caller: Unlocker;
  readonly changeAddress: string;
  /** Hands out a fresh coin at the caller's lock, distinct from every category. */
  readonly nextCoin: () => Promise<Utxo>;
}

async function freshChain(): Promise<Chain> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  let serial = 0x60;
  const nextCoin = async (): Promise<Utxo> => {
    serial += 1;
    const coin = funding(category(serial.toString(16)));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return coin;
  };
  return {
    network, funder: wallet.unlock.spend(alicePub, signature), caller: signature.unlockP2PKH(),
    changeAddress: wallet.address, nextCoin,
  };
}

/** A contract deployed behind its generated proxy, and what a later hop into it names. */
interface Proxied {
  readonly artifact: Artifact;
  readonly proxy: string;
  readonly implementation: string;
  readonly address: Uint8Array;
}

async function deployProxied(
  chain: Chain, artifact: Artifact, ids: readonly [string, string], args: readonly FunctionArgument[],
): Promise<Proxied> {
  const deployment = await deployFramedProxy({
    provider: chain.network,
    implementationArtifact: artifact,
    proxyArtifact: buildProxyArtifact(artifact),
    implementationDeploy: { fundingUtxo: funding(ids[0]), funder: chain.funder, changeAddress: chain.changeAddress },
    proxyDeploy: { fundingUtxo: funding(ids[1]), funder: chain.funder, changeAddress: chain.changeAddress },
    initialize: { functionName: 'initialize', args: [...args] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: await chain.nextCoin(), funder: chain.caller, changeAddress: chain.changeAddress },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    artifact,
    proxy: deployment.proxy.categoryId,
    implementation: deployment.implementation.categoryId,
    address: deployment.proxy.address,
  };
}

/** The store as the root's externals name it: its proxy category, with the implementation it runs behind it. */
function externalOf(store: Proxied): FramedProxyExternal {
  return {
    artifact: store.artifact,
    categoryId: store.proxy,
    proxyArtifact: buildProxyArtifact(store.artifact),
    implementationCategoryId: store.implementation,
  };
}

/** What a hop left: its result, or its error with the last draft built and the stalls the settle caught. */
interface Outcome {
  readonly result?: FramedProxyCallResult | FramedCallResult;
  readonly error?: Error;
  readonly draft?: composer.CompositionDraft;
  readonly stalls: readonly string[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Runs one call and records what it left; `call` enters it through whichever path the case drives. */
async function observe(chain: Chain, call: (coin: Utxo) => Promise<Outcome['result']>): Promise<Outcome> {
  const coin = await chain.nextCoin();
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  let result: Outcome['result'];
  let error: Error | undefined;
  try {
    result = await call(coin);
  } catch (caught) {
    error = caught as Error;
  }
  const last = hosts.mock.results.at(-1);
  const stalls = derivations.mock.results.filter((entry) => entry.type === 'throw')
    .map((entry) => String((entry.value as Error).message));
  hosts.mockRestore();
  derivations.mockRestore();
  const live = await chain.network.getUtxosForLockingBytecode(ALICE_LOCK);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    ...(last?.type === 'return' ? { draft: last.value.draft } : {}),
    stalls,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** Enters an entry of a proxied contract through the shipped hop. */
function enter(
  chain: Chain, target: Proxied, functionName: string, args: readonly FunctionArgument[],
  externals?: Readonly<Record<string, FramedProxyExternal>>,
): Promise<Outcome> {
  return observe(chain, (coin) => callFramedProxyEntry({
    provider: chain.network,
    implementationArtifact: target.artifact,
    proxyArtifact: buildProxyArtifact(target.artifact),
    proxyCategoryId: target.proxy,
    implementationCategoryId: target.implementation,
    functionName,
    args,
    ...(externals === undefined ? {} : { externals }),
    callerUtxo: coin,
    callerLockingBytecode: ALICE_LOCK,
    funder: chain.caller,
    changeAddress: chain.changeAddress,
    vm: compositionMachine(),
  }));
}

/** The hop settled: every verdict accepted and the transaction broadcast. */
function expectSettled(outcome: Outcome): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
}

/** The proxy records the settled hop's delegate frame declared ahead of anything else. */
function settledRecords(outcome: Outcome): string[] {
  return declaredRecords((outcome.result as FramedProxyCallResult).draft);
}

/** The data-NFT indices the entry's published block layout names, in the order its body reads them. */
function namedRecords(artifact: Artifact, functionName: string): number[] {
  const row = artifact.abi.find((entry) => entry.name === functionName)!;
  return [...(row.blockLayout?.slots ?? [])].filter((slot) => slot.kind === 'dataNft')
    .sort((left, right) => left.offset - right.offset).map((slot) => slot.nftIndex!);
}

/** The inputs the delegate frame's first segment declares ahead of anything else, as the proxy's record ids. */
function declaredRecords(draft: composer.CompositionDraft): string[] {
  const byIndex = new Map(draft.layout.participants.map((placed) => [placed.index, placed.id]));
  return draft.blockOf('implementation-master').segments[0]!
    .map((entry) => byIndex.get(entry.in) ?? '')
    .filter((id) => id.startsWith('proxy-record-'));
}

/** The assembled transaction restated in the shape the validator's decision model reads; it decides nothing. */
function modelOf(draft: composer.CompositionDraft): FramedTransaction {
  const program = draft.programFor(draft.layout.participants.find((placed) => placed.kind === 'master')!.id);
  type Holder = {
    readonly token?: { category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array } };
  };
  const shape = (holder: Holder): TokenShape => (holder.token === undefined
    ? { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n }
    : {
      category: holder.token.category,
      capability: holder.token.nft?.capability === 'minting' ? 2 : (holder.token.nft?.capability === 'mutable' ? 1 : 0),
      hasNft: holder.token.nft !== undefined,
      nftCommitment: holder.token.nft?.commitment ?? new Uint8Array(0),
      amount: holder.token.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]! as Holder),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output as Holder),
    })),
  };
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: the block clock beside a task array', () => {
  it('the clock adds no field or record: the layout is the one without it, the append naming the first', () => {
    const desk = compiled(postSource(true)).Desk!;
    const layout = desk.stateLayout!;
    const fields = (candidate: typeof layout): string[] => candidate.variables
      .map((variable) => `${variable.name}@${variable.nftIndex}`);
    expect(layout.dataNftCount).toBe(1);
    expect(fields(layout)).toStrictEqual(['implementation@0', 'journal@0', 'tasks@0']);
    // The entry names the one record it reads and writes, and slices the oracle through its lock pin.
    expect(namedRecords(desk, 'open')).toStrictEqual([0]);
    expect(desk.abi.find((entry) => entry.name === 'open')?.usesBlockOracle).toBe(true);
    expect(desk.blockOracleLockSlots?.length).toBeGreaterThan(0);
    // Without the clock the record is the same.
    const unclocked = compiled(postSource(false)).Desk!.stateLayout!;
    expect(unclocked.dataNftCount).toBe(1);
    expect(fields(unclocked)).toStrictEqual(fields(layout));
  });

  it('the post\'s writes stamped with the clock beside a store call settle on the record the entry names', async () => {
    const { Journal, Desk } = compiled(postSource(true));
    const chain = await freshChain();
    const journal = await deployProxied(chain, Journal!, [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY],
      [addressOf(DESK_PROXY_CATEGORY)]);
    const desk = await deployProxied(chain, Desk!, [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], [journal.address]);
    const outcome = await enter(chain, desk, 'open', [TITLE, 100n, true], { IJournal: externalOf(journal) });
    // The delegate frame declares the records its entry's block layout names (`buildHopPlan`,
    // `frameDataRecordIndices`), and the clock is the co-spent oracle, not a record ahead of the task's chunk.
    expectSettled(outcome);
    expect(settledRecords(outcome)).toStrictEqual(['proxy-record-0']);
  }, 300_000);

  it('the same post without the clock settles and broadcasts', async () => {
    const { Journal, Desk } = compiled(postSource(false));
    const chain = await freshChain();
    const journal = await deployProxied(chain, Journal!, [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY],
      [addressOf(DESK_PROXY_CATEGORY)]);
    const desk = await deployProxied(chain, Desk!, [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], [journal.address]);
    expectSettled(await enter(chain, desk, 'open', [TITLE, 100n, true], { IJournal: externalOf(journal) }));
  }, 300_000);

  it('the clock-stamped append alone, with no call, settles on the record the entry names', async () => {
    const chain = await freshChain();
    const desk = await deployProxied(chain, compiled(appendSource('clock')).Desk!,
      [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], []);
    const outcome = await enter(chain, desk, 'open', [TITLE, 100n]);
    expectSettled(outcome);
    expect(namedRecords(desk.artifact, 'open')).toStrictEqual([0]);
    expect(settledRecords(outcome)).toStrictEqual(['proxy-record-0']);
  }, 300_000);

  it('an isolated field of the source\'s own after the named record settles the append the same way', async () => {
    const chain = await freshChain();
    const desk = await deployProxied(chain, compiled(appendSource('spare')).Desk!,
      [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], []);
    const outcome = await enter(chain, desk, 'open', [TITLE, 100n]);
    expectSettled(outcome);
    expect(desk.artifact.stateLayout!.dataNftCount).toBe(2);
    expect(namedRecords(desk.artifact, 'open')).toStrictEqual([0]);
    expect(settledRecords(outcome)).toStrictEqual(['proxy-record-0']);
  }, 300_000);

  it('the append without the clock settles and broadcasts', async () => {
    const chain = await freshChain();
    const desk = await deployProxied(chain, compiled(appendSource('none')).Desk!,
      [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], []);
    expectSettled(await enter(chain, desk, 'open', [TITLE, 100n]));
  }, 300_000);

  it('the clock alone, with no run after the records, settles and broadcasts', async () => {
    const chain = await freshChain();
    const desk = await deployProxied(chain, compiled(CLOCK_ONLY_SOURCE).Desk!,
      [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], []);
    // The clock adds no record: the entry names its one record and co-spends the oracle.
    expect(desk.artifact.stateLayout!.dataNftCount).toBe(1);
    expect(namedRecords(desk.artifact, 'open')).toStrictEqual([0]);
    expectSettled(await enter(chain, desk, 'open', []));
  }, 300_000);

  it('a record the entry does not name ahead of one it does is left undeclared, and the entry settles', async () => {
    const chain = await freshChain();
    const desk = await deployProxied(chain, compiled(SECOND_RECORD_SOURCE).Desk!,
      [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], []);
    const outcome = await enter(chain, desk, 'open', []);
    // The body reads its one record at the first coordinate of the frame's block, which is where that record is.
    expectSettled(outcome);
    expect(namedRecords(desk.artifact, 'open')).toStrictEqual([1]);
    expect(settledRecords(outcome)).toStrictEqual(['proxy-record-1']);
  }, 300_000);

  it('the same entry through the direct call path, which declares the records the entry names, settles', async () => {
    const artifact = compiled(SECOND_RECORD_SOURCE).Desk!;
    const chain = await freshChain();
    const deployment = await deployStatefulContract(artifact, [], {
      provider: chain.network, fundingUtxo: funding(DESK_IMPL_CATEGORY), funder: chain.funder,
      changeAddress: chain.changeAddress,
    });
    const outcome = await observe(chain, (coin) => callFramedEntry({
      provider: chain.network, artifact, categoryId: deployment.categoryId, functionName: 'open', args: [],
      callerUtxo: coin, callerLockingBytecode: ALICE_LOCK, funder: chain.caller, changeAddress: chain.changeAddress,
      vm: compositionMachine(),
    }));
    expectSettled(outcome);
    const block = outcome.result!.draft.blockOf('master');
    expect(block.segments[0]!.map((entry) => outcome.result!.draft.layout.participants
      .find((placed) => placed.index === entry.in)?.id)).toStrictEqual(['record-1']);
  }, 300_000);
});

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: a proxied store read whose value is ignored', () => {
  /** Deploys the store and the root behind generated proxies and registers the caller in the store. */
  async function readWorld(view: boolean): Promise<{ chain: Chain; journal: Proxied; desk: Proxied }> {
    const { Journal, Desk } = compiled(readSource(view));
    const chain = await freshChain();
    const journal = await deployProxied(chain, Journal!, [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY],
      [addressOf(DESK_PROXY_CATEGORY)]);
    const desk = await deployProxied(chain, Desk!, [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY], [journal.address]);
    const key = Uint8Array.from({ length: 33 }, (_unused, index) => (index * 7 + 3) % 251);
    expectSettled(await enter(chain, journal, 'join', [key, 'TestUser']));
    return { chain, journal, desk };
  }

  it('the view read\'s static frame forwards as a delegate leg, which the validator admits, and it settles', async () => {
    const { chain, journal, desk } = await readWorld(true);
    const outcome = await enter(chain, desk, 'peek', [ALICE_LOCK], { IJournal: externalOf(journal) });
    // V10 admits a DELEGATE leg under a STATIC frame and keeps the read-only rule on its subtree (PW10:
    // `solidc/src/framed/validator/checks.ts`, `checkV10`, and the emitted program's reachability gate).
    expectSettled(outcome);
    const draft = outcome.result!.draft;
    const staticFrame = draft.layout.participants.find((placed) => placed.kind === 'master'
      && draft.blockOf(placed.id).kind === FrameKind.STATIC)!;
    expect(staticFrame.contract).toBe('JournalProxy');
    expect(draft.blockOf(staticFrame.id).calls.map((call) => call.kind)).toStrictEqual([FrameKind.DELEGATE]);
    const validator = draft.layout.participants.find((placed) => placed.kind === 'validator')!;
    const decision = decideValidator(modelOf(draft), {
      validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: validator.index,
    });
    expect(decision.accepted).toBe(true);
    expect(decision.rejection).toBeUndefined();
  }, 300_000);

  it('the same read of an entry declared without view is a CALL frame, and settles and broadcasts', async () => {
    const { chain, journal, desk } = await readWorld(false);
    const outcome = await enter(chain, desk, 'peek', [ALICE_LOCK], { IJournal: externalOf(journal) });
    expectSettled(outcome);
    const draft = outcome.result!.draft;
    expect(draft.layout.participants.filter((placed) => placed.kind === 'master')
      .map((placed) => draft.blockOf(placed.id).kind)).not.toContain(FrameKind.STATIC);
  }, 300_000);
});
