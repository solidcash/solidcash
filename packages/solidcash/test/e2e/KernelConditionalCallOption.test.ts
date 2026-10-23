import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import type { CallDescriptor } from '../../src/message-bus/compose-prepared-invocation.js';
import { participantOf } from '../../src/message-bus/compose-participant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const KERNEL = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel conditional raw call options', () => {
  it('does not attach an inactive native-value branch to the selected token call', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const descriptor = async (source: string, functionName: string): Promise<CallDescriptor> => {
      const artifact = compileString(source, KERNEL);
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
      return { contract, artifact, functionName, args: [] };
    };
    const leaf = await descriptor(`pragma solidity ^0.8.20;
      contract Counter {
        uint public total;
        function store(uint value) public returns (bool) { total = value; return true; }
      }`, 'store');
    const selector = leaf.artifact.abi.find((fn) => fn.name === 'store')!.selector!;
    const root = await descriptor(`pragma solidity ^0.8.20;
      library Raw {
        function invoke(address target, bytes memory payload) internal returns (bytes memory) {
          (bool success, bytes memory result) = target.call(payload);
          require(success);
          return result;
        }
      }
      contract Router {
        function route(bool nativePayment, address payable recipient, address target, uint amount) public {
          if (nativePayment) {
            (bool success,) = recipient.call{value: amount}("");
            require(success);
          } else {
            bytes memory result = Raw.invoke(target, abi.encodeWithSelector(hex"${selector}", amount));
            require(result.length > 0);
          }
        }
      }`, 'route');
    root.args = [false, hexToBin('51'), hexToBin(leaf.contract.inner.lockingBytecode), 41n];
    leaf.args = [41n];
    const invocations = [
      { parent: null, callee: 0, function: 'route', args: root.args },
      { parent: 0, callee: 1, function: 'store', args: leaf.args, consumerCallsiteId: 0 },
    ];
    const plan = messageBus.planCompiledGraph([participantOf(root), participantOf(leaf)], invocations);
    expect(plan.invocations[1].callOptions).toBe(0);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({ preparedCalls: [root, { ...leaf, callsiteId: 0 }],
      funder, changeAddress: funder.unlocker.generateLockingBytecode() });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const original = builder.inputs[0].unlocker;
    if (!isContractUnlocker(original)) throw new Error('Missing router unlocker');
    const emissionIndex = original.abiFunction.inputs.findIndex((input) => input.name === '__internal__graphEmissions');
    const emission = original.params[emissionIndex];
    if (!(emission instanceof Uint8Array)) throw new Error('Missing authenticated emission');
    const forged = emission.slice();
    const modeOffset = 2 + forged[0] + (forged[1] << 8);
    expect(forged[modeOffset]).toBe(0);
    forged[modeOffset] = 2;
    const args = [...original.params];
    args[emissionIndex] = forged;
    builder.inputs[0].unlocker = original.contract.createCompilerRouteUnlocker(
      original.abiFunction, hexToBin(root.artifact.messageBus!.route.selector!),
    )(...args);
    expect(messageBusVmAccepts(builder)).toBe(false);
    builder.inputs[0].unlocker = original;
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect((await leaf.contract.getState()).total).toBe(41n);
  }, 180_000);
});
