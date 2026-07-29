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
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
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
   */
  it('still refuses a handler that reaches a real collection through a helper', () => {
    expect(handlerState(`pragma solidcash >=0.8.0;
contract RealCollection() {
  mapping(bytes20 => bigint) balances;
  function credit(bytes20 k, bigint v) internal { this.balances[k] = this.balances[k] + v; }
  function act(bytes20 k, bigint v) public { credit(k, v); require(v > 0); }
}`, 'act')).toBe(undefined);
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
