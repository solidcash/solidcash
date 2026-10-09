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
 * Events beside an early return. Semantic analysis numbers emits as statements in sequence; the early return then
 * nests the rest of the body into the other arm, and code generation reserved and marked event slots by per-branch
 * counts that no longer described them. An emit in the returning arm beside later ones failed to compile ("Expected
 * variable '__internal__emit_1' does not exist on the stack", KashiPair's accrue), and with one emit after the
 * return the returning path could not settle at all. Each path now settles with the events it emits, and an event
 * output missing from it or added to it is refused.
 */
const RETURNING_EMIT = `pragma solidcash >=0.8.0;
contract EarlyReturnEvents() {
  bigint counter;
  event Fired(bigint value);
  function f(bigint x) {
    if (x == 0) {
      emit Fired(100);
      return;
    }
    emit Fired(x);
    emit Fired(x + 1);
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const EMIT_AFTER_RETURN = `pragma solidcash >=0.8.0;
contract ReturnThenEmit() {
  bigint counter;
  event Fired(bigint value);
  function f(bigint x) {
    if (x == 0) {
      return;
    }
    emit Fired(x);
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const FORGED_COMMITMENT = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])); // decodes to 999999

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Row {
  outcome: string;
  events: bigint[];
}

/**
 * One honest `f(x)`, optionally with the output at one reserved event slot tampered with: `missing` replaces it
 * with a token-free output, `extra` puts a spender-minted event NFT there. A fee input past the block pays for
 * either, so a refusal is the covenant's.
 */
const run = async (source: string, x: bigint, tamper?: { kind: 'missing' | 'extra'; slot: number }): Promise<Row> => {
  const artifact = compileString(source);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any).f(x).build();
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);

  if (tamper) {
    const fn = (artifact.abi as any[]).find((entry) => entry.name === 'f');
    const slot = fn.blockLayout.slots.find((candidate: any) => candidate.kind === 'event'
      && candidate.slotIndex === tamper.slot);
    const output = tamper.kind === 'extra'
      ? {
        to: eventAddress,
        amount: 1000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: FORGED_COMMITMENT } },
      }
      : { to: eventAddress, amount: 1000n };
    // A path that leaves a slot unsettled holds an empty own-category NFT there, or, for a suffix slot, no output
    // at all: an extra event replaces the first and is inserted for the second.
    const outputs = (builder as any).outputs as { token?: unknown }[];
    const held = slot.offset < outputs.length && outputs[slot.offset]?.token !== undefined;
    if (tamper.kind === 'missing' || held) outputs[slot.offset] = output;
    else outputs.splice(slot.offset, 0, output);
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, categoryId, artifact.events![0]))
      .map((event: any) => event.values.value)
    : [];
  return { outcome, events };
};

describe('an emit in an arm that returns early, beside later emits', () => {
  it('settles the returning path with its one event', async () => {
    const row = await run(RETURNING_EMIT, 0n);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([100n]);
  }, 300_000);

  it('settles the full path with its two events', async () => {
    const row = await run(RETURNING_EMIT, 5n);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([5n, 6n]);
  }, 300_000);

  it('refuses the returning path without its event, or with an event it does not emit', async () => {
    expectScriptRejection((await run(RETURNING_EMIT, 0n, { kind: 'missing', slot: 0 })).outcome, 0);
    expectScriptRejection((await run(RETURNING_EMIT, 0n, { kind: 'extra', slot: 1 })).outcome, 0);
  }, 300_000);

  it('refuses the full path without one of its events, or with the returning path\'s', async () => {
    expectScriptRejection((await run(RETURNING_EMIT, 5n, { kind: 'missing', slot: 1 })).outcome, 0);
    expectScriptRejection((await run(RETURNING_EMIT, 5n, { kind: 'extra', slot: 0 })).outcome, 0);
  }, 300_000);
});

describe('an emit after an early return', () => {
  it('settles the returning path with no event and the full path with its event', async () => {
    const returning = await run(EMIT_AFTER_RETURN, 0n);
    expect(returning.outcome).toBe('ACCEPTED');
    expect(returning.events).toEqual([]);
    const full = await run(EMIT_AFTER_RETURN, 5n);
    expect(full.outcome).toBe('ACCEPTED');
    expect(full.events).toEqual([5n]);
  }, 300_000);

  it('refuses an event on the returning path, and the full path without its event', async () => {
    expectScriptRejection((await run(EMIT_AFTER_RETURN, 0n, { kind: 'extra', slot: 0 })).outcome, 0);
    expectScriptRejection((await run(EMIT_AFTER_RETURN, 5n, { kind: 'missing', slot: 0 })).outcome, 0);
  }, 300_000);
});
