import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  argsHash,
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  computeFunctionSelector,
  encodeArgumentList,
  encodeEventCommitment,
  encodeIntegerValue,
  packFixedWidthElement,
  splitValueIntoChunks,
  type Artifact,
  type RecordEntry,
  type StateLayout,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode, type DeployedMaster,
} from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, generateProxySource } from '../../../src/framed/proxy/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, composeAndDerive, entryName, hexOf, master, masterInput, rootOf,
  selectorOf, token, userInput, userInputs, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  createComposedDerivationHost, layOutChunkRun, participant, planChunkRun,
  type ChunkRecordPlacement, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * One appender entered through a proxy's fallback more than once.
 *
 * The implementation declares the address its proxy forwards to beside a dynamic `int[]`, and its `append` pushes
 * onto that array and emits an event. A framed write rebuilds the record commitment from the fields the
 * *writer's own source declares, so the generated proxy mirrors the implementation's fields exactly; the two
 * records carry the same bytes, and the deployment's shared-layout rule holds by construction.
 *
 * The shape driven here enters the proxy's fallback once per append, and each entry forwards the call data it
 * received to the address the proxy's record holds, so the implementation's `append` runs as a `DELEGATE` frame on
 * the proxy's records: the run is carried from one frame to the next and each append emits. Every coordinate comes
 * from `layoutTransaction`/`participant`, the run's records from `planChunkRun`/`layOutChunkRun`, and every
 * commitment from the shipped encoders; no coordinate in the plan is a literal.
 *
 * The composition is driven both ways. A user enters the fallback as a root frame, one signed input per append, and
 * supplies the entry's own call data as the band. A contract enters it as a typed call frame: the hub declares the
 * implementation's interface and spells `append(item)`, so the frame the proxy's fallback master receives carries
 * exactly that selector and argument push. The fallback materializes its `input` from the whole band and forwards
 * it, so the implementation's dispatcher reads the same bytes the hub's site recorded. Both settle, and the call
 * frame's band is the reason a fallback cannot be called with the framed call data alone.
 */

const PROXY_LABEL = 'proxied append run proxy';
const IMPL_LABEL = 'proxied append run implementation';
const HUB_LABEL = 'proxied append run hub';
const PROXY_CATEGORY = seededCategory(PROXY_LABEL);
const IMPL_CATEGORY = seededCategory(IMPL_LABEL);
const HUB_CATEGORY = seededCategory(HUB_LABEL);

const RECORD_ID = 'proxy-record';
const VALIDATOR_ID = 'validator';
const HUB_MASTER = 'hub-1';

/** The appends the composition makes; each is the same parameterless call, so the element each pushes is fixed. */
const APPEND_COUNT = 2;
/** The element `append` pushes and the id its event carries. */
const APPEND = { id: 1n, item: 10n } as const;
/** The selector of the forwarding entry a caller without the implementation's interface enters a proxy by. */
const FORWARD_SELECTOR = computeFunctionSelector('forward(bytes)');

const proxyMasterId = (turn: number): string => `proxy-${turn}`;
const implMasterId = (turn: number): string => `impl-${turn}`;
/** The signed input that enters the fallback for one append. */
const rootUserId = (turn: number): string => `caller-${turn}`;

/**
 * The implementation the proxy is generated from.
 *
 * It declares the field a fallback forwards to, so the generated proxy can mirror its record exactly. `append`
 * takes no parameters: the fallback forwards the call data it received byte for byte, and for a parameterless entry
 * that call data is the selector push alone. `append` writes the dynamic array and emits; making no call of its own
 * is what keeps it admissible while a body that both touched the dynamic value and called would be refused by name.
 */
const IMPL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int[] items;'
  + '   event Appended(int indexed id, int item);'
  + '   function append(int item) {'
  + '     this.items.push(item);'
  + `     emit Appended(${APPEND.id}, item);`
  + '     require(true);'
  + '   }'
  + ' }';

/**
 * The hub source: one unrolled typed call to the proxy's address per append.
 *
 * A contract reaches a proxy the way it reaches any implementation: it declares the implementation's interface and
 * spells the entry, so the call the proxy's fallback master receives is the implementation's own call data. The
 * proxy's fallback materializes its `input` from that whole band, so the implementation's dispatcher reads exactly
 * the selector and argument pushes the hub's site recorded.
 */
function hubSource(proxyAddress: Uint8Array, appends: number): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IStore { function append(int item); }'
    + ' contract Hub {'
    + '   function go(int item) {'
    + Array.from({ length: appends }, () =>
      `     IStore(0x${hexOf(proxyAddress)}).append(item);`).join('\n')
    + '     require(true);'
    + '   }'
    + ' }';
}

/**
 * The forwarding spelling of the same shape: the hub declares a `forward(bytes)` interface and hands the proxy the
 * item's push.
 *
 * A caller without the implementation's interface can still reach it: it hands the proxy the argument the
 * implementation's dispatcher reads, and the fallback's `input` band carries the forwarding selector, then that
 * argument's push, which the delegate frame passes on unchanged.
 */
