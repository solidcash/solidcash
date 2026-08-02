import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, bigIntToVmNumber } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X73 - a Solidity entry point is `external`, and the SCB1 route admitted only `public`.
 *
 * That single refusal was 172 of the 455 route refusals in the F3 corpus census, three times larger than any
 * other gate. It was incidental: `external` and `public` differ in exactly one thing in this compiler - whether
 * the name is callable from inside the contract - and every route-relevant property (entry-point status, ABI
 * membership, block layout, the final-require rule, data locations) reads them identically. What actually broke
 * was the generated dispatcher's bare `handler(args)` call, which the resolver rejects as an internal call to an
 * external function. An admitted external handler is now invoked through an internal clone.
 *
 * Every contract below declares NO public function at all, so a route can only exist because `external` is
 * admitted; a route that appeared for some other reason would still leave these contracts with none.
 */

// X73 isolates Release 4 entry admission; Release 5 grouping has its own corpus.
const BATCH = { forceStateful: true, hiddenBatch: true, repeatedExternalBatch: false };

const externalOnly = `pragma solidcash >=0.8.0;
contract X73ExternalOnly() {
  int counter;
  function add(int n) external { this.counter = this.counter + n; require(n >= 0); }
}`;

/** The same contract in every respect but the one keyword. Its settled state is the honest reference. */
const publicOnly = externalOnly
  .replace('X73ExternalOnly', 'X73PublicOnly')
  .replace('external {', 'public {');

async function deploy(source: string): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(source, BATCH);
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, inner, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(inner, categoryId);
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_unused, index) => (value >>> (8 * index)) & 0xff);

/** One well-formed SCB1 row for `add(n)`, the blob the honest path builds for a single-row batch. */
const oneAddBlob = (selector: string, amount: bigint): Uint8Array => {
  const args = scriptToBytecode([bigIntToVmNumber(amount)]);
  return concat(
    hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(selector),
    le(0, 4), le(0, 2), le(args.length, 2), args,
  );
};

/**
 * The input whose covenant rejects, so a hostile case names one exact script rather than "the transaction".
 *
 * MockNetworkProvider evaluates every input and reports the first failure; the index is read back out of that
 * message. Returns null when the transaction verifies, which is what the honest control asserts.
 */
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

