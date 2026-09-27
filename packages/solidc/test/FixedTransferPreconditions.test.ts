import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('fixed BCH transfer preconditions', () => {
  it('does not turn a VM-enforced require into an SDK activation recipe', () => {
    const artifact = compileString(`contract Vault() {
      function pay(bytes recipient, int amount, int requiredLocktime) public {
        require(tx.locktime == requiredLocktime);
        this.transfer(recipient, amount);
        require(true);
      }
    }`, options);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    expect(handler).toMatchObject({ eligible: true, transfers: [{
      recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
      amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
    }] });
    expect(handler?.transfers?.[0]).not.toHaveProperty('condition');
  });

  it('preserves a selected branch after an opaque precondition', () => {
    const artifact = compileString(`contract Vault() {
      function pay(bytes recipient, int amount, int requiredLocktime, bool enabled) public {
        require(tx.locktime == requiredLocktime);
        if (enabled) this.transfer(recipient, amount);
        require(true);
      }
    }`, options);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{ condition: {
        kind: 'source', source: { kind: 'forward', paramIndex: 3 },
      } }] });
  });

  it('still refuses an opaque branch that selects the transfer', () => {
    const artifact = compileString(`contract Vault() {
      function pay(bytes recipient, int amount, int requiredLocktime) public {
        if (tx.locktime == requiredLocktime) this.transfer(recipient, amount);
        require(true);
      }
    }`, options);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({ condition: null });
  });
});
