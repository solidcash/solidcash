import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * X15 - a requested hidden-batch route that is not synthesized must say so.
 *
 * Route synthesis records one stable rejection reason per entry point, but the only channel that published
 * those reasons was `hiddenBatch.handlers`, which is not built when no entry point survives. A contract whose
 * every handler was rejected therefore reached the user as an artifact with `hiddenBatch` absent and NO
 * diagnostic string at all - silence, not a refusal. Worker C hit this building L1 and routed around it.
 *
 * Each case below pairs the silent shape with an honest control that differs in exactly one field.
 */

const DIAGNOSTIC_CODE = 'hidden-batch-route-not-synthesized';

const batchOnly = { forceStateful: true, experimentalHiddenBatch: true };
const graph = {
  ...batchOnly,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const caller = (body: string): string => `pragma solidcash >=0.8.0;
interface ISink { function ping(int amount) external; }
contract X15Caller(address sink) {
  mapping(address => bigint) balances;
  bigint total;
${body}
}`;

/** Persisted state written IN the called function, plus an external call - the shape X15 names. */
const stateWriteAndCall = caller(`  function push(address who, int amount) public {
    this.balances[who] = this.balances[who] + amount;
    ISink(sink).ping(amount);
    require(true);
  }`);

const absenceDiagnostics = (code: string, options: object): { severity: string; code: string; message: string }[] =>
  (compileString(code, options).diagnostics ?? []).filter((entry) => entry.code === DIAGNOSTIC_CODE);

describe('X15 hidden-batch route absence is stated, not silent', () => {
  it('names the reason for a handler that writes state and makes an external call', () => {
    const artifact = compileString(stateWriteAndCall, batchOnly);
    expect(artifact.hiddenBatch).toBeUndefined();
    const stated = absenceDiagnostics(stateWriteAndCall, batchOnly);
    expect(stated).toHaveLength(1);
    expect(stated[0].severity).toBe('error');
    expect(stated[0].message).toContain("'push': batched-handler-forward-call-not-enabled");
    expect(stated[0].message).toContain('it has no SCB1 entry point and cannot participate in a message bus');
  });

  it('tells the user what to do instead of the refused shape', () => {
    expect(absenceDiagnostics(stateWriteAndCall, batchOnly)[0].message)
      .toContain('supply experimentalMessageBusController with its experimentalMessageBusControllerCategory');
  });

  /**
   * The control differs from the case above in exactly one field - the graph controller option - and the SAME
   * source is admitted. That is what makes the refusal a property of the requested route rather than of the
   * handler shape.
   */
  it('CONTROL: the identical source with a graph controller is admitted and carries no diagnostic', () => {
    const artifact = compileString(stateWriteAndCall, graph);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'push')?.eligible).toBe(true);
    expect(absenceDiagnostics(stateWriteAndCall, graph)).toHaveLength(0);
  });

  // X201 ADMITTED THIS SHAPE. A body whose LAST statement is a forwarding call now reaches the runtime
  // emission form, where the edge is framed at the call site; `graphRuntimeHandlers` membership is a
  // precondition of that widening, so admission implies the emission is bound rather than merely allowed.
  // SCOPE: the VM proof of the binding is on a SINGLE-statement body
  // (`Layer3BareForwardingBodyX201.test.ts`). This subject has a state write before the call and is admitted
  // by the same precondition, not separately VM-proved.
  it('admits a forwarding handler whose last statement is the call', () => {
    const source = caller(`  function push(int amount) public {
    total = total + amount;
    ISink(sink).ping(amount);
  }`);
    const handlers = compileString(source, graph).hiddenBatch!.handlers as any[];
    const push = handlers.find((handler) => handler.name === 'push');
    expect(push.eligible).toBe(true);
    expect(push.rejectionReason).toBeUndefined();
  });

  it('names the reason for a forwarding handler that returns a value', () => {
    const source = caller(`  function push(int amount) public returns (int) {
    total = total + amount;
    ISink(sink).ping(amount);
    return total;
  }`);
    expect(compileString(source, graph).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain("'push': batched-handler-forward-call-not-enabled");
  });

  it('states the absence for a contract with no entry point at all', () => {
    const source = `pragma solidcash >=0.8.0;
contract X15NoEntry() {
  bigint total;
  constructor() { total = 1; }
}`;
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain('The contract declares no entry point for a route to admit');
  });

  it('stays quiet when a route exists', () => {
    const source = caller('  function bump(int amount) public { total = total + amount; require(amount >= 0); }');
    expect(compileString(source, graph).hiddenBatch).toBeDefined();
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  it('uses the default-on route request and publishes its refusal diagnostic', () => {
    const options = { forceStateful: true };
    expect(compileString(stateWriteAndCall, options).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(stateWriteAndCall, options)).toEqual(absenceDiagnostics(stateWriteAndCall, batchOnly));
  });

  it('stays quiet when hidden-batch synthesis is explicitly disabled', () => {
    const options = { forceStateful: true, experimentalHiddenBatch: false };
    expect(compileString(stateWriteAndCall, options).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(stateWriteAndCall, options)).toHaveLength(0);
  });

  /**
   * A partially rejected route already published its reasons through `hiddenBatch.handlers`; the new
   * diagnostic must not duplicate them, or every mixed contract would carry a false "no route" claim.
   *
   * The rejected handler here is the scalar one on a collection-keyed route. It used to be an `external`
   * handler, which X73 admits: `external` and `public` differ only in internal callability, and an admitted
   * external handler is dispatched through an internal clone. This case is about the diagnostic channel, not
   * about which handlers a route admits, so it is stated with a refusal that outlives that change.
   */
  // RESTATED ON A REFUSAL THAT OUTLIVES X94. This case's subject is the absence CHANNEL - that it stays silent
  // when a route exists and only some handlers are refused. It used to reach that state via
  // `mixed-scalar-and-collection-route-not-enabled`, which was merely a convenient way to produce a refused
  // handler, and X94 lifted that gate: a scalar handler beside a collection one is now eligible, because the
  // entry read and its write-back are hoisted outside the row dispatch, so a row addressing no entry flushes
  // the reserved entry UNCHANGED.
  //
  // The replacement is a handler that BOTH returns a value and carries an effect, refused
  // `result-route-requires-effect-free-handlers`. That one survives because the row which relaxed the
  // result gate relaxed only its SET-WIDE half - a handler that itself carries an effect is still demoted -
  // so it is a refusal grounded in the handler's own shape rather than in its siblings'.
  //
  // Two shapes were tried and rejected as subjects first, which is why this comment names one: a persisted
  // write plus an external call is now ADMITTED (X94 took it too), and a plain returning handler is admitted
  // as well. The same substitution was made once before in this file when X73 lifted the `external` refusal it
  // had been borrowing - this file has now had its borrowed subject lifted out from under it twice.
  it('does not fire when only some handlers are rejected', () => {
    const source = `pragma solidcash >=0.8.0;
interface ISink { function ping(int amount) external; }
contract X15Caller(address sink) {
  mapping(address => bigint) balances;
  bigint total;
  event Bumped(int amount);
  function bump(int amount) public { total = total + amount; require(amount >= 0); }
  function tally(int amount) public returns (int) {
    total = total + amount;
    emit Bumped(amount);
    require(amount >= 0);
    return total;
  }
}`;
    const artifact = compileString(source, graph);
    const handlers = artifact.hiddenBatch?.handlers ?? [];
    // The route exists, one handler is admitted, and at least one is refused BY NAME - without which this case
    // would assert an empty diagnostic list over a state it never reached.
    expect(artifact.hiddenBatch).toBeDefined();
    expect(handlers.find((handler) => handler.name === 'bump')).toMatchObject({ eligible: true });
    const refused = handlers.filter((handler) => handler.eligible === false);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((handler) => typeof handler.rejectionReason === 'string')).toBe(true);
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  /** X73's admission, stated where the old refusal was: an external handler is a route handler. */
  it('admits an external handler alongside a public one', () => {
    const source = caller(`  function bump(int amount) public { total = total + amount; require(amount >= 0); }
  function nudge(int amount) external { total = total - amount; require(amount >= 0); }`);
    expect(compileString(source, graph).hiddenBatch?.handlers)
      .toEqual([
        expect.objectContaining({ name: 'bump', eligible: true }),
        expect.objectContaining({ name: 'nudge', eligible: true }),
      ]);
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });
});

/**
 * X22 - the same family as X15, on a shape X15's fix did not reach.
 *
 * A handler that CONSUMES a call result and also carries a physical effect of its own reached code generation
 * and aborted there with the internal `Unbound return call in __scb1; graph=undefined`: no named refusal, no
 * `hiddenBatch.handlers` row and no diagnostic-channel entry. The cause is upstream of code generation - the
 * effect reserves a slot in the ROUTE's block layout, so InlineStoragePointerCalls flattens the graph clone
 * into `__scb1` instead of keeping it behind OP_INVOKE, and the returning edge inside the flattened body then
 * has no physical return slot to bind. Route synthesis now refuses the shape by name.
 *
 * Every case below is paired with a control that differs in exactly ONE field - the effect, or whether the
 * result is consumed - and the control is admitted. That is what makes the refusal a property of the
 * combination rather than of either half.
 */
describe('X22 result-consuming handlers carry authenticated effects', () => {
  const vault = (body: string): string => `pragma solidcash >=0.8.0;
interface IX22Vault { function deposit(bigint amount) returns (bigint); }
interface IX22Sink { function ping(bigint amount); }
contract X22Accrue(address vault, address sink, bytes25 payee) {
  bigint collateral;
  event Accrued(bigint shares);
${body}
}`;

  const resultAndEmit = vault(`  function accrue(bigint amount) public {
    bigint shares = IX22Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    emit Accrued(shares);
    require(shares >= 0);
  }`);

  it('does not throw the internal code-generation sentinel', () => {
    // MEASURED: the second assertion here was `not.toThrow(/Unbound return call/)`, which could not fail on
    // two counts - the bare `not.toThrow()` above already admits no throw at all, and that sentinel string
    // survives only in COMMENTS (Errors.ts:1327, compiler.ts:1041), so no throw site can emit it. The subject
    // is gone; it would return only if the sentinel were reintroduced as a throw. What is live is that the
    // compile SUCCEEDS and produces the artifact, so assert that instead of a string that cannot appear.
    expect(() => compileString(resultAndEmit, graph)).not.toThrow();
    expect(compileString(resultAndEmit, graph).contractName).toBe('X22Accrue');
  });

  it('admits the result-consuming event handler', () => {
    const artifact = compileString(resultAndEmit, graph);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
    expect(absenceDiagnostics(resultAndEmit, graph)).toHaveLength(0);
  });

  it('publishes the effect frame on the admitted route', () => {
    expect(compileString(resultAndEmit, graph).hiddenBatch?.route.blockLayout?.slots
      .some((slot) => slot.kind === 'event')).toBe(true);
  });

  it('CONTROL: the same handler without the emit is admitted', () => {
    const source = vault(`  function accrue(bigint amount) public {
    bigint shares = IX22Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    require(shares >= 0);
  }`);
    expect(compileString(source, graph).hiddenBatch?.handlers
      .find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  it('CONTROL: the same emit over a VOID edge - no result consumed - is admitted', () => {
    const source = vault(`  function accrue(bigint amount) public {
    this.collateral = this.collateral + amount;
    IX22Sink(sink).ping(amount);
    emit Accrued(amount);
    require(true);
  }`);
    expect(compileString(source, graph).hiddenBatch?.handlers
      .find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  it('admits a satoshi transfer alongside a consumed result', () => {
    const source = vault(`  function accrue(bigint amount) public {
    bigint shares = IX22Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    this.transfer(payee, 1000);
    require(shares >= 0);
  }`);
    expect(() => compileString(source, graph)).not.toThrow();
    expect(compileString(source, graph).hiddenBatch?.handlers
      .find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
  });

  /** The rejection must reach the user through `hiddenBatch.handlers` when a sibling still routes. */
  it('publishes the reason per handler when another handler survives', () => {
    const source = vault(`  function accrue(bigint amount) public {
    bigint shares = IX22Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    emit Accrued(shares);
    require(shares >= 0);
  }
  function bump(bigint amount) public { this.collateral = this.collateral + amount; require(amount >= 0); }`);
    const artifact = compileString(source, graph);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'accrue')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'bump')?.eligible).toBe(false);
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  /**
   * An emit reached through an internal helper is NOT this shape: the clone keeps its OP_INVOKE frame, so the
   * route never flattens it and the older uniform-event reason is the accurate one. Pinned so the new refusal
   * is not silently widened onto it.
   */
  it('leaves the indirect-emit shape on its existing reason', () => {
    const source = vault(`  function _log(bigint shares) internal { emit Accrued(shares); }
  function accrue(bigint amount) public {
    bigint shares = IX22Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    _log(shares);
    require(shares >= 0);
  }`);
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain("'accrue': event-route-requires-uniform-events-and-at-most-one-value-transfer");
  });
});
