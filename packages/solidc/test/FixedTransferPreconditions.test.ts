import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const options = {
  forceStateful: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('fixed BCH transfer preconditions', () => {
  it('still refuses an opaque branch that selects the transfer', () => {
    const artifact = compileString(`contract Vault() {
      function pay(bytes recipient, int amount, int requiredLocktime) public {
        if (tx.locktime == requiredLocktime) this.transfer(recipient, amount);
        require(true);
      }
    }`, options);
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({ condition: null });
  });
});
