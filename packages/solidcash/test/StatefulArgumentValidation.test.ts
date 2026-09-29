import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../src/index.js';
import { compileString } from './direct-compile.js';
import { createTestProvider } from './test-util.js';

describe('stateful ABI argument validation', () => {
  const createFixedWidthContract = () => {
    const artifact = compileString(`contract FixedWidthArgument() {
      bytes32 stored;
      function set(bytes32 value) public {
        this.stored = value;
        require(true);
      }
    }`, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider: createTestProvider() });
    return StatefulContract.withCategory(inner, 'aa'.repeat(32));
  };

  it('rejects an oversized fixed-bytes argument before provider or state processing', async () => {
    const contract = createFixedWidthContract();

    // No contract UTXOs are deployed. ABI validation must therefore win over both the missing-state error and
    // any attempt to serialize this value into a PUSHDATA2-limited derived state commitment.
    await expect(contract.call.set(new Uint8Array(65_536)).build()).rejects.toThrow(
      'incorrect data length: got 65536 bytes, expected 32 for bytes32',
    );
  });

  it('validates nested stateful call frames before building the outer call', async () => {
    const outer = createFixedWidthContract();
    const nested = createFixedWidthContract();
    const valid = new Uint8Array(32);

    await expect(outer.call.set(valid)
      .withCall(nested, 'set', [new Uint8Array(65_536)])
      .build()).rejects.toThrow(
      'incorrect data length: got 65536 bytes, expected 32 for bytes32',
    );
  });

  it('preserves the canonical argument-count error during early validation', async () => {
    const contract = createFixedWidthContract();

    await expect((contract.call.set as (...args: unknown[]) => { build(): Promise<unknown> })().build())
      .rejects.toThrow(
        'Incorrect number of arguments passed to function set. Expected 1 arguments (bytes32) but got 0',
      );
  });

  it('validates every supplied route witness around an implicit caller category', () => {
    const contract = createFixedWidthContract();
    const blob = Uint8Array.of(1);
    const proof = new Uint8Array(32);
    const route = {
      name: '__message_bus1',
      inputs: [
        { name: 'batchBlob', type: 'bytes' },
        { name: '__internal__activeVerifierIndex', type: 'bigint' },
        { name: '__internal__msgSenderCategory', type: 'bytes32' },
        { name: '__internal__proof', type: 'bytes32' },
      ],
    } as AbiFunction;
    const frame = [blob, -1n, proof];

    expect(contract._validateAbiFrame(route, frame, { implicitMsgSenderCategory: true })).toEqual(frame);
    expect(() => contract._validateAbiFrame(route, frame)).toThrow(
      'Incorrect number of arguments passed to function __message_bus1',
    );
    expect(() => contract._validateAbiFrame(
      route, [blob, -1n, new Uint8Array(31)], { implicitMsgSenderCategory: true },
    )).toThrow('incorrect data length: got 31 bytes, expected 32 for bytes32');
    expect(() => contract._validateAbiFrame(
      route, [blob, -1n], { implicitMsgSenderCategory: true },
    )).toThrow('Incorrect number of arguments passed to function __message_bus1');
  });
});
