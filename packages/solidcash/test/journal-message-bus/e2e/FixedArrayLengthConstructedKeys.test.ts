import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract FixedDomainKeys() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base) public {
    int[3] memory domain;
    int[] memory keys = new int[](count);
    fill(keys, base, domain.length);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 20;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

const compile = (kernel: boolean): ReturnType<typeof compileString> => {
  const failures: unknown[] = [];
  const artifact = compileString(SOURCE, {
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

describe('fixed-array length constructed keys', () => {
  it('matches legacy semantics and preserves source allocation bounds', async () => {
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
        ? contract.batch([{ function: 'apply', args: [3n, 70n] }])
        : contract.call.apply(3n, 70n);
      await expect(apply.send()).resolves.toBeDefined();
      for (const [key, value] of [[70n, 20n], [71n, 21n], [72n, 22n]] as const) {
        await expect(contract.call.check(key, value).send()).resolves.toBeDefined();
      }
    }

    const provider = createTestProvider();
    const artifact = compile(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'apply', args: [2n, 90n] }]).send())
      .rejects.toThrow();
  }, 180_000);
});
