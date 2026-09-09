import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel finite helper abrupt domains', () => {
  it('publishes the derived recipe but fences multi-arm helper replay for beta', () => {
    const artifact = compileString(`contract HelperAbruptDomains() {
      mapping(int => int) records;
      function derive(int[] memory keys, int base, bool stop) internal pure {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
          if (cursor == 1) {
            if (stop) { break; } else { continue; }
          }
          keys[cursor] = base + cursor + 10;
        }
      }
      function apply(int count, int base, bool stop) public {
        int[] memory keys = new int[](count);
        derive(keys, base, stop);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 20;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'apply')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        collection: 'records',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      });
  });
});
