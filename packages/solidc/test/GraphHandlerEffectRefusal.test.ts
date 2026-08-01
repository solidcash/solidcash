import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { GraphHandlerEffectError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * X42. Two effect kinds crashed on an internal invariant inside a message-bus graph emission handler instead
 * of being diagnosed: `new C(..)` died on `Block slot not found: deploy[0]` and `blockhash(n)` on
 * `Expected variable '__internal__blockhashInputIndex' does not exist on the stack`.
 *
 * Neither produced an artifact at `ffef8568` and neither produces one now, so this is a diagnostic change and
 * not a behaviour change - the no-artifact property is asserted below rather than assumed. Every shape that
 * compiled before still compiles, byte-identical: the refusal only fires for a handler that BOTH carries the
 * effect and is an emission handler on the graph route.
 */

// Message-bus compilation is several seconds per contract.
const COMPILE_TIMEOUT_MS = 120_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
const directOptions = { forceStateful: true };

const CHILD = `contract Child(int seed) {
  bigint stored;
  function bump(uint v) public { this.stored = this.stored + int(v); require(int(v) >= 0); }
}`;

// A void tail-form external call is what makes `run` an emission handler on the graph route.
const DEPLOY_IN_HANDLER = `pragma solidcash >=0.8.0;
interface ICallee { function ping(uint v); }
${CHILD}
contract Deployer() {
  function run(address callee, uint v) public {
    new Child(7);
    ICallee(callee).ping(v);
    require(v >= 0);
  }
}`;

const BLOCKHASH_IN_HANDLER = `pragma solidcash >=0.8.0;
interface ICallee { function ping(uint v); }
contract Watcher() {
  bytes32 seen;
  function run(address callee, uint v, int n) public {
    this.seen = blockhash(n);
    ICallee(callee).ping(v);
    require(v >= 0);
  }
}`;

// Same handler shape, neither effect: the emission handler the two above are variations of.
const PLAIN_HANDLER = `pragma solidcash >=0.8.0;
interface ICallee { function ping(uint v); }
contract Plain() {
  function run(address callee, uint v) public {
    ICallee(callee).ping(v);
    require(v >= 0);
  }
}`;

// Route-eligible, carries the deploy, makes NO external call - so it is not an emission handler.
const DEPLOY_WITHOUT_CALL = `pragma solidcash >=0.8.0;
${CHILD}
contract Deployer() {
  bigint count;
  function run(uint v) public {
    new Child(7);
    this.count = this.count + int(v);
    require(int(v) >= 0);
  }
}`;

describe('graph handler effect refusal (X42)', () => {
  it('names the deploy shape instead of failing on a missing block slot', () => {
    let error: unknown;
    let artifact: unknown;
    try {
      artifact = compileString(DEPLOY_IN_HANDLER, busOptions);
    } catch (thrown) {
      error = thrown;
    }
    // The no-artifact property the diagnostic relies on: refusing produced nothing before and produces
    // nothing now, so no consumer can be handed a partially-lowered route.
    expect(artifact).toBeUndefined();
    expect(error).toBeInstanceOf(GraphHandlerEffectError);
    expect((error as GraphHandlerEffectError).reason).toBe('graph-handler-deploy-not-enabled');
    expect((error as Error).message).toContain('block layout reserves owner slots only');
    // The refusal carries a source location, which the internal invariant message did not.
    expect((error as Error).message).toMatch(/ at Line \d+, Column \d+$/);
  }, COMPILE_TIMEOUT_MS);

  it('admits blockhash after the graph route reserves its row-local oracle band', () => {
    const artifact = compileString(BLOCKHASH_IN_HANDLER, busOptions);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'run')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.route.graphBlockhashOracle?.readWidth).toBe(1);
  }, COMPILE_TIMEOUT_MS);

  it('leaves the same handler without either effect on the graph route', () => {
    const artifact = compileString(PLAIN_HANDLER, busOptions);
    expect(artifact.hiddenBatch?.handlers?.map((handler) => handler.name)).toEqual(['run']);
  }, COMPILE_TIMEOUT_MS);

  it.each([
    ['a deploy', DEPLOY_IN_HANDLER],
    ['a blockhash read', BLOCKHASH_IN_HANDLER],
  ])('still compiles %s in the same handler on the direct route', (_name, source) => {
    const artifact = compileString(source, directOptions);
    expect(artifact.abi.some((fn) => fn.name === 'run')).toBe(true);
  }, COMPILE_TIMEOUT_MS);

  it('still compiles a route-eligible handler that deploys but makes no external call', () => {
    const artifact = compileString(DEPLOY_WITHOUT_CALL, busOptions);
    expect(artifact.hiddenBatch?.handlers?.map((handler) => handler.name)).toEqual(['run']);
  }, COMPILE_TIMEOUT_MS);
});
