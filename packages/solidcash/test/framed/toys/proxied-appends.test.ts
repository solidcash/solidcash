import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  FrameKind,
  INDEX_NONE,
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  encodeEventCommitment,
  encodeIntegerValue,
  packFixedWidthElement,
  splitValueIntoChunks,
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
  EMPTY, USER_LOCK, VALIDATOR_PROGRAM, composeAndDerive, entryName, master, masterInput, rootOf, selectorOf, token,
  userInput, userInputs, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import {
  chunkRecordId, createComposedDerivationHost, layOutChunkRun, participant,
  planChunkRun, type ChunkRecordPlacement, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * An append-shape entry driven behind a proxy.
 *
 * The implementation declares the address its proxy forwards to beside a dynamic `int[]`, and its `append` pushes
 * onto that array and emits an event. A framed write rebuilds the record commitment from the fields the
 * *writer's* own source declares, so the proxy has to declare the implementation's fields exactly;
 * `buildProxyArtifact` generates it from the implementation's published layout, so the two records carry the same
 * bytes and the deployment's shared-layout rule holds by construction.
 *
 * The composition enters the proxy's fallback as a root frame. The fallback forwards the call data it received to
 * the address the record holds, so the implementation's `append` runs as a `DELEGATE` frame on the proxy's records:
 * `msg.sender` and `address(this)` are the caller's and the proxy's, and the appends write chunks of the *proxy's*
 * category. The writer's own body touches the dynamic value and makes no call — the hop is the proxy's body — so the
 * shape the compiler refuses by name is not the one under test.
 *
 * The hop settles end to end: the implementation's segment declares the run its own `append` writes (the chunk it
 * keeps and the one it creates beside the event), and the machine accepts every contract input of the settled
 * transaction. A static entry through a generated proxy is `shapes/proxied-registration.test.ts`'s.
 *
 * Coordinates come from `layoutTransaction`/`participant`, frame references from `entryName`, and every commitment
 * from the shipped encoders; no coordinate in the plan is a literal.
 */

const PROXY_LABEL = 'proxied appends proxy';
const IMPL_LABEL = 'proxied appends implementation';
const PROXY_CATEGORY = seededCategory(PROXY_LABEL);
const IMPL_CATEGORY = seededCategory(IMPL_LABEL);

const RECORD_ID = 'proxy-record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const PROXY_MASTER = 'proxy-1';
const IMPL_MASTER = 'impl-1';

/** The append the implementation's entry makes; its two parameters ride the stack last one first. */
const APPEND = { id: 17n, item: 10n } as const;

/**
 * The implementation the proxy is generated from.
 *
 * It declares the field a fallback forwards to, so the generated proxy can mirror its record exactly. `append`
 * writes the dynamic array and emits; making no call is what keeps it admissible while a body that both touched the
 * dynamic value and called would be refused by name.
 */
const IMPL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int[] items;'
  + '   event Appended(int indexed id, int item);'
  + '   function append(int id, int item) {'
  + '     this.items.push(item);'
  + '     emit Appended(id, item);'
  + '     require(true);'
  + '   }'
  + ' }';

/** The element stream the run starts with: three elements, one 99-byte chunk. */
const SPENT_ITEMS: readonly bigint[] = [7n, 8n, 9n];
/** One more element crosses the 120-byte chunk boundary, so the append keeps a chunk and creates the next. */
const WRITTEN_ITEMS: readonly bigint[] = [...SPENT_ITEMS, APPEND.item];

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
  return {
    name, category, address: held.address, program: held.script, lockingBytecode: held.lockingBytecode,
  };
}

/** The generated proxy of an implementation, compiled by this suite's compiler from the shipped generator's source. */
function buildProxyFromSource(implementationArtifact: NonNullable<ReturnType<typeof compileStringMulti>['Impl']>):
ReturnType<typeof buildProxyArtifact> {
  const generated = compileStringMulti(generateProxySource(implementationArtifact), {
    composition: 'framed', commitmentLimit: implementationArtifact.stateLayout!.commitmentLimit,
  });
  const artifact = generated[`${implementationArtifact.contractName}Proxy`];
  if (artifact === undefined) throw new Error('the generated proxy source did not compile to a contract');
  return artifact;
}

