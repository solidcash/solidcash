import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { encodeHiddenBatch } from '../../src/layer3/hidden-batch.js';
import { alicePkh, bobPkh, carolPkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X76 - the SCB1 route refused a state-changing handler for how it was SPELLED.
 *
 * A bare `m[k]` is an `ArrayAccess`/`ArrayAssign` until symbol resolution decides state-vs-local; only the
 * `this.`-prefixed spelling arrives at route synthesis as a `Mapping*` node. The batch clone's entry-key rewrite
 * matched only the latter, so every bare shape that needs a clone - a second key alternative over one
 * collection, a `msg.sender` key - was turned away. That is exactly ERC-20 `transfer`/`transferFrom`, and the
 * real solidity-by-example ERC-20 writes it bare.
 *
 * The contract below is the mapping-backed ERC-20 the corpus test `RepeatedExternalBatchCorpus` already settles,
 * written the bare way. Two claims, and the second is what makes the first mean anything:
 *
 *   1. the bare spelling now settles a two-row `transferFrom` batch on the VM, and
 *   2. it compiles to the SAME SCRIPT as the `this.`-prefixed spelling, so this admits no new covenant - the
 *      route the bare form now reaches is the one the dotted form always reached.
 */

const BATCH = { forceStateful: true, hiddenBatch: true };

const INTERFACE = `interface IMappingTokenX76 {
  function transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount);
}`;

/** `dotted: false` is the shape under test; `true` is the honest reference the corpus already settles. */
const token = (dotted: boolean): string => {
  const at = (access: string): string => (dotted ? `this.${access}` : access);
  return `pragma solidcash >=0.8.0;
${INTERFACE}
contract X76BareToken() is IMappingTokenX76 {
  mapping(bytes20 => bigint) balances;
  mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

  function mint(bytes20 to, bigint amount) public {
    ${at('balances[to]')} = ${at('balances[to]')} + amount;
    require(amount >= 0);
  }
  function approve(bytes20 owner, bytes20 spender, bigint amount) public {
    this.allowances[owner][spender] = amount;
    require(amount >= 0);
  }
  function transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount) public {
    require(this.allowances[from][spender] >= amount);
    require(${at('balances[from]')} >= amount);
    this.allowances[from][spender] = this.allowances[from][spender] - amount;
    ${at('balances[from]')} = ${at('balances[from]')} - amount;
    ${at('balances[to]')} = ${at('balances[to]')} + amount;
  }
  function checkBalance(bytes20 owner, bigint expected) public {
    require(${at('balances[owner]')} == expected);
  }
}`;
};

const BARE = token(false);
const DOTTED = token(true);

async function deploy(source: string): Promise<StatefulContract> {
  const provider = createTestProvider();
  const artifact = compileString(source, BATCH);
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, inner, artifact.stateLayout!, {}, { saltContract: true },
  );
  return StatefulContract.withCategory(inner, categoryId);
}

