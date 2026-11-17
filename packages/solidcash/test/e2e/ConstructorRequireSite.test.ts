import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A failing `require` in a constructor stops the deploy probe before any state is written. The refusal used to read
// "Ensure the constructor writes all state variables" with only the VM error, so the guard that refused was not named.
const SRC = `contract Escrow {
  error InvalidAmount();
  uint public amount;
  constructor(uint a) {
    require(a > 0, InvalidAmount());
    amount = a;
  }
  function get() public view returns (uint) { return amount; }
}`;

describe('constructor whose require fails (deploy)', () => {
  it('names the failing require site and its error', async () => {
    const artifact = compileString(SRC, { evmCompat: true, allowUnsafeOperations: true });
    const factory = getContractFactory(artifact, await fundedSigner(8));
    const error = await factory.deploy(0n).then(() => undefined, (cause: unknown) => cause as Error);
    expect(error?.message).toContain('failing require in Escrow:5');
    expect(error?.message).toContain('InvalidAmount');
  });

  it('still deploys when the require passes', async () => {
    const artifact = compileString(SRC, { evmCompat: true, allowUnsafeOperations: true });
    const factory = getContractFactory(artifact, await fundedSigner(8));
    const contract = await factory.deploy(5n);
    expect(contract).toBeDefined();
  });
});
