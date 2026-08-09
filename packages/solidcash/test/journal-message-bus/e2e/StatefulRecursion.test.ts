import { describe, it, expect } from 'vitest';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { compileString } from '../../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate, MockNetworkProvider } from '../../../src/index.js';
import { MOCK_CONSENSUS_LIMITS, MOCK_RELAXED_OPERATION_COST } from '../../../src/network/MockNetworkProvider.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { alicePub, alicePriv } from '../../fixture/vars.js';

// A recursive call in a STATEFUL function (the function-modifier bench contract's `decrement`). The block-layout
// conditional-entry walk followed the resolvedFunction back-reference into the callee's body, so a self-call (or
// any call cycle) recursed forever ("Maximum call stack size exceeded"); it now skips that back-reference, as do
// the entry-slot pre-scan walks. (Recursion executes via OP_DEFINE/OP_INVOKE dispatch, not inlining.)
const SELF = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function decrement(int i) {
    this.x = this.x - i;
    if (i > 1) { decrement(i - 1); }
    require(i > 0);
  }
  function chk(int e) { require(this.x == e); }
}`;

// A recursive PURE helper whose result feeds a single state write: exercises the same walk (run -> sumTo ->
// sumTo) and round-trips on-chain.
const PURE = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function run(int n, pubkey pk, sig s) { require(checkSig(s, pk)); this.x = sumTo(n); }
  function sumTo(int n) returns (int) { if (n <= 1) { return n; } return n + sumTo(n - 1); }
  function chk(int e) { require(this.x == e); }
}`;

const REUSED = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function add(int n) internal { this.x = this.x + n; }
  function run(int a, int b) { add(a); add(b); require(a >= 0); }
  function chk(int e) { require(this.x == e); }
}`;

const RETURNING_WRITER = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  int observed;
  function bump(int n) internal returns (int) {
    this.x = this.x + n;
    return this.x;
  }
  function run(int a, int b) {
    int first = bump(a);
    int second = bump(b);
    this.observed = first * 100 + second;
    require(a >= 0);
  }
  function chk(int expectedX, int expectedObserved) {
    require(this.x == expectedX && this.observed == expectedObserved);
  }
}`;

const HANDLER_MESSAGE_CONTEXT = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function touch() internal {
    require(msg.sig == this.run.selector);
    require(msg.data.length > 4);
    this.x = this.x + 1;
  }
  function run(int marker) {
    touch();
    touch();
    require(marker == 77);
  }
  function chk(int expected) { require(this.x == expected); }
}`;

const MUTUAL_HANDLER_CONTEXT = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  modifier from(address expected) {
    require(expected == expected);
    _;
  }
  function even(int n, address expected) internal from(expected) {
    this.x = this.x + 1;
    if (n > 0) { odd(n - 1, expected); }
  }
  function odd(int n, address expected) internal from(expected) {
    this.x = this.x + 1;
    if (n > 0) { even(n - 1, expected); }
  }
  function run(int n, address expected) {
    even(n, expected);
    require(n >= 0);
  }
  function chk(int expected) { require(this.x == expected); }
}`;

