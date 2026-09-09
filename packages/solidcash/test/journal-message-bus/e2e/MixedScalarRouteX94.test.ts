import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../../direct-compile.js';
import { Contract, StatefulContract } from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { alicePkh, bobPkh } from '../../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

/**
 * X94 - the mixed-route settle the `mixed-scalar-and-collection-route-not-enabled` gate was withheld for.
 *
 * The gate demotes every admitted handler that carries NO key witness as soon as one sibling carries one, so a
 * scalar getter/bumper is refused purely for the company it keeps. What it protected against is exact: a row
 * that addresses no physical entry, landing in a route whose block reserves an entry slot on every row.
 *
 * Kernel dispatch keeps the row loop independent of the route's physical entry frame. A row without a mapping
 * effect leaves the authenticated caches untouched; a row with two mapping identities selects their orientation
 * from its decoded arguments. The VM cases below pin both forms and the unchanged-entry behavior.
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
 * A two-entry route: `move` keys `balances` twice over one collection, so the kernel reserves two authenticated
 * entry slots and chooses their source orientation from the active row.
 */
const PER_ROW = `pragma solidcash >=0.8.0;
contract X94PerRow() {
  bigint total;
  mapping(bytes20 => bigint) balances;
  function bump(bigint a) public { this.total = this.total + a; require(a >= 0); }
  function credit(bytes20 who, bigint a) public {
    this.balances[who] = this.balances[who] + a; require(a >= 0);
  }
  function move(bytes20 from, bytes20 to, bigint a) public {
    require(this.balances[from] >= a);
    this.balances[from] = this.balances[from] - a;
    this.balances[to] = this.balances[to] + a;
    require(a >= 0);
  }
  function checkTotal(bigint expected) public { require(this.total == expected); }
  function checkBalance(bytes20 who, bigint expected) public { require(this.balances[who] == expected); }
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
    expect(mixed.messageBus?.route.blockLayout?.slots.find((slot: any) => slot.kind === 'entry'))
      .toEqual(collectionOnly.messageBus?.route.blockLayout?.slots.find((slot: any) => slot.kind === 'entry'));
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
   * The entry witness has to be supplied by hand: no row binds it, which `encodeMessageBatch` reports rather
   * than guessing. That is the honest shape of an all-scalar batch on a route that reserves an entry.
   */
  it('settles an ALL-SCALAR batch and flushes the reserved entry unchanged', async () => {
    const artifact = compileString(MIXED, BUS);
    const contract = await deploy(MIXED);
    await contract.getFunction('credit')(alicePkh, 100n).send();
    await contract.getFunction('credit')(bobPkh, 40n).send();
    const encoded = encodeMessageBatch(
      artifact,
      [{ function: 'bump', args: [3n] }, { function: 'bump', args: [4n] }],
      { __message_bus_key_balances_0: alicePkh },
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
    const clean = encodeMessageBatch(artifact, rows);
    expect(await failingInput(() => honest._batchRaw(clean.blob, clean.routeWitnesses).send())).toBe(null);
    await honest.getFunction('checkBalance')(alicePkh, 105n).send();

    const attacked = await deploy(MIXED);
    await attacked.getFunction('credit')(alicePkh, 100n).send();
    const forged = encodeMessageBatch(artifact, rows);
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

  it('settles a scalar row beside a two-entry mapping row on the kernel loop', async () => {
    const artifact = compileString(PER_ROW, BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.find((handler) => handler.name === 'move')).toMatchObject({ eligible: true });
    expect(handlers.find((handler) => handler.name === 'bump')).toMatchObject({ eligible: true });
    expect(handlers.find((handler) => handler.name === 'move')?.batchKeyWitnesses
      ?.filter((witness: any) => witness.swappable)).toHaveLength(2);
    const routeInputs = artifact.messageBus?.route.inputs.map((input: any) => input.name) ?? [];
    expect(routeInputs).toEqual(expect.arrayContaining([
      '__message_bus_key_balances_0', '__message_bus_key_balances_0_row',
    ]));
    expect(routeInputs.some((name: string) => /_r\d+$/.test(name))).toBe(false);

    const contract = await deploy(PER_ROW);
    await contract.getFunction('credit')(alicePkh, 100n).send();
    await contract.getFunction('credit')(bobPkh, 0n).send();
    await contract.batch([
      { function: 'bump', args: [7n] },
      { function: 'move', args: [alicePkh, bobPkh, 30n] },
    ]).send();
    await contract.getFunction('checkTotal')(7n).send();
    await contract.getFunction('checkBalance')(alicePkh, 70n).send();
    await contract.getFunction('checkBalance')(bobPkh, 30n).send();
  }, 180_000);

  it('settles event-emitting entry writers beside a returning scalar handler', async () => {
    const source = `pragma solidcash >=0.8.0;
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
  function checkBalance(bytes20 who, bigint expected) public {
    require(this.balances[who] == expected);
  }
    }`;
    const artifact = compileString(source, BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['totalSupply', 'credit', 'credit2', 'checkBalance']);
    expect(handlers.find((handler) => handler.name === 'totalSupply')).toMatchObject({
      eligible: true,
    });
    expect(handlers.find((handler) => handler.name === 'credit')).toMatchObject({
      eligible: true,
    });
    expect(handlers.find((handler) => handler.name === 'credit2')).toMatchObject({
      eligible: true,
    });

    const contract = await deploy(source);
    await contract.batch([
      { function: 'totalSupply' },
      { function: 'credit', args: [alicePkh, 5n] },
      { function: 'credit2', args: [alicePkh, 6n] },
    ]).send();
    await contract.getFunction('checkBalance')(alicePkh, 11n).send();
  }, 180_000);

  it('admits an emitting scalar handler beside two silent entry writers', () => {
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
      .toEqual(['bump', 'credit', 'debit']);
    expect(handlers.find((handler) => handler.name === 'bump')).toMatchObject({
      eligible: true,
    });
  }, 180_000);
});

/**
 * X88 + X89 began as an arity/under-reservation regression. The kernel now publishes enumerable iteration as an
 * explicit collection stream, so lowering's hidden operands and the route's physical trailing frame agree.
 */
describe('X88/X89 collection iteration on the kernel loop', () => {
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

  it('compiles entries and key iteration as explicit kernel collection streams', () => {
    for (const body of [scanEntries, scanKeys]) {
      const artifact = compileString(iterating(body), BUS);
      expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'scan'))
        .toMatchObject({ eligible: true });
      expect(artifact.messageBus?.route.collectionIterations)
        .toEqual([expect.objectContaining({ collection: 'm' })]);
    }
  }, 240_000);

  /** The iteration stream and fixed keyed access retain independent physical metadata on one route. */
  it('keeps an iteration stream beside an independently keyed entry writer', () => {
    const artifact = compileString(iterating(
      scanEntries,
      'function credit(bytes20 who, bigint a) public { this.m[who] = this.m[who] + a; require(a >= 0); }',
    ), BUS);
    const handlers = artifact.messageBus?.handlers ?? [];
    expect(handlers.find((handler) => handler.name === 'scan')).toMatchObject({
      eligible: true,
    });
    expect(handlers.find((handler) => handler.name === 'credit')).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.entryAccesses)
      .toContainEqual(expect.objectContaining({
        collection: 'm', keyParams: ['__message_bus_key_m_0'], operations: ['read', 'write'],
      }));
    expect(artifact.messageBus?.route.collectionIterations)
      .toEqual([expect.objectContaining({ collection: 'm', mode: 'entries' })]);
  }, 240_000);
});
