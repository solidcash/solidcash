import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract AliasedFiniteKeys() {
  mapping(int => int) records;
  function apply(int count, int base) public {
    int[3] memory source;
    source[0] = base;
    source[1] = base + 2;
    source[2] = base + 4;
    int[3] memory keys = source;
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

describe('fixed local array key aliases', () => {
  it('matches legacy alias order and preserves runtime index bounds', async () => {
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
        ? contract.batch([{ function: 'apply', args: [3n, 90n] }])
        : contract.call.apply(3n, 90n);
      await expect(apply.send()).resolves.toBeDefined();
      for (const [key, value] of [[90n, 20n], [92n, 21n], [94n, 22n]] as const) {
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
    await expect(contract.batch([{ function: 'apply', args: [4n, 110n] }]).send())
      .rejects.toThrow();
  }, 180_000);
});