/** Compiles the implementation, generates the proxy from its layout, and deploys both at seeded categories. */
function compileAndDeployHalf(): {
  readonly implementationArtifact: ReturnType<typeof compileStringMulti>['Impl'];
  readonly proxyArtifact: ReturnType<typeof buildProxyArtifact>;
  readonly proxy: DeployedContract;
  readonly impl: DeployedContract;
} {
  const artifacts = compileStringMulti(IMPL_SOURCE, { composition: 'framed' });
  const implementationArtifact = artifacts.Impl!;
  // The generated proxy source, compiled by the same compiler this suite imports, so the composition, the
  // implementation it drives and the generated proxy are one build. `buildProxyArtifact` compiles exactly this
  // source with exactly these options through the package's emitted bundle.
  const proxyArtifact = buildProxyFromSource(implementationArtifact);
  const proxy = deployed(proxyArtifact.contractName, PROXY_CATEGORY,
    deployMaster(proxyArtifact, PROXY_CATEGORY, VALIDATOR_PROGRAM));
  const impl = deployed(implementationArtifact.contractName, IMPL_CATEGORY,
    deployMaster(implementationArtifact, IMPL_CATEGORY, VALIDATOR_PROGRAM));
  return { implementationArtifact, proxyArtifact, proxy, impl };
}

interface Built {
  readonly plan: CompositionDraftPlan;
  readonly implementationArtifact: ReturnType<typeof compileStringMulti>['Impl'];
  readonly proxyArtifact: ReturnType<typeof buildProxyArtifact>;
  readonly layout: StateLayout;
  readonly proxy: DeployedContract;
  readonly impl: DeployedContract;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  /** The run's records, from the shipped chunk planner, with created entries remapped to their trailing outputs. */
  readonly records: readonly ChunkRecordPlacement[];
  readonly proxyContract: string;
  readonly implementationContract: string;
}

/**
 * Lays the append out for the proxy hop.
 *
 * The proxy's block holds its master, the validator and the record; the implementation's block follows. The run the
 * implementation writes keeps the chunk both stages hold and creates the one only the written value holds. The band
 * the emitted body reads begins one layout width past the frame's declared record block, which the layout places
 * right after the record; the created chunk is a trailing output, so its declaration is remapped there.
 */
