import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * A framed contract that creates a child is refused; a body that also calls the fresh child is refused earlier, at
 * the call, with the entry-point gap named.
 *
 * The direct convention folds `new Child(); c.configure(...)` into the child's genesis. The framed convention has no
 * CREATE frame, so the call cannot run under a spent master of the child. The semantic pass refuses it before the
 * fold, which also keeps a `foldedIntoDeploy` call node out of the body: the framed stop-site table would otherwise
 * count a call the entry's slot list no longer has and assert (`an execution with 0 call(s) closes 1 segment(s):
 * got 2`) once the creation guard is lifted.
 */
const CHILD = 'int public total; function configure(int v) public { total = v; }';

describe('framed deploy-then-call refusal', () => {
  it('names the CREATE frame for a plain creation', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/contract creation needs the witness `CREATE` checks, which are not emitted yet/u);
  });

  it('refuses a call on the fresh child at the call, naming the spent-master gap', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); c.configure(v); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/does not support a call on a contract created in the same transaction: the child's entry would need a spent master of its own/u);
  });

  it('keeps the direct fold for the same source', () => {
    // The direct convention compiles it: the call is folded into the child's genesis, so no refusal is raised and the
    // deploy target records the folded call.
    const artifact = compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); c.configure(v); made = made + 1; } }`,
      { allowUnsafeOperations: true },
    );
    expect(artifact.abi.find((entry) => entry.name === 'make')).toMatchObject({
      deployTargets: [{ contractName: 'Child', hasFoldedChildCall: true }],
    });
  });
});
