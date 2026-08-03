/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import { layer3 } from '../../../src/index.js';

const push = (payload: number[]): Uint8Array => Uint8Array.from([payload.length, ...payload]);
const routeBuilder = {
  inputs: [{ unlocker: { abiFunction: { selector: '53434231' } } }],
} as never;
const transaction = (payload: number[]) => ({
  inputs: [{ unlockingBytecode: push(payload) }],
}) as never;
const raw = 'Program failed an OP_VERIFY operation.';

describe('SCB1 VM refusal attribution', () => {
  it('maps the real preflight VM refusal at the failing route input', () => {
    const envelope = [0x53, 0x43, 0x42, 0x31, 2, 0, 1, ...Array(12).fill(0)];
    const builder = {
      inputs: [{
        txid: '00'.repeat(32), vout: 0, satoshis: 1000n,
        unlocker: {
          abiFunction: { selector: '53434231' },
          generateLockingBytecode: () => Uint8Array.of(0x00),
        },
      }],
    } as never;
    const tx = {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointTransactionHash: new Uint8Array(32),
        outpointIndex: 0,
        sequenceNumber: 0xffff_ffff,
        unlockingBytecode: push(envelope),
      }],
      outputs: [{ valueSatoshis: 900n, lockingBytecode: Uint8Array.of(0x51) }],
    } as never;
    expect(() => layer3.assertFinalizedTransactionCovenants(builder, tx)).toThrow(
      expect.objectContaining({
        code: 'L3_SCB_VERSION_UNSUPPORTED',
        context: expect.objectContaining({ inputIndex: 0, actual: 2, expected: 1 }),
      }),
    );
  });

  it('maps an unknown envelope version to its exact input while preserving the VM reason', () => {
    const error = layer3.mapLayer3VmFailure(
      routeBuilder, transaction([0x53, 0x43, 0x42, 0x31, 2, 0, 1, ...Array(12).fill(0)]), 0, raw,
    );
    expect(error).toMatchObject({
      code: 'L3_SCB_VERSION_UNSUPPORTED',
      context: {
        inputIndex: 0,
        rawVmReason: raw,
        metadataField: 'SCB1.version',
        actual: 2,
        expected: 1,
      },
    });
    expect(error.message).toContain(raw);
  });

  it.each([
    ['bad magic', [0, 0, 0, 0, 1, 0, 1, ...Array(12).fill(0)]],
    ['truncated row', [0x53, 0x43, 0x42, 0x31, 1, 0, 1]],
    ['invalid flags', [0x53, 0x43, 0x42, 0x31, 1, 1, 1, ...Array(12).fill(0)]],
  ])('maps %s to a malformed-envelope refusal', (_label, payload) => {
    const error = layer3.mapLayer3VmFailure(routeBuilder, transaction(payload), 0, raw);
    expect(error).toMatchObject({
      code: 'L3_SCB_ENVELOPE_MALFORMED',
      context: {
        inputIndex: 0,
        rawVmReason: raw,
        metadataField: 'SCB1.envelope',
      },
    });
    expect(error.message).toContain(raw);
  });

  it('leaves valid SCB1 and non-route covenant objections byte-compatible', () => {
    const valid = transaction([0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)]);
    expect(layer3.mapLayer3VmFailure(routeBuilder, valid, 0, raw).message)
      .toBe(`layer3: BCH-2026 preflight failed at input 0: ${raw}`);
    expect(layer3.mapLayer3VmFailure({ inputs: [{}] } as never, valid, 0, raw).message)
      .toBe(`layer3: BCH-2026 preflight failed at input 0: ${raw}`);
  });

  it('maps a VM-priced resource refusal without discarding its raw reason', () => {
    const reason = 'Operation cost limit exceeded: 12000 exceeds maximum 10000.';
    const valid = transaction([0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)]);
    expect(layer3.mapLayer3VmFailure(routeBuilder, valid, 0, reason)).toMatchObject({
      code: 'L3_VM_RESOURCE_LIMIT',
      context: expect.objectContaining({
        inputIndex: 0, resourceIdentity: 'input:0', measured: 12000, limit: 10000, rawVmReason: reason,
      }),
    });
  });
});
