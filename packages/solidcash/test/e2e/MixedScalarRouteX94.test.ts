import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { encodeMessageBus } from '../../src/layer3/message-bus.js';
import { alicePkh, bobPkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X94 - the mixed-route settle the `mixed-scalar-and-collection-route-not-enabled` gate was withheld for.
 *
 * The gate demotes every admitted handler that carries NO key witness as soon as one sibling carries one, so a
 * scalar getter/bumper is refused purely for the company it keeps. What it protected against is exact: a row
 * that addresses no physical entry, landing in a route whose block reserves an entry slot on every row.
 *
 * The relaxation admits the scalar handler only while the route's entry slots are NOT per-row - i.e. while no
 * survivor carries a `perRow` key witness. On that shape `LowerCollectionJournalHelpers` hoists the physical
 * entry read to the top of the wrapper and its write-back to the bottom, both OUTSIDE the row dispatch, so a
 * scalar row flushes the entry unchanged rather than leaving its post-state unconstrained.
 */

const BUS = { forceStateful: true, messageBus: true };

/** Scalar `bump` beside entry-writing `credit`: the shape the gate refused. */
const MIXED = `pragma solidcash >=0.8.0;
contract X94Mixed() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  function bump(bigint a) public { this.total = this.total + a; require(a >= 0); }
  function credit(bytes20 who, bigint a) public {
    this.balances[who] = this.balances[who] + a; require(a >= 0);
  }
  function checkTotal(bigint expected) public { require(this.total == expected); }
  function checkBalance(bytes20 who, bigint expected) public { require(this.balances[who] == expected); }
}`;

/** The same contract without the scalar handler: the route the relaxation must not change. */
const COLLECTION_ONLY = `pragma solidcash >=0.8.0;
contract X94Mixed() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  function credit(bytes20 who, bigint a) public {
    this.balances[who] = this.balances[who] + a; require(a >= 0);
  }
  function checkTotal(bigint expected) public { require(this.total == expected); }
  function checkBalance(bytes20 who, bigint expected) public { require(this.balances[who] == expected); }
}`;

/**
 * A PER-ROW entry route: `move` keys `balances` twice over one collection, so the route allocates a row-local
 * entry slot per row. This is the shape the relaxation must keep refusing.
 */
const PER_ROW = `pragma solidcash >=0.8.0;
contract X94PerRow() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  function bump(bigint a) public { this.total = this.total + a; require(a >= 0); }
  function move(bytes20 from, bytes20 to, bigint a) public {
    require(this.balances[from] >= a);
    this.balances[from] = this.balances[from] - a;
    this.balances[to] = this.balances[to] + a;
  }
}`;

async function deploy(source: string): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(source, BUS);
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, inner, artifact.stateLayout!, {}, { saltContract: true },
  );
  return StatefulContract.withCategory(inner, categoryId);
}

/** The input whose covenant rejects, so a hostile case names one exact script rather than "the transaction". */
async function failingInput(send: () => Promise<unknown>): Promise<number | null> {
  try {
    await send();
    return null;
  } catch (error) {
    const message = (error as Error).message;
    const match = /(?:input|Input)[^0-9]{0,20}(\d+)/.exec(message);
    if (!match) throw new Error(`no input index in rejection: ${message}`);
    return Number(match[1]);
  }
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}

