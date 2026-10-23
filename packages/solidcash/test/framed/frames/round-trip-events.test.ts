import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  computeFunctionSelector,
  computeFunctionSignature,
  encodeEventCommitment,
  validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * An event emitted by a framed master, laid out as a trailing output.
 *
 * The plan states the event's output itself — its lock, value and token — and the layout opens that output past
 * the participants, where no input sits. The composer's assembled transaction carries it, a block's `events` list
 * names it by index, and the master's own body checks the payload it computed against the token there.
 *
 * The two-contract round trip whose entry emits after its call returns derives: the re-entered entry shares its
 * contract's category with the entry that started the trip, so its own census stands down and the event the other
 * frame listed is admitted, exactly as the spec's 5.2 output set has it. Each of the composition's masters is
 * asked for its verdict on the derived transaction, and the controls beside them are the refusals that stay: an
 * event payload the listing entry did not compute, and an own-category NFT no frame lists at a contract that runs
 * on a single master. The union census a shared category needs belongs to the validator and is not emitted yet,
 * which the last case pins.
 */

const CATEGORY_A = seededCategory('round trip events A');
const CATEGORY_B = seededCategory('round trip events B');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const ENTRY_F = 'A.f()';
const ENTRY_K = 'A.k()';
const ENTRY_G = 'B.g()';
const A_FIRST = 'a-1';
const A_SECOND = 'a-2';
const B_MASTER = 'b-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const EMPTY = new Uint8Array(0);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmOutput = NonNullable<NonNullable<VmProgram['transaction']>['outputs'][number]>;

/** The machine every verdict in this file is taken from. */
const machine = (): ReturnType<typeof createVirtualMachineBch2026> => compositionMachine();
const F_SELECTOR = computeFunctionSelector(computeFunctionSignature('f', []));
const G_SELECTOR = computeFunctionSelector(computeFunctionSignature('g', []));
const K_SELECTOR = computeFunctionSelector(computeFunctionSignature('k', []));
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: EMPTY } });

/** Two contracts where every contract emits, so the compiler admits the unit, and `A.f` emits after its call. */
const ROUND_TRIP_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function g(); }'
  + ' interface IA { function k(); }'
  + ' contract B {'
  + '   event Ping(int x);'
  + `   function g() { IA(0x${Buffer.from(ADDRESS_A).toString('hex')}).k.call(); emit Ping(1); require(true); }`
  + ' }'
  + ' contract A {'
  + '   event Log(int value);'
  + `   function f() { IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call(); emit Log(7); require(true); }`
  + '   function k() { require(true); }'
  + ' }';

