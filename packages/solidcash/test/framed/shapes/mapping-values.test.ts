import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { layoutWithFacets } from './harness.js';
import {
  FrameKind,
  INDEX_NONE,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  encodeChunkableValueTail,
  scriptToBytecode,
  sha256,
  type RecordEntry,
} from '@solidcash/utils';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  composeAndDerive,
  compileAndDeploy,
  entryName,
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
  USER_LOCK,
  type DeployedContract,
} from './harness.js';
import {
  layOutMappingBatch,
  mappingValueChunkLock,
  participant,
  planMappingBatch,
  planMappingWrite,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A `mapping(string => string)` set, and a long value read from the frame's witness block.
 *
 * A node's value tail holds a value of at most 60 bytes inline and a longer one as its hash, so a body reading a
 * long value takes the value itself from the value list its frame's block carries and checks it against that hash.
 * A body that only writes reads nothing, so its value slot stays empty. Each case is a hub calling the entry
 * through an interface, the node spent as one entry UTXO, and the BCH-2026 machine asked about every input.
 */

const encoder = new TextEncoder();
const KEY = encoder.encode('title');
const FIRST = encoder.encode('first title');
const SECOND = encoder.encode('second title');
/** Past the 60 bytes a node's tail holds inline, so the tail carries the value's hash. */
const LONG = encoder.encode('a note long enough that the node keeps only its hash and the reader brings the value itself');
/** The same length with its last byte changed, so only the hash can tell the two apart. */
const FORGED = Uint8Array.from(LONG, (byte, index) => (index === LONG.length - 1 ? byte ^ 1 : byte));
/** Long enough that its bytes past the node's 28-byte head fill one value chunk and part of another. */
const LONG_WRITE = encoder.encode(`a long title whose bytes past the node's head go to value chunks ${'-'.repeat(118)} end`);
const ZERO_SLOT = new Uint8Array(32);
const SLOT = keyToSlotMulti([KEY]);

const TAGS_ADDRESS = seededAddress('mapping values tags');
const NOTES_ADDRESS = seededAddress('mapping values notes');
/** A reading contract with a second entry beside the reader, so the head's value slot is derived from several bodies. */
const LEDGER_ADDRESS = seededAddress('mapping values ledger');
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ITags { function put(string k, string v); }'
  + ' interface INotes { function check(string k, string v); }'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
  + ' }'
  + ' contract Notes {'
  + '   mapping(string => string) notes;'
  + '   function check(string k, string v) { require(this.notes[k] == v); }'
  + ' }'
  + ' contract SetHub {'
  + `   function run() { ITags(0x${hexOf(TAGS_ADDRESS)}).put("${text(KEY)}", "${text(SECOND)}"); require(true); }`
  + ' }'
  + ' contract LongSetHub {'
  + `   function run() { ITags(0x${hexOf(TAGS_ADDRESS)}).put("${text(KEY)}", "${text(LONG_WRITE)}"); require(true); }`
  + ' }'
  + ' contract ReadHub {'
  + `   function run() { INotes(0x${hexOf(NOTES_ADDRESS)}).check("${text(KEY)}", "${text(LONG)}"); require(true); }`
  + ' }'
  + ' interface ILedger { function check(string k, string v); }'
  + ' contract Ledger {'
  + '   mapping(string => string) ledger;'
  + '   function check(string k, string v) { require(this.ledger[k] == v); }'
  + '   function put(string k, string v) { this.ledger[k] = v; require(true); }'
  + ' }'
  + ' contract LedgerHub {'
  + `   function run() { ILedger(0x${hexOf(LEDGER_ADDRESS)}).check("${text(KEY)}", "${text(LONG)}"); require(true); }`
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, {
  SetHub: 'mapping values set hub', ReadHub: 'mapping values read hub',
  Tags: 'mapping values tags', Notes: 'mapping values notes',
  LedgerHub: 'mapping values ledger hub', Ledger: 'mapping values ledger', LongSetHub: 'mapping values long set hub',
});

const HUB_MASTER = 'hub-1';
const ENTRY_MASTER = 'entry-1';
const NODE_ID = 'node';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

/** The entry covenant a contract's mapping nodes are locked by. */
function nodeRedeem(contract: DeployedContract, contractName: string): Uint8Array {
  const collection = artifacts[contractName]!.stateLayout!.collections![0]!;
  return scriptToBytecode(buildEntryNftCovenantScript(contract.category, computeCollectionHash(collection.signature)));
}

const nodeLock = (contract: DeployedContract, contractName: string): Uint8Array =>
  encodeLockingBytecodeP2sh32(hash256(nodeRedeem(contract, contractName)));

