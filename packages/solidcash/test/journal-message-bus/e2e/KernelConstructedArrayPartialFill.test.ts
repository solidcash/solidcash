import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel constructed-array partial fill', () => {
  it('preserves default keys, complete fills, source OOB failure, and the authenticated domain', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract IndexedDomainReplay() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 20;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    const hostileCall = contract.batch([{ function: 'apply', args: [3n, 40n, 1n] }]);
    const hostileBuilder = await hostileCall.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const permutationName = handler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!.name;
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === permutationName);
    const rows = routeUnlocker.params[permutationIndex] as bigint[][];
    const hostileParams = [...routeUnlocker.params];
    hostileParams[permutationIndex] = [rows[0].slice(1)];
    hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    )(...hostileParams);
    const hostileTransaction = hostileBuilder.buildLibauthTransaction();
    const hostileVm = createVirtualMachineBch2026ForProvider(provider);
    expect(hostileVm.stateSuccess(hostileVm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(hostileBuilder.inputs),
      transaction: hostileTransaction,
    })), 'truncated source-domain permutation').not.toBe(true);

    await expect(contract.batch([{ function: 'apply', args: [3n, 40n, 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(40n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 22n).send()).resolves.toBeDefined();

    // A different complete source-domain permutation passes the generic range/duplicate proof. It must still
    // fail: the executable consumer reconstructs `keys[perm[rank]]`, hashes that exact key, and pins it to the
    // preplanned entry record. This is the on-chain binding which prevents an SDK-side replay descriptor from
    // substituting a same-domain, differently ordered producer vector.
    const fullCall = contract.batch([{ function: 'apply', args: [3n, 70n, 3n] }]);
    const fullBuilder = await fullCall.build();
    const fullRouteInputIndex = fullBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const fullRouteUnlocker = fullBuilder.inputs[fullRouteInputIndex].unlocker;
    if (!('params' in fullRouteUnlocker)) throw new Error('message-bus route input has no parameters');
    const fullRows = fullRouteUnlocker.params[permutationIndex] as bigint[][];
    expect(fullRows).toHaveLength(1);
    expect(fullRows[0]).toHaveLength(3);
    const reordered = [...fullRows[0]].reverse();
    expect(reordered).not.toEqual(fullRows[0]);
    const reorderedParams = [...fullRouteUnlocker.params];
    reorderedParams[permutationIndex] = [reordered];
    fullBuilder.inputs[fullRouteInputIndex].unlocker = fullRouteUnlocker.contract.createCompilerRouteUnlocker(
      fullRouteUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    )(...reorderedParams);
    const reorderedVm = createVirtualMachineBch2026ForProvider(provider);
    expect(reorderedVm.stateSuccess(reorderedVm.evaluate({
      inputIndex: fullRouteInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(fullBuilder.inputs),
      transaction: fullBuilder.buildLibauthTransaction(),
    })), 'same-domain reordered constructed-key permutation').not.toBe(true);
    fullBuilder.inputs[fullRouteInputIndex].unlocker = fullRouteUnlocker;

    await expect(fullCall.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(70n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(71n, 21n).send()).resolves.toBeDefined();
    await expect(contract.call.check(72n, 22n).send()).resolves.toBeDefined();

    await expect(contract.batch([{ function: 'apply', args: [3n, 90n, 4n] }]).send())
      .rejects.toThrow();
  }, 180_000);
});
