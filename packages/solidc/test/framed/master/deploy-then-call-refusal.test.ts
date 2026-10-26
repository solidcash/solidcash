import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * A framed contract that creates a child is refused before code generation; the refusal names the CREATE frame and,
 * when the same body also calls the fresh child, says that the call's entry would need to run in a spent master.
 *
 * The direct convention folds `new Child(); c.configure(...)` into the child's genesis. The framed convention has no
 * CREATE frame, so the fold's call node survives in the body and the planner cannot lay its frame; the diagnostic
 * must say so rather than surfacing an internal stop-site assertion (`an execution with 0 call(s) closes 1
 * segment(s): got 2`) when the creation guard is lifted.
 */
const CHILD = 'int public total; function configure(int v) public { total = v; }';

describe('framed deploy-then-call refusal', () => {
  it('names the CREATE frame for a plain creation', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/contract creation needs the witness `CREATE` checks, which are not emitted yet(?!;)/u);
  });

  it('adds the child-entry fact for a call on the fresh child', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); c.configure(v); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/a call on the new contract would need the child's entry to run in a spent master's script/u);
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
