import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  TransactionBuilder,
} from '../../src/index.js';
import {
  StatefulContract,
  getEventNftAddress,
  readEventsFromChain,
} from '../../src/stateful/index.js';
import { createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * Events in exclusive arms, on the direct convention. Semantic analysis gave the arms of a branch shared event slots
 * by position, taking one arm as the reference for how many there were:
 *  - it took the if arm whenever that arm held at least half the else arm's events, so an else arm emitting two
 *    events beside one in the if arm ran past the reserved slots and failed to compile (KashiPair's cook);
 *  - different events shared a slot, whose output is placed under one event's locking bytecode, so every path
 *    emitting another event there was refused (BentoBoxV1's setStrategy settled one path of five);
 *  - a nested branch ended at its if arm's count, so the last event of a longer else arm shared a slot with the
 *    next event of its path, and one of the two was dropped from a transaction that was still accepted.
 * Code generation also reserved and marked a branch's slots from counts that start where the slots visited so far
 * end, so a path that skipped an earlier arm's slot could not settle. Each path now settles with exactly the events
 * it emits, and an event output missing from it or added to it is refused.
 */
const contract = (name: string, events: string[], body: string): string => `pragma solidcash >=0.8.0;
contract ${name}() {
  bigint counter;
  ${events.map((event) => `event ${event}(bigint value);`).join('\n  ')}
  function f(bool c, bool d, bigint x) {
    ${body}
    this.counter = this.counter + 1;
  }
}`;

// BentoBoxV1.setStrategy: queue a strategy, or settle the old one (profit, loss or neither, then divest) and set it.
const SET_STRATEGY = contract('SetStrategy', ['Queued', 'Profit', 'Loss', 'Divest', 'Set'], `
    if (c) {
      emit Queued(1);
    } else {
      if (d) {
        if (x > 10) {
          emit Profit(x);
        } else if (x > 5) {
          emit Loss(x);
        }
        emit Divest(2);
      }
      emit Set(3);
    }`);

// KashiPair.cook: an accrual that may emit, then one action of a chain, one of which emits two events.
const COOK = contract('Cook', ['Accrue', 'AddCollateral', 'Transfer', 'AddAsset', 'Repay'], `
    if (c) {
      emit Accrue(9);
    }
    if (x == 1) {
      emit AddCollateral(x);
    } else if (x == 2) {
      emit Transfer(x);
      emit AddAsset(x);
    } else if (x == 3) {
      emit Repay(x);
    }`);

// One event throughout: the nested else arm is longer than its if arm, and an event follows the nested branch.
const NESTED_TAIL = contract('NestedTail', ['Fired'], `
    if (c) {
      emit Fired(5);
      emit Fired(6);
      emit Fired(7);
      emit Fired(8);
    } else {
      if (d) {
        emit Fired(1);
      } else {
        emit Fired(2);
        emit Fired(3);
      }
      emit Fired(4);
    }`);

// One event throughout: a branch in the second arm, whose path past it skips the first slot.
const SECOND_ARM = contract('SecondArm', ['Fired'], `
    if (c) {
      emit Fired(1);
      emit Fired(2);
    } else {
      if (d) {
        emit Fired(3);
      }
      emit Fired(4);
    }`);

const FORGED_COMMITMENT = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])); // decodes to 999999

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Row {
  outcome: string;
  // `Name(value)` for each event read back, sorted.
  events: string[];
  // The reserved event slots this path settles, and the ones it leaves without an event.
  settled: number[];
  unsettled: number[];
}

/**
 * One honest `f(c, d, x)`, optionally with the output at one reserved event slot tampered with: `missing` replaces
 * it with a token-free output, `extra` puts a spender-minted event NFT of that slot's event there. A fee input past
 * the block pays for either, so a refusal is the covenant's.
 */
