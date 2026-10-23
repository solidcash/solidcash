import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  encodeEventCommitment,
  encodeIntegerValue,
  encodeResultList,
  packFixedWidthElement,
  splitValueIntoChunks,
  type Artifact,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { seededCategory, REAL_VALIDATOR_PROGRAM } from '../../../../solidc/test/framed/master/validator-input.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import {
  chunkRecordId, createComposedDerivationHost, layOutChunkRun, participant,
  planChunkRun, reportCompositionRefusal,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { layoutWithFacets } from './harness.js';
import {
  EMPTY,
  USER_LOCK,
  composeAndDerive,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
  type DeployedContract,
} from './harness.js';

/**
 * A user enters a proxied root whose implementation writes the proxy's record and calls one store twice.
 *
 * The outer hop is a generated proxy's fallback, which `DELEGATE`s into the implementation. The implementation
 * writes the proxy's own record (so it runs as the proxy and rebuilds the proxy's data NFT) and then makes two
 * calls to a store. The store is itself reached through a generated proxy: each call is the store's own typed call,
 * so the store proxy's fallback master receives the store entry's selector and argument pushes as its frame's
 * call-data band, materializes it as its `input`, and `DELEGATE`s into the store's implementation; the store entry
 * then appends one element to the store's log and emits an event above the 128-byte commitment size.
 *
 * The store entry requires `msg.sender` to be the root proxy's address. A call frame's sender is the caller's own
 * address, so the store proxy's fallback is entered with the root proxy's address as its sender; a delegate frame
 * inherits its caller's sender and takes the caller's address as `address(this)`. The store's `append` therefore
 * runs with `self` the store proxy's address and observes `msg.sender` as the root proxy's address, which is what
 * its gate names.
 *
 * Every coordinate comes from `layoutTransaction`/`participant`, the store's log from `planChunkRun`/
 * `layOutChunkRun`, and every commitment from the shipped encoders (`buildPushdataCommitment`,
 * `buildChunkCommitment`, `encodeEventCommitment`, `stateRecordLockingBytecode`, `stateRecordUnlockingBytecode`).
 * The whole shipped path runs: the compiler, `deployMaster`, `buildProxyArtifact` for both proxies, the composer,
 * the derivation and the BCH-2026 machine.
 *
 * The shape's token pull, a low-level call the compiler lowers to the typed call, is pinned in
 * `edges/low-level-token-call-lowering.test.ts`.
 *
 * The read-only hop is driven against the second contract at its own address. A read-only frame makes no calls, and
 * a generated proxy's fallback is a delegate hop, so the read of a contract *behind* its proxy is not settled here.
 */

const ROOT_PROXY_LABEL = 'proxied root append proxy';
const ROOT_IMPL_LABEL = 'proxied root append implementation';
const STORE_IMPL_LABEL = 'proxied root append store implementation';
const STORE_PROXY_LABEL = 'proxied root append store proxy';
const ROOT_PROXY_CATEGORY = seededCategory(ROOT_PROXY_LABEL);
const ROOT_IMPL_CATEGORY = seededCategory(ROOT_IMPL_LABEL);
const STORE_IMPL_CATEGORY = seededCategory(STORE_IMPL_LABEL);
const STORE_PROXY_CATEGORY = seededCategory(STORE_PROXY_LABEL);
const ROOT_PROXY_CATEGORY_HEX = bytesToHex(ROOT_PROXY_CATEGORY);
const STORE_PROXY_CATEGORY_HEX = bytesToHex(STORE_PROXY_CATEGORY);
const ROOT_IMPL_ADDRESS = seededAddress(ROOT_IMPL_LABEL);
const ROOT_PROXY_ADDRESS = seededAddress(ROOT_PROXY_LABEL);
const STORE_IMPL_ADDRESS = seededAddress(STORE_IMPL_LABEL);
const STORE_PROXY_ADDRESS = seededAddress(STORE_PROXY_LABEL);
const ROOT_PROXY_ADDRESS_HEX = hexOf(ROOT_PROXY_ADDRESS);
const STORE_PROXY_ADDRESS_HEX = hexOf(STORE_PROXY_ADDRESS);

const RECORD_ID = 'root-record';
const HEADER_ID = 'store-header';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const PROXY_MASTER = 'proxy-1';
const IMPL_MASTER = 'impl-1';
const STORE_PROXY_MASTERS = ['store-proxy-1', 'store-proxy-2'] as const;
const STORE_IMPL_MASTERS = ['store-impl-1', 'store-impl-2'] as const;

/** The count the root's proxy record carries before and after the entry runs. */
const COUNT_BEFORE = 0n;
const COUNT_AFTER = 1n;

/** The element the log already holds, so the appends grow a run the transaction keeps rather than creates. */
const SPENT_ITEMS: readonly bigint[] = [7n];

/** The two appends: each tag is the event's indexed argument and each item is the element pushed onto the log. */
const APPENDS: readonly { readonly tag: bigint; readonly item: bigint }[] = [
  { tag: 1n, item: 10n },
  { tag: 2n, item: 20n },
];

/** The blob the store's event carries: 150 bytes, so the encoded payload crosses the 128-byte commitment size. */
const BIG_BLOB = new Uint8Array(150).fill(0xab);

