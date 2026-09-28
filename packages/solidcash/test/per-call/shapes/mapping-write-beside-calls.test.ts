import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  INDEX_NONE,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  encodeIntegerValue,
  encodeResultList,
  scriptToBytecode,
  type RecordEntry,
} from '@solidcash/utils';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
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
} from './harness.js';
import {
  layoutTransaction,
  participant,
  planMappingWrite,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';

/**
 * A mapping write beside calls: the arbitration shape, where the entry records the award, then reads a value through
 * a static call and settles through a second call.
 *
 * A call closes the segment the code before it runs in, so the write's records are declared in the segment it lands
 * in and the batch walk reads the groups there. In every other segment the frame declares the node kept: its code
 * writes it in one segment only, so a view changed anywhere else is one a callee could read that no write made.
 */

const ORACLE_ADDRESS = seededAddress('mapping write beside calls oracle');
const ESCROW_ADDRESS = seededAddress('mapping write beside calls escrow');
const ID = 7n;
const AMOUNT = ID + 100n;

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IOracle { function amountOf(int id) view returns (int); }'
  + ' interface IEscrow { function settle(int id); }'
  + ' contract Oracle { function amountOf(int id) view returns (int) { return id + 100; } }'
  + ' contract Escrow { function settle(int id) { require(id > 0); } }'
  + ' contract Arbiter {'
  + '   mapping(int => int) awarded;'
  + '   function arbitrate(int id) {'
  + '     this.awarded[id] = id + 100;'
  + `     IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf(id);`
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(id);`
  + '     require(true);'
  + '   }'
  + '   function awardOf(int id) view returns (int) { return this.awarded[id]; }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, {
  Arbiter: 'mapping write beside calls arbiter', Oracle: 'mapping write beside calls oracle',
  Escrow: 'mapping write beside calls escrow',
});

const ARBITER_MASTER = 'arbiter-1';
const ORACLE_MASTER = 'oracle-1';
const ESCROW_MASTER = 'escrow-1';
const NODE_ID = 'node';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const ID_PUSH = encodeIntegerValue(ID);
const SLOT = keyToSlotMulti([ID_PUSH]);
const BEFORE = encodeEntryCommitment(SLOT, new Uint8Array(32), encodeIntegerValue(0n));
const AFTER = encodeEntryCommitment(SLOT, new Uint8Array(32), encodeIntegerValue(AMOUNT));
const FAKE = encodeEntryCommitment(SLOT, new Uint8Array(32), encodeIntegerValue(999n));
const SENTINEL = headSentinelCommitment();
/** The award written into an empty mapping: the head relinked, and the node created. */
const INSERT = planMappingWrite({
  keys: [ID_PUSH], value: AMOUNT, inventory: [SENTINEL], encodeValue: (value) => encodeIntegerValue(value),
});
const HEAD_AFTER = INSERT.written[0]!.after;
const CREATED = INSERT.written[1]!.after;

/** The spent node's commitments, the node an insert creates, and each segment's declarations. */
interface NodeShape {
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly created?: Uint8Array;
  readonly segments: (node: number, created: number) => readonly (readonly RecordEntry[])[];
}

/** The update's shape: one node, declared in each segment with the views given. */
const updateShape = (views: readonly (readonly [Uint8Array, Uint8Array])[]): NodeShape => ({
  before: BEFORE, after: AFTER,
  segments: (node) => views.map(([viewIn, viewOut]) => [{ in: node, out: node, viewIn, viewOut }]),
});

/** The composition: the entry runs on the arbiter, whose mapping has the shape `shape` gives it. */
function buildPlan(shape: NodeShape): CompositionDraftPlan {
  const entry = 'arbitrate';
  const arbiter = contracts.Arbiter!;
  const oracle = contracts.Oracle!;
  const escrow = contracts.Escrow!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Arbiter', masters: [ARBITER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [NODE_ID] },
    { contract: 'Oracle', masters: [ORACLE_MASTER], state: [] },
    { contract: 'Escrow', masters: [ESCROW_MASTER], state: [] },
  ];
  const layout = layoutTransaction(blocks);
  const nodeIndex = participant(layout, NODE_ID).index;
  const createdIndex = layout.participantCount;
  const amountOf = [selectorOf(artifacts, 'Oracle', 'amountOf'), ID_PUSH];
  const settle = [selectorOf(artifacts, 'Escrow', 'settle'), ID_PUSH];
  const callee = (kind: number): DraftMaster['facts'] => ({
    contract: kind === FrameKind.STATIC ? 'Oracle' : 'Escrow',
    functionName: kind === FrameKind.STATIC ? entryName('Oracle', 'amountOf') : entryName('Escrow', 'settle'),
    kind, callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
  });

  const arbiterMaster: DraftMaster = master({
    master: ARBITER_MASTER, contract: 'Arbiter', entry, program: arbiter.program,
    facts: {
      contract: 'Arbiter', functionName: entryName('Arbiter', entry), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: arbiter.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [
      { kind: FrameKind.STATIC, callee: ORACLE_MASTER, target: oracle.address, value: 0n, argumentPushes: amountOf },
      { kind: FrameKind.CALL, callee: ESCROW_MASTER, target: escrow.address, value: 0n, argumentPushes: settle },
    ],
    segments: shape.segments(nodeIndex, createdIndex).map((segment) => [...segment]),
    argumentPushes: [selectorOf(artifacts, 'Arbiter', entry), ID_PUSH],
    dispatches: true,
  });
  const oracleMaster: DraftMaster = {
    ...master({
      master: ORACLE_MASTER, contract: 'Oracle', entry: 'amountOf', program: oracle.program,
      facts: callee(FrameKind.STATIC),
      frame: { kind: FrameKind.STATIC, sender: arbiter.address, self: oracle.address, value: 0n },
      enteredBy: ARBITER_MASTER, origin: USER_ID, argumentPushes: amountOf, dispatches: true,
    }),
    retval: encodeResultList([encodeIntegerValue(AMOUNT)]),
  };
  const escrowMaster: DraftMaster = master({
    master: ESCROW_MASTER, contract: 'Escrow', entry: 'settle', program: escrow.program,
    facts: callee(FrameKind.CALL),
    frame: { kind: FrameKind.CALL, sender: arbiter.address, self: escrow.address, value: 0n },
    enteredBy: ARBITER_MASTER, origin: USER_ID, argumentPushes: settle, dispatches: true,
  });

  const redeem = scriptToBytecode(buildEntryNftCovenantScript(arbiter.category,
    computeCollectionHash(artifacts.Arbiter!.stateLayout!.collections![0]!.signature)));
  const nodeSource = {
    lockingBytecode: scriptToLockingBytecode(redeem, 'p2sh32'), valueSatoshis: 20_000n,
    token: token(arbiter.category, 'mutable', shape.before),
  };
  const validator = validatorFor(arbiter.category);
  return {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [arbiterMaster, oracleMaster, escrowMaster],
    inputs: {
      [ARBITER_MASTER]: { source: masterInput(arbiter) },
      [ORACLE_MASTER]: { source: masterInput(oracle) },
      [ESCROW_MASTER]: { source: masterInput(escrow) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(arbiter.category, 'mutable') },
      },
      [NODE_ID]: {
        source: nodeSource,
        output: { ...nodeSource, token: token(arbiter.category, 'mutable', shape.after) },
        unlockingBytecode: createUnlockingBytecode('p2sh32', redeem, [
          encodeFunctionArgument(1n, 'bigint') as Uint8Array,
          encodeFunctionArgument(BigInt(participant(layout, ARBITER_MASTER).index), 'bigint') as Uint8Array,
        ]),
      },
      [USER_ID]: userInput(),
    },
    ...(shape.created === undefined ? {} : {
      trailingOutputs: [{ ...nodeSource, valueSatoshis: 1_500n, token: token(arbiter.category, 'mutable', shape.created) }],
    }),
    validator: {
      id: VALIDATOR_ID, covers: ['Oracle', 'Escrow'],
      settles: [{
        category: arbiter.category, stateInputs: [NODE_ID],
        ...(shape.created === undefined ? {} : { createdOutputs: [createdIndex] }),
      }],
      redeemScript: validator.redeem,
    },
  };
}

const compose = (shape: NodeShape): ReturnType<typeof composeAndDerive> =>
  composeAndDerive(buildPlan(shape), [artifacts.Arbiter!, artifacts.Oracle!, artifacts.Escrow!],
    [rootOf('Arbiter', 'arbitrate', ARBITER_MASTER)]);

const refusals = (outcome: ReturnType<typeof composeAndDerive>): readonly string[] => outcome.verdicts
  .filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.participant}: ${verdict.objection}`);