const run = async (
  source: string, [c, d, x]: [boolean, boolean, bigint], tamper?: { kind: 'missing' | 'extra'; slot: number },
): Promise<Row> => {
  const artifact = compileString(source);
  const provider = createTestProvider();
  const instance = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, instance, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = instance.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(instance, categoryId);
  const builder = await (sc as any).f(c, d, x).build();
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);

  const fn = (artifact.abi as any[]).find((entry) => entry.name === 'f');
  const slots = (fn.blockLayout.slots as any[]).filter((slot) => slot.kind === 'event');
  const outputs = (builder as any).outputs as { token?: { nft?: { commitment?: unknown } } }[];
  const holds = (slot: any): boolean => String(outputs[slot.offset]?.token?.nft?.commitment ?? '') !== '';
  const settled = slots.filter(holds).map((slot) => slot.slotIndex);
  const unsettled = slots.filter((slot) => !holds(slot)).map((slot) => slot.slotIndex);

  if (tamper) {
    const slot = slots.find((candidate) => candidate.slotIndex === tamper.slot);
    const signature = (fn.emits as any[]).find((emit) => emit.emitIndex === tamper.slot).eventSignature;
    const eventAddress = getEventNftAddress(salted, categoryId, signature);
    const output = tamper.kind === 'extra'
      ? {
        to: eventAddress,
        amount: 1000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: FORGED_COMMITMENT } },
      }
      : { to: eventAddress, amount: 1000n };
    // A path that leaves a slot unsettled holds an empty own-category NFT there, or, for a suffix slot, no output
    // at all: an extra event replaces the first and is inserted for the second.
    const held = slot.offset < outputs.length && outputs[slot.offset]?.token !== undefined;
    if (tamper.kind === 'missing' || held) outputs[slot.offset] = output as never;
    else outputs.splice(slot.offset, 0, output as never);
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events: string[] = [];
  if (outcome === 'ACCEPTED') {
    for (const definition of artifact.events!) {
      const address = getEventNftAddress(salted, categoryId, definition.signature);
      for (const event of await readEventsFromChain(provider as any, address, categoryId, definition)) {
        events.push(`${definition.name}(${(event as any).values.value})`);
      }
    }
  }
  return { outcome, events: events.sort(), settled, unsettled };
};

/** The path settles with exactly `expected`; each of its events missing, or an event in a slot it leaves, is refused. */
const settlesExactly = async (
  source: string, args: [boolean, boolean, bigint], expected: string[],
): Promise<void> => {
  const honest = await run(source, args);
  expect(honest.outcome).toBe('ACCEPTED');
  expect(honest.events).toEqual([...expected].sort());
  expect(honest.settled).toHaveLength(expected.length);
  for (const slot of honest.settled) {
    expectScriptRejection((await run(source, args, { kind: 'missing', slot })).outcome, 0);
  }
  for (const slot of honest.unsettled) {
    expectScriptRejection((await run(source, args, { kind: 'extra', slot })).outcome, 0);
  }
};

describe('different events in nested exclusive arms (BentoBoxV1.setStrategy)', () => {
  it('settles the queueing path with its one event', async () => {
    await settlesExactly(SET_STRATEGY, [true, false, 0n], ['Queued(1)']);
  }, 300_000);

  it('settles the profit path with its three events', async () => {
    await settlesExactly(SET_STRATEGY, [false, true, 20n], ['Profit(20)', 'Divest(2)', 'Set(3)']);
  }, 300_000);

  it('settles the loss path with its three events', async () => {
    await settlesExactly(SET_STRATEGY, [false, true, 7n], ['Loss(7)', 'Divest(2)', 'Set(3)']);
  }, 300_000);

  it('settles the path with neither profit nor loss with its two events', async () => {
    await settlesExactly(SET_STRATEGY, [false, true, 1n], ['Divest(2)', 'Set(3)']);
  }, 300_000);

  it('settles the path without a strategy to divest with its one event', async () => {
    await settlesExactly(SET_STRATEGY, [false, false, 0n], ['Set(3)']);
  }, 300_000);
});

describe('an arm emitting two events beside arms emitting one (KashiPair.cook)', () => {
  it('settles each action with its events, with and without the accrual', async () => {
    await settlesExactly(COOK, [true, false, 1n], ['Accrue(9)', 'AddCollateral(1)']);
    await settlesExactly(COOK, [false, false, 2n], ['Transfer(2)', 'AddAsset(2)']);
    await settlesExactly(COOK, [true, false, 2n], ['Accrue(9)', 'Transfer(2)', 'AddAsset(2)']);
    await settlesExactly(COOK, [false, false, 3n], ['Repay(3)']);
    await settlesExactly(COOK, [true, false, 4n], ['Accrue(9)']);
  }, 300_000);
});

describe('one event in nested arms', () => {
  it('settles every event of a path through a longer nested else arm', async () => {
    await settlesExactly(NESTED_TAIL, [true, false, 0n], ['Fired(5)', 'Fired(6)', 'Fired(7)', 'Fired(8)']);
    await settlesExactly(NESTED_TAIL, [false, true, 0n], ['Fired(1)', 'Fired(4)']);
    await settlesExactly(NESTED_TAIL, [false, false, 0n], ['Fired(2)', 'Fired(3)', 'Fired(4)']);
  }, 300_000);

  it('settles the path past a branch in the second arm that skips the first slot', async () => {
    await settlesExactly(SECOND_ARM, [true, false, 0n], ['Fired(1)', 'Fired(2)']);
    await settlesExactly(SECOND_ARM, [false, true, 0n], ['Fired(3)', 'Fired(4)']);
    await settlesExactly(SECOND_ARM, [false, false, 0n], ['Fired(4)']);
  }, 300_000);
});
