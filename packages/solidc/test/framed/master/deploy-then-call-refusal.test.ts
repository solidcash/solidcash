import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * A framed contract that creates a child is refused: one created without a salt for the address its creator's nonce
 * gives it, which a framed master does not hold, before any other check, and one created with a salt for the
 * `CREATE` frame the framed convention does not emit.
 *
 * The direct convention folds `new Child(); c.configure(...)` into the child's genesis. The framed convention has no
 * CREATE frame, so the call cannot run under a spent master of the child. The semantic pass refuses it before the
 * fold, which also keeps a `foldedIntoDeploy` call node out of the body: the framed stop-site table would otherwise
 * count a call the entry's slot list no longer has and assert (`an execution with 0 call(s) closes 1 segment(s):
 * got 2`) once the creation guard is lifted.
 */
const CHILD = 'int public total; function configure(int v) public { total = v; }';

describe('framed deploy-then-call refusal', () => {
  it('names the nonce a plain creation takes its address from, and the CREATE frame for a salted one', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/'new Child\(\)' takes its address from the creator's nonce, which a framed master does not hold/u);
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child{salt: bytes32(0)}(); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/contract creation needs the witness `CREATE` checks, which are not emitted yet/u);
  });

  it('refuses a creation the body then calls, by the nonce its address comes from, before the call', () => {
    expect(() => compileString(
      `pragma solidcash ^0.14.0; contract Child { ${CHILD} }
       contract Factory { int made; function make(int v) public { Child c = new Child(); c.configure(v); made = made + 1; } }`,
      { composition: 'framed' },
    )).toThrow(/'new Child\(\)' takes its address from the creator's nonce, which a framed master does not hold/u);
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
