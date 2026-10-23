import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../src/index.js';
import { MockNetworkProvider } from '../src/network/mock/index.js';
import { compileString } from './direct-compile.js';

/**
 * A `p2s` (raw-script) contract's locking bytecode is the raw redeem script. Its hex address is not a CashAddress,
 * so deriving the lock through `addressToLockScript` used to throw and made every spend path unbuildable.
 */
describe('a p2s contract derives its locking bytecode from the raw script', () => {
  it('returns the raw redeem-script bytes from generateLockingBytecode', () => {
    const artifact = compileString('pragma solidcash ^0.14.0; contract C() { function f() { require(true); } }');
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [], { provider, addressType: 'p2s' });
    const unlocker = contract.unlock.f();
    expect(() => unlocker.generateLockingBytecode()).not.toThrow();
    expect(unlocker.generateLockingBytecode()).toEqual(hexToBin(contract.lockingBytecode));
  });
});