/** The shapes of `ROUND_TRIP_SOURCE` compiled and deployed, with the events the plan states as trailing outputs. */
function buildRoundTrip(): {
  plan: CompositionDraftPlan;
  artifacts: ReturnType<typeof compileStringMulti>;
  eventIndex: number;
} {
  const artifacts = compileStringMulti(ROUND_TRIP_SOURCE, { composition: 'framed' });
  const a = deployMaster(artifacts.A!, CATEGORY_A, VALIDATOR_PROGRAM);
  const b = deployMaster(artifacts.B!, CATEGORY_B, VALIDATOR_PROGRAM);
  const aEvent = artifacts.A!.events![0]!;
  const bEvent = artifacts.B!.events![0]!;

  const validator = validatorSpend(CATEGORY_A, { roots: [0], masters: [0, 1, 3], settles: [] });
  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number,
    makesExternalCall: boolean, callerIsUser: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser, originEqualsCaller: callerIsUser,
    makesExternalCall, mastersOfContract,
  });

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'A', masters: [A_FIRST, A_SECOND], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'B', masters: [B_MASTER], state: [] },
  ];
  // The trailing region starts at the participant count, which includes the facet each validator binds.
  const eventIndex = layoutWithFacets(blocks).participantCount;

  const aFirst: DraftMaster = {
    master: A_FIRST, contract: 'A', functionName: ENTRY_F, program: a.script,
    facts: facts('A', 'f', FrameKind.ROOT, 2, true, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_A, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: B_MASTER, target: ADDRESS_B, value: 0n,
      argumentPushes: [G_SELECTOR],
    }],
    retval: EMPTY, segments: [[], []], events: [eventIndex], sends: [],
    argumentPushes: [F_SELECTOR], redeemScript: a.script, dispatches: true,
  };
  const bMaster: DraftMaster = {
    master: B_MASTER, contract: 'B', functionName: ENTRY_G, program: b.script,
    facts: facts('B', 'g', FrameKind.CALL, 1, true, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_A, self: ADDRESS_B, value: 0n },
    enteredBy: A_FIRST, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: A_SECOND, target: ADDRESS_A, value: 0n,
      argumentPushes: [K_SELECTOR],
    }],
    retval: EMPTY, segments: [[], []], events: [eventIndex + 1], sends: [],
    argumentPushes: [G_SELECTOR], redeemScript: b.script,
  };
  const aSecond: DraftMaster = {
    master: A_SECOND, contract: 'A', functionName: ENTRY_K, program: a.script,
    facts: facts('A', 'k', FrameKind.CALL, 2, false, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_B, self: ADDRESS_A, value: 0n },
    enteredBy: B_MASTER, origin: USER_ID,
    calls: [], retval: EMPTY, segments: [[]], events: [], sends: [],
    argumentPushes: [K_SELECTOR], redeemScript: a.script,
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: USER_ID, index: eventIndex }],
    masters: [aFirst, bMaster, aSecond],
    inputs: {
      [A_FIRST]: { source: { lockingBytecode: a.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'minting') } },
      [A_SECOND]: { source: { lockingBytecode: a.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'minting') } },
      [B_MASTER]: { source: { lockingBytecode: b.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_B, 'minting') } },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'mutable') },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    trailingOutputs: [
      eventOutput(CATEGORY_A, aEvent.signature, encodeEventCommitment(aEvent.parameters, [7n])),
      eventOutput(CATEGORY_B, bEvent.signature, encodeEventCommitment(bEvent.parameters, [1n])),
    ],
    validator: {
      id: VALIDATOR_ID, covers: ['B'], settles: [{ category: CATEGORY_A, stateInputs: [] }],
      redeemScript: validator.redeem,
    },
  };
  return { plan, artifacts, eventIndex };
}

const ROOT = { contract: 'A', functionName: ENTRY_F, kind: FrameKind.ROOT, master: A_FIRST };