function build(): Built {
  const { implementationArtifact, proxyArtifact, proxy, impl } = compileAndDeployHalf();
  const layout = proxyArtifact.stateLayout!;
  const proxyContract = proxyArtifact.contractName;
  const implementationContract = implementationArtifact.contractName;

  const spentItems = itemsBytes(SPENT_ITEMS);
  const writtenItems = itemsBytes(WRITTEN_ITEMS);
  const before = recordCommitment(layout, impl.address, spentItems);
  const after = recordCommitment(layout, impl.address, writtenItems);

  const appendSelector = selectorOf({ Impl: implementationArtifact }, 'Impl', 'append');
  // The callee's argument pushes carry the last parameter first. The fallback's one parameter is the call data the
  // frame received: the selector's push and the argument pushes, with their framing bytes, exactly the bytes the
  // implementation's own dispatcher reads.
  const argumentPushes = [appendSelector, encodeIntegerValue(APPEND.item), encodeIntegerValue(APPEND.id)];

  const event = implementationArtifact.events![0]!;
  const payload = encodeEventCommitment(event.parameters, [APPEND.id, APPEND.item]);
  const emitted = [eventOutput(PROXY_CATEGORY, event.signature, payload)];

  const runPlan = planChunkRun({ layout, variable: 'items', spent: spentItems, written: writtenItems });
  const spentChunks = splitValueIntoChunks(spentItems).map((piece, index) => chunkOf(index, piece));
  const writtenChunks = splitValueIntoChunks(writtenItems).map((piece, index) => chunkOf(index, piece));
  const keptCount = Math.min(spentChunks.length, writtenChunks.length);
  const createdCount = writtenChunks.length - keptCount;

  // The proxy's block hosts the master, the validator and the record, then the run's kept chunks. A probe with the
  // right number of state participants fixes the geometry the band starts from.
  const probes = Array.from({ length: keptCount }, (_unused, offset) => `kept#${offset}`);
  const probeLayout = layoutWithFacets([
    {
      contract: proxyContract, masters: [PROXY_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID, ...probes],
    },
    { contract: implementationContract, masters: [IMPL_MASTER], state: [] as readonly string[] },
  ]);
  const recordIndex = participant(probeLayout, RECORD_ID).index;
  const proxyIndex = participant(probeLayout, PROXY_MASTER).index;
  const base = recordIndex + layout.dataNftCount;

  // Events come first in the trailing region; created chunks follow them.
  const participantCount = probeLayout.participantCount;
  const eventIndex = participantCount;
  const createdIndices = Array.from(
    { length: createdCount }, (_unused, offset) => participantCount + emitted.length + offset,
  );
  const keptIds = Array.from({ length: keptCount }, (_unused, offset) => chunkRecordId('items', base + offset));

  // The run the shipped planner lays out at the band the body reads. A created chunk has no input, so the planner
  // names it at the band; the transaction carries it as a trailing output, so its declaration is remapped to the
  // index the layout gives that output.
  const run = layOutChunkRun({
    plan: runPlan, category: PROXY_CATEGORY, base, writer: proxyIndex, valueSatoshis: 1_000n,
  });
  let createdSeen = 0;
  const records: ChunkRecordPlacement[] = run.records.map((record) => record.role !== 'created'
    ? record
    : {
      ...record,
      index: createdIndices[createdSeen]!,
      entry: { in: INDEX_NONE, out: createdIndices[createdSeen++]!, viewIn: EMPTY, viewOut: record.viewOut },
    });

  const blocks = [
    {
      contract: proxyContract, masters: [PROXY_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID, ...keptIds],
    },
    { contract: implementationContract, masters: [IMPL_MASTER], state: [] as readonly string[] },
  ];

  const recordEntry: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: after };
  const proxyRead: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: before };
  const proxyResumed: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: after, viewOut: after };

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: proxyContract, entry: '__fallback', program: proxy.program,
    facts: {
      contract: proxyContract, functionName: '__fallback', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: impl.address, value: 0n, argumentPushes,
    }],
    // The fallback reads the record before the hop and resumes from what the implementation wrote after it.
    segments: [[proxyRead], [proxyResumed]],
    // The bytes the fallback received are the callee's own call data: the selector's push and its argument
    // pushes. The band is the frame's own call data, so the master's unlocking carries it as the entry's pushes.
    argumentPushes,
    dispatches: true,
  });
  const implMaster: DraftMaster = {
    ...master({
      master: IMPL_MASTER, contract: implementationContract, entry: 'append', program: impl.program,
      facts: {
        contract: implementationContract, functionName: 'append', kind: FrameKind.DELEGATE, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxy.address, value: 0n },
      enteredBy: PROXY_MASTER, origin: USER_ID,
      calls: [],
      segments: [[recordEntry, ...records.map((record) => record.entry)]],
      argumentPushes,
    }),
    events: [eventIndex],
  };

  const proxyCategoryHex = bytesToHex(PROXY_CATEGORY);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(PROXY_CATEGORY, 'mutable', before),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [proxyMaster, implMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(proxy) },
      [IMPL_MASTER]: { source: masterInput(impl) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(PROXY_CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(PROXY_CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(PROXY_CATEGORY, 'mutable', after) },
        // The write rebuilds the proxy's record; the covenant authorizes it by the proxy's own master, which
        // carries the proxy category's minting NFT.
        unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, proxyIndex, 1),
      },
      ...Object.fromEntries(records
        .filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      ...emitted,
      ...records.filter((record) => record.role === 'created').map((record) => record.output!),
    ],
    validator: {
      id: VALIDATOR_ID, covers: [implementationContract],
      settles: [{
        category: PROXY_CATEGORY,
        stateInputs: [RECORD_ID, ...keptIds],
        createdOutputs: createdIndices,
      }],
      redeemScript: validatorFor(PROXY_CATEGORY).redeem,
    },
  };
  return {
    plan, implementationArtifact, proxyArtifact, layout, proxy, impl, before, after, records,
    proxyContract, implementationContract,
  };
}

/** The root request the derivation starts from. */
function rootRequest(built: Built): ReturnType<typeof rootOf> {
  return rootOf(built.proxyContract, '__fallback', PROXY_MASTER);
}

