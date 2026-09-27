import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  computeEventNameHash,
  encodeEventCommitment,
  hash256,
  validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * An event emitted by a per-call master, laid out as a trailing output.
 *
 * The plan states the event's output itself — its lock, value and token — and the layout opens that output past
 * the participants, where no input sits. The composer's assembled transaction carries it, a block's `events` list
 * names it by index, and the master's own body checks the payload it computed against the token there.
 *
 * The two-contract round trip whose entry emits after its call returns is where the shipped path stops. Such a
 * source does not compile unless every contract in the unit attributes an event (`PER_CALL_CODEGEN_UNAVAILABLE`),
 * and with that workaround applied the derivation stalls on the first master whose witness block carries both a
 * call section and an event list (`PER_CALL_DERIVATION_STALLED`). Both refusals are pinned below, and the shape
 * that does run — an entry that emits without making a call — is driven end to end.
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
const EVENT_VALUE = 1_000n;

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: EMPTY } });

/**
 * The lock the emitting body recomputes for an event: the category pin, the event signature hash and the relative
 * timelock, hashed into a P2SH32 lock.
 */
function eventCovenantLock(category: Uint8Array, signature: string): Uint8Array {
  const nameHash = computeEventNameHash(signature);
  const script = new Uint8Array([
    0xc0, 0xce, 0x01, 0x20, 0x7f, 0x7c, // OP_INPUTINDEX OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_SWAP
    0x20, ...categorySlotValue(category), // the category in the order introspection reports it
    0x88, 0x00,                         // OP_EQUALVERIFY, empty capability
    0x88, 0x14, ...nameHash,            // OP_EQUALVERIFY, the event signature hash
    0x75, 0x02, 0x90, 0x00, 0xb2, 0x75, // OP_DROP <144> OP_CHECKSEQUENCEVERIFY OP_DROP
    0x51,                               // OP_1
  ]);
  return new Uint8Array([0xaa, 0x20, ...hash256(script), 0x87]);
}

/** An event output: an immutable NFT of the contract's category carrying the emitted payload. */
function eventOutput(
  category: Uint8Array,
  signature: string,
  commitment: Uint8Array,
): {
  lockingBytecode: Uint8Array;
  valueSatoshis: bigint;
  token: { category: Uint8Array; amount: bigint; nft: { capability: 'none'; commitment: Uint8Array } };
} {
  return {
    lockingBytecode: eventCovenantLock(category, signature),
    valueSatoshis: EVENT_VALUE,
    token: { category, amount: 0n, nft: { capability: 'none', commitment } },
  };
}