/**
 * The store: each entry appends one element to its log, gates on the root proxy's address and emits.
 *
 * It declares the address its generated proxy delegates to, so the proxy can mirror the store's record exactly.
 */
const STORE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Store {'
  + '   address public implementation;'
  + '   int[] public items;'
  + '   event Appended(int indexed tag, bytes blob);'
  + '   function append(int tag, int item) {'
  + `     require(msg.sender == 0x${ROOT_PROXY_ADDRESS_HEX});`
  + '     this.items.push(item);'
  + `     emit Appended(tag, hex"${hexOf(BIG_BLOB)}");`
  + '     require(true);'
  + '   }'
  + ' }';

const STORE_ARTIFACT = compileStringMulti(STORE_SOURCE, { composition: 'framed' }).Store!;
const STORE_PROXY_ARTIFACT = buildProxyArtifact(STORE_ARTIFACT);
const STORE_CONTRACT = STORE_ARTIFACT.contractName;
const STORE_PROXY_CONTRACT = STORE_PROXY_ARTIFACT.contractName;
const STORE_DEPLOYED = deployMaster(STORE_ARTIFACT, STORE_IMPL_CATEGORY, REAL_VALIDATOR_PROGRAM);
const STORE_PROXY_DEPLOYED = deployMaster(STORE_PROXY_ARTIFACT, STORE_PROXY_CATEGORY, REAL_VALIDATOR_PROGRAM);
const STORE: DeployedContract = {
  name: STORE_CONTRACT, category: STORE_IMPL_CATEGORY, address: STORE_IMPL_ADDRESS,
  program: STORE_DEPLOYED.script, lockingBytecode: STORE_DEPLOYED.lockingBytecode,
};
const STORE_PROXY: DeployedContract = {
  name: STORE_PROXY_CONTRACT, category: STORE_PROXY_CATEGORY, address: STORE_PROXY_ADDRESS,
  program: STORE_PROXY_DEPLOYED.script, lockingBytecode: STORE_PROXY_DEPLOYED.lockingBytecode,
};

const STORE_PROXY_LAYOUT = STORE_PROXY_ARTIFACT.stateLayout!;
const ELEMENT_WIDTH = packFixedWidthElement(1n, 'int256').length;

/** The store entry's arguments as the pushes its dispatcher reads: the selector, then the last parameter first. */
function appendPushes(frame: number): readonly Uint8Array[] {
  return [
    selectorOf({ Store: STORE_ARTIFACT }, 'Store', 'append'),
    encodeIntegerValue(APPENDS[frame]!.item),
    encodeIntegerValue(APPENDS[frame]!.tag),
  ];
}

/** The root implementation: it makes the store's two typed calls through the store's proxy, then writes its record. */
const ROOT_IMPL_SOURCE = ((): string => {
  const calls = APPENDS.map((append) =>
    `     IStore(0x${STORE_PROXY_ADDRESS_HEX}).append(${append.tag}, ${append.item});`).join('\n');
  return 'pragma solidcash ^0.14.0;'
    + ' interface IStore { function append(int tag, int item); }'
    + ' contract RootImpl {'
    + '   address public implementation;'
    + '   int public count;'
    + '   function run() {'
    + `\n${calls}\n`
    + '     this.count = this.count + 1;'
    + '     require(true);'
    + '   }'
    + ' }';
})();

/** The same root, but its entry passes the store's items as run-time arguments rather than stating them. */
const ROOT_IMPL_RUNTIME_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function append(int tag, int item); }'
  + ' contract RootImpl {'
  + '   address public implementation;'
  + '   int public count;'
  + '   function run(int first, int second) {'
  + `     IStore(0x${STORE_PROXY_ADDRESS_HEX}).append(1, first);`
  + `     IStore(0x${STORE_PROXY_ADDRESS_HEX}).append(2, second);`
  + '     this.count = this.count + 1;'
  + '     require(true);'
  + '   }'
  + ' }';

/** A proxied implementation: its artifact, the generated proxy, both deployments, and the fallback's call data. */
interface ImplSetup {
  readonly artifact: Artifact;
  readonly proxyArtifact: Artifact;
  readonly impl: DeployedContract;
  readonly proxy: DeployedContract;
  readonly proxyContract: string;
  readonly implContract: string;
  /** The pushes the implementation's dispatcher consumes: the selector, then the parameters last-declared-first. */
  readonly implPushes: readonly Uint8Array[];
}

/** Compiles an implementation, generates its proxy, and deploys both at the shape's one pair of addresses. */
function setupImpl(source: string, entry: string, args: readonly Uint8Array[]): ImplSetup {
  const artifact = compileStringMulti(source, { composition: 'framed' }).RootImpl!;
  const proxyArtifact = buildProxyArtifact(artifact);
  const implDeployed = deployMaster(artifact, ROOT_IMPL_CATEGORY, REAL_VALIDATOR_PROGRAM);
  const proxyDeployed = deployMaster(proxyArtifact, ROOT_PROXY_CATEGORY, REAL_VALIDATOR_PROGRAM);
  const selector = selectorOf({ RootImpl: artifact }, 'RootImpl', entry);
  const implPushes = [selector, ...[...args].reverse()];
  return {
    artifact, proxyArtifact,
    impl: {
      name: artifact.contractName, category: ROOT_IMPL_CATEGORY, address: ROOT_IMPL_ADDRESS,
      program: implDeployed.script, lockingBytecode: implDeployed.lockingBytecode,
    },
    proxy: {
      name: proxyArtifact.contractName, category: ROOT_PROXY_CATEGORY, address: ROOT_PROXY_ADDRESS,
      program: proxyDeployed.script, lockingBytecode: proxyDeployed.lockingBytecode,
    },
    proxyContract: proxyArtifact.contractName, implContract: artifact.contractName, implPushes,
  };
}