describe('an append-shape entry entered through a proxy\'s fallback', () => {
  it('generates the proxy from the implementation\'s own layout, and both contracts are served', () => {
    const artifacts = compileStringMulti(IMPL_SOURCE, { composition: 'framed' });
    const proxy = buildProxyArtifact(artifacts.Impl!);

    // The write rebuilds the record from the writer's declaration, so the two layouts must be the same geometry.
    const implementationLayout = artifacts.Impl!.stateLayout!;
    expect(proxy.stateLayout!.dataNftCount).toBe(implementationLayout.dataNftCount);
    expect(proxy.stateLayout!.variables
      .map((variable) => `${variable.name}:${variable.nftIndex}.${variable.fieldIndex}`))
      .toStrictEqual(implementationLayout.variables
        .map((variable) => `${variable.name}:${variable.nftIndex}.${variable.fieldIndex}`));

    // The proxy is the forwarder shape, so it is served rather than refused. The implementation's entry touches a
    // dynamic value but makes no call of its own, so it too is served: the delegate hop is the proxy's body, and it
    // does not count as the implementation's own call.
    expect(proxy.composition?.convention).toBe('framed');
    expect(proxy.composition?.refusedEntries).toBeUndefined();
    expect(artifacts.Impl!.composition?.refusedEntries).toBeUndefined();
  });

  it('serves an implementation whose entry both writes the dynamic value and calls', () => {
    // The same shape with the call inside the writer's own body rather than the proxy's: the entry touches a
    // dynamic value and makes an external call, and the head parks the record block's base so the body's own
    // layout width turns it into the run's coordinate against the segment its call has reached.
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IPing { function ping(); }'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   int[] items;'
      + `   function append(int id, int item) { this.items.push(item); IPing(0x${'11'.repeat(35)}).ping();`
      + ' require(true); }'
      + ' }';
    const artifact = compileStringMulti(source, { composition: 'framed' }).Impl!;
    expect(artifact.composition?.convention).toBe('framed');
    expect(artifact.composition?.refusedEntries).toBeUndefined();
    expect(artifact.abi.map((entry) => entry.name)).toStrictEqual(['append']);
  });

  it('settles the append behind the proxy: the implementation writes the run and every input is accepted', () => {
    // The positive control on the dynamic shape. The fallback forwards the callee's own call data and the composer
    // drives the delegate edge, so the implementation runs as a `DELEGATE` frame on the proxy's records. The frame
    // uses the contract whose records it runs on for everything the records' category decides: the head leaves the
    // owner's input index for the event walk, and the body derives the collection addresses and the event covenant
    // from it. The machine accepts every contract input of the settled transaction.
    const built = build();
    const outcome = composeAndDerive(
      built.plan, [built.proxyArtifact, built.implementationArtifact], [rootRequest(built)],
    ) as ReturnType<typeof composeAndDerive>;
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName(built.implementationContract, 'append'),
      entryName(built.proxyContract, '__fallback'),
    ]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // Every participant of the composition is asked: the proxy's master, the implementation's master, the
    // validator, the record and the run's kept chunk. The user and the created chunk are not contract inputs of
    // the participant graph; the created chunk is a trailing output.
    const asked = new Set(outcome.verdicts.map((verdict) => verdict.participant));
    const keptChunkIds = built.records.filter((record) => record.role === 'kept').map((record) => record.id);
    expect(keptChunkIds.length).toBeGreaterThan(0);
    expect([...asked].sort()).toStrictEqual(
      [PROXY_MASTER, IMPL_MASTER, VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID, ...keptChunkIds].sort(),
    );
  });

  it('refuses a record output no frame computed, on the same composition', () => {
    // The refused control. The same programs and witnesses, with only the record's output commitment replaced by a
    // value no frame computed: a frame reads its own declaration, so the implementation stays self-consistent, and
    // the settlement is what holds the declaration to the transaction. The validator refuses.
    const built = build();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [built.proxyArtifact, built.implementationArtifact], plan: built.plan,
    });
    const recordIndex = participant(draft.layout, RECORD_ID).index;
    const program = draft.programFor(PROXY_MASTER);
    const wrongAddress = new Uint8Array(35);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === recordIndex
        ? {
          ...output,
          token: {
            ...output.token!,
            nft: { ...output.token!.nft!, commitment: recordCommitment(built.layout, wrongAddress, EMPTY) },
          },
        }
        : output)),
    };
    const state = compositionMachine().evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs,
      transaction,
    });
    expect(compositionMachine().stateSuccess(state)).not.toBe(true);
  });
});