describe('X94 a scalar handler joins a collection route', () => {
  it('admits the scalar handler and leaves the block layout the collection route already had', () => {
    const mixed = compileString(MIXED, BUS);
    const collectionOnly = compileString(COLLECTION_ONLY, BUS);
    expect(mixed.messageBus?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['bump', true], ['credit', true], ['checkTotal', true], ['checkBalance', true]]);
    // The soundness claim, in the only place it can be read off a compile: admitting the scalar rows adds no
    // slot and moves none. The entry slot the covenant addresses is the SAME slot at the SAME offset.
    expect(mixed.messageBus?.route.blockLayout)
      .toEqual(collectionOnly.messageBus?.route.blockLayout);
    expect(mixed.messageBus?.route.blockLayout?.slots.map((slot: any) => slot.kind))
      .toEqual(['master', 'dataNft', 'entry']);
  }, 180_000);

  it('settles a mixed batch on the VM, crediting the entry row and the scalar row', async () => {
    const contract = await deploy(MIXED);
    await contract.getFunction('credit')(alicePkh, 100n).send();
    await contract.batch([
      { function: 'bump', args: [7n] },
      { function: 'credit', args: [alicePkh, 5n] },
    ]).send();
    await contract.getFunction('checkTotal')(7n).send();
    await contract.getFunction('checkBalance')(alicePkh, 105n).send();
  }, 180_000);

  /**
   * THE ROW THE GATE EXISTED FOR. Every row is scalar, so nothing in the batch addresses the entry the block
   * still reserves. The entry must come back UNCHANGED - not merely "the transaction verified" - which is the
   * difference between the slot being flushed from its hoisted cache and being left unconstrained.
   *
   * The entry witness has to be supplied by hand: no row binds it, which `encodeMessageBus` reports rather
   * than guessing. That is the honest shape of an all-scalar batch on a route that reserves an entry.
   */
  it('settles an ALL-SCALAR batch and flushes the reserved entry unchanged', async () => {
    const artifact = compileString(MIXED, BUS);
    const contract = await deploy(MIXED);
    await contract.getFunction('credit')(alicePkh, 100n).send();
    await contract.getFunction('credit')(bobPkh, 40n).send();
    const encoded = encodeMessageBus(
      artifact,
      [{ function: 'bump', args: [3n] }, { function: 'bump', args: [4n] }],
      { __scb_key_balances_0: alicePkh },
    );
    expect(await failingInput(() => contract._batchRaw(encoded.blob, encoded.routeWitnesses).send()))
      .toBe(null);
    await contract.getFunction('checkTotal')(7n).send();
    // Read the entries back through the contract's own covenant, not the provider's view. The witnessed entry
    // is alice's; bob's is not even co-spent, and neither moves.
    await contract.getFunction('checkBalance')(alicePkh, 100n).send();
    await contract.getFunction('checkBalance')(bobPkh, 40n).send();
  }, 180_000);

  /**
   * GUARD. A route can "settle" by dispatching to nothing. A batch whose scalar rows differ must land on a
   * different scalar state, and the entry rows must still each apply.
   */
  it('applies every row: two different scalar rows and two different entry rows', async () => {
    const contract = await deploy(MIXED);
    await contract.getFunction('credit')(alicePkh, 100n).send();
    await contract.batch([
      { function: 'bump', args: [3n] },
      { function: 'credit', args: [alicePkh, 5n] },
      { function: 'bump', args: [11n] },
      { function: 'credit', args: [alicePkh, 6n] },
    ]).send();
    await contract.getFunction('checkTotal')(14n).send();
    await contract.getFunction('checkBalance')(alicePkh, 111n).send();
  }, 180_000);

  /**
   * HOSTILE, pinned to the contract's own master input. The scalar handler declares one `bigint`; its row is
   * decoded from the blob and its selector is what chooses the branch. Substituting the ENTRY handler's
   * selector into a scalar row leaves that row's argument vector one field short of the entry handler's
   * schema, and the entry key witness the route checked belongs to no row - so the master covenant, the only
   * script that decodes the blob, must reject.
   */
  it('refuses an entry selector substituted into a scalar row, at the contract input', async () => {
    const artifact = compileString(MIXED, BUS);
    const rows = [
      { function: 'bump', args: [3n] },
      { function: 'credit', args: [alicePkh, 5n] },
    ];

    const honest = await deploy(MIXED);
    await honest.getFunction('credit')(alicePkh, 100n).send();
    const clean = encodeMessageBus(artifact, rows);
    expect(await failingInput(() => honest._batchRaw(clean.blob, clean.routeWitnesses).send())).toBe(null);
    await honest.getFunction('checkBalance')(alicePkh, 105n).send();

    const attacked = await deploy(MIXED);
    await attacked.getFunction('credit')(alicePkh, 100n).send();
    const forged = encodeMessageBus(artifact, rows);
    const blob = Uint8Array.from(forged.blob);
    const scalar = artifact.messageBus!.handlers.find((handler) => handler.name === 'bump')!;
    const entry = artifact.messageBus!.handlers.find((handler) => handler.name === 'credit')!;
    const at = indexOfBytes(blob, hexToBin(scalar.selector));
    expect(at).toBeGreaterThanOrEqual(0);
    blob.set(hexToBin(entry.selector), at);
    expect(await failingInput(() => attacked._batchRaw(blob, forged.routeWitnesses).send())).toBe(0);
    // and nothing moved
    await attacked.getFunction('checkBalance')(alicePkh, 100n).send();
  }, 240_000);

  /**
   * NEGATIVE CONTROL for the narrowing, not for the gate. `move` keys one collection twice, so the route
   * allocates a ROW-LOCAL entry slot per row - the shape whose scalar row genuinely would leave an entry slot
   * with no constraint. The scalar sibling must still be refused, and by the same named reason.
   */
  it('still refuses the scalar sibling on a per-row entry route', () => {
    const artifact = compileString(PER_ROW, BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.find((handler) => handler.name === 'move')).toMatchObject({ eligible: true });
    expect(handlers.find((handler) => handler.name === 'bump')).toMatchObject({
      eligible: false, rejectionReason: 'mixed-scalar-and-collection-route-not-enabled',
    });
    // The reason the refusal stands here: this route's entry witnesses are per-row.
    expect(handlers.find((handler) => handler.name === 'move')?.batchKeyWitnesses
      ?.some((witness: any) => witness.perRow)).toBe(true);
    // And the slots that makes unbindable are real route inputs, one per row, with no row to bind them.
    expect(artifact.messageBus?.route.inputs.map((input: any) => input.name))
      .toEqual(expect.arrayContaining(['__scb_key_balances_0_row_r0', '__scb_key_balances_0_row_r1']));
  }, 180_000);

  /**
   * NEVER-SHRINK GUARD, with its own subject. The uniformity rules pick ONE shape for the whole set, so a
   * newly admitted scalar handler can demote handlers that were already admitted - a RETURNING one makes the
   * route result-shaped, an EMITTING one makes it event-shaped, and each of those refuses handlers the route
   * already carried. The guard runs the rules over both sets and keeps the wider.
   *
   * Neither shape occurs in the four corpora - the corpus delta with the guard and without it is zero rows -
   * so these are the only place the mechanism is exercised at all.
   */
  it('refuses a returning scalar handler rather than let it demote two emitting entry writers', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
contract X94Result() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  event Moved(int amount);
  function totalSupply() public returns (bigint) { require(true); return this.total; }
  function credit(bytes20 who, bigint a) public {
    this.balances[who] = this.balances[who] + a; emit Moved(a); require(a >= 0);
  }
  function credit2(bytes20 who, bigint a) public {
    this.balances[who] = this.balances[who] + a; emit Moved(a); require(a >= 0);
  }
}`, BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    // Admitting `totalSupply` makes the route result-shaped, which refuses BOTH emitters: one handler against
    // the two the route already carried. The guard keeps the two.
    expect(handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['credit', 'credit2']);
    expect(handlers.find((handler) => handler.name === 'totalSupply')).toMatchObject({
      eligible: false, rejectionReason: 'mixed-scalar-and-collection-route-not-enabled',
    });
  }, 180_000);

  it('refuses an emitting scalar handler rather than let it demote two silent entry writers', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
contract X94Event() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  event Bumped(int amount);
  function bump(bigint a) public { this.total = this.total + a; emit Bumped(a); require(a >= 0); }
  function credit(bytes20 who, bigint a) public { this.balances[who] = this.balances[who] + a; require(a >= 0); }
  function debit(bytes20 who, bigint a) public { this.balances[who] = this.balances[who] - a; require(a >= 0); }
}`, BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['credit', 'debit']);
    expect(handlers.find((handler) => handler.name === 'bump')).toMatchObject({
      eligible: false, rejectionReason: 'mixed-scalar-and-collection-route-not-enabled',
    });
  }, 180_000);
});

