import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';

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
});
