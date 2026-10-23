import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { participantOf } from '../../src/message-bus/compose-participant-helpers.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const OPTIONS = { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, suppressWarnings: true,
  maximumInputBytes: 1_000_000 } as const;

describe('kernel framedsite value effects', () => {
  it.each([false, true])('keeps getter and raw sibling value-free with mapping payment %s', async (enabled) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ICounter { function store(uint value) external returns (bool); }
      library Raw {
        function invoke(address target, uint value) internal returns (bytes memory) {
          (bool success, bytes memory data) = target.call(abi.encodeCall(ICounter.store, (value)));
          require(success); return data;
        }
      }
      contract Reader {
        uint public total;
        function read(uint key) public view returns (uint) { return total + key; }
      }
      contract Counter {
        uint public total;
        function store(uint value) public returns (bool) { total = value; return true; }
      }
      contract Router {
        struct Payment { address payable recipient; uint amount; bool enabled; }
        mapping(uint => Payment) payments;
        function seed(uint key, address payable recipient, uint amount, bool enabled) public {
          payments[key] = Payment(recipient, amount, enabled); require(true);
        }
        function route(uint key, address reader, address target) public {
          Payment memory payment = payments[key];
          uint result = IReader(reader).read(key);
          require(result == key);
          if (payment.enabled) {
            (bool success,) = payment.recipient.call{value: payment.amount}("");
            require(success);
          } else {
            bytes memory data = Raw.invoke(target, payment.amount);
            require(data.length > 0);
          }
        }
      }`, OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
    await provider.addUtxo(signer.getAddress(), { txid: 'ad'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const connect = async (artifact: Artifact): Promise<StatefulContract> => {
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId)
        .connect(signer);
    };
    const router = await connect(artifacts.Router);
    const reader = await connect(artifacts.Reader);
    const counter = await connect(artifacts.Counter);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const recipient = funder.unlocker.generateLockingBytecode();
    await router.call.seed(7n, recipient, 2_000n, enabled).send();
    if (enabled) await provider.addUtxo(getSatoshiContainerAddress(router.inner, router.categoryId), {
      txid: 'ae'.repeat(32), vout: 0, satoshis: 30_000n,
    });
    const calls = [
      { contract: router, artifact: artifacts.Router, functionName: 'route',
        args: [7n, hexToBin(reader.inner.lockingBytecode), hexToBin(counter.inner.lockingBytecode)] },
      { contract: reader, artifact: artifacts.Reader, functionName: 'read', args: [7n], callsiteId: 0 },
      ...(!enabled ? [{ contract: counter, artifact: artifacts.Counter,
        functionName: 'store', args: [2_000n], callsiteId: 1 }] : []),
    ];
    const invocations = calls.map((call, index) => ({ parent: index === 0 ? null : 0, callee: index,
      function: call.functionName, args: call.args, consumerCallsiteId: call.callsiteId }));
    const plan = messageBus.planCompiledGraph(calls.map((call) => participantOf(call)), invocations);
    expect(plan.invocations.map((row) => row.callOptions)).toEqual(enabled ? [0, 0] : [0, 0, 0]);
    const composition = messageBus.compose({ preparedCalls: calls, funder, changeAddress: recipient });
    expect(messageBusVmAccepts(await composition.build())).toBe(true);
    await composition.send();
    expect((await counter.getState()).total).toBe(enabled ? 0n : 2_000n);
  }, 180_000);

  it('retains and authenticates the value flag on a genuine nonempty raw call', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function store(uint value) external returns (bool); }
      contract Sink {
        uint public total;
        function store(uint value) public returns (bool) { total = value; return true; }
      }
      contract Payer {
        function pay(address target, uint amount) public {
          (bool success, bytes memory data) = target.call{value: amount}(abi.encodeCall(ISink.store, (amount)));
          require(success && data.length > 0);
        }
      }`, OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const connect = async (artifact: Artifact): Promise<StatefulContract> => {
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const sink = await connect(artifacts.Sink);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'be'.repeat(32), vout: 0, satoshis: 30_000n,
    });
    const calls = [
      { contract: payer, artifact: artifacts.Payer, functionName: 'pay',
        args: [hexToBin(sink.inner.lockingBytecode), 2_000n] },
      { contract: sink, artifact: artifacts.Sink, functionName: 'store', args: [2_000n], callsiteId: 0 },
    ];
    const invocations = calls.map((call, index) => ({ parent: index === 0 ? null : 0, callee: index,
      function: call.functionName, args: call.args, consumerCallsiteId: call.callsiteId }));
    const participants = calls.map((call) => participantOf(call));
    expect(messageBus.planCompiledGraph(participants, invocations).invocations[1].callOptions).toBe(2);
    const stale = structuredClone(artifacts.Payer);
    delete stale.abi.find((fn) => fn.name === 'pay')!.externalCalls![0].callValueEffect;
    expect(() => messageBus.planCompiledGraph([{ ...participants[0], artifact: stale }, participants[1]], invocations))
      .toThrow(/omits framedsite value metadata/);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({ preparedCalls: calls, funder,
      changeAddress: funder.unlocker.generateLockingBytecode() });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const original = builder.inputs[0].unlocker;
    if (!isContractUnlocker(original)) throw new Error('Missing payer unlocker');
    const emissionIndex = original.abiFunction.inputs.findIndex((input) => input.name === '__internal__graphEmissions');
    const emission = original.params[emissionIndex];
    if (!(emission instanceof Uint8Array)) throw new Error('Missing authenticated emission');
    const forged = emission.slice();
    const modeOffset = 2 + forged[0] + (forged[1] << 8);
    expect(forged[modeOffset]).toBe(2);
    forged[modeOffset] = 0;
    const args = [...original.params];
    args[emissionIndex] = forged;
    builder.inputs[0].unlocker = original.contract.createCompilerRouteUnlocker(
      original.abiFunction, hexToBin(artifacts.Payer.messageBus!.route.selector!),
    )(...args);
    expect(messageBusVmAccepts(builder)).toBe(false);
    builder.inputs[0].unlocker = original;
    const transfer = builder.outputs.find((output) => !output.token && output.amount === 2_000n)!;
    expect(transfer).toBeDefined();
    transfer.amount += 1n;
    expect(messageBusVmAccepts(builder)).toBe(false);
    transfer.amount -= 1n;
    await composition.send();
    expect((await sink.getState()).total).toBe(2_000n);
  }, 180_000);
});