/** Two contracts where every contract emits, so the compiler admits the unit, and `A.f` emits after its call. */
const ROUND_TRIP_SOURCE = 'pragma solidcash ^0.13.0;'
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
  const artifacts = compileStringMulti(ROUND_TRIP_SOURCE, { composition: 'per-call' });
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
  const eventIndex = blocks.reduce(
    (count, block) => count + block.masters.length + (block.validator === undefined ? 0 : 1) + block.state.length,
    0,
  );

  const aFirst: DraftMaster = {
    master: A_FIRST, contract: 'A', functionName: ENTRY_F, program: a.script,
    facts: facts('A', 'f', FrameKind.ROOT, 2, true, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_A, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: B_MASTER, target: ADDRESS_B, value: 0n,
      argumentPushes: [new Uint8Array(4).fill(0x11)],
    }],
    retval: EMPTY, segments: [[], []], events: [eventIndex], sends: [],
    argumentPushes: [], redeemScript: a.script, dispatches: true,
  };
  const bMaster: DraftMaster = {
    master: B_MASTER, contract: 'B', functionName: ENTRY_G, program: b.script,
    facts: facts('B', 'g', FrameKind.CALL, 1, true, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_A, self: ADDRESS_B, value: 0n },
    enteredBy: A_FIRST, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: A_SECOND, target: ADDRESS_A, value: 0n,
      argumentPushes: [new Uint8Array(4).fill(0x22)],
    }],
    retval: EMPTY, segments: [[], []], events: [eventIndex + 1], sends: [],
    argumentPushes: [new Uint8Array(4).fill(0x11)], redeemScript: b.script,
  };
  const aSecond: DraftMaster = {
    master: A_SECOND, contract: 'A', functionName: ENTRY_K, program: a.script,
    facts: facts('A', 'k', FrameKind.CALL, 2, false, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_B, self: ADDRESS_A, value: 0n },
    enteredBy: B_MASTER, origin: USER_ID,
    calls: [], retval: EMPTY, segments: [[]], events: [], sends: [],
    argumentPushes: [new Uint8Array(4).fill(0x22)], redeemScript: a.script,
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: USER_ID, index: 4 }],
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
    expect(artifacts.A!.composition?.convention).toBe('per-call');
    expect(artifacts.B!.composition?.convention).toBe('per-call');

    const { draft } = createComposedDerivationHost({ artifacts: [artifacts.A!, artifacts.B!], plan });
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

  it('is refused by the shipped derivation at the entry\'s call site', () => {
    // A master's witness block that carries both a call section and an event list does not verify, so the
    // derivation never advances past the entry's first call site. Until that is emitted, the round trip whose
    // entry emits after its call returns cannot be derived.
    const { plan, artifacts } = buildRoundTrip();
    const { host } = createComposedDerivationHost({ artifacts: [artifacts.A!, artifacts.B!], plan });

    let message = '';
    try {
      deriveDepthFirst(ROOT, host);
    } catch (error) {
      message = String((error as { message?: string }).message ?? error);
    }
    expect(message).toContain('PER_CALL_DERIVATION_STALLED');
    expect(message).toContain(`${ENTRY_F} filled no witness at site 0 (call 0)`);
  });

  it('cannot be compiled at all when only the entry attributes an event', () => {
    // The survey that gates the tail is unit-wide while the event list is per contract, so a unit that emits and
    // makes an external call requires every contract in it to attribute an event to a body.
    const source = 'pragma solidcash ^0.13.0;'
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

    let message = '';
    try {
      compileStringMulti(source, { composition: 'per-call' });
    } catch (error) {
      message = String((error as { message?: string }).message ?? error);
    }
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('emits an event that is not attributed to a body');
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
  const SOURCE = 'pragma solidcash ^0.13.0;'
    + ' contract Log {'
    + '   event First(int x);'
    + '   event Second(int y);'
    + '   function fire() { emit First(1); emit Second(2); require(true); }'
    + ' }';
  const FIRE = 'Log.fire()';
  const LOG_MASTER = 'log-1';
  const USER = 'user';

  function build(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
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
    const { host, draft } = createComposedDerivationHost({ artifacts: [artifacts.Log!], plan });

    const result = deriveDepthFirst({ contract: 'Log', functionName: FIRE, kind: FrameKind.ROOT, master: LOG_MASTER }, host);

    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([FIRE]);
    // The index is where the layout opens the trailing region, not a literal: the master lists exactly those.
    const placed = draft.trailingOutputs;
    expect(placed.map((entry) => entry.index))
      .toStrictEqual([draft.layout.participantCount, draft.layout.participantCount + 1]);
    expect(draft.blockOf(LOG_MASTER).events).toStrictEqual(placed.map((entry) => entry.index));
    expect(draft.assembly.outputs.eventIndices).toStrictEqual(placed.map((entry) => entry.index));

    const program = draft.programFor(LOG_MASTER);
    const vm = createVirtualMachineBch2026({ operationCostBudgetPerByte: 10_000_000, hashDigestIterationsPerByte: 10_000_000 });
    const state = vm.evaluate({ inputIndex: 0, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
    expect(vm.stateSuccess(state)).toBe(true);
  });
});
