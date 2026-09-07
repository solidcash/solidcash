import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

type KernelHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handler = (helper: string, call: string): KernelHandler | undefined => compileString(`contract C() {
  mapping(bigint => int) slots;
  ${helper}
  function write(int count, int runtimeLimit) public {
    bigint[] memory keys = new bigint[](count);
    ${call}
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(count == 2);
  }
}`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'write');

const finite = `
  function fill(bigint[] memory keys, bigint[] memory alias, bigint base, bigint remaining) internal pure {
    if (remaining == 0) { return; }
    alias.push(base + remaining + 20);
    fill(keys, alias, base, remaining - 1);
    keys.pop();
    keys[remaining - 1] = base + remaining;
  }
`;

describe('finite recursive constructed-array AST specialization', () => {
  it('materializes selected frames in source order with shared push/pop alias identity', () => {
    expect(handler(finite, 'fill(keys, keys, 50, 2);')).toMatchObject({ eligible: true });
  });

  it('treats literal-selected natural function fallthrough as the void recursive base case', () => {
    expect(handler(`
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (remaining > 0) {
          keys[remaining - 1] = base + remaining;
          fill(keys, base, remaining - 1);
        }
      }
    `, 'fill(keys, 50, 2);')).toMatchObject({ eligible: true });
  });

  it('specializes an in-range bounded countdown while forwarding an invariant runtime scalar', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, uint8 remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base, remaining - 1);
        keys[remaining - 1] = base + remaining;
      }
      function write(int count, int base) public {
        int[] memory keys = new int[](count);
        fill(keys, base, uint8(2));
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(count == 2);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .varyingKeyExpressions).toEqual([expect.objectContaining({ kind: 'ternary' })]);
  });

  it('snapshots an invariant runtime expression once before specializing recursive frames', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, uint8 remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base, remaining - 1);
        keys[remaining - 1] = base + remaining;
      }
      function write(int count, int seed, int offset) public {
        int[] memory keys = new int[](count);
        fill(keys, seed * 2 + offset, uint8(2));
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(count == 2);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('does not mistake nested-block fallthrough for termination before a later recursive edge', () => {
    expect(handler(`
      function fill(bigint[] memory keys, bigint remaining) internal pure {
        if (remaining > 0) { keys[remaining - 1] = remaining; }
        fill(keys, remaining - 1);
      }
    `, 'fill(keys, 2);')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it.each([
    ['runtime scalar', finite, 'fill(keys, keys, 50, runtimeLimit);'],
    ['no progress', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base, remaining);
        keys[0] = base;
      }
    `, 'fill(keys, 50, 2);'],
    ['negative divergence', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base, remaining - 1);
        keys[0] = base;
      }
    `, 'fill(keys, 50, -1);'],
    ['duplicate branching', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base, remaining - 1);
        fill(keys, base, remaining - 1);
      }
    `, 'fill(keys, 50, 2);'],
    ['abrupt continue', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        for (int once = 0; once < 1; once = once + 1) { continue; }
        if (remaining == 0) { return; }
        fill(keys, base, remaining - 1);
        keys[remaining - 1] = base + remaining;
      }
    `, 'fill(keys, 50, 2);'],
    ['resource selector', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (tx.inputs.length == 0) { return; }
        fill(keys, base, remaining - 1);
        keys[remaining - 1] = base + remaining;
      }
    `, 'fill(keys, 50, 2);'],
    ['non-literal natural termination', `
      function fill(bigint[] memory keys, bigint remaining) internal pure {
        if (remaining > 0) {
          keys[remaining - 1] = remaining;
          fill(keys, remaining - 1);
        }
      }
    `, 'fill(keys, runtimeLimit);'],
    ['changing runtime scalar', `
      function fill(bigint[] memory keys, bigint base, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        fill(keys, base + 1, remaining - 1);
        keys[remaining - 1] = base;
      }
    `, 'fill(keys, bigint(runtimeLimit), 2);'],
  ])('keeps %s fenced', (_name, helper, call) => {
    expect(handler(helper, call)).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('keeps mutual recursion fenced', () => {
    expect(handler(`
      function a(bigint[] memory keys, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        b(keys, remaining - 1);
        keys[remaining - 1] = remaining;
      }
      function b(bigint[] memory keys, bigint remaining) internal pure {
        if (remaining == 0) { return; }
        a(keys, remaining - 1);
        keys[remaining - 1] = remaining;
      }
    `, 'a(keys, 2);')).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps natural-fallthrough specialization within 256 frames', () => {
    const helper = `
      function fill(bigint[] memory keys, bigint remaining) internal pure {
        if (remaining > 0) {
          fill(keys, remaining - 1);
          keys[0] = remaining;
        }
      }
    `;
    expect(handler(helper, 'fill(keys, 257);')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('does not erase checked overflow in a recursive scalar argument', () => {
    expect(handler(`
      function fill(bigint[] memory keys, int8 remaining, int8 other) internal pure {
        if (remaining == 0) { return; }
        fill(keys, remaining - 1, other - 1);
        keys[remaining - 1] = other;
      }
    `, 'fill(keys, int8(1), int8(-128));')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('does not erase checked overflow hidden by a later arithmetic operation', () => {
    expect(handler(`
      function fill(bigint[] memory keys, uint8 remaining, uint8 other) internal pure {
        if (remaining == 0) { return; }
        fill(keys, remaining - 1, (other + 1) - 1);
        keys[remaining - 1] = other;
      }
    `, 'fill(keys, uint8(1), uint8(255));')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });
});
