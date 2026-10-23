import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract RuntimeArrayFill() {
  mapping(int => int) records;
  function fill(int[] memory keys, int base) internal pure {
    for (int cursor = 0; cursor < keys.length; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function apply(int count, int base) public {
    int[] memory keys = new int[](count);
    fill(keys, base);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 10;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

const INDEXED_DOMAIN_SOURCE = `contract IndexedRuntimeArrayFill() {
  mapping(int => int) records;
  function fillPartial(int[] memory keys, int base) internal pure {
    for (int cursor = 0; cursor < keys.length - 1; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }
  }
  function applyPartial(int count, int base) public {
    int[] memory keys = new int[](count);
    fillPartial(keys, base);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[keys[cursor]] = cursor + 10;
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.records[key] == expected); }
}`;

describe('runtime-sized full-array key fill BCH VM', () => {
  it('executes the exact derived domain and rejects missing or extra iterations', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const apply = artifact.abi.find((entry) => entry.name === 'apply')!;
    const permutationName = apply.sortedUpsertLoopInfo?.[0].varyingArrayParam;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
    expect(permutationName).toMatch(/^__internal__vmapCounterPerm_/);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [3n, 40n] }]);
    const builder = await call.build();
    const routeIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const unlocker = builder.inputs[routeIndex]?.unlocker;
    if (!unlocker || !('params' in unlocker)) throw new Error('kernel route input is missing');
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    const rowPermutation = (unlocker.params[permutationIndex] as bigint[][])[0];
    expect([...rowPermutation].sort((left, right) => Number(left - right))).toEqual([0n, 1n, 2n]);

    const original = unlocker;
    const recreate = unlocker.contract.createCompilerRouteUnlocker(
      unlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const hostile of [rowPermutation.slice(1), [...rowPermutation, 3n]]) {
      const params = [...unlocker.params];
      params[permutationIndex] = [hostile];
      builder.inputs[routeIndex].unlocker = recreate(...params);
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex: routeIndex,
        sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
        transaction: builder.buildLibauthTransaction(),
      })), `hostile domain ${hostile.join(',')}`).not.toBe(true);
    }
    builder.inputs[routeIndex].unlocker = original;

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    for (const [key, expected] of [[40n, 10n], [41n, 11n], [42n, 12n]] as const) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);

  it.each([
    ['partial', 'applyPartial', [3n, 40n], [[40n, 10n], [41n, 11n], [0n, 12n]]],
  ] as const)('persists the exact %s fill domain including its trailing default key', async (
    _label, functionName, args, expectedEntries,
  ) => {
    const provider = createTestProvider();
    const artifact = compileString(INDEXED_DOMAIN_SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === functionName))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: functionName, args: [...args] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (const [key, expected] of expectedEntries) {
      await expect(contract.call.check(key, expected).send()).resolves.toBeDefined();
    }
  }, 180_000);
});
