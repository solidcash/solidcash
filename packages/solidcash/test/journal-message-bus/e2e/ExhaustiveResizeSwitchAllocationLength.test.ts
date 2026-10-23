import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const source = (kernel: boolean): string => `contract ExhaustiveResizeSwitchKeys() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base, int allocationLength, int mode) public {
    ${kernel ? `int[] memory domain = new int[](allocationLength);
    switch (mode) {
      case 0: domain.push(base + 20); break;
      case 1: domain.push(base + 30); domain.push(base + 31); break;
      default: domain.push(base + 40); domain.push(base + 41); domain.pop();
    }` : ''}
    int[] memory keys = new int[](count);
    fill(keys, base, ${kernel ? 'domain.length' : 'allocationLength + (mode == 1 ? 2 : 1)'});
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 50;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

const compile = (kernel: boolean): ReturnType<typeof compileString> => {
  const failures: unknown[] = [];
  const artifact = compileString(source(kernel), {
    forceStateful: true,
    messageBus: true,
    messageBusKernel: kernel,
    maximumInputBytes: 1_000_000,
    ...(kernel && {
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    }),
  });
  if (kernel) expect(failures).toEqual([]);
  return artifact;
};

describe('exhaustive finite resize switches', () => {
  it('matches legacy for every selected arm and preserves source bounds failures', async () => {
    const scenarios = [
      { mode: 0n, count: 3n, base: 1100n, length: 2n },
      { mode: 1n, count: 3n, base: 1200n, length: 1n },
      { mode: 7n, count: 3n, base: 1300n, length: 2n },
    ] as const;
    for (const { mode, count, base, length } of scenarios) {
      for (const kernel of [false, true]) {
        const provider = createTestProvider();
        const artifact = compile(kernel);
        const inner = new Contract(artifact, [], { provider });
        const { categoryId } = await setupStatefulUtxos(
          provider, inner, artifact.stateLayout!, {}, { saltContract: true },
        );
        const contract = StatefulContract.withCategory(inner, categoryId);
        if (kernel) {
          expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
            .toContain('OP_INVOKE');
          expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
            .toMatchObject({ eligible: true });
        }
        const apply = kernel
          ? contract.batch([{ function: 'apply', args: [count, base, length, mode] }])
          : contract.call.apply(count, base, length, mode);
        await expect(apply.send()).resolves.toBeDefined();
        for (let cursor = 0n; cursor < count; cursor += 1n) {
          await expect(contract.call.check(base + cursor, cursor + 50n).send()).resolves.toBeDefined();
        }
      }
    }

    for (const kernel of [false, true]) {
      const provider = createTestProvider();
      const artifact = compile(kernel);
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      const apply = kernel
        ? contract.batch([{ function: 'apply', args: [2n, 1400n, 1n, 1n] }])
        : contract.call.apply(2n, 1400n, 1n, 1n);
      await expect(apply.send()).rejects.toThrow();
    }
  }, 180_000);
});
