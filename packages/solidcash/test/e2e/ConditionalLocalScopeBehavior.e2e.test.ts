import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Regression: in a function WITH a return type, a local var declared inside an if-branch
// (`if (c) { T local; }`) was not dropped at branch end - the tracker kept the local but the NOT-TAKEN
// path's real stack lacked it, desyncing every later stack read (a not-taken-path-only crash, so tests
// that always took the branch never caught it). visitBranch used its return-in-branch save/restore path
// for ANY return-typed function; fixed to use it only when a branch ACTUALLY contains a return
// (blockContainsReturn), so a fall-through branch's scoped locals are dropped via removeScopedVariables.
//
// This also fixes a state-writing helper called as a discarded statement in a conditional
// (`if (c) { helper(); }` where helper returns a value + writes state): it inlines to a conditional-local
// (the return temp) + a state write, which hit the same bug.
describe('conditional-branch local scope in return-typed functions', () => {
  it('an if-branch local is cleaned up on the not-taken path (reads state after)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function run(bool c) public returns (int) { if (c) { bool r = true; } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.run(false)).resolves.toBeDefined(); // not-taken: branch local must be dropped
    await expect(sc.run(true)).resolves.toBeDefined();  // taken
  });

  it('pure function with an if-branch local (not-taken path)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      function run(bool c) public pure returns (int) { if (c) { int r = 5; } return 9; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.run(false)).resolves.toBeDefined();
  });

  it('a state-writing returning helper called as a discarded statement in a conditional', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function bump() internal returns (bool) { count = count + 1; return true; }
      function run(bool c) public returns (int) { if (c) { bump(); } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.run(false); expect((await sc.getState()).count).toBe(0n); // c=false: bump not run
    await sc.run(true); expect((await sc.getState()).count).toBe(1n);  // c=true: bump runs once
  });

  it('a branch that itself returns still works (return-in-branch path unchanged)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function run(bool c) public returns (int) { if (c) { return 1; } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.run(false)).resolves.toBeDefined();
    await expect(sc.run(true)).resolves.toBeDefined();
  });
});
