import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm, resolveAddressForm } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// What `addressForm` does - and does not - reach. The option changes the form of an address *value* at the one
// packing surface and at the decoded presentation; it never changes what `msg.sender` and `tx.origin` ARE (both
// are locking bytecode) and never changes how two addresses compare. These pins state that boundary so a later
// change cannot quietly narrow an introspection value or re-domain an address comparison.

const size = (source: string, addressForm: 'hash' | 'bytecode', extra: Record<string, unknown> = {}): number =>
  compileString(source, { evmCompat: true, messageBus: false, addressForm, ...extra }).debug.bytecode.length / 2;

describe('addressForm and the address introspection values', () => {
  it('packs msg.sender, tx.origin and address(this) as the identity under hash and whole under bytecode', () => {
    const packing = (what: string): string =>
      `contract C() { function f() returns (bytes) { return abi.encodePacked(${what}); } }`;
    for (const what of ['msg.sender', 'tx.origin', 'address(this)']) {
      const hash = size(packing(what), 'hash');
      const bytecode = size(packing(what), 'bytecode');
      // 'hash' inserts the address -> 20-byte narrowing at the packing site (a shorter script without it).
      expect(bytecode, what).toBeLessThan(hash);
    }
  });

  it('leaves address equality and the zero comparison form-independent (a guard must not be re-domained)', () => {
    const guard = 'contract C() { address owner; function f() { require(msg.sender == this.owner); } }';
    const zero = 'contract C() { function f() { require(msg.sender == address(0)); } }';
    expect(size(guard, 'bytecode')).toBe(size(guard, 'hash'));
    expect(size(zero, 'bytecode')).toBe(size(zero, 'hash'));
  });

  it('leaves an event address field form-independent (the receipt carries the lock either way)', () => {
    const source = 'contract C { event Hit(address from, uint256 v); int s; '
      + 'function f(uint256 v) external { s = 1; emit Hit(msg.sender, v); } }';
    expect(size(source, 'bytecode', { composition: 'framed' }))
      .toBe(size(source, 'hash', { composition: 'framed' }));
  });

  it('leaves the ecrecover pairing form-independent in both recovery modes', () => {
    const source = 'contract C() { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) '
      + '{ require(ecrecover(h, v, r, s) == msg.sender); } }';
    for (const ecrecover of ['p2pkh', 'evm'] as const) {
      expect(size(source, 'bytecode', { ecrecover }), ecrecover).toBe(size(source, 'hash', { ecrecover }));
    }
  });

  it('narrows a cast in either form, so a Solidity-shaped comparison stays expressible', () => {
    // `uint160(msg.sender)` is the documented way to reach the 20-byte domain from a lock; it works in both
    // forms because the cast, not the form, is the narrowing.
    const source = 'contract C() { function f() returns (bytes) { return abi.encodePacked(uint160(msg.sender)); } }';
    const hash = bytecodeToAsm(hexToBin(compileString(source, {
      evmCompat: true, messageBus: false, addressForm: 'hash',
    }).debug.bytecode));
    const bytecode = bytecodeToAsm(hexToBin(compileString(source, {
      evmCompat: true, messageBus: false, addressForm: 'bytecode',
    }).debug.bytecode));
    expect(hash).toBe(bytecode);
  });
});

// The artifact is where a consumer reads the choice back from: the option is published only when the source named
// it, so an artifact that names none keeps the shape it always had and `resolveAddressForm` re-derives the form its
// mode implies. Without the published field the SDK fell back to 'hash' under `evmCompat` and reproduced a packing
// the body does not emit (DECISIONS D29: the framed wire's address-value emulation).
describe('the resolved address form on the artifact', () => {
  const source = 'contract C() { function f() returns (bytes) { return abi.encodePacked(msg.sender); } }';

  it('publishes the form the source chose', () => {
    for (const addressForm of ['hash', 'bytecode'] as const) {
      expect(compileString(source, { evmCompat: true, addressForm }).compiler.options.addressForm).toBe(addressForm);
      expect(compileString(source, { addressForm }).compiler.options.addressForm).toBe(addressForm);
    }
  });

  it('omits the field when the source names none, so the mode still decides it', () => {
    for (const evmCompat of [true, false]) {
      const options = compileString(source, { evmCompat }).compiler.options;
      expect('addressForm' in options).toBe(false);
      expect(resolveAddressForm(options)).toBe(evmCompat ? 'hash' : 'bytecode');
    }
  });
});
