import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel finite helper abrupt-domain composition', () => {
  it('keeps continue local to its iteration, terminates on break, and rejects a forged source domain', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract HelperAbruptDomainCompose() {
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
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    const hostileCall = contract.batch([{ function: 'apply', args: [3n, 40n, false] }]);
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

    await expect(contract.batch([{ function: 'apply', args: [3n, 40n, false] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(50n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(41n, 21n).send()).resolves.toBeDefined();
    await expect(contract.call.check(52n, 22n).send()).resolves.toBeDefined();

    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'apply', args: [3n, 70n, true] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(80n, 20n).send()).resolves.toBeDefined();
    await expect(contract.call.check(71n, 21n).send()).resolves.toBeDefined();
    await expect(contract.call.check(0n, 22n).send()).resolves.toBeDefined();
  }, 180_000);
});
