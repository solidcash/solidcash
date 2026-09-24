import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { MockNetworkProvider } from '../../src/index.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';

/**
 * Guards the diamond false-pin class: settle helpers must call `stateSuccess`.
 * A missing `testSuccess` spelling under try/catch falsely reports red.
 */
describe('messageBusVmAccepts', () => {
  it('provider VM exposes stateSuccess and does not expose testSuccess', () => {
    const vm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider());
    expect(typeof vm.stateSuccess).toBe('function');
    expect((vm as { testSuccess?: unknown }).testSuccess).toBeUndefined();
  });

  it('returns false when the builder cannot produce a libauth transaction', () => {
    const builder = {
      provider: new MockNetworkProvider(),
      inputs: [],
      buildLibauthTransaction: () => {
        throw new Error('intentional build failure');
      },
    } as unknown as TransactionBuilder;
    expect(messageBusVmAccepts(builder)).toBe(false);
  });
});