/** The insert's shape: the head relinked and the node created in the first segment, then each later one's records. */
const insertShape = (later: (head: number, node: number) => RecordEntry[][]): NodeShape => ({
  before: SENTINEL, after: HEAD_AFTER, created: CREATED,
  segments: (head, node) => [[
    { in: head, out: head, viewIn: SENTINEL, viewOut: HEAD_AFTER },
    { in: INDEX_NONE, out: node, viewIn: new Uint8Array(0), viewOut: CREATED },
  ], ...later(head, node)],
});
const kept = (index: number, view: Uint8Array): RecordEntry => ({ in: index, out: index, viewIn: view, viewOut: view });

describe('a mapping write beside two calls', () => {
  it('settles the award written before both calls, kept in the segments after it', () => {
    const outcome = compose(updateShape([[BEFORE, AFTER], [AFTER, AFTER], [AFTER, AFTER]]));
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Oracle', 'amountOf'), entryName('Escrow', 'settle'), entryName('Arbiter', 'arbitrate'),
    ]);
    expect(refusals(outcome)).toStrictEqual([]);
    const index = participant(outcome.draft.layout, NODE_ID).index;
    expect(bytesToHex(outcome.transaction.outputs[index]!.token!.nft!.commitment)).toBe(bytesToHex(AFTER));
    // The created node is declared where it is created only, or kept at its output after that.
    expect(refusals(compose(insertShape((head) => [[kept(head, HEAD_AFTER)], [kept(head, HEAD_AFTER)]]))))
      .toStrictEqual([]);
    expect(refusals(compose(insertShape((head, node) => [[kept(head, HEAD_AFTER), kept(node, CREATED)],
      [kept(head, HEAD_AFTER), kept(node, CREATED)]])))).toStrictEqual([]);
  });

  it('refuses the node declared changed and back in the segments after the one it is written in', () => {
    expect(() => compose(updateShape([[BEFORE, AFTER], [AFTER, FAKE], [FAKE, AFTER]])))
      .toThrow(/PER_CALL_DERIVATION_STALLED/);
    expect(() => compose(insertShape((head, node) => [
      [kept(head, HEAD_AFTER), { in: node, out: node, viewIn: CREATED, viewOut: FAKE }],
      [kept(head, HEAD_AFTER), { in: node, out: node, viewIn: FAKE, viewOut: CREATED }],
    ]))).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });
});
