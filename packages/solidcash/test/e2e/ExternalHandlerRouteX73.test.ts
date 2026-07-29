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

const BATCH = { forceStateful: true, experimentalHiddenBatch: true };

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
   * container is invoked as ITSELF, because the token covenant binds the consumed container to that function's
   * own parameter; a synthetic clone would authenticate a second, context-free container. The route refuses
   * that one shape by name rather than routing it through a clone, and the same source with `public` is
   * admitted - so the refusal is a property of the spelling the route cannot serve, not of the handler.
   */
  it('still refuses the one external shape a clone cannot serve, and admits its public twin', () => {
    const tokenHandler = (visibility: string): string => `pragma solidcash >=0.8.0;
      contract X73TokenContainer() {
        bigint calls;
        function send(bytes32 category, bytes20 recipient, bigint amount) ${visibility} {
          require(this.tokens[category].tokenAmount >= amount);
          this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
          this.calls = this.calls + 1;
        }
      }`;
    expect(compileString(tokenHandler('public'), BATCH).hiddenBatch?.handlers)
      .toEqual([expect.objectContaining({ name: 'send', eligible: true })]);

    const refused = compileString(tokenHandler('external'), BATCH);
    expect(refused.hiddenBatch).toBeUndefined();
    expect((refused.diagnostics ?? []).map((entry) => entry.message).join(' '))
      .toContain("'send': external-token-container-handler-requires-public-visibility");
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
  it('lets a newly admitted external collection handler displace a public scalar one', () => {
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
      expect.objectContaining({
        name: 'bump', eligible: false, rejectionReason: 'mixed-scalar-and-collection-route-not-enabled',
      }),
      expect.objectContaining({ name: 'credit', eligible: true }),
    ]);
  });

  /**
   * NEVER SHRINK. The route's uniformity rules choose ONE shape for the whole admitted set, so a newly
   * eligible handler can demote handlers that were already admitted. Measured on a real ERC-20: admitting the
   * event-emitting, value-returning `approve` makes the route both result-shaped and event-shaped, and that
   * combination refuses EVERY handler - so the contract went from a route carrying `balanceOf` to no route at
   * all. Admitting `external` must never cost a contract handlers it already had, so the public-only route is
   * kept and the external handler is refused by name.
   *
   * The control below is the same source with `approve` declared `public`. There the poisoning is not X73's to
   * avoid - both handlers are public candidates, there is no narrower set, and the route is lost at HEAD
   * exactly as it was before. That is what makes the preserved case a property of this guard rather than of
   * some change to the uniformity rules themselves, which are untouched.
   */
  it('keeps the public-only route when an external handler would cost the contract its handlers', () => {
    const erc20 = (visibility: string): string => `pragma solidcash >=0.8.0;
contract X73Shrink() {
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
    expect(compileString(erc20('external'), BATCH).hiddenBatch?.handlers).toEqual([
      expect.objectContaining({ name: 'balanceOf', eligible: true }),
      expect.objectContaining({
        name: 'approve', eligible: false, rejectionReason: 'external-handler-would-shrink-the-route',
      }),
    ]);

    // CONTROL: the same handler as `public`. Nothing about the uniformity rules changed, so this contract has
    // no route - which is exactly what it had before X73, and what the external spelling would have inherited.
    const asPublic = compileString(erc20('public'), BATCH);
    expect(asPublic.hiddenBatch).toBeUndefined();
    expect((asPublic.diagnostics ?? []).map((entry) => entry.message).join(' '))
      .toContain("'balanceOf': result-route-requires-effect-free-handlers");
  });

  /**
   * NEVER FAIL. Whether the route's refusals admit a handler is decided at synthesis time, but whether the
   * generated wrapper COMPILES is not known until semantic analysis has run over it. The corpus turned up
   * fourteen files where the newly admitted external handler reaches a route-generation gap its refusal used
   * to hide - a parameter type the row schema cannot render, external-call edges the graph route rejects, a
   * storage-slot writer whose clone has no block layout - and the whole file stopped compiling as a
   * participant, taking eighteen contracts with it.
   *
   * A contract that used to compile and now does not is strictly worse, so the compile falls back once to the
   * public-only route and names the refusal. The control is the same source with the handler spelled `public`:
   * it does not compile at HEAD either, which is what shows the gap is the route generator's and not X73's,
   * and that the fallback masks nothing - it only declines to make the route try.
   */
  it('falls back to the public-only route when the generated wrapper cannot be compiled', () => {
    const udvt = (visibility: string): string => `pragma solidcash >=0.8.0;
type MyAddress is address;
contract X73Udvt() {
  bigint calls;
  function bump(bigint n) public { this.calls = this.calls + n; require(n >= 0); }
  function id(MyAddress a) ${visibility} returns (MyAddress) { require(true); return a; }
}`;
    expect(compileString(udvt('external'), BATCH).hiddenBatch?.handlers).toEqual([
      expect.objectContaining({ name: 'bump', eligible: true }),
      expect.objectContaining({
        name: 'id', eligible: false, rejectionReason: 'external-handler-route-generation-unsupported',
      }),
    ]);

    // CONTROL: the same handler as `public` reaches the same gap and still fails. The fallback is not a
    // catch-all - it re-raises the original error whenever the narrower route fails too.
    expect(() => compileString(udvt('public'), BATCH))
      .toThrow(/Found parameters .* in call to function 'id'/);
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
    experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
    experimentalMessageBusControllerCategory: '22'.repeat(32),
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