/**
 * The input whose covenant rejects, so a hostile case names one exact script rather than "the transaction".
 * Returns null when the transaction verifies, which is what the honest control asserts.
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

describe('X76 the bare spelling of an ERC-20 entry write reaches the SCB1 route', () => {
  it('admits transferFrom written bare, and compiles it to the dotted spelling\'s exact script', () => {
    const bare = compileString(BARE, BATCH);
    const dotted = compileString(DOTTED, BATCH);
    expect(bare.hiddenBatch?.handlers.find((handler) => handler.name === 'transferFrom'))
      .toMatchObject({ eligible: true });
    // Not "a route appeared": the SAME route. A weaker covenant for the bare form would differ here.
    expect(bare.bytecode).toBe(dotted.bytecode);
    expect(bare.hiddenBatch?.handlers.find((handler) => handler.name === 'transferFrom')?.batchKeyWitnesses)
      .toEqual([
        { routeInput: '__scb_key_allowances_0', inputIndex: 0 },
        { routeInput: '__scb_key_allowances_1', inputIndex: 2 },
        { routeInput: '__scb_key_balances_0', inputIndex: 0 },
        { routeInput: '__scb_key_balances_0_row', inputIndex: 1, perRow: true },
      ]);
  });

  it('settles a two-row bare transferFrom batch on the VM', async () => {
    const contract = await deploy(BARE);
    await contract.getFunction('mint')(alicePkh, 100n).send();
    await contract.getFunction('mint')(bobPkh, 0n).send();
    await contract.getFunction('mint')(carolPkh, 0n).send();
    await contract.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    await contract.batch([
      { function: 'transferFrom', args: [alicePkh, bobPkh, carolPkh, 10n] },
      { function: 'transferFrom', args: [alicePkh, carolPkh, carolPkh, 20n] },
    ]).send();
    // Read the settled entries back through the contract's own covenant, not through the provider's view.
    await contract.getFunction('checkBalance')(alicePkh, 70n).send();
    await contract.getFunction('checkBalance')(bobPkh, 10n).send();
    await contract.getFunction('checkBalance')(carolPkh, 20n).send();
  }, 180_000);

  /**
   * GUARD. A route can "settle" by dispatching to nothing and flushing an unchanged state, and a two-row batch
   * can settle by applying one row twice. So: the bare spelling must reach the same three balances the DOTTED
   * spelling reaches from the same rows, and a batch whose second row differs must land on a different state.
   */
  it('credits each row to the handler body, and matches the dotted spelling row for row', async () => {
    const reference = await deploy(DOTTED);
    await reference.getFunction('mint')(alicePkh, 100n).send();
    await reference.getFunction('mint')(bobPkh, 0n).send();
    await reference.getFunction('mint')(carolPkh, 0n).send();
    await reference.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    await reference.batch([
      { function: 'transferFrom', args: [alicePkh, bobPkh, carolPkh, 10n] },
      { function: 'transferFrom', args: [alicePkh, carolPkh, carolPkh, 20n] },
    ]).send();
    await reference.getFunction('checkBalance')(alicePkh, 70n).send();
    await reference.getFunction('checkBalance')(bobPkh, 10n).send();
    await reference.getFunction('checkBalance')(carolPkh, 20n).send();

    // The same rows against the bare spelling, but the second row moves 5 instead of 20: every balance moves,
    // so no row was dropped, deduplicated or double-applied.
    const varied = await deploy(BARE);
    await varied.getFunction('mint')(alicePkh, 100n).send();
    await varied.getFunction('mint')(bobPkh, 0n).send();
    await varied.getFunction('mint')(carolPkh, 0n).send();
    await varied.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    await varied.batch([
      { function: 'transferFrom', args: [alicePkh, bobPkh, carolPkh, 10n] },
      { function: 'transferFrom', args: [alicePkh, carolPkh, carolPkh, 5n] },
    ]).send();
    await varied.getFunction('checkBalance')(alicePkh, 85n).send();
    await varied.getFunction('checkBalance')(bobPkh, 10n).send();
    await varied.getFunction('checkBalance')(carolPkh, 5n).send();
  }, 240_000);

  /**
   * HOSTILE, and it targets exactly what normalization changed. The clone's keys are rewritten to synthetic
   * parameters fed by the route's canonical witnesses, and the wrapper requires each declared row argument to
   * EQUAL its witness. Substituting the recipient inside the blob while leaving the honest witnesses in place is
   * the forgery that check exists to catch: without it the bare clone would credit an entry the route never
   * authenticated. It must be refused by the CONTRACT's own input.
   */
  it('refuses a recipient substituted inside the blob, at the contract input', async () => {
    const artifact = compileString(BARE, BATCH);
    const rows = [
      { function: 'transferFrom', args: [alicePkh, bobPkh, carolPkh, 10n] },
      { function: 'transferFrom', args: [alicePkh, carolPkh, carolPkh, 20n] },
    ];

    const honest = await deploy(BARE);
    await honest.getFunction('mint')(alicePkh, 100n).send();
    await honest.getFunction('mint')(bobPkh, 0n).send();
    await honest.getFunction('mint')(carolPkh, 0n).send();
    await honest.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    const clean = encodeHiddenBatch(artifact, rows);
    expect(await failingInput(() => honest._batchRaw(clean.blob, clean.routeWitnesses).send())).toBe(null);
    await honest.getFunction('checkBalance')(bobPkh, 10n).send();

    const attacked = await deploy(BARE);
    await attacked.getFunction('mint')(alicePkh, 100n).send();
    await attacked.getFunction('mint')(bobPkh, 0n).send();
    await attacked.getFunction('mint')(carolPkh, 0n).send();
    await attacked.getFunction('approve')(alicePkh, carolPkh, 50n).send();
    const forged = encodeHiddenBatch(artifact, rows);
    const blob = Uint8Array.from(forged.blob);
    // Row 0's `to` argument is bob's 20 bytes; rewrite them to carol IN THE BLOB only. The route witnesses
    // still say bob, which is the disagreement the covenant must reject.
    const at = indexOfBytes(blob, bobPkh);
    expect(at).toBeGreaterThan(0);
    blob.set(carolPkh, at);
    const rejected = await failingInput(() => attacked._batchRaw(blob, forged.routeWitnesses).send());
    expect(rejected).toBe(0); // the contract master input, the only script that decodes the blob
    // and nothing moved
    await attacked.getFunction('checkBalance')(alicePkh, 100n).send();
    await attacked.getFunction('checkBalance')(carolPkh, 0n).send();
  }, 240_000);
});

