import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SCALAR_SOURCE = `contract ExactOverload() {
  function element(int base) internal pure returns (int) { return base + 2; }
  function element(bigint base) internal pure returns (bigint) { return base + 100; }
  function verify(int base) public { require(element(base) == base + 2); }
}`;

const FIXED_SOURCE = `contract ExactOverload() {
  mapping(int => int) records;
  function element(int base) internal pure returns (int) { return base + 2; }
  function element(bigint base) internal pure returns (bigint) { return base + 100; }
  function make(int base) internal pure returns (int[3] memory) {
    int[3] memory result;
    result[0] = base; result[1] = element(base); result[2] = base + 4;
    return result;
  }
  function apply(int count, int base) public {
    int[3] memory keys = make(base);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 20;
    }
    require(true);
  }
}`;

describe('overloaded pure internal calls', () => {
  it.each([
    ['direct', false, false],
    ['legacy batch', true, false],
    ['kernel batch', true, true],
  ] as const)('executes the exact semantic overload on the %s path', async (_name, messageBus, kernel) => {
    const provider = createTestProvider();
    const failures: unknown[] = [];
    const artifact = compileString(SCALAR_SOURCE, {
      forceStateful: true,
      messageBus,
      messageBusKernel: kernel,
      maximumInputBytes: 1_000_000,
      ...(kernel && {
        __artifactCache: false,
        __strictNoInternalRecovery: true,
        __attemptFailureBox: { failures },
      }),
    });
    if (kernel) expect(failures).toEqual([]);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = messageBus
      ? contract.batch([{ function: 'verify', args: [7n] }])
      : contract.call.verify(7n);
    await expect(call.send()).resolves.toBeDefined();
  }, 180_000);

  it.each([
    ['legacy direct', true, false],
    ['kernel batch', true, true],
  ] as const)('keeps the exact overload through a fixed return on the %s path',
    async (name, messageBus, kernel) => {
      const provider = createTestProvider();
      const failures: unknown[] = [];
      const artifact = compileString(FIXED_SOURCE, {
        forceStateful: true, messageBus, messageBusKernel: kernel, maximumInputBytes: 1_000_000,
        ...(kernel && {
          __artifactCache: false,
          __strictNoInternalRecovery: true,
          __attemptFailureBox: { failures },
        }),
      });
      if (kernel) expect(failures).toEqual([]);
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      const call = name.endsWith('batch')
        ? contract.batch([{ function: 'apply', args: [3n, 10n] }])
        : contract.call.apply(3n, 10n);
      await expect(call.send()).resolves.toBeDefined();
    }, 180_000);
});
