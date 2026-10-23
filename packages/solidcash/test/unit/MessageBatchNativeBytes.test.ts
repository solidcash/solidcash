import { cashAddressToLockingBytecode } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { encodeMessageBatch } from '../../src/message-bus/message-bus.js';

const address = 'bchtest:qrz2mzwdkumhaj9pvvrsapzz6wv6s7u8qyqdczyv82';
const decoded = cashAddressToLockingBytecode(address);
if (typeof decoded === 'string') throw new Error(decoded);
const identity = decoded.bytecode.slice(3, 23);
const create = (evmCompat = true): Artifact => compileString(`contract BytesBatch() {
  int stored;
  function accept(bytes value) public { this.stored = int(value.length); require(true); }
  function narrow(bytes20 value) public { this.stored = int(value.length); require(true); }
  function wide(bytes32 value) public { this.stored = int(value.length); require(true); }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, evmCompat, suppressWarnings: true });

describe('message-bus native addresses in Solidity byte arguments', () => {
  it('encodes the same authenticated rows as explicit identity bytes without mutating invocations', () => {
    const artifact = create();
    const invocations = [{ function: 'accept', args: [address] }];
    const native = encodeMessageBatch(artifact, invocations);
    const explicit = encodeMessageBatch(artifact, [{ function: 'accept', args: [identity] }]);
    expect(native.blob).toEqual(explicit.blob);
    expect(native.rows).toEqual(explicit.rows);
    expect(invocations[0].args).toEqual([address]);
    expect(encodeMessageBatch(artifact, [{ function: 'narrow', args: [address] }]).rows)
      .toEqual(encodeMessageBatch(artifact, [{ function: 'narrow', args: [identity] }]).rows);
  });

  it('retains exact fixed byte widths and strict malformed-text validation', () => {
    const artifact = create();
    expect(() => encodeMessageBatch(artifact, [{ function: 'wide', args: [address] }]))
      .toThrow(/expected 32 for bytes32/);
    for (const invalid of ['ordinary text', 'bchtest:invalid']) {
      expect(() => encodeMessageBatch(artifact, [{ function: 'accept', args: [invalid] }])).toThrow();
    }
  });

  it('retains strict byte encoding outside Solidity compatibility', () => {
    expect(() => encodeMessageBatch(create(false), [{ function: 'accept', args: [address] }]))
      .toThrow(/valid hex string/);
  });
});