describe('X73 external entry points reach the SCB1 route', () => {
  it('settles a three-row batch over an external handler and nothing else declares one', async () => {
    const artifact = compileString(externalOnly, BATCH);
    // The contract's whole surface is external. A route at all is the claim under test.
    expect(artifact.abi.map((entry) => entry.modifiers)).toEqual([['external']]);
    expect(artifact.hiddenBatch?.handlers)
      .toEqual([expect.objectContaining({ name: 'add', eligible: true })]);

    const contract = await deploy(externalOnly);
    await contract.batch([
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
      { function: 'add', args: [4n] },
    ]).send();
    // Not merely "a transaction settled": the handler body ran once per row, in one transaction.
    expect((await contract.getState()).counter).toBe(9n);
  }, 120_000);

  /**
   * GUARD. The route could settle for the wrong reason - dispatching to nothing and flushing an unchanged
   * state would also "settle". Two rows must differ from three by exactly the row they add, and the external
   * spelling must reach the same state the public spelling does from the same rows.
   */
  it('credits each row to the handler body, and matches the public spelling row for row', async () => {
    const rows = [{ function: 'add', args: [5n] }, { function: 'add', args: [6n] }];
    const twoRows = await deploy(externalOnly);
    await twoRows.batch(rows).send();
    expect((await twoRows.getState()).counter).toBe(11n);

    const threeRows = await deploy(externalOnly);
    await threeRows.batch([...rows, { function: 'add', args: [7n] }]).send();
    expect((await threeRows.getState()).counter).toBe(18n);

    const reference = await deploy(publicOnly);
    await reference.batch(rows).send();
    expect((await reference.getState()).counter).toBe(11n);
  }, 120_000);

  /**
   * HOSTILE. A blob whose row count claims two rows while carrying one is the substitution the route's own
   * cursor check exists to catch. It must be refused by the CONTRACT's covenant - the input holding the SCB1
   * unlocker - and not by an SDK-side guard or by some other input in the transaction.
   */
  it('refuses a row-count substitution at the contract input, where the honest blob verifies', async () => {
    const selector = compileString(externalOnly, BATCH).hiddenBatch!.handlers
      .find((handler) => handler.name === 'add')!.selector;

    const honest = await deploy(externalOnly);
    expect(await failingInput(() => honest._batchRaw(oneAddBlob(selector, 2n)).send())).toBe(null);
    expect((await honest.getState()).counter).toBe(2n);

    const attacked = await deploy(externalOnly);
    const forged = oneAddBlob(selector, 2n);
    forged[6] = 2; // count says two rows; the blob carries one
    const at = await failingInput(() => attacked._batchRaw(forged).send());
    expect(at).toBe(0); // the contract master input, the only script that decodes the blob
    expect((await attacked.getState()).counter).toBe(0n);
  }, 120_000);

  /**
   * NEGATIVE CONTROL. Admitting `external` must not be a blanket admission. A handler that moves a token
   * container cannot currently enter the plain SCB1 route: its transfer outputs require an effect frame owned
   * by graph mode. Both visibility spellings therefore stay direct-only, with the route naming the effect
   * refusal before considering the narrower external-clone visibility rule.
   */
  it('keeps token-container effects direct-only for both entry visibilities', () => {
    const tokenHandler = (visibility: string): string => `pragma solidcash >=0.8.0;
      contract X73TokenContainer() {
        bigint calls;
        function send(bytes32 category, bytes20 recipient, bigint amount) ${visibility} {
          require(this.tokens[category].tokenAmount >= amount);
          this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
          this.calls = this.calls + 1;
        }
      }`;
    for (const visibility of ['public', 'external']) {
      const refused = compileString(tokenHandler(visibility), BATCH);
      expect(refused.hiddenBatch).toBeUndefined();
      expect((refused.diagnostics ?? []).map((entry) => entry.message).join(' '))
        .toContain("'send': token-container-effect-route-not-enabled");
    }
  });

  /**
   * BLAST RADIUS, stated rather than discovered later. Admitting `external` does not only add handlers to
   * contracts that had none - it adds them to routes that already existed, and the route's uniformity rules
   * then apply to the larger set. Here the newly admitted collection-keyed external handler makes the route
   * collection-shaped, and the public scalar handler that used to be its only member is refused by the
   * pre-existing `mixed-scalar-and-collection-route-not-enabled` rule.
   *
   * The route still exists and is still fail-closed; what changed is WHICH handler it carries. A contract in
   * this shape gains a batchable `credit` and loses a batchable `bump`.
   */
  /**
   * X94's MIXED-SCALAR LIFT RETIRED THIS SUBJECT. It used to measure a newly admitted external collection
   * handler DISPLACING a public scalar one, because the route chose one shape for the whole set and the scalar
   * lost. X94 admits the mixed shape, so there is no displacement left to observe: both handlers are eligible.
   * Recorded as the parity it has become rather than deleted, because the pair is still worth pinning - a
   * regression that re-introduced the uniformity conflict would turn this red.
   */
  it('admits a scalar and a collection handler together, so neither displaces the other', () => {
    const mixed = `pragma solidcash >=0.8.0;
contract X73Mixed() {
  bigint total;
  mapping(address => bigint) balances;
  function bump(bigint n) public { this.total = this.total + n; require(n >= 0); }
  function credit(address who, bigint n) external {
    this.balances[who] = this.balances[who] + n;
    require(n >= 0);
  }
}`;
    expect(compileString(mixed, BATCH).hiddenBatch?.handlers).toEqual([
      expect.objectContaining({ name: 'bump', eligible: true }),
      expect.objectContaining({ name: 'credit', eligible: true }),
    ]);
  });

  /**
   * NEVER SHRINK. The route's uniformity rules choose ONE shape for the whole admitted set, so a newly eligible
   * handler can demote handlers that were already admitted. Admitting `external` must never cost a contract
   * handlers it already had, so where it would, the external handler is refused by name and the wider
   * public-only set is kept.
   *
   * X76 TOOK THIS GUARD'S ORIGINAL SUBJECT AWAY, AND THE REPAIR IS A NEW SUBJECT, NOT A RELAXED ASSERTION. The
   * shape it was built on was a real ERC-20 whose event-emitting, value-returning `approve` poisoned the route
   * for `balanceOf` too; X76 refuses `approve` on `result-route-requires-effect-free-handlers` in BOTH
   * spellings, so that source no longer shrinks and cannot exercise this guard. The test below measures that
   * collapse explicitly; this one moves to a shape that still shrinks, and the shrink is visible as a COUNT
   * rather than as the difference between a route and no route.
   *
   * TWO public scalar handlers plus one external collection handler. The public spelling makes the route
   * collection-shaped: `credit` is admitted and BOTH scalars are refused `mixed-scalar-and-collection`, so the
   * admitted set is one handler. Admitting the external spelling the same way would take the contract from the
   * two handlers its public-only route already carries down to one, so the guard refuses `credit` instead. The
   * boundary is sharp and the other side of it is already pinned above: with ONE public scalar the counts are
   * 1 against 1, no shrink, and `X73Mixed` shows the external collection handler displacing it.
   */
  it('X114: the never-shrink subject is retired by X94; both spellings now admit the same set', () => {
    const shrink = (visibility: string): string => `pragma solidcash >=0.8.0;
contract X73Shrink() {
  bigint total;
  bigint other;
  mapping(address => bigint) balances;
  function bump(bigint n) public { this.total = this.total + n; require(n >= 0); }
  function bump2(bigint n) public { this.other = this.other + n; require(n >= 0); }
  function credit(address who, bigint n) ${visibility} {
    this.balances[who] = this.balances[who] + n;
    require(n >= 0);
  }
}`;
    // THIS GUARD HAS NOW LOST ITS SUBJECT TWICE, and the second loss is X94's mixed-scalar lift. The shape
    // below depended on the public arm being collection-shaped and admitting exactly ONE handler, so that
    // admitting `external` had two handlers to take away. X94 admits the mixed shape, so the public arm now
    // admits all THREE and there is nothing to lose: both spellings admit 3 and the visibility keyword makes
    // no difference at all. Three further candidate shapes were probed for a replacement subject - two
    // distinct mappings, an expression key against an argument key, and an array-iterating external handler -
    // and NONE shrinks; in the last two the external handler is refused by its own gate in BOTH spellings,
    // which is the same collapse X76 caused here.
    //
    // The RULE is not dead: J4's re-measurement records `external-handler-would-shrink-the-route` firing on 3
    // corpus rows, up from 1. So this file needs a subject drawn from those rows rather than a synthetic one.
    // Filed as X114. Until then this records parity, which is what is actually true, instead of asserting a
    // refusal that no longer happens.
    const asPublic = compileString(shrink('public'), BATCH);
    const asExternal = compileString(shrink('external'), BATCH);
    const admitted = (artifact: ReturnType<typeof compileString>): number =>
      (artifact.hiddenBatch?.handlers ?? []).filter((handler) => handler.eligible).length;
    expect(admitted(asPublic)).toBe(3);
    expect(admitted(asExternal)).toBe(3);
    // The never-shrink property, stated as the inequality it really is. It holds vacuously on this subject
    // now, and that is exactly why X114 exists - do not read a green tick here as the guard being exercised.
    expect(admitted(asExternal)).toBeGreaterThanOrEqual(admitted(asPublic));
    // Parity is itself worth pinning: the two spellings must agree handler for handler, including reasons.
    expect(asExternal.hiddenBatch?.handlers).toEqual(asPublic.hiddenBatch?.handlers);
  });

  /**
   * THE SUBJECT THIS GUARD WAS BUILT ON NO LONGER SHRINKS, recorded rather than deleted.
   *
   * X73 measured this real ERC-20 going from a route carrying `balanceOf` to no route at all when `approve` was
   * admitted, because the combination is both result-shaped and event-shaped. X76 refuses the EFFECT rather
   * than the route: `approve` is turned away on `result-route-requires-effect-free-handlers` and `balanceOf` is
   * admitted - in BOTH spellings, identically. So the visibility keyword makes no difference on this source at
   * all, the public arm now HAS the route it used to lose, and `external-handler-would-shrink-the-route` cannot
   * fire here. A guard whose only subject has stopped reaching it would be passing for the wrong reason, which
   * is why the test above moved to a shape that still shrinks and this one pins the collapse.
   */
  it('records that the ERC-20 shape X73 measured is no longer a shrink subject in either spelling', () => {
    const erc20 = (visibility: string): string => `pragma solidcash >=0.8.0;
contract X73Approve() {
  event Approval(address owner, bigint amount);
  mapping(address => bigint) balances;
  mapping(address => bigint) allowances;
  function balanceOf(address who) public returns (bigint) { require(true); return this.balances[who]; }
  function approve(address spender, bigint amount) ${visibility} returns (bool) {
    this.allowances[spender] = amount;
    emit Approval(spender, amount);
    require(true);
    return true;
  }
}`;
    const expected = [
      expect.objectContaining({ name: 'balanceOf', eligible: true }),
      expect.objectContaining({
        name: 'approve', eligible: false, rejectionReason: 'result-route-requires-effect-free-handlers',
      }),
    ];
    const asExternal = compileString(erc20('external'), BATCH);
    const asPublic = compileString(erc20('public'), BATCH);
    expect(asExternal.hiddenBatch?.handlers).toEqual(expected);
    expect(asPublic.hiddenBatch?.handlers).toEqual(expected);
    // The two spellings are the same program here, so they are the same bytes: nothing is credited to X73.
    expect(asExternal.bytecode).toBe(asPublic.bytecode);
  });

  /**
   * UDVT parameters were one of the generated-wrapper gaps that originally forced the external-handler
   * admission fallback. The row-schema/type lowering now supports the shape for both visibility spellings, so
   * this regression records the closed gap rather than pinning the superseded fallback result.
   */
  it('admits UDVT parameters after generated-wrapper type support lands', () => {
    const udvt = (visibility: string): string => `pragma solidcash >=0.8.0;
type MyAddress is address;
contract X73Udvt() {
  bigint calls;
  function bump(bigint n) public { this.calls = this.calls + n; require(n >= 0); }
  function id(MyAddress a) ${visibility} returns (MyAddress) { require(true); return a; }
}`;
    for (const visibility of ['external', 'public']) {
      expect(compileString(udvt(visibility), BATCH).hiddenBatch?.handlers).toEqual([
        expect.objectContaining({ name: 'bump', eligible: true }),
        expect.objectContaining({ name: 'id', eligible: true }),
      ]);
    }
  });

  /**
   * NEGATIVE CONTROL. The refusal that remains is the one the route genuinely cannot lift: a name that is not
   * an entry point at all. Nothing here is credited to the visibility gate having been removed wholesale.
   */
  it('leaves a contract whose only functions are internal without a route', () => {
    const internalOnly = `pragma solidcash >=0.8.0;
contract X73InternalOnly() {
  int counter;
  function bump(int n) internal { this.counter = this.counter + n; }
  function entry(int n) external { this.bump(n); require(n >= 0); }
}`;
    const artifact = compileString(internalOnly, BATCH);
    expect(artifact.hiddenBatch?.handlers.map((handler) => handler.name)).toEqual(['entry']);
  });
});