/** The node a frame spends at its entry covenant, unlocked on the write path its master authorizes. */
function nodeInput(contract: DeployedContract, contractName: string, before: Uint8Array, after: Uint8Array,
  masterIndex: number): CompositionDraftPlan['inputs'][string] {
  const redeem = nodeRedeem(contract, contractName);
  const source = {
    lockingBytecode: nodeLock(contract, contractName), valueSatoshis: 20_000n,
    token: token(contract.category, 'mutable', before),
  };
  return {
    source,
    output: { ...source, token: token(contract.category, 'mutable', after) },
    unlockingBytecode: createUnlockingBytecode('p2sh32', redeem, [
      encodeFunctionArgument(1n, 'bigint') as Uint8Array,
      encodeFunctionArgument(BigInt(masterIndex), 'bigint') as Uint8Array,
    ]),
  };
}

interface Shape {
  readonly hub: string;
  readonly entryContract: string;
  readonly entry: string;
  readonly argumentPushes: readonly Uint8Array[];
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly values?: readonly Uint8Array[];
  /** The entry's own records, trailing outputs and created outputs, laid out against the transaction's layout. */
  readonly lay?: (participantCount: number, nodeIndex: number) => {
    readonly records: readonly RecordEntry[];
    readonly outputs: NonNullable<CompositionDraftPlan['trailingOutputs']>;
    readonly created: readonly number[];
  };
}

/** A hub calling the entry, the validator settling the entry's contract, and the node the entry touches. */
function buildPlan(shape: Shape): { readonly plan: CompositionDraftPlan; readonly nodeIndex: number } {
  const hub = contracts[shape.hub]!;
  const entryContract = contracts[shape.entryContract]!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: shape.hub, masters: [HUB_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: shape.entryContract, masters: [ENTRY_MASTER], state: [NODE_ID] },
  ];
  const layout = layoutWithFacets(blocks);
  const nodeIndex = participant(layout, NODE_ID).index;
  const record: RecordEntry = { in: nodeIndex, out: nodeIndex, viewIn: shape.before, viewOut: shape.after };
  const laid = shape.lay?.(layout.participantCount, nodeIndex);
  const selector = selectorOf(artifacts, shape.entryContract, shape.entry);
  const validator = validatorFor(hub.category);

  const hubMaster: DraftMaster = master({
    master: HUB_MASTER, contract: shape.hub, entry: 'run', program: hub.program,
    facts: {
      contract: shape.hub, functionName: entryName(shape.hub, 'run'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: ENTRY_MASTER, target: entryContract.address, value: 0n,
      argumentPushes: [selector, ...shape.argumentPushes],
    }],
    segments: [[], []],
  });
  const entryMaster: DraftMaster = {
    ...master({
      master: ENTRY_MASTER, contract: shape.entryContract, entry: shape.entry, program: entryContract.program,
      facts: {
        contract: shape.entryContract, functionName: entryName(shape.entryContract, shape.entry),
        kind: FrameKind.CALL, callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: hub.address, self: entryContract.address, value: 0n },
      enteredBy: HUB_MASTER, origin: USER_ID,
      argumentPushes: [selector, ...shape.argumentPushes],
      segments: [laid === undefined ? [record] : [...laid.records]],
      dispatches: true,
    }),
    ...(shape.values === undefined ? {} : { values: shape.values }),
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [hubMaster, entryMaster],
    inputs: {
      [HUB_MASTER]: { source: masterInput(hub) },
      [ENTRY_MASTER]: { source: masterInput(entryContract) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
      },
      [NODE_ID]: nodeInput(entryContract, shape.entryContract, shape.before, shape.after,
        participant(layout, ENTRY_MASTER).index),
      [USER_ID]: userInput(),
    },
    ...(laid === undefined ? {} : { trailingOutputs: laid.outputs }),
    validator: {
      id: VALIDATOR_ID, covers: [shape.entryContract],
      settles: [],
      redeemScript: validator.redeem,
    },
  };
  return { plan, nodeIndex };
}