describe('a plan whose entry emits after its call returns', () => {
  it('lays the event at a trailing output past the participants', () => {
    const { plan, artifacts, eventIndex } = buildRoundTrip();
    expect(artifacts.A!.composition?.convention).toBe('framed');
    expect(artifacts.B!.composition?.convention).toBe('framed');

    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
    const placed = draft.trailingOutputs[0]!;

    // The event fills the first output the layout opens past the participants, where no input sits, and the
    // emitting master lists exactly that index.
    expect(placed.index).toBe(draft.layout.participantCount);
    expect(placed.index).toBe(eventIndex);
    expect(draft.layout.participants.map((slot) => slot.index)).not.toContain(placed.index);
    expect(draft.blockOf(A_FIRST).events).toStrictEqual([placed.index]);
    expect(draft.assembly.outputs.eventIndices)
      .toStrictEqual([placed.index, placed.index + 1]);
  });

  /** The verdict of one master's program, with output `at` optionally replaced. */
  const verdict = (
    draft: ReturnType<typeof createComposedDerivationHost>['draft'],
    master: string,
    mutate: (outputs: VmOutput[]) => VmOutput[] = (outputs) => outputs,
  ): string => {
    const program = draft.programFor(master);
    const vm = machine();
    const state = vm.evaluate({
      inputIndex: program.inputIndex,
      sourceOutputs: program.sourceOutputs,
      transaction: { ...program.transaction, outputs: mutate(program.transaction.outputs) },
    });
    return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
  };

  /** Its own contract's category, as an immutable NFT carrying `commitment`, at the place of output `at`. */
  const ownCategoryImmutable = (
    outputs: readonly VmOutput[], at: number, category: Uint8Array, commitment: Uint8Array,
  ): VmOutput[] => outputs.map((output, offset) => (offset === at
    ? { ...output, token: { category, amount: 0n, nft: { capability: 'none' as const, commitment } } }
    : output));

  it('derives the whole trip, with each event at the output its block lists', () => {
    // The re-entered entry shares `A`'s category with the entry that started the trip. The census over a
    // contract's own-category outputs is the contract's, and the spec leaves it to the validator once several
    // masters run that contract (7.2 V7/V8), so a master runs it only while it is its category's only master: the
    // shared entry no longer refuses the event the other frame of its own contract listed.
    const { plan, artifacts, eventIndex } = buildRoundTrip();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });

    const derived = deriveDepthFirst(ROOT, host);
    expect([...derived.completed.map((frame) => frame.master)].sort())
      .toStrictEqual([A_FIRST, A_SECOND, B_MASTER].sort());

    // The two events take the layout's trailing outputs, and the blocks name them the way the plan's shape does.
    expect(draft.blockOf(A_FIRST).events).toStrictEqual([eventIndex]);
    expect(draft.blockOf(A_SECOND).events).toStrictEqual([]);
    expect(draft.blockOf(B_MASTER).events).toStrictEqual([eventIndex + 1]);
    expect(draft.assembly.outputs.eventIndices).toStrictEqual([eventIndex, eventIndex + 1]);

    // Output 6 of the spec's set: `A`'s category, immutable, carrying what `A.f` emitted.
    const carried = draft.programFor(A_FIRST).transaction.outputs[eventIndex]!;
    expect(carried).toStrictEqual(plan.trailingOutputs![0]);
    expect(carried.token?.category).toStrictEqual(CATEGORY_A);
    expect(carried.token?.nft?.capability).toBe('none');
    expect(carried.token?.nft?.commitment)
      .toStrictEqual(encodeEventCommitment(artifacts.A!.events![0]!.parameters, [7n]));

    // Every master of the composition accepts the transaction as derived.
    expect([A_FIRST, A_SECOND, B_MASTER].map((master) => verdict(draft, master)))
      .toStrictEqual(['accepted', 'accepted', 'accepted']);
  });

  it('refuses an event output whose payload the entry that listed it did not compute', () => {
    // The event at the listed output is bound to the payload its entry emitted: the same lock and token with a
    // payload the entry did not compute is refused, which is the control that the accept above is not vacuous.
    const { plan, artifacts, eventIndex } = buildRoundTrip();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });

    expect(verdict(draft, A_FIRST, (outputs) => ownCategoryImmutable(outputs, eventIndex, CATEGORY_A, new Uint8Array([9]))))
      .toContain('refused');
    expect(verdict(draft, A_FIRST, (outputs) => ownCategoryImmutable(outputs, eventIndex + 1, CATEGORY_A, EMPTY)))
      .toContain('refused');
  });

  it('refuses an own-category NFT no frame lists at a master that is its category\'s only one', () => {
    // `B` runs on one master, so its census is its own, exactly as its settlement is. An immutable NFT of `B`'s
    // category at an output no frame of the transaction lists is refused, and the same shape one output further
    // in is refused too, so the census is over the transaction rather than over the listed index.
    const { plan, artifacts } = buildRoundTrip();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
    const event = artifacts.B!.events![0]!;
    const payload = encodeEventCommitment(event.parameters, [1n]);

    const appended = (outputs: readonly VmOutput[]): VmOutput[] => [
      ...outputs, eventOutput(CATEGORY_B, event.signature, payload),
    ];
    expect(verdict(draft, B_MASTER, appended)).toContain('refused');
    expect(verdict(draft, B_MASTER, (outputs) => ownCategoryImmutable(outputs, 0, CATEGORY_B, new Uint8Array([7]))))
      .toContain('refused');
  });

  it('leaves an own-category NFT no frame lists to the validator when the category is shared', () => {
    // `A` runs on two masters, so the union of the events their frames list is the validator's census to make
    // (5.2 puts the event census on the validator input, 7.2 V7 states the union), and a master cannot express a
    // union it does not hold. This case reads the master's own verdict, which stays what it is: what the union
    // census changes is the validator input's verdict, so the case belongs to the validator suite, not here.
    // Measured: with a census emitted in the program this master still accepts, because this harness never
    // evaluates the validator input.
    const { plan, artifacts } = buildRoundTrip();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
    const bEvent = draft.blockOf(B_MASTER).events[0]!;

    expect(verdict(draft, A_SECOND, (outputs) => ownCategoryImmutable(outputs, bEvent, CATEGORY_A, new Uint8Array([9]))))
      .toBe('accepted');
  });

  it('emits every contract of a unit whose contracts attribute different numbers of events', () => {
    // Only one contract of this unit emits, and the quiet one keeps no state of its own, so nothing but the
    // contract's own bodies can decide its event region: both masters are emitted.
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function g(); }'
      + ' interface IA { function k(); }'
      + ' contract B {'
      + `   function g() { IA(0x${Buffer.from(ADDRESS_A).toString('hex')}).k.call(); require(true); }`
      + ' }'
      + ' contract A {'
      + '   event Log(int value);'
      + `   function f() { IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call(); emit Log(7); require(true); }`
      + '   function k() { require(true); }'
      + ' }';

    const artifacts = compileStringMulti(source, { composition: 'framed' });
    expect(artifacts.B?.composition?.convention).toBe('framed');
    expect(artifacts.B?.events ?? []).toStrictEqual([]);
    expect(artifacts.A?.events?.length).toBe(1);
  });
});


