import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * D2/R19. `analyseFunctionFootprint` reads a bare element access `xs[i]` as a COLLECTION access unless `xs` is
 * locally bound, and it only counted parameters and `var` declarations as local. A NAMED RETURN and a tuple
 * DECLARATION bind a local too, so a handler using either published `collection:<local>:*` for a name the
 * contract never declares. The hidden-batch route's collection branch is gated on that footprint and then
 * finds no key for it, so the handler was refused `collection-helper-route-not-enabled` with no collection
 * anywhere in the contract. Measured on the F3 corpora this is what turns away four of UniswapV2Router02's
 * swap entry points, among others.
 *
 * The guard is the other half: a REAL collection access must still reach the footprint, because the route
 * reserves its entry slot from exactly this signal (X19/X26).
 */
const BUS = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

const handlerState = (source: string, name: string): string | undefined | true => {
  const artifact = compileString(source, BUS);
  const handler = artifact.hiddenBatch?.handlers?.find((entry) => entry.name === name);
  if (!handler) return undefined;
  return handler.eligible ? true : handler.rejectionReason;
};

describe('phantom collections in the invocation footprint', () => {
  it('admits a handler whose only element access is on a named return', () => {
    expect(handlerState(`pragma solidcash >=0.8.0;
contract NamedReturn() {
  bigint total;
  function act(bigint n) public returns (bigint[] amounts) {
    amounts = [n, n + 1, n + 2];
    this.total = this.total + amounts[1];
    require(n >= 0);
  }
}`, 'act')).toBe(true);
  });

  it('admits a handler whose only element access is on a tuple-declared local', () => {
    expect(handlerState(`pragma solidcash >=0.8.0;
contract TupleDecl() {
  bigint total;
  function build(bigint n) internal returns (bigint, bigint[]) { return (n, [n, n + 1]); }
  function act(bigint n) public {
    (bigint head, bigint[] xs) = build(n);
    this.total = this.total + head + xs[1];
    require(n >= 0);
  }
}`, 'act')).toBe(true);
  });

  /**
   * GUARD. The same shape over a REAL collection must keep its established refusal: the name shadowing test
   * above must not be reachable by a collection the contract actually declares.
   *
   * MEASURED. `handlerState` returns `undefined` for THREE different states - no route at all, no such handler,
   * and no `hiddenBatch` key on the artifact - and `toBe(undefined)` cannot tell them apart. On this fixture it
   * is the first: `act` is the only entry point, so refusing it erases the route and there is no handlers
   * channel to read. The established refusal this case is named for, `collection-helper-route-not-enabled`, was
   * therefore never compared to anything. It is read below on the channel this fixture actually uses, and then
   * on the handlers channel from a fixture differing in exactly ONE field - an admitted sibling handler.
   */
  it('still refuses a handler that reaches a real collection through a helper', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
contract RealCollection() {
  mapping(bytes20 => bigint) balances;
  function credit(bytes20 k, bigint v) internal { this.balances[k] = this.balances[k] + v; }
  function act(bytes20 k, bigint v) public { credit(k, v); require(v > 0); }
}`, BUS);
    expect(artifact.hiddenBatch, 'a route now survives, so the refusal moved to the handlers channel')
      .toBeUndefined();
    const absence = (artifact.diagnostics ?? [])
      .filter((entry) => entry.code === 'hidden-batch-route-not-synthesized');
    expect(absence).toHaveLength(1);
    expect(absence[0].message).toContain("'act': collection-helper-route-not-enabled");
  });

  it('publishes that refusal per handler when an admitted sibling keeps the route', () => {
    const handlers = compileString(`pragma solidcash >=0.8.0;
contract RealCollection() {
  mapping(bytes20 => bigint) balances;
  bigint total;
  function credit(bytes20 k, bigint v) internal { this.balances[k] = this.balances[k] + v; }
  function act(bytes20 k, bigint v) public { credit(k, v); require(v > 0); }
  function bump(bigint v) public { this.total = this.total + v; require(v >= 0); }
}`, BUS).hiddenBatch!.handlers;
    expect(handlers.map((entry) => `${entry.name}:${entry.eligible}`)).toEqual(['act:false', 'bump:true']);
    expect(handlers.find((entry) => entry.name === 'act')!.rejectionReason)
      .toBe('collection-helper-route-not-enabled');
  });

  /**
   * GUARD. A named return that SHADOWS a declared collection is the local, exactly as symbol resolution
   * resolves it - but the contract's own collection write elsewhere in the same handler must still be seen.
   */
  it('still sees a real collection write in a handler that also has a named return', () => {
    expect(handlerState(`pragma solidcash >=0.8.0;
contract Both() {
  mapping(bytes20 => bigint) balances;
  function act(bytes20 k, bigint v) public returns (bigint[] amounts) {
    amounts = [v, v + 1];
    balances[k] = balances[k] + amounts[0];
    require(v > 0);
  }
}`, 'act')).toBe(true);
  });
});