/**
 * The message-bus route, not just the owner-local one. A participant is compiled with an authenticated graph
 * controller declared, which is the mode every capstone uses and the mode the F3 census probes.
 */
describe('X73 external entry points reach the authenticated graph route', () => {
  const graph = {
    ...BATCH,
    messageBusController: `aa20${'11'.repeat(32)}87`,
    messageBusControllerCategory: '22'.repeat(32),
  };

  it('admits an external handler as a bus participant', () => {
    const artifact = compileString(externalOnly, graph);
    expect(artifact.hiddenBatch?.handlers)
      .toEqual([expect.objectContaining({ name: 'add', eligible: true })]);
  });

  /**
   * A mapping-keyed external handler is the ERC-20 shape the census counted: `balanceOf`, `transfer` and
   * `approve` are all `external` in every real token, and all three address a collection entry.
   */
  it('admits an external collection-keyed handler and binds its route key witness', () => {
    const erc20ish = `pragma solidcash >=0.8.0;
contract X73Balances() {
  mapping(address => bigint) balances;
  function credit(address who, bigint amount) external {
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }
}`;
    const artifact = compileString(erc20ish, graph);
    expect(artifact.hiddenBatch?.handlers)
      .toEqual([expect.objectContaining({ name: 'credit', eligible: true })]);
    // The entry the route authenticates is named by the collection, exactly as the public spelling names it.
    expect(artifact.abi[0].entryAccesses)
      .toEqual([expect.objectContaining({ collection: 'balances', keyParams: ['who'] })]);
  });

  /**
   * The resource-shaped route - two key alternatives over one collection - is the ERC-20 `transfer` shape, and
   * `transfer` is `external` in every real token. It reaches the route through the resource clone the route
   * already builds, so the external spelling compiles to the SAME BYTES as the public one: the visibility
   * keyword costs a participant nothing here.
   */
  it('admits the external ERC-20 transfer shape at no byte cost over the public spelling', () => {
    const transfer = (visibility: string): string => `pragma solidcash >=0.8.0;
contract X73Token() {
  mapping(address => bigint) balances;
  function transfer(address from, address to, bigint amount) ${visibility} {
    require(this.balances[from] >= amount);
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
    require(amount >= 0);
  }
}`;
    const asPublic = compileString(transfer('public'), graph);
    const asExternal = compileString(transfer('external'), graph);
    expect(asExternal.hiddenBatch?.handlers)
      .toEqual([expect.objectContaining({ name: 'transfer', eligible: true })]);
    expect(asExternal.bytecode).toBe(asPublic.bytecode);
    // A state-changing handler, not a read-only one: this is a route that can move balances.
    expect(asExternal.abi.find((entry) => entry.name === 'transfer')?.writesState).toBe(true);
  });
});