/**
 * An entry that emits without making a call, driven from source to a machine verdict.
 *
 * This is the shape the shipped path does run: no witness block carries both a call section and an event list. The
 * plan states both events as trailing outputs, the derivation completes with each event at the output it lists, and
 * the machine accepts the master's own input.
 */
describe('an entry that emits and makes no call', () => {
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' contract Log {'
    + '   event First(int x);'
    + '   event Second(int y);'
    + '   function fire() { emit First(1); emit Second(2); require(true); }'
    + ' }';
  const FIRE = 'Log.fire()';
  const LOG_MASTER = 'log-1';
  const USER = 'user';

  function build(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const log = deployMaster(artifacts.Log!, CATEGORY_A, VALIDATOR_PROGRAM);
    const events = artifacts.Log!.events!;
    const blocks: CompositionDraftPlan['blocks'] = [{ contract: 'Log', masters: [LOG_MASTER], state: [] }];
    // The trailing outputs begin one past the participants, so the two events take the first two slots there.
    const trailingBase = blocks.reduce(
      (count, block) => count + block.masters.length + (block.validator === undefined ? 0 : 1) + block.state.length,
      0,
    );
    const master: DraftMaster = {
      master: LOG_MASTER, contract: 'Log', functionName: FIRE, program: log.script,
      facts: {
        contract: 'Log', functionName: 'fire', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: log.address, value: 0n },
      enteredBy: USER, origin: USER, calls: [], retval: EMPTY, segments: [[]],
      events: [trailingBase, trailingBase + 1], sends: [], argumentPushes: [], redeemScript: log.script,
    };
    const plan: CompositionDraftPlan = {
      blocks,
      userInputs: [{ id: USER, index: trailingBase }],
      masters: [master],
      inputs: {
        [LOG_MASTER]: { source: { lockingBytecode: log.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'minting') } },
        [USER]: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: callerUnlockingBytecode(),
        },
      },
      trailingOutputs: [
        eventOutput(CATEGORY_A, events[0]!.signature, encodeEventCommitment(events[0]!.parameters, [1n])),
        eventOutput(CATEGORY_A, events[1]!.signature, encodeEventCommitment(events[1]!.parameters, [2n])),
      ],
    };
    return { plan, artifacts };
  }

  it('derives it and the machine accepts it, with both events at their trailing outputs', () => {
    const { plan, artifacts } = build();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Log!], plan });

    const result = deriveDepthFirst({ contract: 'Log', functionName: FIRE, kind: FrameKind.ROOT, master: LOG_MASTER }, host);

    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([FIRE]);
    // The index is where the layout opens the trailing region, not a literal: the master lists exactly those.
    const placed = draft.trailingOutputs;
    expect(placed.map((entry) => entry.index))
      .toStrictEqual([draft.layout.participantCount, draft.layout.participantCount + 1]);
    expect(draft.blockOf(LOG_MASTER).events).toStrictEqual(placed.map((entry) => entry.index));
    expect(draft.assembly.outputs.eventIndices).toStrictEqual(placed.map((entry) => entry.index));

    const program = draft.programFor(LOG_MASTER);
    const vm = compositionMachine();
    const state = vm.evaluate({ inputIndex: 0, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
    expect(vm.stateSuccess(state)).toBe(true);
  });
});
