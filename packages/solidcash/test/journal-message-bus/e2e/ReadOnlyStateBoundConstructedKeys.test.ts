import { compileString } from '@solidcash/solidc';
import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract StableBoundKeys() {
  int limit;
  mapping(int => int) records;
  function fill(int[] memory keys, int base, int stop) internal pure {
    for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base) public {
    int[] memory keys = new int[](count);
    fill(keys, base, this.limit);
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

describe('read-only state bounded constructed keys', () => {
  it('matches legacy partial-fill semantics and preserves source out-of-bounds failure', async () => {
    for (const kernel of [false, true]) {
      const provider = createTestProvider();
      const artifact = compile(kernel);
      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, { limit: 1n }, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);

      if (kernel) {
        expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
          .toContain('OP_INVOKE');
        expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
          .toMatchObject({ eligible: true });
      }
      const apply = kernel
        ? contract.batch([{ function: 'apply', args: [3n, 40n] }])
        : contract.call.apply(3n, 40n);
      await expect(apply.send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      await expect(contract.call.check(40n, 20n).send()).resolves.toBeDefined();
      await expect(contract.call.check(0n, 22n).send()).resolves.toBeDefined();
    }

    const provider = createTestProvider();
    const artifact = compile(true);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { limit: 4n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'apply', args: [3n, 90n] }]).send())
      .rejects.toThrow();

    const mutated = compileString(`contract MutatedBoundKeys() {
      int limit;
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int next) public {
        this.limit = next;
        int[] memory keys = new int[](count);
        fill(keys, base, this.limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 20;
        }
        require(true);
      }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(mutated.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  }, 180_000);
});
