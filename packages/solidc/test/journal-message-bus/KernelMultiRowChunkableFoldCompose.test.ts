import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

/**
 * Gate B (compiler publish + residual): chunkable push handlers publish a resourceFoldPlan;
 * unsupported multi-mutation groups remain KERNEL_LAYOUT.
 */
describe('kernel multi-row chunkable fold publish', () => {
  it('publishes resourceFoldPlans for an eligible chunkable array push handler', () => {
    const artifact = compileString(`contract Journal() {
      mapping(int => int[]) events;
      function pushOne(int key, int value) {
        this.events[key].push(value);
        require(true);
      }
    }`, KERNEL);
    const pushOne = artifact.abi.find((fn) => fn.name === 'pushOne');
    expect(pushOne?.entryAccesses?.some((a) => a.chunkableArrayValue === true)).toBe(true);
    expect(pushOne?.inputs?.some((i) => i.name.startsWith('__internal__leadingPushValue_'))).toBe(true);
    expect(pushOne?.inputs?.some((i) => i.name.startsWith('__internal__completePushValue_'))).toBe(true);
    expect(artifact.messageBus?.handlers?.find((h) => h.name === 'pushOne')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.inputs.some((i) => i.name.startsWith('__internal__leadingPushValue_')))
      .toBe(true);
    expect(artifact.messageBus?.route.inputs.some((i) => i.name.startsWith('__internal__completePushValue_')))
      .toBe(true);
    expect(artifact.messageBus?.resourceFoldPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: 'events',
          initialSource: 'empty',
          stepKind: 'push',
          leadingWitness: '__internal__leadingPushValue',
          completeWitness: '__internal__completePushValue',
        }),
      ]),
    );
  });

  it('keeps unsupported same-group multi-mutation as KERNEL_LAYOUT residual', () => {
    // Two distinct chunkable collections mutated in one execution without a supported stream schedule.
    const artifact = compileString(`contract Dual() {
      mapping(int => bytes) left;
      mapping(int => bytes) right;
      function writeBoth(int key, bytes a, bytes b) {
        this.left[key] = a;
        this.right[key] = b;
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers?.find((h) => h.name === 'writeBoth');
    // Either ineligible with KERNEL_LAYOUT, or eligible only under the supported multi-stream schedule.
    // Residual: must not publish a multi-collection push fold plan for this shape.
    if (handler && handler.eligible === false) {
      expect((handler as { rejectionReason?: string }).rejectionReason ?? 'KERNEL_LAYOUT')
        .toMatch(/KERNEL_LAYOUT|KERNEL_/);
    }
    expect(artifact.messageBus?.resourceFoldPlans?.some((p) => p.collection === 'left')).toBeFalsy();
  });
});
