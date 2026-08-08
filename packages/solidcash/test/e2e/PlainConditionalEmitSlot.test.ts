import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract, TransactionBuilder, getEventNftAddress, readEventsFromChain,
} from '../../src/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * SEC-10 off the bus. The one-armed conditional emit slot is reserved by `collectEmitStatements` and its
 * covenant verification is wrapped in `OP_IF <blob non-empty>` by `emitEventCovenantVerification` - neither is
 * route-specific, so the same unverified output should exist on an ordinary stateful function.
 */
const SOURCE = `pragma solidcash >=0.8.0;
contract CondEmitPlain() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    if (x > 100) { emit Fired(x); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

/** Two-armed: BOTH arms emit, so the slot is settled on every path and must NOT be marked conditional. */
const TWO_ARMED = `pragma solidcash >=0.8.0;
contract TwoArmedPlain() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    if (x > 100) { emit Fired(x); } else { emit Fired(x + 1); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

describe('SEC-10 off the bus: plain stateful conditional emit', () => {
  const artifact = compileString(SOURCE);

  it('reserves an event slot for the one-armed emit, and marks it conditional', () => {
    const fn = (artifact.abi as any[]).find((entry) => entry.name === 'bump');
    expect(fn.blockLayout.slots).toContainEqual({
      kind: 'event', offset: 2, slotIndex: 0, conditional: true,
    });
  });

  /**
   * The repair predicate already exists and is already sound: `minCounts.emits` (the per-branch minimum emit
   * count, GenerateTargetTraversal.ts:2484-2489) marks a slot `conditional` exactly when some path leaves it
   * unsettled. A two-armed if/else settles the slot on every path and is correctly NOT marked, so a repair
   * keyed on this flag would not over-refuse.
   */
  const forgeTwoArmed = async (): Promise<string> => {
    const two = compileString(TWO_ARMED);
    const fn = (two.abi as any[]).find((entry) => entry.name === 'bump');
    expect(fn.blockLayout.slots.find((slot: any) => slot.kind === 'event').conditional).toBeUndefined();
    const provider = createTestProvider();
    const contract = new Contract(two, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, two.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const salted = contract.withCategory(hexToBin(categoryId));
    const sc = StatefulContract.withCategory(contract, categoryId);
    const builder = await (sc as any).bump(4n).build();
    (builder as any).outputs[2] = {
      to: getEventNftAddress(salted, categoryId, two.events![0].signature),
      amount: 1000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])) },
      },
    };
    try {
      await provider.sendRawTransaction(raw(builder));
      return 'ACCEPTED';
    } catch (error) {
      return (error as Error).message;
    }
  };

  it('the un-flagged two-armed slot is settled on the else path too', async () => {
    expectScriptRejection(await forgeTwoArmed(), 0);
  }, 300_000);

  const forge = async (x: bigint): Promise<{ outcome: string; events: any[]; eventOffset: number }> => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const salted = contract.withCategory(hexToBin(categoryId));
    const sc = StatefulContract.withCategory(contract, categoryId);
    const builder = await (sc as any).bump(x).build();

    const fn = (artifact.abi as any[]).find((entry) => entry.name === 'bump');
    const eventSlot = fn.blockLayout.slots.find((slot: any) => slot.kind === 'event');
    const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);
    // Overwrite ONLY the reserved event slot with a spender-minted own-category event NFT.
    (builder as any).outputs[eventSlot.offset] = {
      to: eventAddress,
      amount: 1000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])) },
      },
    };

    let outcome = 'REJECTED';
    try {
      await provider.sendRawTransaction(raw(builder));
      outcome = 'ACCEPTED';
    } catch (error) {
      outcome = `REJECTED: ${(error as Error).message.slice(0, 160)}`;
    }
    const events = outcome === 'ACCEPTED'
      ? await readEventsFromChain(provider as any, eventAddress, categoryId, artifact.events![0])
      : [];
    return { outcome, events, eventOffset: eventSlot.offset };
  };

  // Control: the branch runs, so the slot's covenant verification runs, and the forgery is refused at input 0.
  it('rejects the forged commitment when the branch IS taken', async () => {
    const { outcome, eventOffset } = await forge(200n);
    expect(eventOffset).toBe(2);
    expectScriptRejection(outcome, 0);
  }, 300_000);

  /**
   * The measurement: no bus, no route, no frame. One-armed emit, branch not taken. This WAS forgeable and is
   * now refused - `emitEventCovenantVerification` binds the reserved slot's commitment to EMPTY on the path
   * that does not reach the emit, which is what both honest not-taken shapes produce.
   */
  it('rejects the forged commitment when the branch is NOT taken', async () => {
    const { outcome } = await forge(4n);
    expectScriptRejection(outcome, 0);
  }, 300_000);

  it('the forged NFT no longer reads back as a genuine event off the bus either', async () => {
    const { outcome, events } = await forge(4n);
    expect(outcome).not.toBe('ACCEPTED');
    expect(events).toEqual([]);
  }, 300_000);
});