/* ------------------------------------------------------------------------------------------------ */
/* The other gate: the result route refused the whole route because ONE sibling emitted                */
/* ------------------------------------------------------------------------------------------------ */

const RESULT_ROUTE = `pragma solidcash >=0.8.0;
contract X76ResultRoute() {
  event Moved(int amount);
  mapping(bytes20 => bigint) shares;
  function peek(bytes20 who) public returns (bigint) {
    require(this.shares[who] >= 0);
    return this.shares[who];
  }
  function bump(bytes20 who, bigint amount) public {
    this.shares[who] = this.shares[who] + amount;
    emit Moved(1);
    require(amount >= 0);
  }
}`;

describe('X76 the result route survives an emitting sibling', () => {
  it('settles a two-row batch on a route that did not exist before, and still refuses the emitter', async () => {
    const artifact = compileString(RESULT_ROUTE, BATCH);
    expect(artifact.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['peek', true], ['bump', false]]);

    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.getFunction('bump')(alicePkh, 7n).send();
    await contract.getFunction('bump')(bobPkh, 9n).send();
    // Both rows address the one physical entry the route sizes for `shares` - a non-per-row witness means the
    // rows must agree on the key, which is a property of the route shape and not of this change.
    const honest = encodeHiddenBatch(artifact, [
      { function: 'peek', args: [alicePkh] },
      { function: 'peek', args: [alicePkh] },
    ]);
    expect(await failingInput(() => contract._batchRaw(honest.blob, honest.routeWitnesses).send())).toBe(null);

    /**
     * GUARD, and it is the half of the rule that must NOT have moved. `bump` carries an effect on a
     * result-shaped route and is still refused, so its selector must not dispatch. Substituting it into the blob
     * where the honest one verified has to be rejected by the CONTRACT's input, not by an SDK check.
     */
    const emitter = artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'bump')!;
    expect(emitter.rejectionReason).toBe('result-route-requires-effect-free-handlers');
    const forged = encodeHiddenBatch(artifact, [
      { function: 'peek', args: [alicePkh] },
      { function: 'peek', args: [alicePkh] },
    ]);
    const blob = Uint8Array.from(forged.blob);
    const getterSelector = hexToBin(
      artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'peek')!.selector,
    );
    const at = indexOfBytes(blob, getterSelector);
    expect(at).toBeGreaterThan(0);
    blob.set(hexToBin(emitter.selector), at);
    expect(await failingInput(() => contract._batchRaw(blob, forged.routeWitnesses).send())).toBe(0);
  }, 240_000);
});

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}
