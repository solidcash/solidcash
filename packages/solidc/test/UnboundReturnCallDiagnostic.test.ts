import { beforeAll, describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import { UnboundReturnCallError } from '../src/Errors.js';

/**
 * X75 - the residual internal abort in the X15/X22 family.
 *
 * `Unbound return call in __scbN; graph=undefined` was thrown from code generation as a bare `Error`: no
 * error name, no position, no remedy. The F3 corpus census recorded it for 5 solidity-by-example and 5
 * solc-corpus contracts and could only quote the sentinel. An unsupported shape must fail closed with a
 * NAMED diagnostic; that is the standard X15 and X22 already set for this channel.
 *
 * The shape is NOT X22's. X22 refused a handler that consumes a call result in its own body while carrying
 * an effect. Here the returning call and the effect sit in a VOID INTERNAL HELPER: the effect makes the
 * helper ineligible for its own OP_INVOKE subroutine, so `InlineStoragePointerCalls` inlines it into the
 * SCB1 wrapper, and the relocated edge lands in a function whose layout reserves no return-event slot.
 * X22's route-synthesis refusal never sees it, which is exactly why the gate is at the generator: every
 * unbound returning edge converges there, whichever upstream gate let it through.
 *
 * Both controls differ from the case in exactly ONE field.
 */

const batchOnly = { forceStateful: true, experimentalHiddenBatch: true };
const graph = {
  ...batchOnly,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

/** A void helper that consumes a call result AND emits, reached from a batched handler. */
const inlinedReturningHelper = `pragma solidcash >=0.8.0;
interface IVault { function deposit(bigint amount) returns (bigint); }
contract X75(address vault) {
  bigint collateral;
  event Accrued(bigint shares);
  function _pull(bigint amount) internal {
    bigint shares = IVault(vault).deposit(amount);
    emit Accrued(shares);
  }
  function accrue(bigint amount) public {
    this._pull(amount);
    require(true);
  }
}`;

/** Control: the helper's effect is a scalar state write instead of an emit. Same call, same helper. */
const scalarEffectHelper = inlinedReturningHelper.replace('emit Accrued(shares);', 'this.collateral = shares;');

// Compile each source ONCE, in one budgeted hook. Recompiling per assertion is what turns a passing file into
// a timeout under the load of a full multi-package run.
let refusal: Error | undefined;
let batchOnlyArtifact: ReturnType<typeof compileString>;
let scalarEffectArtifact: ReturnType<typeof compileString>;

describe('X75 an unbound returning edge fails closed with a named diagnostic', () => {
  beforeAll(() => {
    try { compileString(inlinedReturningHelper, graph); } catch (error) { refusal = error as Error; }
    batchOnlyArtifact = compileString(inlinedReturningHelper, batchOnly);
    scalarEffectArtifact = compileString(scalarEffectHelper, graph);
  }, 300_000);

  it('is a named error, not a bare internal sentinel', () => {
    expect(refusal).toBeInstanceOf(UnboundReturnCallError);
    expect(refusal!.name).toBe('UnboundReturnCallError');
    // MEASURED: the old `not.toMatch(/Unbound return call in/)` here could not fail. That sentinel string
    // survives only in COMMENTS (Errors.ts:1327, compiler.ts:1041); no throw site emits it, so the control
    // named vocabulary the subject cannot produce. Its subject is genuinely gone - it would be restored only
    // by the bare sentinel being reintroduced as a throw. Replaced with a live check on the shape the message
    // actually has, which is what "named, not internal" means at this commit.
    expect(refusal!.message).toMatch(/^Function '__scb1' consumes the return value of the external call/);
  });

  it('names the edge, the function whose layout has no slot, and why', () => {
    expect(refusal!.message).toContain("external call 'IVault.deposit()'");
    expect(refusal!.message).toContain("Function '__scb1'");
    expect(refusal!.message).toContain('no return-event slot is reserved for it');
  });

  it('tells the user what to do instead', () => {
    expect(refusal!.message).toContain('carries no other physical effect');
    expect(refusal!.message).toContain('drop the result and make the call a void tail call');
  });

  /**
   * The position must be in the USER's file. The generated route source is a second parse whose line numbers
   * are not positions in anything the user wrote (X71), so a diagnostic that quoted one would be unusable.
   * The source is 14 lines; the returning call is on line 7.
   */
  it('reports a position inside the user source, not inside generated source', () => {
    const at = /at Line (\d+), Column \d+/.exec(refusal!.message);
    expect(at).not.toBeNull();
    const line = Number(at![1]);
    expect(line).toBe(7);
    expect(line).toBeLessThanOrEqual(inlinedReturningHelper.split('\n').length);
    expect(inlinedReturningHelper.split('\n')[line - 1]).toContain('IVault(vault).deposit(amount)');
  });

  /** No artifact is produced, which is what makes naming the abort not a behaviour change. */
  it('produces no artifact', () => {
    expect(refusal).toBeDefined();
  });

  /**
   * Control 1 - the SAME source, differing only in the requested route (no graph controller). It compiles
   * and publishes a route, so the refusal is a property of the route that flattens the helper, not of the
   * contract.
   */
  it('control: the same source compiles when no graph controller is requested', () => {
    expect(batchOnlyArtifact.hiddenBatch).toBeDefined();
    expect(batchOnlyArtifact.hiddenBatch!.handlers!
      .filter((handler) => handler.eligible).map((handler) => handler.name)).toContain('accrue');
  });

  /**
   * Control 2 - the same route, differing only in the helper's effect (a scalar write rather than an emit).
   * It compiles, so the refusal is a property of the effect that forces the inline, not of the returning
   * call by itself.
   */
  it('control: the same route compiles when the helper carries no emission effect', () => {
    expect(scalarEffectArtifact.hiddenBatch).toBeDefined();
    expect(scalarEffectArtifact.hiddenBatch!.handlers!
      .filter((handler) => handler.eligible).map((handler) => handler.name)).toContain('accrue');
  });
});