/** The machine's objections, one per refused input. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('a string-keyed string mapping set', () => {
  const before = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(FIRST));
  const written = planMappingWrite({
    keys: [KEY], value: SECOND, inventory: [before], encodeValue: encodeChunkableValueTail,
  }).written[0]!;
  // Call data carries the arguments last parameter first.
  const shape = (after: Uint8Array): Shape => ({
    hub: 'SetHub', entryContract: 'Tags', entry: 'put', argumentPushes: [SECOND, KEY], before, after,
  });

  it('is served: no refusal is published and the entry takes only its key and value', () => {
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    expect(artifacts.Tags!.abi.find((entry) => entry.name === 'put')!.inputs.map((input) => input.name))
      .toStrictEqual(['k', 'v']);
  });

  it('settles: the node carries the value the body wrote, and every contract input is accepted', () => {
    const built = buildPlan(shape(written.after));
    const outcome = composeAndDerive(built.plan, [artifacts.SetHub!, artifacts.Tags!], [rootOf('SetHub', 'run', HUB_MASTER)]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Tags', 'put'), entryName('SetHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    const commitment = outcome.transaction.outputs[built.nodeIndex]!.token!.nft!.commitment;
    expect(bytesToHex(commitment))
      .toBe(bytesToHex(encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(SECOND))));
  });

  it('refuses the node written back with less value than it held (T39)', () => {
    const built = buildPlan(shape(written.after));
    const outcome = composeAndDerive(built.plan, [artifacts.SetHub!, artifacts.Tags!], [rootOf('SetHub', 'run', HUB_MASTER)]);
    const program = outcome.draft.programFor(HUB_MASTER);
    const drained = program.transaction.outputs.map((output, index) => (index === built.nodeIndex
      ? { ...output, valueSatoshis: output.valueSatoshis - 1_000n } : output));
    const vm = compositionMachine();
    const refusedBy = outcome.contractInputs.filter((input) => vm.stateSuccess(vm.evaluate({
      inputIndex: input.index, sourceOutputs: program.sourceOutputs,
      transaction: { ...program.transaction, outputs: drained },
    })) !== true).map((input) => input.id);
    expect(refusedBy).toStrictEqual([ENTRY_MASTER]);
  });

  it('refuses a close the body did not compute', () => {
    const built = buildPlan(shape(encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(FIRST))));
    expect(() => composeAndDerive(built.plan, [artifacts.SetHub!, artifacts.Tags!], [rootOf('SetHub', 'run', HUB_MASTER)]))
      .toThrow('FRAMED_DERIVATION_STALLED: master "entry-1" of Tags.put()');
  });
});

describe('a long mapping value read from the frame\'s block', () => {
  const node = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(LONG));
  const shape = (values?: readonly Uint8Array[]): Shape => ({
    hub: 'ReadHub', entryContract: 'Notes', entry: 'check', argumentPushes: [LONG, KEY], before: node, after: node,
    ...(values === undefined ? {} : { values }),
  });
  const compose = (values?: readonly Uint8Array[]): ReturnType<typeof composeAndDerive> => composeAndDerive(
    buildPlan(shape(values)).plan, [artifacts.ReadHub!, artifacts.Notes!], [rootOf('ReadHub', 'run', HUB_MASTER)],
  );

  /** The read's own frame stops at the close of its one segment when the value it reads is not the one hashed. */
  const STALL = 'FRAMED_DERIVATION_STALLED: master "entry-1" of Notes.check() filled no witness at site 0 '
    + '(close of segment 0)';

  it('keeps the value out of the node: the tail holds its hash', () => {
    expect(LONG.length).toBeGreaterThan(60);
    expect(bytesToHex(node)).toContain(bytesToHex(sha256(LONG)));
    expect(bytesToHex(node)).not.toContain(bytesToHex(LONG));
  });

  it('settles when the block lists the value, and every contract input is accepted', () => {
    const outcome = compose([LONG]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Notes', 'check'), entryName('ReadHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.draft.blockOf(ENTRY_MASTER).values).toStrictEqual([LONG]);
  });

  it('refuses a listed value other than the one the node\'s hash names', () => {
    expect(FORGED.length).toBe(LONG.length);
    expect(() => compose([FORGED])).toThrow(STALL);
  });

  it('refuses a read whose block lists no value', () => {
    expect(() => compose()).toThrow(STALL);
  });
});