function forwardHubSource(proxyAddress: Uint8Array, payload: Uint8Array, appends: number): string {
  const framed = bytesToHex(payload);
  return 'pragma solidcash ^0.14.0;'
    + ' interface IProxy { function forward(bytes payload); }'
    + ' contract Hub {'
    + '   function go() {'
    + Array.from({ length: appends }, () =>
      `     IProxy(0x${hexOf(proxyAddress)}).forward(hex"${framed}");`).join('\n')
    + '     require(true);'
    + '   }'
    + ' }';
}

/** The element stream the run starts with: four elements, the chunk boundary already crossed. */
const SPENT_ITEMS: readonly bigint[] = [7n, 8n, 9n, 11n];

const ELEMENT_WIDTH = packFixedWidthElement(1n, 'int256').length;

/** The element stream a chunk-packed `int[]` holds: each element packed at the type's fixed width. */
function itemsBytes(values: readonly bigint[]): Uint8Array {
  const bytes = new Uint8Array(values.length * ELEMENT_WIDTH);
  values.forEach((value, index) => bytes.set(packFixedWidthElement(value, 'int256'), index * ELEMENT_WIDTH));
  return bytes;
}

/** The record's commitment for a state of the implementation's layout, from the shipped encoder. */
function recordCommitment(layout: StateLayout, implementation: Uint8Array, items: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, { implementation, items }, 0), 'hex'));
}

/** One chunk commitment of a run holding this element stream, from the shipped encoder. */
function chunkOf(index: number, bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(buildChunkCommitment(index, bytes), 'hex'));
}

/** A compiled, deployed contract in the shape the harness's helpers take. */
function deployed(name: string, category: Uint8Array, held: DeployedMaster): DeployedContract {
  return { name, category, address: held.address, program: held.script, lockingBytecode: held.lockingBytecode };
}

/**
 * The generated proxy of an implementation, compiled by this suite's compiler from the shipped generator's source.
 */
function buildProxyFromSource(implementationArtifact: NonNullable<ReturnType<typeof compileStringMulti>['Impl']>):
ReturnType<typeof buildProxyArtifact> {
  const generated = compileStringMulti(generateProxySource(implementationArtifact), {
    composition: 'framed', commitmentLimit: implementationArtifact.stateLayout!.commitmentLimit,
  });
  const artifact = generated[`${implementationArtifact.contractName}Proxy`];
  if (artifact === undefined) throw new Error('the generated proxy source did not compile to a contract');
  return artifact;
}

/** The contracts a built composition compiles, in the order the composer is asked for their tables. */
interface CompiledContracts {
  readonly proxyArtifact: ReturnType<typeof buildProxyFromSource>;
  readonly implementationArtifact: NonNullable<ReturnType<typeof compileStringMulti>['Impl']>;
  readonly hubArtifact?: NonNullable<ReturnType<typeof compileStringMulti>['Hub']>;
}

interface Built {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Pick<Artifact, 'composition'>[];
  readonly layout: StateLayout;
  readonly proxy: DeployedContract;
  readonly impl: DeployedContract;
  readonly headers: readonly Uint8Array[];
  readonly stages: readonly Uint8Array[];
  readonly records: readonly ChunkRecordPlacement[];
  /** The payload every append's event carries, from the implementation's declared event. */
  readonly eventPayload: Uint8Array;
  /** The implementation's `append` selector. */
  readonly appendSelector: Uint8Array;
  readonly proxyContract: string;
  readonly implementationContract: string;
  readonly hubContract?: string;
  /** The root requests: one entry into the fallback per append. */
  readonly roots: readonly ReturnType<typeof rootOf>[];
}

/** Compiles the implementation, generates the proxy from its layout, and deploys both at seeded categories. */
function compileAndDeployHalf(): {
  readonly contracts: CompiledContracts;
  readonly proxy: DeployedContract;
  readonly impl: DeployedContract;
  readonly layout: StateLayout;
} {
  const implementationArtifact = compileStringMulti(IMPL_SOURCE, { composition: 'framed' }).Impl!;
  // The generated proxy source, compiled by the same compiler this suite imports, so the composition, the
  // implementation it drives and the generated proxy are one build.
  const proxyArtifact = buildProxyFromSource(implementationArtifact);
  const impl = deployed(implementationArtifact.contractName, IMPL_CATEGORY,
    deployMaster(implementationArtifact, IMPL_CATEGORY, VALIDATOR_PROGRAM));
  const proxy = deployed(proxyArtifact.contractName, PROXY_CATEGORY,
    deployMaster(proxyArtifact, PROXY_CATEGORY, VALIDATOR_PROGRAM));
  return {
    contracts: { proxyArtifact, implementationArtifact }, proxy, impl, layout: proxyArtifact.stateLayout!,
  };
}

