import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A stateful `new` in a constructor (an inline state initializer or the body) mints its child inside the genesis
// transaction, which carries no child genesis input or outputs. The derivation probe read the missing child input and
// the refusal blamed unwritten state ("Ensure the constructor writes all state variables"); it now names the children.
const SRC = `contract Unit {
  uint public x;
  constructor() { x = 7; }
  function get() public view returns (uint) { return x; }
}
contract Pair {
  uint public y;
  function set(uint v) public { y = v; }
}
contract Holder {
  Unit a = new Unit();
  Pair b;
  uint public n;
  constructor() { b = new Pair(); n = 1; }
  function touch() public { n += 1; }
}`;

describe('constructor that creates stateful contracts (deploy)', () => {
  it('refuses by naming each child instead of failing the probe on a missing input', async () => {
    // The constructor is an inferred deploy entry with no signature check: compile it permissionless on purpose.
    const artifact = compileString(SRC, { evmCompat: true, allowUnsafeOperations: true });
    const factory = getContractFactory(artifact, await fundedSigner(8));
    const error = await factory.deploy().then(() => undefined, (cause: unknown) => cause as Error);
    expect(error?.message).toMatch(/^Constructor of 'Holder' creates stateful contract /);
    expect(error?.message).toContain("'Unit'");
    expect(error?.message).toContain("'Pair'");
    expect(error?.message).not.toContain('Failed to derive initial state commitments');
  });
});
