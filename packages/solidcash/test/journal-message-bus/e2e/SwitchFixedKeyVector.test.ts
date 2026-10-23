import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract SwitchedFiniteKeys() {
  mapping(int => int) records;
  function apply(int count, int base, int mode) public {
    int[3] memory keys;
    keys[0] = base;
    switch (mode) {
      case 0: keys[1] = base + 2; break;
      case 1: keys[1] = base + 3; break;
      default: keys[1] = base + 5;
    }
    keys[2] = base + 6;
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

describe('switch fixed key vectors', () => {
  it('matches legacy case/default choice and preserves runtime index bounds', async () => {
    const scenarios = [
      { base: 500n, mode: 0n, selected: 502n, untaken: [503n, 505n] },
      { base: 600n, mode: 1n, selected: 603n, untaken: [602n, 605n] },
      { base: 700n, mode: 9n, selected: 705n, untaken: [702n, 703n] },
    ] as const;
    for (const { base, mode, selected, untaken } of scenarios) {
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
          ? contract.batch([{ function: 'apply', args: [3n, base, mode] }])
          : contract.call.apply(3n, base, mode);
        await expect(apply.send()).resolves.toBeDefined();
        for (const [key, value] of [
          [base, 20n], [selected, 21n], [base + 6n, 22n],
          ...untaken.map((unselectedKey) => [unselectedKey, 0n] as const),
        ] as const) await expect(contract.call.check(key, value).send()).resolves.toBeDefined();
      }
    }

    const provider = createTestProvider();
    const artifact = compile(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'apply', args: [4n, 800n, 1n] }]).send())
      .rejects.toThrow();
  }, 180_000);
});