const APPEND_SETUP = setupImpl(ROOT_IMPL_SOURCE, 'run', []);
const RUNTIME_SETUP = setupImpl(ROOT_IMPL_RUNTIME_SOURCE, 'run', [encodeIntegerValue(10n), encodeIntegerValue(20n)]);

/** The element stream the store's log holds: each element packed at the type's fixed width. */
function itemsBytes(values: readonly bigint[]): Uint8Array {
  const bytes = new Uint8Array(values.length * ELEMENT_WIDTH);
  values.forEach((value, index) => bytes.set(packFixedWidthElement(value, 'int256'), index * ELEMENT_WIDTH));
  return bytes;
}

/** The log's data NFT commitment for a value, from the shipped encoder. */
function headerOf(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(STORE_PROXY_LAYOUT, { implementation: STORE_IMPL_ADDRESS, items: bytes }, 0), 'hex'));
}

/** One chunk commitment of a run holding this element stream, from the shipped encoder. */
function chunkOf(index: number, bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(buildChunkCommitment(index, bytes), 'hex'));
}

/** The commitment a proxy's data-NFT record materializes for one state, from the shipped encoder. */
function recordOf(setup: ImplSetup, count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(setup.proxyArtifact.stateLayout!, { implementation: setup.impl.address, count }, 0),
    'hex'));
}

/** Everything one append composition needs, with the coordinates the layout assigned. */
interface AppendBuild {
  readonly setup: ImplSetup;
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Artifact[];
  readonly root: ReturnType<typeof rootOf>;
  readonly recordIndex: number;
  readonly headerIndex: number;
  readonly chunkIndex: number;
  readonly chunkId: string;
  readonly storeProxyIndices: readonly number[];
  readonly storeImplIndices: readonly number[];
  readonly eventIndices: readonly number[];
  readonly recordBefore: Uint8Array;
  readonly recordAfter: Uint8Array;
  readonly headers: readonly Uint8Array[];
  readonly stages: readonly Uint8Array[];
  readonly eventPayloads: readonly Uint8Array[];
}

