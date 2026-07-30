import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * X76 - two SCB1 route gates that refused handlers for a PROPERTY OF THE SET rather than of the handler.
 *
 * 1. `result-route-requires-effect-free-handlers` read `eventMode`, which is true when ANY candidate emits. One
 *    emitting sibling therefore refused every effect-free handler on the route, including returning getters
 *    that are admitted when compiled alone - and since the event block then refuses the rest, the whole route
 *    disappeared. The rule now demotes only the handler that CARRIES the effect.
 * 2. A BARE `m[k]` is an `ArrayAccess`/`ArrayAssign` until symbol resolution decides state-vs-local, and the
 *    batch clone's entry-key rewrite matched only the `this.`-prefixed `Mapping*` nodes. Any bare shape needing
 *    a clone (a second key alternative, a `msg.sender` key) was refused `collection-helper-route-not-enabled`,
 *    which is a SPELLING artifact: the identical contract written `this.m[k]` was admitted. The clone is now
 *    normalized to the same nodes resolution would have produced.
 *
 * Every case pairs the admitted shape with a control that differs in one field and is still refused.
 */

const batch = { forceStateful: true, experimentalHiddenBatch: true };
const graph = {
  ...batch,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const verdicts = (source: string, options: object = graph): Map<string, string> => {
  const artifact = compileString(source, options);
  if (artifact.hiddenBatch) {
    return new Map(artifact.hiddenBatch.handlers.map((handler) =>
      [handler.name, handler.eligible ? 'ELIGIBLE' : (handler.rejectionReason ?? 'unnamed')]));
  }
  const diagnostic = artifact.diagnostics
    ?.find((entry) => entry.code === 'hidden-batch-route-not-synthesized');
  const stated = /Rejected entry points - ([^.]*)\./.exec(diagnostic?.message ?? '');
  return new Map((stated?.[1] ?? '').split('; ').map((entry) => {
    const parsed = /^'([^']+)': (.*)$/.exec(entry.trim());
    return [parsed?.[1] ?? '?', parsed?.[2] ?? entry.trim()] as [string, string];
  }));
};

const hasRoute = (source: string, options: object = graph): boolean =>
  compileString(source, options).hiddenBatch !== undefined;

/* ------------------------------------------------------------------------------------------------ */
/* 1. The result-route gate demoted siblings that carry no effect                                     */
/* ------------------------------------------------------------------------------------------------ */

const RESULT_HEAD = `pragma solidcash >=0.8.0;
contract X76Result() {
  event Moved(int amount);
  mapping(address => bigint) shares;
`;
const getter = `  function peek(address who) public returns (bigint) {
    require(this.shares[who] >= 0);
    return this.shares[who];
  }
`;
const emitter = `  function bump(address who, bigint amount) public {
    this.shares[who] = this.shares[who] + amount;
    emit Moved(1);
    require(amount >= 0);
  }
`;

describe('X76 the result route refuses the effect, not the route', () => {
  it('keeps a returning getter admitted when an emitting sibling is added', () => {
    // The getter alone is the reference: it is admitted, so nothing about IT changes below.
    expect(verdicts(`${RESULT_HEAD}${getter}}`).get('peek')).toBe('ELIGIBLE');
    const together = verdicts(`${RESULT_HEAD}${getter}${emitter}}`);
    expect(together.get('peek')).toBe('ELIGIBLE');
    expect(together.get('bump')).toBe('result-route-requires-effect-free-handlers');
  });

  it('leaves a route standing where the pair used to erase it', () => {
    // The whole contract lost its route: the emitting sibling made the set event-shaped, the result gate then
    // demoted BOTH handlers, and the artifact reached the user with `hiddenBatch` absent. The route now exists,
    // which is what makes this a lost-route bug rather than one refused handler.
    expect(hasRoute(`${RESULT_HEAD}${getter}${emitter}}`)).toBe(true);
    // Each handler alone is admitted, so neither is refused for anything about ITSELF.
    expect(hasRoute(`${RESULT_HEAD}${getter}}`)).toBe(true);
    expect(hasRoute(`${RESULT_HEAD}${emitter}}`)).toBe(true);
    expect(verdicts(`${RESULT_HEAD}${emitter}}`).get('bump')).toBe('ELIGIBLE');
  });

  /**
   * NEGATIVE CONTROL, one field outside the new boundary. The rule that survives is the honest half: a handler
   * that BOTH returns a value and carries an effect is still refused, because the effect's block slot flattens
   * it into the wrapper and its returning edge then has no slot to bind.
   */
  it('CONTROL: a handler that returns AND emits is still refused by name', () => {
    const both = `${RESULT_HEAD}  function take(address who, bigint amount) public returns (bigint) {
    this.shares[who] = this.shares[who] - amount;
    emit Moved(1);
    return amount;
  }
}`;
    expect(verdicts(both).get('take')).toBe('result-route-requires-effect-free-handlers');
  });
});