describe('a long mapping value read from a contract with several entries', () => {
  // `Ledger.check` reads the long value while `Ledger.put` writes the same mapping, so the slot the reader takes is
  // one the head derives from more than one body and the reader is not the writer issuing the value.
  const node = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(LONG));
  const shape = (values?: readonly Uint8Array[]): Shape => ({
    hub: 'LedgerHub', entryContract: 'Ledger', entry: 'check', argumentPushes: [LONG, KEY], before: node, after: node,
    ...(values === undefined ? {} : { values }),
  });
  const compose = (values?: readonly Uint8Array[]): ReturnType<typeof composeAndDerive> => composeAndDerive(
    buildPlan(shape(values)).plan, [artifacts.LedgerHub!, artifacts.Ledger!], [rootOf('LedgerHub', 'run', HUB_MASTER)],
  );

  /** The read's own frame stops at the close of its one segment when the value it reads is not the one hashed. */
  const STALL = 'FRAMED_DERIVATION_STALLED: master "entry-1" of Ledger.check() filled no witness at site 0 '
    + '(close of segment 0)';

  it('compiles both entries, the reader taking the head\'s value slot', () => {
    // The reader is a pure read at slot 0 while the writer is a write, so the value list is the reader's own slot
    // rather than one the reading body itself issued.
    const reader = artifacts.Ledger!.abi.find((entry) => entry.name === 'check')!;
    const writer = artifacts.Ledger!.abi.find((entry) => entry.name === 'put')!;
    expect(reader.entryAccesses?.map(({ slotIndex, operations }) => ({ slotIndex, operations })))
      .toStrictEqual([{ slotIndex: 0, operations: ['read'] }]);
    expect(writer.entryAccesses?.map(({ operations }) => operations)).toStrictEqual([['write']]);
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
  });

  it('settles when the block lists the value, and every contract input is accepted', () => {
    const outcome = compose([LONG]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Ledger', 'check'), entryName('LedgerHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.draft.blockOf(ENTRY_MASTER).values).toStrictEqual([LONG]);
  });

  it('refuses a listed value other than the one the node\'s hash names', () => {
    expect(FORGED.length).toBe(LONG.length);
    expect(() => compose([FORGED])).toThrow(STALL);
  });

  it('refuses a read whose block lists no value', () => {
    expect(() => compose()).toThrow(STALL);
  });
});

describe('a long mapping value written with its value chunks', () => {
  const tags = contracts.Tags!;
  const before = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(FIRST));
  const batch = planMappingBatch({
    writes: [{ keys: [KEY], value: LONG_WRITE }], inventory: [before], encodeValue: encodeChunkableValueTail,
    chunkable: (value) => value,
  });
  const chunkLock = mappingValueChunkLock(tags.category, artifacts.Tags!.stateLayout!.collections![0]!.name,
    batch.chunks[0]!);
  /** A node no write made, at the collection's own covenant. */
  const forged = encodeEntryCommitment(keyToSlotMulti([encoder.encode('forged')]), ZERO_SLOT,
    encodeChunkableValueTail(encoder.encode('a node no write made')));

  /** The update and its chunks; `control` alters one chunk or declares one record more. */
  const shape = (control?: 'altered chunk' | 'extra record'): Shape => ({
    hub: 'LongSetHub', entryContract: 'Tags', entry: 'put', argumentPushes: [LONG_WRITE, KEY], before,
    after: batch.written[0]!.after,
    lay: (participantCount, nodeIndex) => {
      const records = layOutMappingBatch(batch, {
        placementOf: () => ({ in: nodeIndex, out: nodeIndex }),
        chunkOutputOf: (_slot, index) => participantCount + index,
      });
      const outputs = batch.chunks.map((chunk) => ({ lock: chunkLock, commitment: chunk.commitment }));
      if (control === 'altered chunk') {
        const commitment = Uint8Array.from(outputs[1]!.commitment, (byte, i) => (i === 2 ? byte ^ 1 : byte));
        outputs[1] = { lock: chunkLock, commitment };
        records[records.length - 1] = { ...records[records.length - 1]!, viewOut: commitment };
      }
      if (control === 'extra record') {
        outputs.push({ lock: nodeLock(tags, 'Tags'), commitment: forged });
        records.push({
          in: INDEX_NONE, out: participantCount + batch.chunks.length, viewIn: new Uint8Array(0), viewOut: forged,
        });
      }
      return {
        records,
        outputs: outputs.map(({ lock, commitment }) => ({
          lockingBytecode: lock, valueSatoshis: 1_000n, token: token(tags.category, 'mutable', commitment),
        })),
        created: records.filter((record) => record.in === INDEX_NONE).map((record) => record.out),
      };
    },
  });
  const compose = (control?: 'altered chunk' | 'extra record'): ReturnType<typeof composeAndDerive> => composeAndDerive(
    buildPlan(shape(control)).plan, [artifacts.LongSetHub!, artifacts.Tags!], [rootOf('LongSetHub', 'run', HUB_MASTER)],
  );

  it('settles: the node keeps the root, the chunks the bytes past its head, and every contract input is accepted', () => {
    expect(batch.chunks.map((chunk) => chunk.index)).toStrictEqual([0, 1]);
    const outcome = compose();
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Tags', 'put'), entryName('LongSetHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(bytesToHex(batch.written[0]!.after))
      .toBe(bytesToHex(encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(LONG_WRITE))));
  });

  it('refuses a chunk whose bytes are not the value\'s, and a record declared past the chunks it pinned', () => {
    for (const control of ['altered chunk', 'extra record'] as const) {
      expect(() => compose(control)).toThrow('FRAMED_DERIVATION_STALLED: master "entry-1" of Tags.put()');
    }
  });
});
