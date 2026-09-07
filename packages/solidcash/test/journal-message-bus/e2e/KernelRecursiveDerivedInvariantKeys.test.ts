import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

describe('recursive derived invariant mapping key authentication', () => {
  it('settles the derived tuple and rejects a forged value witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract Register() {
      mapping(int => mapping(int => int)) source;
      mapping(int => int) result;
      function seed(int outer, int inner, int value) public {
        this.source[outer][inner] = value;
        require(true);
      }
      function copy(int remaining, int scope) public returns (int) {
        if (remaining == 0) return 0;
        int terminal = copy(remaining - 1, scope);
        this.result[remaining] = this.source[remaining][scope + 1] + terminal;
        return terminal;
      }
      function check(int key, int expected) public { require(this.result[key] == expected); }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const scope = 8n;
    for (let outer = 1n; outer <= 3n; outer += 1n) {
      await contract.call.seed(outer, scope + 1n, outer + 10n).send();
    }

    const sourceRead = artifact.abi.find((candidate) => candidate.name === 'copy')?.sortedUpsertLoopInfo
      ?.find((stream) => stream.collection === 'source');
    expect(sourceRead).toMatchObject({ op: 'read', varyingKeyIndices: [0] });
    expect(sourceRead?.varyingKeyExpressions?.[1]).toMatchObject({ kind: 'binary', operator: '+' });
    const call = contract.batch([{ function: 'copy', args: [3n, scope] }]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const accepts = (): boolean => {
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
        vm.evaluate({ inputIndex, sourceOutputs, transaction }),
      ) === true);
    };
    expect(accepts()).toBe(true);

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const witnessIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === sourceRead?.oldValuesWitnessParam);
    expect(witnessIndex).toBeGreaterThanOrEqual(0);
    const witnessRows = routeUnlocker.params[witnessIndex] as bigint[][];
    const forgedParams = [...routeUnlocker.params];
    forgedParams[witnessIndex] = [[witnessRows[0][0] + 1n, ...witnessRows[0].slice(1)]];
    builder.inputs[routeInputIndex].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    )(...forgedParams);
    expect(accepts()).toBe(false);

    const canonical = await contract.batch([{ function: 'copy', args: [3n, scope] }]).send();
    expect(canonical.txid).toMatch(/^[0-9a-f]{64}$/);
    for (let key = 1n; key <= 3n; key += 1n) {
      await expect(contract.call.check(key, key + 10n).send()).resolves.toBeDefined();
    }
  }, 180_000);
});