/**
 * X88 + X89, and the pairing is the point. A collection ITERATION read never entered the footprint
 * (`CollectionIterationNode` carries `collectionName`, not `name`), which was harmless only because X88 stopped
 * the handler compiling: the enumerable-iteration lowering gives the handler extra parameters after the
 * wrapper's dispatch call has already been generated from the pre-lowering signature.
 *
 * Fixing the arity alone would have turned a compile error into a SILENT UNDER-RESERVATION - a handler admitted
 * with entry reads the block reserves nothing for. So the read is recovered AND the handler is refused by name,
 * and both halves are pinned here.
 */
describe('X88/X89 a collection-iteration handler is refused by name, not crashed on arity', () => {
  const iterating = (body: string, sibling = ''): string => `pragma solidcash >=0.8.0;
contract X88Iter() {
  enumerable mapping(bytes20 => bigint) m;
  bigint total;
  ${body}
  ${sibling}
}`;
  const scanEntries = `function scan(bigint seed) public {
    bigint t = seed;
    for (bytes20 k, bigint v of this.m.entries) { t = t + v; }
    this.total = t;
    require(t >= 0);
  }`;
  const scanKeys = `function scan(bigint seed) public {
    bigint t = seed;
    for (bytes20 k in this.m) { t = t + 1; }
    this.total = t;
    require(t >= 0);
  }`;

  it('compiles the handler that used to crash the generated wrapper, with no route and a named reason', () => {
    for (const body of [scanEntries, scanKeys]) {
      const artifact = compileString(iterating(body), BUS);
      expect(artifact.messageBus).toBeUndefined();
      expect((artifact.diagnostics ?? []).map((entry) => entry.message).join(' '))
        .toContain("'scan': collection-iteration-handler-not-enabled");
    }
  }, 240_000);

  /**
   * The half that makes the refusal load-bearing rather than cosmetic. Beside a handler the route DOES admit,
   * the iteration handler must be refused for the iteration - not swept up by some other rule that happens to
   * fire - and the route's entry slots must still be exactly the admitted handler's own.
   */
  it('refuses the iteration handler beside an admitted entry writer, and sizes only that writer', () => {
    const artifact = compileString(iterating(
      scanEntries,
      'function credit(bytes20 who, bigint a) public { this.m[who] = this.m[who] + a; require(a >= 0); }',
    ), BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.find((handler) => handler.name === 'scan')).toMatchObject({
      eligible: false, rejectionReason: 'collection-iteration-handler-not-enabled',
    });
    expect(handlers.find((handler) => handler.name === 'credit')).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.entryAccesses)
      .toEqual([{ collection: 'm', keyParams: ['__scb_key_m_0'], operations: ['read', 'write'] }]);
  }, 240_000);
});
