import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Regression: an unconditional state write FOLLOWED by a conditional re-write of the SAME var
// (`x = a; if (c) { x = b; }`) crashed with a stack-index error when the branch was not taken. The
// "replace-in-place vs push-new" decision keyed on preAllocatedStateWrites, which missed a slot already
// pushed by the prior unconditional write, so the in-branch write pushed a DUPLICATE slot inside the OP_IF
// and desynced the stack on the not-taken path. Fixed to key on pendingStateWrites (slot already on stack).
describe('conditional state write after an unconditional write', () => {
  it('x = a; if (c) { x = b } behaves per branch (both c values)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function set(bool c) public returns (int) { count = 5; if (c) { count = 1; } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.set(false); expect((await sc.getState()).count).toBe(5n);
    await sc.set(true); expect((await sc.getState()).count).toBe(1n);
  });

  it('read-modify-write in the conditional (x = a; if (c) { x = x + 1 })', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function set(bool c) public returns (int) { count = 5; if (c) { count = count + 1; } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.set(false); expect((await sc.getState()).count).toBe(5n);
    await sc.set(true); expect((await sc.getState()).count).toBe(6n);
  });

  it('two unconditional writes to the same var (x = a; x = b) -> b', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function set() public returns (int) { count = 5; count = 6; return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.set(); expect((await sc.getState()).count).toBe(6n);
  });

  it('if-else both branches write (unchanged, still correct)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function set(bool c) public returns (int) { if (c) { count = 1; } else { count = 2; } return count; }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.set(false); expect((await sc.getState()).count).toBe(2n);
    await sc.set(true); expect((await sc.getState()).count).toBe(1n);
  });
});