const UNBOUNDED = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function recurse() {
    this.x = this.x + 1;
    recurse();
    require(this.x > 0);
  }
}`;

describe('recursion in a stateful contract no longer crashes the compiler', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('a stateful self-recursive function compiles (was: compiler crash)', () => {
    expect(() => compileString(SELF, { forceStateful: true })).not.toThrow();
  });

  it('a stateful self-recursive function journals every recursive write', async () => {
    const artifact = compileString(SELF, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.decrement(3n).send();
    await sc.chk(-6n).send();
  });

  /**
   * THE BUDGET ROW, MADE ATTRIBUTABLE AGAIN.
   *
   * This row refused for DENSITY CONTROL when it was written - `Maximum operation cost: 551200`, the stock
   * 800-per-byte budget times a 689-byte density control length. It still refuses and still passes, and it has
   * not measured a budget since X130 made `debug()` provider-faithful: `MOCK_CONSENSUS_LIMITS` publishes
   * `operationCostBudgetPerByte: 10_000_000`, 12,500x the stock value, so on the default profile no depth this
   * handler survives can exceed the budget. Measured on this branch: `decrement(10_000)` refuses `Unsuccessful
   * evaluation: completed with a non-truthy value on top of the stack`, and every depth from 4 to 40 BUILDS.
   * The old assertion matched only the SDK's wrapper sentence, so it could not tell the two apart.
   *
   * REPAIRED BY PINNING THE CEILING TO A PUBLISHED PROFILE. The subject runs against the STOCK BCH-2026
   * consensus budget, read from libauth's own `ConsensusBch2026` and never restated here, and the expected
   * ceiling is that published budget times the density control length the VM reports for this transaction. No
   * figure below is a literal, so the row measures whatever the profile publishes rather than a number that
   * was true once.
   *
   * THE DEPTH IS ONE THE HANDLER SURVIVES, which is what makes the refusal attributable: the same invocation
   * at the same depth BUILDS under the relaxed default budget, so the two runs differ in the published budget
   * and in nothing else. A depth past 47 would refuse non-truthy under either budget and prove nothing.
   *
   * This row stages its own `MockNetworkProvider` rather than `createTestProvider()` because its subject is
   * the SDK's preflight decider - a pure VM decision on published consensus limits, with no node in it.
   */
  const OVER_BUDGET_DEPTH = 20n;
  const STOCK_BUDGET = ConsensusBch2026.operationCostBudgetPerByte;
  // NOT MOCK_CONSENSUS_LIMITS.operationCostBudgetPerByte: that default is now the REAL 800, identical to
  // STOCK_BUDGET, which would silently collapse the control arm below into the subject and make the pair
  // meaningless. This arm has to be genuinely relaxed for "differs in exactly one field" to hold.
  const RELAXED_BUDGET = MOCK_RELAXED_OPERATION_COST;

  /** Stage the recursive contract against one published operation-cost budget. */
  const stageAtBudget = async (operationCostBudgetPerByte: number): Promise<StatefulContract<any>> => {
    const artifact = compileString(SELF, { forceStateful: true });
    const staged = new MockNetworkProvider({
      consensusLimits: { ...MOCK_CONSENSUS_LIMITS, operationCostBudgetPerByte },
    });
    const contract = new Contract(artifact, [], { provider: staged });
    const { categoryId } = await setupStatefulUtxos(
      staged, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('rejects an over-budget concrete recursion before returning a transaction builder', async () => {
    // GUARD NEGATIVE CONTROL, and it differs from the subject in exactly one field: the published budget.
    // If this ever refuses, the depth - not the budget - is what the subject below is measuring.
    const relaxed = await stageAtBudget(RELAXED_BUDGET);
    await expect(
      relaxed.decrement(OVER_BUDGET_DEPTH).build(),
      `depth ${OVER_BUDGET_DEPTH} does not fit at the relaxed budget either`,
    ).resolves.toBeDefined();

    const strict = await stageAtBudget(STOCK_BUDGET);
    const refusal = await strict.decrement(OVER_BUDGET_DEPTH).build()
      .then(() => undefined, (error: Error) => error.message);
    expect(refusal, `depth ${OVER_BUDGET_DEPTH} was ADMITTED at the stock budget`).toBeDefined();
    expect(refusal).toMatch(
      /Recursive state invocation 'decrement' does not fit or fails its concrete BCH VM preflight/,
    );
    // ATTRIBUTABLE. The refusal is density control and not the generic non-truthy completion that made this
    // row vacuous; it names the participant's own input; and the ceiling it reports is the PUBLISHED budget
    // times the density control length it reports, computed here rather than written down.
    expect(refusal).toContain('exceed the operation cost density limit');
    expect(refusal, 'the refusal regressed to a non-truthy completion').not.toContain('non-truthy');
    expect(refusal).toContain('at input 0 in contract');
    const reported = refusal!.match(/Maximum operation cost: (\d+) \(density control length: (\d+)\)/);
    expect(reported, 'the refusal named no operation-cost ceiling at all').not.toBeNull();
    const [, ceiling, density] = reported!;
    expect(Number(ceiling), `ceiling is not the published ${STOCK_BUDGET} x ${density}`)
      .toBe(STOCK_BUDGET * Number(density));
    // And the overage is real: the operation the VM refused costs more than the ceiling it just named.
    const overage = refusal!.match(/operation cost following operation: (\d+)/);
    expect(overage, 'the refusal named no overage').not.toBeNull();
    expect(Number(overage![1])).toBeGreaterThan(Number(ceiling));
  }, 300_000);

  /**
   * The sibling row, and its refusal is a DIFFERENT one - correctly so. A structurally unbounded recursion
   * cannot complete, so it fails the evaluation itself rather than a budget, at any budget. That was left
   * unstated while this row also matched only the wrapper; it is pinned here so the two rows cannot silently
   * converge on the same refusal again.
   */
  it('rejects structurally unbounded recursion before returning a transaction builder', async () => {
    const artifact = compileString(UNBOUNDED, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'recurse')?.recursiveStateHandler).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const refusal = await sc.recurse().build().then(() => undefined, (error: Error) => error.message);
    expect(refusal, 'unbounded recursion was ADMITTED').toBeDefined();
    expect(refusal).toMatch(
      /Recursive state invocation 'recurse' does not fit or fails its concrete BCH VM preflight/,
    );
    // ATTRIBUTABLE, without pinning WHICH concrete cause fires: that depends on the published budget. At a
    // relaxed budget the loop runs until the covenant completes with a non-truthy value; against the mock's real
    // 800-per-byte budget, exact-transaction preflight can trip density control first. Both are concrete VM
    // refusals of the same unbounded shape; neither may degrade into a generic template/debug failure.
    expect(refusal).toMatch(
      /Unsuccessful evaluation: completed with a non-truthy value|operation cost density limit/,
    );
    expect(refusal).toContain('input 0');
  });

  it('a recursive pure helper feeding a state write compiles and runs', async () => {
    const artifact = compileString(PURE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(4n, alicePub, sig()).send();   // 4+3+2+1 = 10
    await sc.chk(10n).send();
  });

  it('threads one scalar journal through repeated internal helper calls', async () => {
    const artifact = compileString(REUSED, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(2n, 3n).send();
    await sc.chk(5n).send();
  });

  it('keeps declared return values separate from the updated scalar journal', async () => {
    const artifact = compileString(RETURNING_WRITER, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 1n, observed: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(2n, 4n).send();
    await sc.chk(7n, 307n).send();
  });

  it('forwards the physical entry msg.sig and msg.data into extracted handlers', async () => {
    const artifact = compileString(HANDLER_MESSAGE_CONTEXT, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(77n).send();
    await sc.chk(2n).send();
  });

  it('threads arguments, modifiers, and state through mutual recursion', async () => {
    const artifact = compileString(MUTUAL_HANDLER_CONTEXT, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(3n, contract.address).send();
    await sc.chk(4n).send();
  });
});
