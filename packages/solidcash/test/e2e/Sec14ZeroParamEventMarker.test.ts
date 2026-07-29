import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  Contract, StatefulContract, getEventNftAddress, readEventsFromChain,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * SEC-14. A zero-parameter event's taken and not-taken rows were byte-identical at the event slot: same event
 * covenant address, `none` capability, EMPTY commitment on both. No positional pin can separate them.
 *
 * The cause turned out to be sharper than "indistinguishable rows", and the fix is at that cause rather than
 * bolted on top. `emitEventCovenantVerification` gates a conditional emit's verification on
 * `OP_IF <blob non-empty>`, and the blob for a zero-parameter emit was EMPTY - the same value as the reserved
 * dummy for an emit that was never reached. So on the TAKEN path the gate was FALSE and the covenant address,
 * capability, FT-amount and satoshi-bound checks did not run at all; only the SEC-10 not-taken binding
 * ("commitment at this index is empty") did. MEASURED: the reserved output could be replaced with a plain
 * 50,000-satoshi P2SH carrying no token whatsoever and the transaction was ACCEPTED.
 *
 * One non-empty ACTIVE marker byte settles both halves: the gate becomes true exactly when the emit is
 * reached, so the verification runs; and the row carries a byte the not-taken row cannot. `OP_1` is the same
 * single script byte `OP_0` was, so the script costs nothing and only the on-chain commitment grows by a byte -
 * which is also what makes the row readable, since `readEventsFromChain` skips empty commitments.
 *
 * The reader accident is therefore removed rather than relied on: a genuine `emit Ping()` now decodes as a log,
 * and a not-taken slot still does not.
 */
const PING = `pragma solidcash >=0.8.0;
contract PingEvents() {
  bigint counter;
  event Ping();
  function bump(bigint x) {
    if (x > 100) { emit Ping(); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

/** Control: the SAME event, emitted unconditionally. Its verification was always reachable. */
const PING_UNCOND = `pragma solidcash >=0.8.0;
contract PingUncond() {
  bigint counter;
  event Ping();
  function bump(bigint x) {
    emit Ping();
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

/** Guard: a one-PARAMETER conditional emit. Its blob was already non-empty, so nothing here may change it. */
const ONE_PARAM = `pragma solidcash >=0.8.0;
contract OneParam() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    if (x > 100) { emit Fired(x); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Row { outcome: string; slot: string; logs: number }

async function run(source: string, x: bigint, divert: boolean): Promise<Row> {
  const artifact = compileString(source);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder: any = await (sc as any).bump(x).build();
  const fn = (artifact.abi as any[]).find((entry) => entry.name === 'bump');
  const offset = fn.blockLayout.slots.find((s: any) => s.kind === 'event').offset;
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);
  const before = builder.outputs[offset];
  const slot = `${before?.token?.nft?.capability ?? '-'}/${before?.token?.nft?.commitment ?? ''}`;

  if (divert) {
    // Everything the not-taken binding asserts is "the commitment at this index is empty". Replace the reserved
    // event output with a plain P2SH carrying no token at all and far past the honest 1200-satoshi bound.
    const { utxo, unlocker } = await createFeeFunder(provider, 200_000n);
    builder.addInput(utxo, unlocker);
    const sink = new Contract(
      compileString('contract Sink() { function f() { require(true); } }'), [], { provider },
    );
    builder.outputs[offset] = { to: addressToLockScript(sink.address), amount: 50_000n };
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const logs = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, categoryId, artifact.events![0])).length
    : 0;
  return { outcome, slot, logs };
}

describe('SEC-14: zero-parameter event active marker', () => {
  // HONEST POSITIVE CONTROL. The taken row settles, carries the marker, and reads back as a genuine log.
  it('settles the taken row and reads it back as a log', async () => {
    const row = await run(PING, 200n, false);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.slot).toBe('none/01');
    expect(row.logs).toBe(1);
  }, 300_000);

  // The not-taken row settles too, and is now distinguishable: empty commitment, and no log.
  it('settles the not-taken row with an empty commitment and no log', async () => {
    const row = await run(PING, 4n, false);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.slot).toBe('none/');
    expect(row.logs).toBe(0);
  }, 300_000);

  /**
   * HOSTILE, pinned to an index, and the reason the marker is worth its byte. This diversion was ACCEPTED
   * before: on the taken path the gate was false, so nothing checked the covenant address, the capability, the
   * FT amount or the satoshi bound at the reserved index. It is refused at input 0 now.
   */
  it('refuses diverting the reserved event output on the taken path', async () => {
    const row = await run(PING, 200n, true);
    expect(row.outcome).toContain('error in evaluating input index 0');
  }, 300_000);

  /**
   * GUARD NEGATIVE CONTROL #1, so the repair is not credited to the wrong mechanism. The SAME diversion against
   * an UNCONDITIONAL zero-parameter emit was already refused before this change: that path never had the gate.
   * If the marker were doing nothing and some other check had appeared, both rows would move together.
   */
  it('was already refusing the same diversion on an unconditional emit', async () => {
    const row = await run(PING_UNCOND, 4n, true);
    expect(row.outcome).toContain('error in evaluating input index 0');
    expect((await run(PING_UNCOND, 4n, false)).slot).toBe('none/01');
  }, 300_000);

  /**
   * GUARD NEGATIVE CONTROL #2. A one-parameter conditional emit already had a non-empty blob, so the marker
   * must not touch it: its taken row still carries exactly the encoded parameter and its not-taken row is
   * still empty. A marker prepended to every emit would have shown up here as a changed commitment.
   */
  it('leaves a one-parameter conditional emit byte-for-byte unchanged', async () => {
    expect((await run(ONE_PARAM, 200n, false)).slot).toBe('none/02c800');
    expect((await run(ONE_PARAM, 4n, false)).slot).toBe('none/');
  }, 300_000);
});
