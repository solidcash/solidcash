import { cashAddressToLockingBytecode } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { compileString } from './direct-compile.js';
import { createTestProvider } from './test-util.js';

const address = 'bchtest:qrz2mzwdkumhaj9pvvrsapzz6wv6s7u8qyqdczyv82';
const decoded = cashAddressToLockingBytecode(address);
if (typeof decoded === 'string') throw new Error(decoded);
const identity = decoded.bytecode.slice(3, 23);
const create = (evmCompat = true): StatefulContract => {
  const artifact = compileString(`contract NativeBytesFrame() {
    int stored;
    function accept(bytes value) public { require(true); }
    function fixedIdentity(bytes20 value) public { require(true); }
    function digest(bytes32 value) public { require(true); }
  }`, { evmCompat, forceStateful: true });
  return StatefulContract.withCategory(
    new Contract(artifact, [], { provider: createTestProvider() }), 'aa'.repeat(31) + '55',
  );
};

describe('native addresses used as Solidity byte arguments', () => {
  it('validates a native address using its Solidity identity bytes', () => {
    const contract = create();
    const abi = contract.inner.artifact.abi.find((entry) => entry.name === 'accept')!;
    expect(contract._validateAbiFrame(abi, [address])).toEqual([identity]);
  });

  it('preserves fixed-byte widths and rejects non-address text', () => {
    const contract = create();
    const entry = (name: string): AbiFunction => contract.inner.artifact.abi.find((candidate) => candidate.name === name)!;
    expect(contract._validateAbiFrame(entry('fixedIdentity'), [address])).toEqual([identity]);
    expect(() => contract._validateAbiFrame(entry('digest'), [address])).toThrow(/expected 32 for bytes32/);
    expect(() => contract._validateAbiFrame(entry('accept'), ['bchtest:invalid'])).toThrow();
    expect(() => contract._validateAbiFrame(entry('accept'), ['ordinary text'])).toThrow();
    expect(contract._validateAbiFrame(entry('accept'), ['0x1234'])).toEqual(['0x1234']);
  });

  it('retains strict byte input validation outside Solidity compatibility', () => {
    const contract = create(false);
    const abi = contract.inner.artifact.abi.find((entry) => entry.name === 'accept')!;
    expect(() => contract._validateAbiFrame(abi, [address])).toThrow(/valid hex string/);
  });
});