/**
 * Lays the repeated append out for the proxy hop.
 *
 * The fallback is the composition's root frame once per append, entered by the signed input the layout places for
 * it. The proxy's block holds one master per entry, the validator, the record and the run's chunks, and the
 * implementation's block follows with one master per entry. The run the implementation writes on turn `t` reads the
 * header and chunks turn `t - 1` left and writes the ones turn `t` computes, so each chunk is kept in place and the
 * value grows inside it.
 */
function build(): Built {
  const { contracts, proxy, impl, layout } = compileAndDeployHalf();
  const { proxyArtifact, implementationArtifact } = contracts;
  const proxyContract = proxyArtifact.contractName;
  const implementationContract = implementationArtifact.contractName;

  // The element stream at each turn's boundary: the appended element crosses nothing, so the run keeps its two
  // chunks and the value grows inside them from stage to stage.
  const stages = Array.from({ length: APPEND_COUNT + 1 }, (_unused, turn) =>
    itemsBytes([...SPENT_ITEMS, ...Array.from({ length: turn }, () => APPEND.item)]));
  const headers = stages.map((bytes) => recordCommitment(layout, impl.address, bytes));

  const appendSelector = selectorOf({ Impl: implementationArtifact }, 'Impl', 'append');
  // The callee's argument pushes carry the last parameter first: the selector, then the item. That band is what
  // the fallback's one parameter carries and what the user supplies.
  const appendPushes = [appendSelector, encodeIntegerValue(APPEND.item)];

  const runPlan = planChunkRun({ layout, variable: 'items', spent: stages[0]!, written: stages[APPEND_COUNT]! });

  // A probe with the run's records fixes the geometry: the record is the proxy block's first state UTXO and the
  // run's band begins one layout width past it.
  const probeState = [RECORD_ID, ...runPlan.written.chunks.map((_chunk, offset) => `items#probe${offset}`)];
  const probeLayout = layoutWithFacets([
    {
      contract: proxyContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => proxyMasterId(t + 1)),
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: probeState,
    },
    {
      contract: implementationContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => implMasterId(t + 1)),
      state: [] as readonly string[],
    },
  ]);
  const recordIndex = participant(probeLayout, RECORD_ID).index;
  const proxyIndex = participant(probeLayout, proxyMasterId(1)).index;
  const base = recordIndex + layout.dataNftCount;

  const run = layOutChunkRun({
    plan: runPlan, category: PROXY_CATEGORY, base, writer: proxyIndex, valueSatoshis: 1_000n,
  });
  const records = run.records;
  const keptIds = records.map((record) => record.id);

  const blocks = [
    {
      contract: proxyContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => proxyMasterId(t + 1)),
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID, ...keptIds],
    },
    {
      contract: implementationContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => implMasterId(t + 1)),
      state: [] as readonly string[],
    },
  ];
  const layoutTx = layoutWithFacets(blocks);
  if (participant(layoutTx, RECORD_ID).index !== recordIndex) {
    throw new Error('the probe fixed a record index the final layout does not place the record at');
  }

  const recordEntry = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
    ({ in: recordIndex, out: recordIndex, viewIn, viewOut });

  /**
   * The run entries one frame declares for its own turn, from the shipped plan's records.
   *
   * Every chunk is kept in place across this run, so each entry reads what the turn before wrote and closes against
   * what its own append computes.
   */
  const chunkEntries = (turn: number): readonly RecordEntry[] => records.map((record, offset) => {
    const before = splitValueIntoChunks(stages[turn - 1]!).map((piece, index) => chunkOf(index, piece));
    const after = splitValueIntoChunks(stages[turn]!).map((piece, index) => chunkOf(index, piece));
    return { in: record.index, out: record.index, viewIn: before[offset]!, viewOut: after[offset]! };
  });

  // The proxy root frame reads the record before its hop and resumes from what the implementation wrote after it;
  // the frame the user's own unlocking enters carries its received call data as the fallback's argument.
  const proxyMaster = (turn: number): DraftMaster => master({
    master: proxyMasterId(turn), contract: proxyContract, entry: '__fallback', program: proxy.program,
    facts: {
      contract: proxyContract, functionName: entryName(proxyContract, '__fallback'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: APPEND_COUNT,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: rootUserId(turn), origin: rootUserId(turn),
    calls: [{
      kind: FrameKind.DELEGATE, callee: implMasterId(turn), target: impl.address, value: 0n,
      argumentPushes: appendPushes,
    }],
    segments: [[recordEntry(headers[turn - 1]!, headers[turn - 1]!)], [recordEntry(headers[turn]!, headers[turn]!)]],
    // The fallback's one parameter is the frame's own call-data band: the selector push and the item's push, which
    // is exactly the call data the user supplies for the entry.
    argumentPushes: appendPushes,
    dispatches: true,
  });

  const implMaster = (turn: number): DraftMaster => master({
    master: implMasterId(turn), contract: implementationContract, entry: 'append', program: impl.program,
    facts: {
      contract: implementationContract, functionName: entryName(implementationContract, 'append'),
      kind: FrameKind.DELEGATE, callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
      mastersOfContract: APPEND_COUNT,
    },
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: proxyMasterId(turn), origin: rootUserId(turn),
    calls: [],
    // The delegate frame writes the proxy's record and the run's chunks: it reads what the turn before left and
    // closes its segment against what its own append computes.
    segments: [[recordEntry(headers[turn - 1]!, headers[turn]!), ...chunkEntries(turn)]],
    argumentPushes: appendPushes,
  });

  // Events come first in the trailing region, one per append at the output the layout gives it.
  const event = implementationArtifact.events![0]!;
  const payload = encodeEventCommitment(event.parameters, [APPEND.id, APPEND.item]);
  const emitted = Array.from({ length: APPEND_COUNT }, () => eventOutput(PROXY_CATEGORY, event.signature, payload));
  const eventIndices = Array.from(
    { length: APPEND_COUNT }, (_unused, offset) => layoutTx.participantCount + offset,
  );

  const proxyCategoryHex = bytesToHex(PROXY_CATEGORY);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(PROXY_CATEGORY, 'mutable', headers[0]!),
  };
  const validator = validatorFor(PROXY_CATEGORY);
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs(
      Array.from({ length: APPEND_COUNT }, (_unused, turn) => rootUserId(turn + 1)), layoutTx.funderInputBase,
    ),
    masters: [
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => proxyMaster(turn + 1)),
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => ({
        ...implMaster(turn + 1), events: [eventIndices[turn]!],
      })),
    ],
    inputs: {
      ...Object.fromEntries(Array.from({ length: APPEND_COUNT },
        (_unused, turn) => [proxyMasterId(turn + 1), { source: masterInput(proxy) }])),
      ...Object.fromEntries(Array.from({ length: APPEND_COUNT },
        (_unused, turn) => [implMasterId(turn + 1), { source: masterInput(impl) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(PROXY_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(PROXY_CATEGORY, 'mutable', headers[APPEND_COUNT]!) },
        // The write rebuilds the proxy's record; the covenant authorizes it by the proxy's own master, which
        // carries the proxy category's minting NFT.
        unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, proxyIndex, 1),
      },
      ...Object.fromEntries(records.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      ...Object.fromEntries(Array.from({ length: APPEND_COUNT },
        (_unused, turn) => [rootUserId(turn + 1), userInput()])),
    },
    trailingOutputs: emitted,
    validator: {
      id: VALIDATOR_ID, covers: [implementationContract],
      // The implementation runs two delegate frames, so the validator must settle its category too, although the
      // implementation itself keeps no state UTXO: the value it writes lives in the proxy's record.
      settles: [
        { category: PROXY_CATEGORY, stateInputs: [RECORD_ID, ...keptIds] },
        { category: IMPL_CATEGORY, stateInputs: [] },
      ],
      redeemScript: validator.redeem,
    },
  };

  return {
    plan, artifacts: [proxyArtifact, implementationArtifact], layout, proxy, impl, headers, stages, records,
    eventPayload: payload, appendSelector, proxyContract, implementationContract,
    roots: Array.from({ length: APPEND_COUNT }, (_unused, turn) =>
      rootOf(proxyContract, '__fallback', proxyMasterId(turn + 1))),
  };
}

/**
 * Lays the same appends out with a hub as the single root calling the proxy's fallback once per append.
 *
 * This is the shape a contract's own entry drives. The hub makes the implementation's typed call once per append;
 * the proxy's fallback is entered as a `CALL` frame, materializes its `input` from the frame's whole call-data band,
 * and delegates to the implementation, which runs on the proxy's records.
 */
function buildHubCall(forward = false): Built {
  const { contracts, proxy, impl, layout } = compileAndDeployHalf();
  const { proxyArtifact, implementationArtifact } = contracts;
  const proxyContract = proxyArtifact.contractName;
  const implementationContract = implementationArtifact.contractName;

  const stages = Array.from({ length: APPEND_COUNT + 1 }, (_unused, turn) =>
    itemsBytes([...SPENT_ITEMS, ...Array.from({ length: turn }, () => APPEND.item)]));
  const headers = stages.map((bytes) => recordCommitment(layout, impl.address, bytes));

  const appendSelector = selectorOf({ Impl: implementationArtifact }, 'Impl', 'append');
  // The call the hub makes: the implementation's selector, then the item's push. The proxy's fallback materializes
  // the whole band that frame carries, so the implementation's dispatcher reads it unchanged. The forwarding
  // spelling hands the same band over with the forwarding selector in the selector's place.
  const argumentPushes = forward
    ? [FORWARD_SELECTOR, encodeIntegerValue(APPEND.item)]
    : [appendSelector, encodeIntegerValue(APPEND.item)];

  const hubArtifact = compileStringMulti(forward
    ? forwardHubSource(proxy.address, encodeIntegerValue(APPEND.item), APPEND_COUNT)
    : hubSource(proxy.address, APPEND_COUNT), {
    composition: 'framed',
  }).Hub!;
  const hub = deployed(hubArtifact.contractName, HUB_CATEGORY,
    deployMaster(hubArtifact, HUB_CATEGORY, VALIDATOR_PROGRAM));
  const hubContract = hubArtifact.contractName;

  const runPlan = planChunkRun({ layout, variable: 'items', spent: stages[0]!, written: stages[APPEND_COUNT]! });
  const probeState = [RECORD_ID, ...runPlan.written.chunks.map((_chunk, offset) => `items#probe${offset}`)];
  const probeLayout = layoutWithFacets([
    {
      contract: hubContract, masters: [HUB_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [] as readonly string[],
    },
    {
      contract: proxyContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => proxyMasterId(t + 1)),
      state: probeState,
    },
    {
      contract: implementationContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => implMasterId(t + 1)),
      state: [] as readonly string[],
    },
  ]);
  const recordIndex = participant(probeLayout, RECORD_ID).index;
  const proxyIndex = participant(probeLayout, proxyMasterId(1)).index;
  const base = recordIndex + layout.dataNftCount;

  const run = layOutChunkRun({
    plan: runPlan, category: PROXY_CATEGORY, base, writer: proxyIndex, valueSatoshis: 1_000n,
  });
  const records = run.records;
  const keptIds = records.map((record) => record.id);

  const blocks = [
    {
      contract: hubContract, masters: [HUB_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [] as readonly string[],
    },
    {
      contract: proxyContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => proxyMasterId(t + 1)),
      state: [RECORD_ID, ...keptIds],
    },
    {
      contract: implementationContract, masters: Array.from({ length: APPEND_COUNT }, (_u, t) => implMasterId(t + 1)),
      state: [] as readonly string[],
    },
  ];
  const layoutTx = layoutWithFacets(blocks);

  const recordEntry = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
    ({ in: recordIndex, out: recordIndex, viewIn, viewOut });
  const chunkEntries = (turn: number): readonly RecordEntry[] => records.map((record, offset) => {
    const before = splitValueIntoChunks(stages[turn - 1]!).map((piece, index) => chunkOf(index, piece));
    const after = splitValueIntoChunks(stages[turn]!).map((piece, index) => chunkOf(index, piece));
    return { in: record.index, out: record.index, viewIn: before[offset]!, viewOut: after[offset]! };
  });

  const hubMaster: DraftMaster = master({
    master: HUB_MASTER, contract: hubContract, entry: 'go', program: hub.program,
    facts: {
      contract: hubContract, functionName: entryName(hubContract, 'go'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: Array.from({ length: APPEND_COUNT }, (_unused, turn) => ({
      kind: FrameKind.CALL, callee: proxyMasterId(turn + 1), target: proxy.address, value: 0n, argumentPushes,
    })),
    segments: Array.from({ length: APPEND_COUNT + 1 }, () => []),
    // The typed `go` takes the item, so the user supplies its push and the site frames it as a run-time argument.
    // The forwarding `go` takes nothing: its whole call data is the frame's band.
    ...(forward ? {} : { argumentPushes: [encodeIntegerValue(APPEND.item)], dispatches: true }),
  });

  const proxyMaster = (turn: number): DraftMaster => master({
    master: proxyMasterId(turn), contract: proxyContract, entry: '__fallback', program: proxy.program,
    facts: {
      contract: proxyContract, functionName: entryName(proxyContract, '__fallback'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: APPEND_COUNT,
    },
    frame: { kind: FrameKind.CALL, sender: hub.address, self: proxy.address, value: 0n },
    enteredBy: HUB_MASTER, origin: 'user',
    calls: [{
      // The fallback forwards the band it received, which is the caller's whole call data: the forwarding
      // selector's push and the framed bytes. The delegate callee's call data is that band.
      kind: FrameKind.DELEGATE, callee: implMasterId(turn), target: impl.address, value: 0n,
      argumentPushes,
    }],
    segments: [[recordEntry(headers[turn - 1]!, headers[turn - 1]!)], [recordEntry(headers[turn]!, headers[turn]!)]],
    argumentPushes,
  });

  const implMaster = (turn: number): DraftMaster => master({
    master: implMasterId(turn), contract: implementationContract, entry: 'append', program: impl.program,
    facts: {
      contract: implementationContract, functionName: entryName(implementationContract, 'append'),
      kind: FrameKind.DELEGATE, callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
      mastersOfContract: APPEND_COUNT,
    },
    frame: { kind: FrameKind.DELEGATE, sender: hub.address, self: proxy.address, value: 0n },
    enteredBy: proxyMasterId(turn), origin: 'user',
    calls: [],
    segments: [[recordEntry(headers[turn - 1]!, headers[turn]!), ...chunkEntries(turn)]],
    argumentPushes,
  });

  const event = implementationArtifact.events![0]!;
  const payload = encodeEventCommitment(event.parameters, [APPEND.id, APPEND.item]);
  const emitted = Array.from({ length: APPEND_COUNT }, () => eventOutput(PROXY_CATEGORY, event.signature, payload));
  const eventIndices = Array.from(
    { length: APPEND_COUNT }, (_unused, offset) => layoutTx.participantCount + offset,
  );

  const proxyCategoryHex = bytesToHex(PROXY_CATEGORY);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(PROXY_CATEGORY, 'mutable', headers[0]!),
  };
  const validator = validatorFor(HUB_CATEGORY);
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs(['user'], layoutTx.funderInputBase),
    masters: [
      hubMaster,
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => proxyMaster(turn + 1)),
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => ({
        ...implMaster(turn + 1), events: [eventIndices[turn]!],
      })),
    ],
    inputs: {
      [HUB_MASTER]: { source: masterInput(hub) },
      ...Object.fromEntries(Array.from({ length: APPEND_COUNT },
        (_unused, turn) => [proxyMasterId(turn + 1), { source: masterInput(proxy) }])),
      ...Object.fromEntries(Array.from({ length: APPEND_COUNT },
        (_unused, turn) => [implMasterId(turn + 1), { source: masterInput(impl) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(HUB_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(PROXY_CATEGORY, 'mutable', headers[APPEND_COUNT]!) },
        unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, proxyIndex, 1),
      },
      ...Object.fromEntries(records.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      user: userInput(),
    },
    trailingOutputs: emitted,
    validator: {
      id: VALIDATOR_ID, covers: [proxyContract, implementationContract],
      settles: [
        { category: PROXY_CATEGORY, stateInputs: [RECORD_ID, ...keptIds] },
        { category: IMPL_CATEGORY, stateInputs: [] },
      ],
      redeemScript: validator.redeem,
    },
  };

  return {
    plan, artifacts: [hubArtifact, proxyArtifact, implementationArtifact], layout, proxy, impl, headers, stages,
    records, eventPayload: payload, appendSelector, proxyContract, implementationContract, hubContract,
    roots: [rootOf(hubContract, 'go', HUB_MASTER)],
  };
}

/** Composes, derives and evaluates a built shape; every participant's input is asked of the real machine. */
function settleOutcome(built: Built): ReturnType<typeof composeAndDerive> {
  return composeAndDerive(built.plan, built.artifacts, built.roots);
}

/** A built shape and its settled outcome. */
interface Settled {
  readonly built: Built;
  readonly outcome: ReturnType<typeof composeAndDerive>;
}

function settledOf(built: Built): Settled {
  return { built, outcome: settleOutcome(built) };
}

let userEntered: Settled | undefined;
let hubEntered: Settled | undefined;

/** The user-entered appends, settled once: the cases that read them change nothing in them. */
function settledUserEntered(): Settled {
  userEntered ??= settledOf(build());
  return userEntered;
}

/** The hub-entered appends, settled once: the cases that read them change nothing in them. */
function settledHubEntered(): Settled {
  hubEntered ??= settledOf(buildHubCall());
  return hubEntered;
}

// The generated proxy's layout mirror is pinned in `proxied-appends.test.ts`.
describe('an appender entered through a proxy\'s fallback more than once', () => {
  it('settles the repeated append: a delegate frame per entry, accepted at every contract input', () => {
    const { built, outcome } = settledUserEntered();
    // Each root's delegate callee completes before the root that forwarded to it, once per entry, in root order.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      ...Array.from({ length: APPEND_COUNT }, (_unused, _turn) => [
        entryName(built.implementationContract, 'append'),
        entryName(built.proxyContract, '__fallback'),
      ]).flat(),
    ]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // Every contract input is asked: each proxy master, each implementation master, the validator, the record and
    // every chunk of the run.
    const asked = new Set(outcome.verdicts.map((verdict) => verdict.participant));
    expect([...asked].sort()).toStrictEqual([
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => proxyMasterId(turn + 1)),
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => implMasterId(turn + 1)),
      VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID, ...built.records.map((record) => record.id),
    ].sort());
  });

  it('carries the run across frames: each delegate frame reads what the frame before it wrote', () => {
    const { built, outcome } = settledUserEntered();
    for (let turn = 1; turn <= APPEND_COUNT; turn += 1) {
      const impl = outcome.draft.blockOf(implMasterId(turn));
      expect(bytesToHex(impl.segments[0]![0]!.viewIn)).toBe(bytesToHex(built.headers[turn - 1]!));
      expect(bytesToHex(impl.segments[0]![0]!.viewOut)).toBe(bytesToHex(built.headers[turn]!));
      // Each chunk the frame declares reads the turn before's commitment and closes against its own.
      const before = splitValueIntoChunks(built.stages[turn - 1]!);
      const after = splitValueIntoChunks(built.stages[turn]!);
      built.records.forEach((record, offset) => {
        const entry = impl.segments[0]!.find((candidate) => candidate.in === record.index)!;
        expect(entry.viewIn).toStrictEqual(chunkOf(offset, before[offset]!));
        expect(entry.viewOut).toStrictEqual(chunkOf(offset, after[offset]!));
      });

      // The proxy resumes from the record the delegate frame wrote.
      const proxy = outcome.draft.blockOf(proxyMasterId(turn));
      expect(bytesToHex(proxy.segments[0]![0]!.viewOut)).toBe(bytesToHex(built.headers[turn - 1]!));
      expect(bytesToHex(proxy.segments[1]![0]!.viewIn)).toBe(bytesToHex(built.headers[turn]!));
    }
  });

  it('writes the run the appends computed: the header, every chunk and every event read back', () => {
    const { built, outcome } = settledUserEntered();
    const transaction = outcome.transaction;
    const final = built.stages[APPEND_COUNT]!;

    // The record output carries the element stream's length and every chunk its bytes, both from the shipped
    // encoder: the value grew inside the run the transaction keeps.
    expect(transaction.outputs[participant(outcome.draft.layout, RECORD_ID).index]!.token?.nft?.commitment)
      .toStrictEqual(recordCommitment(built.layout, built.impl.address, final));
    const chunks = splitValueIntoChunks(final).map((piece, index) => chunkOf(index, piece));
    expect(chunks).toHaveLength(2);
    built.records.forEach((record, offset) => {
      const index = participant(outcome.draft.layout, record.id).index;
      expect(transaction.outputs[index]!.token?.nft?.commitment).toStrictEqual(chunks[offset]);
    });

    // One event per append, each at the trailing output the plan placed it at, carrying the payload the body
    // computed.
    const eventIndices = outcome.draft.assembly.outputs.eventIndices;
    expect(eventIndices).toHaveLength(APPEND_COUNT);
    eventIndices.forEach((index) => {
      expect(transaction.outputs[index]!.token?.nft).toStrictEqual({
        capability: 'none', commitment: built.eventPayload,
      });
    });
  });

  it('refuses a record output no frame computed, on the same composition', () => {
    // The refused control. The same programs and witnesses, with only the record's output commitment replaced by a
    // value no frame computed: a frame reads its own declaration, so the implementation stays self-consistent, and
    // the settlement is what holds the declaration to the transaction. The validator refuses.
    const built = build();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: built.artifacts, plan: built.plan,
    });
    const recordIndex = participant(draft.layout, RECORD_ID).index;
    const program = draft.programFor(proxyMasterId(1));
    const wrongAddress = new Uint8Array(35);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === recordIndex
        ? {
          ...output,
          token: {
            ...output.token!,
            nft: { ...output.token!.nft!, commitment: recordCommitment(built.layout, wrongAddress, built.stages[0]!) },
          },
        }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs,
      transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });

  it('settles the hub-entered appends: the fallback receives the forwarded call data, then delegates', () => {
    const { built, outcome } = settledHubEntered();
    // Each append's delegate frame completes before the proxy fallback that forwarded to it, in call order, and
    // the hub that drove them all completes last.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      ...Array.from({ length: APPEND_COUNT }, (_unused, _turn) => [
        entryName(built.implementationContract, 'append'),
        entryName(built.proxyContract, '__fallback'),
      ]).flat(),
      entryName(built.hubContract!, 'go'),
    ]);
    // The fallback is entered by the hub's call, not by a user's root: every fallback frame the derivation ran
    // was a `CALL`.
    const fallbackFrames = outcome.completed
      .filter((frame) => frame.functionName === entryName(built.proxyContract, '__fallback'));
    expect(fallbackFrames).toHaveLength(APPEND_COUNT);
    expect(fallbackFrames.every((frame) => frame.kind === FrameKind.CALL)).toBe(true);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // Every contract input is asked: the hub, each proxy master, each implementation master, the validator, the
    // record and every chunk of the run.
    const asked = new Set(outcome.verdicts.map((verdict) => verdict.participant));
    expect([...asked].sort()).toStrictEqual([
      HUB_MASTER,
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => proxyMasterId(turn + 1)),
      ...Array.from({ length: APPEND_COUNT }, (_unused, turn) => implMasterId(turn + 1)),
      VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID, ...built.records.map((record) => record.id),
    ].sort());
  });

  it('binds the hub\'s call: the proxy frame runs on the call data the hub handed it', () => {
    const { built, outcome } = settledHubEntered();
    const layout = outcome.draft.layout;
    const hub = outcome.draft.blockOf(HUB_MASTER);
    // One typed call per append, each reaching the proxy input at its own place in the layout, and each record
    // carries the digest of the selector and the item push the hub's own site computed.
    expect(hub.calls).toHaveLength(APPEND_COUNT);
    hub.calls.forEach((call, turn) => {
      expect(call.kind).toBe(FrameKind.CALL);
      expect(call.target).toStrictEqual(built.proxy.address);
      expect(call.calleeRef).toBe(participant(layout, proxyMasterId(turn + 1)).index);
      expect(call.argsHash)
        .toStrictEqual(argsHash(built.appendSelector, encodeArgumentList([encodeIntegerValue(APPEND.item)])));
    });

    // The proxy runs a call frame entered by the hub; its fallback reads the whole call-data band and delegates to
    // the implementation, which runs as the proxy on the proxy's records.
    const proxy = outcome.draft.blockOf(proxyMasterId(1));
    expect(proxy.kind).toBe(FrameKind.CALL);
    expect(proxy.callerRef).toBe(participant(layout, HUB_MASTER).index);
    expect(proxy.sender).toStrictEqual(outcome.draft.blockOf(HUB_MASTER).self);
    expect(proxy.calls[0]!.kind).toBe(FrameKind.DELEGATE);
    expect(proxy.calls[0]!.target).toStrictEqual(built.impl.address);
    expect(proxy.calls[0]!.argsHash)
      .toStrictEqual(argsHash(built.appendSelector, encodeArgumentList([encodeIntegerValue(APPEND.item)])));
    const impl = outcome.draft.blockOf(implMasterId(1));
    expect(impl.kind).toBe(FrameKind.DELEGATE);
    expect(impl.self).toStrictEqual(built.proxy.address);
  });

  it('carries the run across frames: each delegate frame reads what the frame before it wrote', () => {
    const { built, outcome } = settledHubEntered();
    for (let turn = 1; turn <= APPEND_COUNT; turn += 1) {
      const impl = outcome.draft.blockOf(implMasterId(turn));
      expect(bytesToHex(impl.segments[0]![0]!.viewIn)).toBe(bytesToHex(built.headers[turn - 1]!));
      expect(bytesToHex(impl.segments[0]![0]!.viewOut)).toBe(bytesToHex(built.headers[turn]!));
      const before = splitValueIntoChunks(built.stages[turn - 1]!);
      const after = splitValueIntoChunks(built.stages[turn]!);
      built.records.forEach((record, offset) => {
        const entry = impl.segments[0]!.find((candidate) => candidate.in === record.index)!;
        expect(entry.viewIn).toStrictEqual(chunkOf(offset, before[offset]!));
        expect(entry.viewOut).toStrictEqual(chunkOf(offset, after[offset]!));
      });

      const proxy = outcome.draft.blockOf(proxyMasterId(turn));
      expect(bytesToHex(proxy.segments[0]![0]!.viewOut)).toBe(bytesToHex(built.headers[turn - 1]!));
      expect(bytesToHex(proxy.segments[1]![0]!.viewIn)).toBe(bytesToHex(built.headers[turn]!));
    }
  });

  it('writes the run the hub-called appends computed: the header, every chunk and every event read back', () => {
    const { built, outcome } = settledHubEntered();
    const transaction = outcome.transaction;
    const final = built.stages[APPEND_COUNT]!;

    expect(transaction.outputs[participant(outcome.draft.layout, RECORD_ID).index]!.token?.nft?.commitment)
      .toStrictEqual(recordCommitment(built.layout, built.impl.address, final));
    const chunks = splitValueIntoChunks(final).map((piece, index) => chunkOf(index, piece));
    expect(chunks).toHaveLength(2);
    built.records.forEach((record, offset) => {
      const index = participant(outcome.draft.layout, record.id).index;
      expect(transaction.outputs[index]!.token?.nft?.commitment).toStrictEqual(chunks[offset]);
    });

    const eventIndices = outcome.draft.assembly.outputs.eventIndices;
    expect(eventIndices).toHaveLength(APPEND_COUNT);
    eventIndices.forEach((index) => {
      expect(transaction.outputs[index]!.token?.nft).toStrictEqual({
        capability: 'none', commitment: built.eventPayload,
      });
    });
  });

  it('refuses the forwarding spelling: the implementation has no entry for the selector a caller forwards', () => {
    // A caller that spells `forward(bytes)` hands the proxy the item, and the fallback forwards the band it received
    // with that selector. The implementation's one entry requires its own selector, as the EVM's dispatcher does, so
    // a frame whose selector names no entry of it is refused rather than run as `append()`.
    expect(() => settleOutcome(buildHubCall(true)))
      .toThrowError(/FRAMED_DERIVATION_STALLED: master "impl-1" of Impl\.append\(\) filled no witness at site 0/);
  });
});