/* ------------------------------------------------------------------------------------------------ */
/* 2. The bare spelling of a collection entry                                                         */
/* ------------------------------------------------------------------------------------------------ */

/** Two key alternatives over one collection: the shape that needs a cloned, entry-key-parameterised handler. */
const bareTwoAlternatives = `pragma solidcash >=0.8.0;
contract X76Bare() {
  mapping(address => bigint) balances;
  function move(address from, address to, bigint amount) public {
    balances[from] = balances[from] - amount;
    balances[to] = balances[to] + amount;
    require(amount >= 0);
  }
}`;
/** The SAME contract, `this.`-prefixed. Admitted before this change; the reference for what bare must become. */
const dottedTwoAlternatives = bareTwoAlternatives.replace(/(?<!this\.)balances\[/g, 'this.balances[');

describe('X76 the bare spelling of a collection entry reaches the route', () => {
  it('admits a two-alternative bare handler, which used to have no route at all', () => {
    expect(verdicts(bareTwoAlternatives).get('move')).toBe('ELIGIBLE');
    expect(verdicts(dottedTwoAlternatives).get('move')).toBe('ELIGIBLE');
  });

  /**
   * The claim is that spelling is not a semantic difference, so the two must produce the SAME SCRIPT. A route
   * that merely exists for the bare form could still be a different, weaker covenant; identical bytecode is
   * what rules that out.
   */
  it('emits byte-identical bytecode for the bare and the this.-prefixed spelling', () => {
    const bare = compileString(bareTwoAlternatives, graph);
    const dotted = compileString(dottedTwoAlternatives, graph);
    expect(bare.bytecode).toBe(dotted.bytecode);
    expect(bare.hiddenBatch?.handlers.find((handler) => handler.name === 'move')?.batchKeyWitnesses)
      .toEqual(dotted.hiddenBatch?.handlers.find((handler) => handler.name === 'move')?.batchKeyWitnesses);
  });

  it('admits a bare msg.sender-keyed handler on the authenticated graph route', () => {
    const source = `pragma solidcash >=0.8.0;
contract X76BareSender() {
  mapping(address => bigint) balances;
  function send(address to, bigint amount) public {
    balances[msg.sender] = balances[msg.sender] - amount;
    balances[to] = balances[to] + amount;
    require(amount >= 0);
  }
}`;
    expect(verdicts(source).get('send')).toBe('ELIGIBLE');
  });

  /**
   * THE CORPUS SHAPE, which is what makes this row worth doing: `EventSubscription.subscribe()` from
   * solidity-by-example (`events-advanced/EventsAdvanced.sol`) writes `subscribers[msg.sender] = true` bare and
   * pushes to a dynamic state array. It was the ONE state-changing handler this change newly admits across the
   * three application corpora, and it was refused `collection-helper-route-not-enabled`.
   *
   * The `this.`-prefixed respelling was ALREADY admitted before the change, and the two now publish the same
   * byte count. So the route the bare form reaches is not a new covenant - it is the one the dotted form always
   * reached, which is the whole soundness claim for this relaxation.
   */
  it('admits the corpus EventSubscription.subscribe shape, with the dotted route\'s exact size', () => {
    const port = (dotted: boolean): string => {
      const at = (access: string): string => (dotted ? `this.${access}` : access);
      return `pragma solidcash >=0.8.0;
contract X76Subscription() {
  mapping(address => bool) subscribers;
  address[] subscriberList;
  function subscribe() public {
    require(!${at('subscribers[msg.sender]')});
    ${at('subscribers[msg.sender]')} = true;
    this.subscriberList.push(msg.sender);
  }
}`;
    };
    expect(verdicts(port(false)).get('subscribe')).toBe('ELIGIBLE');
    expect(verdicts(port(true)).get('subscribe')).toBe('ELIGIBLE');
    expect(compileString(port(false), graph).bytecode.length)
      .toBe(compileString(port(true), graph).bytecode.length);
    // And it is a WRITE, not a getter: the read-only surface is not what moved.
    expect(compileString(port(false), graph).abi.find((entry) => entry.name === 'subscribe')?.writesState)
      .toBe(true);
  });

  /**
   * NEGATIVE CONTROL 1. A bare element of a name the function BINDS ITSELF is a LOCAL array, not a collection
   * entry. Normalizing one would retarget a local element write at a state entry NFT, so the handler must
   * publish witnesses for the two `balances` entries and NOTHING for `scratch` - in particular no witness bound
   * to a parameter index that only the local's arithmetic reads.
   */
  it('CONTROL: a local array element is not turned into an entry key', () => {
    const withLocal = `pragma solidcash >=0.8.0;
contract X76Local() {
  mapping(address => bigint) balances;
  function move(address from, address to, bigint amount) public {
    bigint[2] scratch = [amount, amount];
    scratch[0] = scratch[1] + amount;
    balances[from] = balances[from] - scratch[0];
    balances[to] = balances[to] + scratch[0];
    require(amount >= 0);
  }
}`;
    const artifact = compileString(withLocal, graph);
    const witnesses = artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'move')
      ?.batchKeyWitnesses ?? [];
    expect(witnesses.length).toBeGreaterThan(0);
    expect(witnesses.every((witness) => /^__scb_key_balances_0(_row)?$/.test(witness.routeInput))).toBe(true);
    // `from` and `to` are inputs 0 and 1; `amount` is input 2 and keys nothing.
    expect(witnesses.map((witness) => witness.inputIndex).sort()).toEqual([0, 1]);
  });

  /**
   * NEGATIVE CONTROL 2. A bare element of a state ARRAY is not an entry the route can size: its key here is a
   * literal, not a parameter. The shape stays outside the boundary - and the refusal is now the accurate one
   * (`...requires-one-parameter-keyed-entry-per-collection`) rather than the helper reason, because the entry
   * is visible in the handler's own body and it is the KEY that disqualifies it.
   */
  it('CONTROL: a bare literal-keyed state-array element is still refused', () => {
    const packed = `pragma solidcash >=0.8.0;
contract X76Packed() {
  bigint[4] slots;
  mapping(address => bigint) balances;
  function poke(address who, bigint amount) public {
    slots[1] = slots[1] + amount;
    balances[who] = balances[who] + amount;
    require(amount >= 0);
  }
}`;
    expect(hasRoute(packed)).toBe(false);
    expect(verdicts(packed).get('poke'))
      .toBe('collection-route-requires-one-parameter-keyed-entry-per-collection');
  });

  /**
   * NEGATIVE CONTROL 3. The gate's other half is untouched: an entry reached through a HELPER is still refused,
   * because the route only sizes entries it can see in the handler's own body.
   */
  it('CONTROL: an entry reached through a helper is still refused', () => {
    const helper = `pragma solidcash >=0.8.0;
contract X76Helper() {
  mapping(address => bigint) balances;
  function credit(address who, bigint amount) internal {
    this.balances[who] = this.balances[who] + amount;
  }
  function move(address from, address to, bigint amount) public {
    balances[from] = balances[from] - amount;
    credit(to, amount);
    require(amount >= 0);
  }
}`;
    expect(verdicts(helper).get('move')).toBe('collection-helper-route-not-enabled');
  });

  /**
   * The paths this change does NOT touch must be untouched. A single-key all-parameter bare handler was already
   * admitted (X19's self-reached set, which makes no clone and so normalizes nothing), and a scalar-only route
   * never reaches either gate. Both keep their exact script.
   */
  it('CONTROL: the self-reached bare shape and a scalar route keep their exact bytecode', () => {
    const selfReached = `pragma solidcash >=0.8.0;
contract X76Self() {
  mapping(address => bigint) balances;
  function credit(address who, bigint amount) public {
    balances[who] = balances[who] + amount;
    require(amount >= 0);
  }
}`;
    const scalar = `pragma solidcash >=0.8.0;
contract X76Scalar() {
  int count;
  function add(int n) public { this.count = this.count + n; require(n >= 0); }
}`;
    // Pinned lengths, measured at 77cd1e8c with the same options. A change to either is a regression on a path
    // this row claims not to touch, not a re-pin.
    expect(compileString(selfReached, graph).bytecode.length).toBe(3185);
    expect(compileString(scalar, graph).bytecode.length).toBe(2957);
    expect(verdicts(selfReached).get('credit')).toBe('ELIGIBLE');
    expect(verdicts(scalar).get('add')).toBe('ELIGIBLE');
  });
});