/** Lays the shape out, with the sender the store's delegate frames declare. */
function buildAppend(setup: ImplSetup = APPEND_SETUP, sender: Uint8Array = ROOT_PROXY_ADDRESS): AppendBuild {
  const stages = [
    itemsBytes(SPENT_ITEMS),
    itemsBytes([...SPENT_ITEMS, APPENDS[0]!.item]),
    itemsBytes([...SPENT_ITEMS, ...APPENDS.map((append) => append.item)]),
  ];
  const headers = stages.map((bytes) => headerOf(bytes));

  const blockOf = (chunk: string): CompositionDraftPlan['blocks'] => [
    {
      contract: setup.proxyContract, masters: [PROXY_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID],
    },
    { contract: setup.implContract, masters: [IMPL_MASTER], state: [] as readonly string[] },
    {
      contract: STORE_PROXY_CONTRACT, masters: [...STORE_PROXY_MASTERS],
      state: [HEADER_ID, chunk],
    },
    { contract: STORE_CONTRACT, masters: [...STORE_IMPL_MASTERS], state: [] as readonly string[] },
  ];
  // A probe with the same block geometry fixes the record block's width, because the log's run begins one layout
  // width past the store's header, which the emitted body derives from the frame's own declaration.
  const probe = layoutWithFacets(blockOf('probe-chunk'));
  const headerIndex = participant(probe, HEADER_ID).index;
  const base = headerIndex + STORE_PROXY_LAYOUT.dataNftCount;
  const chunkId = chunkRecordId('items', base);
  const blocks = blockOf(chunkId);
  const layout = layoutWithFacets(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const recordIndex = indexOf(RECORD_ID);
  const storeProxyIndices = STORE_PROXY_MASTERS.map((id) => indexOf(id));
  const storeImplIndices = STORE_IMPL_MASTERS.map((id) => indexOf(id));
  const chunkIndex = indexOf(chunkId);
  const participantCount = layout.participantCount;

  const run = layOutChunkRun({
    plan: planChunkRun({ layout: STORE_PROXY_LAYOUT, variable: 'items', spent: stages[0]!, written: stages[2]! }),
    category: STORE_PROXY_CATEGORY,
    base,
    writer: storeProxyIndices[0]!,
    valueSatoshis: 1_000n,
  });
  const keptChunk = run.records[0]!;
  const chunksAt = (stage: number): readonly Uint8Array[] =>
    splitValueIntoChunks(stages[stage]!).map((piece, index) => chunkOf(index, piece));

  const event = STORE_ARTIFACT.events![0]!;
  const eventPayloads = APPENDS.map((append) =>
    encodeEventCommitment(event.parameters, [append.tag, BIG_BLOB]));
  const emitted = eventPayloads.map((payload) => eventOutput(STORE_PROXY_CATEGORY, event.signature, payload));
  const eventIndices = eventPayloads.map((_payload, offset) => participantCount + offset);

  const recordBefore = recordOf(setup, COUNT_BEFORE);
  const recordAfter = recordOf(setup, COUNT_AFTER);
  const recordWrite: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordAfter,
  };
  const recordRead: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore,
  };
  const recordResumed: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordAfter, viewOut: recordAfter,
  };

  /** The store's header as one frame sees it: read before its delegate hop, and resumed after it. */
  const headerRead = (frame: number): RecordEntry =>
    ({ in: headerIndex, out: headerIndex, viewIn: headers[frame]!, viewOut: headers[frame]! });
  const headerWritten = (frame: number): RecordEntry =>
    ({ in: headerIndex, out: headerIndex, viewIn: headers[frame]!, viewOut: headers[frame + 1]! });
  const headerResumed = (frame: number): RecordEntry =>
    ({ in: headerIndex, out: headerIndex, viewIn: headers[frame + 1]!, viewOut: headers[frame + 1]! });
  /** The log's chunks one append touches: each is kept in place and its value grows inside it. */
  const chunkEntries = (frame: number): readonly RecordEntry[] => {
    const before = chunksAt(frame);
    const after = chunksAt(frame + 1);
    return Array.from({ length: Math.max(before.length, after.length) }, (_unused, offset) => ({
      in: chunkIndex, out: chunkIndex, viewIn: before[offset] ?? EMPTY, viewOut: after[offset] ?? EMPTY,
    }));
  };

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: setup.proxyContract, entry: '__fallback', program: setup.proxy.program,
    facts: {
      contract: setup.proxyContract, functionName: '__fallback', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: setup.proxy.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: setup.impl.address, value: 0n,
      argumentPushes: [...setup.implPushes],
    }],
    segments: [[recordRead], [recordResumed]],
    // The fallback's one parameter is the frame's own call-data band: the caller's selector push, then its pushes.
    argumentPushes: [...setup.implPushes],
    dispatches: true,
  });
  const implMaster: DraftMaster = master({
    master: IMPL_MASTER, contract: setup.implContract, entry: 'run', program: setup.impl.program,
    facts: {
      contract: setup.implContract, functionName: 'run', kind: FrameKind.DELEGATE, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: setup.proxy.address, value: 0n },
    enteredBy: PROXY_MASTER, origin: USER_ID,
    calls: APPENDS.map((_append, frame) => ({
      kind: FrameKind.CALL, callee: STORE_PROXY_MASTERS[frame]!, target: STORE_PROXY.address, value: 0n,
      argumentPushes: appendPushes(frame),
    })),
    segments: [[recordRead], [recordRead], [recordWrite]],
    argumentPushes: [...setup.implPushes],
  });

  /** The store proxy's fallback: it materializes its input from the frame's call-data band and delegates. */
  const storeProxyMaster = (frame: number): DraftMaster => master({
    master: STORE_PROXY_MASTERS[frame]!, contract: STORE_PROXY_CONTRACT, entry: '__fallback',
    program: STORE_PROXY.program,
    facts: {
      contract: STORE_PROXY_CONTRACT, functionName: '__fallback', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: true, mastersOfContract: STORE_PROXY_MASTERS.length,
    },
    frame: { kind: FrameKind.CALL, sender: ROOT_PROXY_ADDRESS, self: STORE_PROXY.address, value: 0n },
    enteredBy: IMPL_MASTER, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: STORE_IMPL_MASTERS[frame]!, target: STORE.address, value: 0n,
      argumentPushes: appendPushes(frame),
    }],
    segments: [[headerRead(frame)], [headerResumed(frame)]],
    // The fallback's one parameter is the frame's own call-data band: the caller's selector push, then its pushes.
    argumentPushes: appendPushes(frame),
  });

  /** The store's code as its proxy's delegate frame: it appends to the store proxy's log and emits. */
  const storeImplMaster = (frame: number): DraftMaster => ({
    ...master({
      master: STORE_IMPL_MASTERS[frame]!, contract: STORE_CONTRACT, entry: 'append', program: STORE.program,
      facts: {
        contract: STORE_CONTRACT, functionName: 'append', kind: FrameKind.DELEGATE, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: STORE_IMPL_MASTERS.length,
      },
      frame: { kind: FrameKind.DELEGATE, sender, self: STORE_PROXY.address, value: 0n },
      enteredBy: STORE_PROXY_MASTERS[frame]!, origin: USER_ID,
      argumentPushes: appendPushes(frame),
      segments: [[headerWritten(frame), ...chunkEntries(frame)]],
    }),
    events: [eventIndices[frame]!],
  });

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(ROOT_PROXY_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(ROOT_PROXY_CATEGORY, 'mutable', recordBefore),
  };
  const headerSource = {
    lockingBytecode: stateRecordLockingBytecode(STORE_PROXY_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(STORE_PROXY_CATEGORY, 'mutable', headers[0]!),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters: [
      proxyMaster, implMaster,
      ...APPENDS.map((_append, frame) => storeProxyMaster(frame)),
      ...APPENDS.map((_append, frame) => storeImplMaster(frame)),
    ],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(setup.proxy) },
      [IMPL_MASTER]: { source: masterInput(setup.impl) },
      ...Object.fromEntries(STORE_PROXY_MASTERS.map((id) => [id, { source: masterInput(STORE_PROXY) }])),
      ...Object.fromEntries(STORE_IMPL_MASTERS.map((id) => [id, { source: masterInput(STORE) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(ROOT_PROXY_CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(ROOT_PROXY_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(ROOT_PROXY_CATEGORY, 'mutable', recordAfter) },
        unlockingBytecode: stateRecordUnlockingBytecode(ROOT_PROXY_CATEGORY_HEX, indexOf(PROXY_MASTER), 1),
      },
      [HEADER_ID]: {
        source: headerSource,
        output: { ...headerSource, token: token(STORE_PROXY_CATEGORY, 'mutable', headers[2]!) },
        unlockingBytecode: stateRecordUnlockingBytecode(STORE_PROXY_CATEGORY_HEX, storeProxyIndices[0]!, 1),
      },
      [chunkId]: keptChunk.input!,
      [USER_ID]: userInput(),
    },
    trailingOutputs: [...emitted],
    validator: {
      id: VALIDATOR_ID, covers: [setup.implContract, STORE_PROXY_CONTRACT, STORE_CONTRACT],
      settles: [
        { category: ROOT_PROXY_CATEGORY, stateInputs: [RECORD_ID] },
        { category: STORE_PROXY_CATEGORY, stateInputs: [HEADER_ID, chunkId] },
        // The store's code runs two delegate frames, so the validator settles the store's own category too,
        // although the store itself keeps no state UTXO: the value it writes lives in the store proxy's records.
        { category: STORE_IMPL_CATEGORY, stateInputs: [] },
      ],
      redeemScript: validatorFor(ROOT_PROXY_CATEGORY).redeem,
    },
  };

  return {
    setup, plan, artifacts: [setup.proxyArtifact, setup.artifact, STORE_PROXY_ARTIFACT, STORE_ARTIFACT],
    root: rootOf(setup.proxyContract, '__fallback', PROXY_MASTER),
    recordIndex, headerIndex, chunkIndex, chunkId, storeProxyIndices, storeImplIndices, eventIndices,
    recordBefore, recordAfter, headers, stages, eventPayloads,
  };
}

/** The participants whose input the machine refused, named with the refusal. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

interface SettledAppend {
  readonly built: AppendBuild;
  readonly outcome: ReturnType<typeof composeAndDerive>;
}
let appended: SettledAppend | undefined;
/** The default append composition, derived once: the cases below only read it. */
function settledAppend(): SettledAppend {
  if (appended === undefined) {
    const built = buildAppend();
    appended = { built, outcome: composeAndDerive(built.plan, built.artifacts, [built.root]) };
  }
  return appended;
}

describe('a proxied root appending through one store behind its proxy', () => {
  it('settles the record write and both appends: every contract input is accepted', () => {
    const { built, outcome } = settledAppend();

    expect(refused(outcome)).toStrictEqual([]);
    // Each store entry completes before the store proxy fallback that delegated to it, in call order; the root
    // implementation completes after both hops and the root proxy after the implementation.
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual([
      STORE_IMPL_MASTERS[0], STORE_PROXY_MASTERS[0], STORE_IMPL_MASTERS[1], STORE_PROXY_MASTERS[1],
      IMPL_MASTER, PROXY_MASTER,
    ]);
    // The accepted inputs are the root proxy, the root implementation, both store proxy and store masters, the
    // validator and the records.
    expect(outcome.verdicts.filter((verdict) => verdict.accepted)
      .map((verdict) => verdict.participant).sort())
      .toStrictEqual([PROXY_MASTER, IMPL_MASTER, ...STORE_PROXY_MASTERS, ...STORE_IMPL_MASTERS,
        VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID, HEADER_ID, built.chunkId].sort());
  });

  it('reaches the store as a delegate frame on the store proxy\'s record, entered by a call frame', () => {
    const { outcome } = settledAppend();
    const layout = outcome.draft.layout;

    // The store proxy's fallback runs a call frame entered by the root implementation's own frame, so its sender is
    // the address that frame runs as: the root proxy's.
    const proxyFrame = outcome.draft.blockOf(STORE_PROXY_MASTERS[0]!);
    expect(proxyFrame.kind).toBe(FrameKind.CALL);
    expect(proxyFrame.callerRef).toBe(participant(layout, IMPL_MASTER).index);
    expect(proxyFrame.sender).toStrictEqual(ROOT_PROXY_ADDRESS);
    expect(proxyFrame.self).toStrictEqual(STORE_PROXY.address);
    expect(proxyFrame.calls[0]!.kind).toBe(FrameKind.DELEGATE);
    expect(proxyFrame.calls[0]!.target).toStrictEqual(STORE.address);

    // The store's code runs the delegate frame: it inherits the fallback's sender and runs as the store proxy, so
    // that is the address the entry's `address(this)` and `msg.sender` read.
    const storeFrame = outcome.draft.blockOf(STORE_IMPL_MASTERS[0]!);
    expect(storeFrame.kind).toBe(FrameKind.DELEGATE);
    expect(storeFrame.callerRef).toBe(participant(layout, STORE_PROXY_MASTERS[0]!).index);
    expect(storeFrame.sender).toStrictEqual(ROOT_PROXY_ADDRESS);
    expect(storeFrame.self).toStrictEqual(STORE_PROXY.address);
  });

  it('writes the root record, the store header, the chunk and both events through the shipped encoders', () => {
    const { built, outcome } = settledAppend();
    const outputs = outcome.transaction.outputs;

    // The root proxy's record commitment is what the shipped encoder materializes for the value the entry computed.
    expect(bytesToHex(outputs[built.recordIndex]!.token!.nft!.commitment)).toBe(bytesToHex(built.recordAfter));
    expect(bytesToHex(built.recordAfter)).toBe(bytesToHex(recordOf(built.setup, COUNT_AFTER)));
    expect(bytesToHex(built.recordAfter)).not.toBe(bytesToHex(recordOf(built.setup, COUNT_BEFORE)));

    // The store proxy's header carries the address its fallback delegates to and the length of the whole element
    // stream, from the shipped encoder.
    expect(bytesToHex(outputs[built.headerIndex]!.token!.nft!.commitment)).toBe(bytesToHex(built.headers[2]!));

    // The chunk carries the encoder's commitment for the final element stream, at the layout's index.
    const chunks = splitValueIntoChunks(built.stages[2]!).map((piece, index) => chunkOf(index, piece));
    expect(chunks).toHaveLength(1);
    expect(bytesToHex(outputs[built.chunkIndex]!.token!.nft!.commitment)).toBe(bytesToHex(chunks[0]!));

    // Each append's event is at the trailing output the layout gave it, carrying the payload the body computed.
    expect(built.eventPayloads[0]!.length).toBeGreaterThan(128);
    built.eventIndices.forEach((index, offset) => {
      expect(outputs[index]!.token!.nft).toStrictEqual({
        capability: 'none', commitment: built.eventPayloads[offset]!,
      });
    });
  });

  it('refuses a record output no frame computed, on the same composition', () => {
    const { built, outcome: { draft } } = settledAppend();
    const program = draft.programFor(PROXY_MASTER);
    const wrong = recordOf(built.setup, COUNT_BEFORE + 100n);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === built.recordIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs, transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});

describe('the store\'s caller check through its proxy', () => {
  it('refuses a control whose store frames are told a different sender, and the machine objects', () => {
    // The accepted run is the settle above, whose store frames carry the root proxy's address.
    // The store's sender is the frame the delegate runs with, so a plan that writes another address into that
    // frame makes the body's own check fail. The machine's objection on the store's input is asserted beside the
    // derivation stalling there.
    const built = buildAppend(APPEND_SETUP, ROOT_IMPL_ADDRESS);
    let stalled: Error | undefined;
    try {
      composeAndDerive(built.plan, built.artifacts, [built.root]);
    } catch (error) {
      stalled = error as Error;
    }
    expect(stalled?.message)
      .toMatch(/FRAMED_DERIVATION_STALLED: master "store-impl-1" of Store\.append\(\)/);

    const report = reportCompositionRefusal({
      draft: createComposedDerivationHost({
        vm: compositionMachine(), artifacts: built.artifacts, plan: built.plan,
      }).draft,
      artifacts: built.artifacts,
      vm: compositionMachine(),
    });
    const store = report.refusals.find((entry) => entry.master === STORE_IMPL_MASTERS[0]!);
    expect(store?.objection).toMatch(/OP_VERIFY/);
  });
});

/** A read-only hop: the root's implementation reads a second contract once per tag and stores the sum it read. */
const READ_ROOT_LABEL = 'proxied root append read proxy';
const READ_IMPL_LABEL = 'proxied root append read implementation';
const READER_LABEL = 'proxied root append reader';
const READ_ROOT_CATEGORY = seededCategory(READ_ROOT_LABEL);
const READ_IMPL_CATEGORY = seededCategory(READ_IMPL_LABEL);
const READER_CATEGORY = seededCategory(READER_LABEL);
const READ_ROOT_CATEGORY_HEX = bytesToHex(READ_ROOT_CATEGORY);
const READER_CATEGORY_HEX = bytesToHex(READER_CATEGORY);
const READ_IMPL_ADDRESS = seededAddress(READ_IMPL_LABEL);
const READ_ROOT_ADDRESS = seededAddress(READ_ROOT_LABEL);
const READER_ADDRESS = seededAddress(READER_LABEL);
const READER_ADDRESS_HEX = hexOf(READER_ADDRESS);

const READ_RECORD_ID = 'read-root-record';
const READER_RECORD_ID = 'reader-record';
const READ_MASTERS = ['read-1', 'read-2', 'read-3'] as const;
const READ_VALIDATOR_ID = 'read-validator';
const READ_USER_ID = 'read-user';
const READ_RECORD_MASTER = 'read-root-1';
const READ_IMPL_MASTER = 'read-impl-1';

/** The reader's `n` and the tags the root reads; the sum the entry stores is what a read value feeds back in. */
const READER_N = 5n;
const TAGS: readonly bigint[] = [1n, 2n, 3n];
const TAG_VALUES = TAGS.map((tag) => READER_N + tag);
const TOTAL = TAG_VALUES.reduce((sum, value) => sum + value, 0n);

const READ_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IRead { function tag(int id) view returns (int); }'
  + ' contract RootRead {'
  + '   address public implementation;'
  + '   int public total;'
  + '   function run() {'
  + `     int a = IRead(0x${READER_ADDRESS_HEX}).tag(1);`
  + `     int b = IRead(0x${READER_ADDRESS_HEX}).tag(2);`
  + `     int c = IRead(0x${READER_ADDRESS_HEX}).tag(3);`
  + '     this.total = a + b + c;'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Reader {'
  + '   int public n;'
  + '   function tag(int id) view returns (int) { return this.n + id; }'
  + ' }';

const READ_ARTIFACTS = compileStringMulti(READ_SOURCE, { composition: 'framed' });
const READ_IMPL_ARTIFACT = READ_ARTIFACTS.RootRead!;
const READ_PROXY_ARTIFACT = buildProxyArtifact(READ_IMPL_ARTIFACT);
const READER_ARTIFACT = READ_ARTIFACTS.Reader!;
const READ_IMPL_DEPLOYED = deployMaster(READ_IMPL_ARTIFACT, READ_IMPL_CATEGORY, REAL_VALIDATOR_PROGRAM);
const READ_PROXY_DEPLOYED = deployMaster(READ_PROXY_ARTIFACT, READ_ROOT_CATEGORY, REAL_VALIDATOR_PROGRAM);
const READER_DEPLOYED = deployMaster(READER_ARTIFACT, READER_CATEGORY, REAL_VALIDATOR_PROGRAM);
const READ_IMPL: DeployedContract = {
  name: READ_IMPL_ARTIFACT.contractName, category: READ_IMPL_CATEGORY, address: READ_IMPL_ADDRESS,
  program: READ_IMPL_DEPLOYED.script, lockingBytecode: READ_IMPL_DEPLOYED.lockingBytecode,
};
const READ_PROXY: DeployedContract = {
  name: READ_PROXY_ARTIFACT.contractName, category: READ_ROOT_CATEGORY, address: READ_ROOT_ADDRESS,
  program: READ_PROXY_DEPLOYED.script, lockingBytecode: READ_PROXY_DEPLOYED.lockingBytecode,
};
const READER: DeployedContract = {
  name: READER_ARTIFACT.contractName, category: READER_CATEGORY, address: READER_ADDRESS,
  program: READER_DEPLOYED.script, lockingBytecode: READER_DEPLOYED.lockingBytecode,
};
const READ_ROOT = rootOf(READ_PROXY_ARTIFACT.contractName, '__fallback', READ_RECORD_MASTER);

/** The commitment the read root's proxy record materializes, from the shipped encoder. */
function readRecordOf(total: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(READ_PROXY_ARTIFACT.stateLayout!, { implementation: READ_IMPL_ADDRESS, total }, 0),
    'hex'));
}

/** Builds the read composition: a proxied root whose delegate frame makes one read-only call per tag. */
function buildRead(): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Artifact[];
  readonly recordIndex: number;
  readonly total: bigint;
} {
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: READ_PROXY_ARTIFACT.contractName, masters: [READ_RECORD_MASTER],
      validator: { id: READ_VALIDATOR_ID, settles: [] as readonly string[] }, state: [READ_RECORD_ID],
    },
    { contract: READ_IMPL_ARTIFACT.contractName, masters: [READ_IMPL_MASTER], state: [] as readonly string[] },
    { contract: READER_ARTIFACT.contractName, masters: [...READ_MASTERS], state: [READER_RECORD_ID] },
  ];
  const layout = layoutWithFacets(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const recordIndex = indexOf(READ_RECORD_ID);
  const readerIndex = indexOf(READER_RECORD_ID);

  const recordBefore = readRecordOf(0n);
  const recordAfter = readRecordOf(TOTAL);
  const recordWrite: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordAfter,
  };
  const recordRead: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordBefore, viewOut: recordBefore,
  };
  const recordResumed: RecordEntry = {
    in: recordIndex, out: recordIndex, viewIn: recordAfter, viewOut: recordAfter,
  };
  const readerCommitment = new Uint8Array(Buffer.from(
    buildPushdataCommitment(READER_ARTIFACT.stateLayout!, { n: READER_N }, 0), 'hex'));
  const readerRead: RecordEntry = {
    in: readerIndex, out: readerIndex, viewIn: readerCommitment, viewOut: readerCommitment,
  };

  const tagSelector = selectorOf({ Reader: READER_ARTIFACT }, 'Reader', 'tag');
  const readPushes = (index: number): readonly Uint8Array[] =>
    [tagSelector, encodeIntegerValue(TAGS[index]!)];
  const runSelector = selectorOf({ RootRead: READ_IMPL_ARTIFACT }, 'RootRead', 'run');

  const proxyMaster: DraftMaster = master({
    master: READ_RECORD_MASTER, contract: READ_PROXY_ARTIFACT.contractName, entry: '__fallback',
    program: READ_PROXY.program,
    facts: {
      contract: READ_PROXY_ARTIFACT.contractName, functionName: '__fallback', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: READ_PROXY.address, value: 0n },
    enteredBy: READ_USER_ID, origin: READ_USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: READ_IMPL_MASTER, target: READ_IMPL.address, value: 0n,
      argumentPushes: [runSelector],
    }],
    segments: [[recordRead], [recordResumed]],
    // The fallback's one parameter is the frame's own call-data band: the caller's selector push.
    argumentPushes: [runSelector],
    dispatches: true,
  });
  const implMaster: DraftMaster = master({
    master: READ_IMPL_MASTER, contract: READ_IMPL_ARTIFACT.contractName, entry: 'run',
    program: READ_IMPL.program,
    facts: {
      contract: READ_IMPL_ARTIFACT.contractName, functionName: 'run', kind: FrameKind.DELEGATE,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: READ_PROXY.address, value: 0n },
    enteredBy: READ_RECORD_MASTER, origin: READ_USER_ID,
    calls: TAGS.map((_tag, index) => ({
      kind: FrameKind.STATIC, callee: READ_MASTERS[index]!, target: READER.address, value: 0n,
      argumentPushes: readPushes(index),
    })),
    segments: [[recordRead], [recordRead], [recordRead], [recordWrite]],
    argumentPushes: [runSelector],
  });
  const readerMaster = (index: number): DraftMaster => ({
    ...master({
      master: READ_MASTERS[index]!, contract: READER_ARTIFACT.contractName, entry: 'tag', program: READER.program,
      facts: {
        contract: READER_ARTIFACT.contractName, functionName: 'tag', kind: FrameKind.STATIC,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
        mastersOfContract: READ_MASTERS.length,
      },
      frame: { kind: FrameKind.STATIC, sender: READ_PROXY.address, self: READER.address, value: 0n },
      enteredBy: READ_IMPL_MASTER, origin: READ_USER_ID, argumentPushes: readPushes(index),
      segments: [[readerRead]],
    }),
    retval: encodeResultList([encodeIntegerValue(TAG_VALUES[index]!)]),
  });

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(READ_ROOT_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(READ_ROOT_CATEGORY, 'mutable', recordBefore),
  };
  const readerSource = {
    lockingBytecode: stateRecordLockingBytecode(READER_CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(READER_CATEGORY, 'mutable', readerCommitment),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([READ_USER_ID], layout.funderInputBase),
    masters: [proxyMaster, implMaster, ...TAGS.map((_tag, index) => readerMaster(index))],
    inputs: {
      [READ_RECORD_MASTER]: { source: masterInput(READ_PROXY) },
      [READ_IMPL_MASTER]: { source: masterInput(READ_IMPL) },
      ...Object.fromEntries(READ_MASTERS.map((id) => [id, { source: masterInput(READER) }])),
      [READ_VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(READ_ROOT_CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(READ_ROOT_CATEGORY, 'mutable'),
        },
      },
      [READ_RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(READ_ROOT_CATEGORY, 'mutable', recordAfter) },
        unlockingBytecode: stateRecordUnlockingBytecode(READ_ROOT_CATEGORY_HEX, indexOf(READ_RECORD_MASTER), 1),
      },
      // The reader's record is only ever read, so its input takes the data NFT covenant's read-only path.
      [READER_RECORD_ID]: {
        source: readerSource, output: { ...readerSource },
        unlockingBytecode: stateRecordUnlockingBytecode(READER_CATEGORY_HEX, 0, 0),
      },
      [READ_USER_ID]: userInput(),
    },
    validator: {
      id: READ_VALIDATOR_ID, covers: [READ_IMPL_ARTIFACT.contractName, READER_ARTIFACT.contractName],
      settles: [
        { category: READ_ROOT_CATEGORY, stateInputs: [READ_RECORD_ID] },
        { category: READER_CATEGORY, stateInputs: [READER_RECORD_ID] },
      ],
      redeemScript: validatorFor(READ_ROOT_CATEGORY).redeem,
    },
  };
  return {
    plan, artifacts: [READ_PROXY_ARTIFACT, READ_IMPL_ARTIFACT, READER_ARTIFACT], recordIndex, total: TOTAL,
  };
}

describe('a proxied root reading a second contract once per tag', () => {
  it('settles every read and stores the sum the entry read back out of them', () => {
    const built = buildRead();
    const outcome = composeAndDerive(built.plan, built.artifacts, [READ_ROOT]);

    expect(refused(outcome)).toStrictEqual([]);
    // Each read completes before the delegate frame that made it, and the reads complete in source order.
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual([
      ...READ_MASTERS, READ_IMPL_MASTER, READ_RECORD_MASTER,
    ]);
    // The value the caller stored is the sum of what it read, read back out of the record the shipped encoder
    // materializes for exactly that value.
    expect(outcome.transaction.outputs[built.recordIndex]!.token!.nft!.commitment)
      .toStrictEqual(readRecordOf(built.total));
    expect(built.total).toBe(21n);
  });
});

describe('a root whose store appends carry run-time arguments', () => {
  it('settles appends whose items are run-time scalars, and the log grows', () => {
    // The typed call is the caller's own site, so a run-time item is framed by the compiler's canonical push and
    // the store's dispatcher reads it: the run reaches the store and the log grows in the store proxy's records.
    const built = buildAppend(RUNTIME_SETUP);
    const outcome = composeAndDerive(built.plan, built.artifacts, [built.root]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual([
      STORE_IMPL_MASTERS[0], STORE_PROXY_MASTERS[0], STORE_IMPL_MASTERS[1], STORE_PROXY_MASTERS[1],
      IMPL_MASTER, PROXY_MASTER,
    ]);
    // The store's header and chunk carry the run the run-time items named, from the shipped encoders.
    expect(bytesToHex(outcome.transaction.outputs[built.headerIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(built.headers[2]!));
    const finalChunk = splitValueIntoChunks(built.stages[2]!).map((piece, index) => chunkOf(index, piece));
    expect(bytesToHex(outcome.transaction.outputs[built.chunkIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(finalChunk[0]!));
  });
});

