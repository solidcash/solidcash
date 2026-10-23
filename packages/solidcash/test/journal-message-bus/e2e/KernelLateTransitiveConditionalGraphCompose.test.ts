import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  registerDeployment,
  StatefulContract,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel late transitive conditional graph planning', () => {
  it('resolves a late P2SH32 target from an authenticated producer address result', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const targetArtifact = compileString(`pragma solidity ^0.8.0;
      contract ValueTarget {
        uint public stored;
        function store(uint value) public { stored = value; require(true); }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(
      provider, targetBase, targetArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );
    expect(target.inner.lockingBytecode).toMatch(/^aa20[0-9a-f]{64}87$/u);
    registerDeployment(provider, {
      contractName: targetArtifact.contractName,
      address: target.target,
      lockingBytecode: target.inner.lockingBytecode,
      contract: target,
    });

    const sourceArtifact = compileString(`pragma solidity ^0.8.0;
      contract TargetSource(address destination) {
        function resolve() public view returns (address) { return destination; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sourceBase = new Contract(sourceArtifact, [target.inner.lockingBytecode], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      interface ITargetSource { function resolve() external view returns (address); }
      interface IValueTarget { function store(uint value) external; }
      contract RouteCoordinator(address source) {
        function run(uint value) public {
          address destination = ITargetSource(source).resolve();
          destination.call(abi.encodeCall(IValueTarget.store, (value)));
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(coordinatorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const coordinatorCalls = coordinatorArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    expect(coordinatorCalls.map((call) => call.functionName)).toEqual(['resolve', '__raw__']);
    expect(coordinatorCalls[1]).toMatchObject({ interfaceName: '__raw__', rawFunctionName: 'store' });
    expect(coordinatorCalls[1]!.addressSource?.expression).toMatchObject({
      kind: 'producerResult',
      callsiteId: coordinatorCalls[0]!.callsiteId,
      resultIndex: 0,
    });
    const coordinatorBase = new Contract(
      coordinatorArtifact, [source.inner.lockingBytecode], { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    coordinator._registerResolvedExternal('ITargetSource', source);

    const relayArtifact = compileString(`pragma solidity ^0.8.0;
      interface IRouteCoordinator { function run(uint value) external; }
      contract EntryRelay(address coordinator) {
        function relay(uint value) public {
          IRouteCoordinator(coordinator).run(value);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const relayBase = new Contract(relayArtifact, [coordinator.inner.lockingBytecode], { provider });
    const relaySetup = await setupStatefulUtxos(
      provider, relayBase, relayArtifact.stateLayout!, {}, { saltContract: true },
    );
    const relay = StatefulContract.withCategory(
      relayBase.withCategory(hexToBin(relaySetup.categoryId)), relaySetup.categoryId,
    );
    relay._registerResolvedExternal('IRouteCoordinator', coordinator);

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      contract EntryRoot(address implementation) {
        function execute(bytes rawPayload) public {
          implementation.delegatecall(rawPayload);
          require(true);
        }
      }`, KERNEL);
    expect(rootArtifact.messageBus?.convention).toBe('kernel-row-loop');
    // The root is a foreign-delegate proxy: its own body is the pre-auth covenant and no helper reaches the
    // two-use floor, so there is no OP_INVOKE to look for. The published delegate forwarding is what states
    // that this route executes the implementation it was given as constructor argument 0.
    expect(rootArtifact.abi.find((entry) => entry.name === 'execute')?.delegateForwarding)
      .toMatchObject({ targetBinding: { kind: 'constructorArg', input: 0, name: 'implementation' } });
    const rootBase = new Contract(rootArtifact, [relay.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const payload = hexToBin(relayArtifact.abi.find((entry) => entry.name === 'relay')!.selector!);
    const call = root.call.execute(payload)
      .withCallerIdentity(hexToBin(root.inner.lockingBytecode), root.categoryId)
      .withCall(relay, 'relay', [41n]);
    const preparedBuilder = await (call as unknown as {
      _applyOverrides(): Promise<{
        getExternalCallUtxoGroups(): readonly Array<{
          logicalFunctionName?: string;
          logicalFunctionArgs?: unknown[];
          logicalContract?: StatefulContract;
          logicalArtifact?: ReturnType<typeof compileString>;
        }>;
      }>;
    })._applyOverrides();
    const lateTargetGroup = preparedBuilder.getExternalCallUtxoGroups()
      .find((group) => group.logicalFunctionName === 'store');
    expect(lateTargetGroup?.logicalFunctionArgs).toEqual([41n]);
    expect(lateTargetGroup?.logicalContract).toBe(target);
    expect(lateTargetGroup?.logicalArtifact).toBe(targetArtifact);
    const builder = await call.build();
    const participantContracts = builder.inputs.flatMap((input) => (
      'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
    ));
    expect(participantContracts.filter((name) => name === 'EntryRelay')).toHaveLength(1);
    expect(participantContracts.filter((name) => name === 'RouteCoordinator')).toHaveLength(1);
    expect(participantContracts.filter((name) => name === 'TargetSource')).toHaveLength(1);
    expect(participantContracts.filter((name) => name === 'ValueTarget')).toHaveLength(1);
    expect(vmAccepts(builder)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await target.getState()).stored).toBe(41n);
  }, 180_000);

  it.each([true, false])(
    'resolves producer-derived branch %s and fixed-array arguments before adding late callees',
    async (choose) => {
      const provider = createMessageBusCapstoneTestProvider();

      const producerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Decision { bool choose; uint16 left; uint16 right; }
      contract LateDecisionProducer {
        function decide(bool choose) public pure returns (Decision memory) {
          return Decision(choose, 7, 9);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
      const producerBase = new Contract(producerArtifact, [], { provider });
      const producerSetup = await setupStatefulUtxos(
        provider, producerBase, producerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const producer = StatefulContract.withCategory(
        producerBase.withCategory(hexToBin(producerSetup.categoryId)), producerSetup.categoryId,
      );

      const leftArtifact = compileString(`pragma solidity ^0.8.0;
      contract LateLeftBranch {
        function select(uint16[2] memory values) public pure returns (uint16) {
          return values[0] * 10 + values[1];
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
      const leftBase = new Contract(leftArtifact, [], { provider });
      const leftSetup = await setupStatefulUtxos(
        provider, leftBase, leftArtifact.stateLayout!, {}, { saltContract: true },
      );
      const left = StatefulContract.withCategory(
        leftBase.withCategory(hexToBin(leftSetup.categoryId)), leftSetup.categoryId,
      );

      const rightArtifact = compileString(`pragma solidity ^0.8.0;
      contract LateRightBranch {
        function select(uint16[2] memory values) public pure returns (uint16) {
          return values[0] * 10 + values[1];
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
      const rightBase = new Contract(rightArtifact, [], { provider });
      const rightSetup = await setupStatefulUtxos(
        provider, rightBase, rightArtifact.stateLayout!, {}, { saltContract: true },
      );
      const right = StatefulContract.withCategory(
        rightBase.withCategory(hexToBin(rightSetup.categoryId)), rightSetup.categoryId,
      );

      const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract LateResultSink {
        uint16 public seen;
        function record(uint16 value) public { seen = value; require(true); }
      }`, { ...KERNEL, messageBusGraphContext: true });
      const sinkBase = new Contract(sinkArtifact, [], { provider });
      const sinkSetup = await setupStatefulUtxos(
        provider, sinkBase, sinkArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
      );
      const sink = StatefulContract.withCategory(
        sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
      );

      const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      struct Decision { bool choose; uint16 left; uint16 right; }
      interface ILateDecisionProducer {
        function decide(bool choose) external view returns (Decision memory);
      }
      interface ILateLeftBranch {
        function select(uint16[2] memory values) external view returns (uint16);
      }
      interface ILateRightBranch {
        function select(uint16[2] memory values) external view returns (uint16);
      }
      interface ILateResultSink { function record(uint16 value) external; }
      contract LateCoordinator(address producer, address left, address right, address sink) {
        function values(uint16 first, uint16 second) internal pure returns (uint16[2] memory) {
          uint16[2] memory result;
          result[0] = first;
          result[1] = second;
          return result;
        }
        function run(bool choose) public {
          Decision memory decision = ILateDecisionProducer(producer).decide(choose);
          uint16 selected;
          if (decision.choose) {
            selected = ILateLeftBranch(left).select(values(decision.left, decision.right));
          } else {
            selected = ILateRightBranch(right).select(values(decision.right, decision.left));
          }
          ILateResultSink(sink).record(selected);
          require(selected == (choose ? 79 : 97));
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
      expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
      expect(coordinatorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
      const coordinatorBase = new Contract(coordinatorArtifact, [
        producer.inner.lockingBytecode,
        left.inner.lockingBytecode,
        right.inner.lockingBytecode,
        sink.inner.lockingBytecode,
      ], { provider });
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
      );
      coordinator._registerResolvedExternal('ILateDecisionProducer', producer);
      coordinator._registerResolvedExternal('ILateLeftBranch', left);
      coordinator._registerResolvedExternal('ILateRightBranch', right);
      coordinator._registerResolvedExternal('ILateResultSink', sink);

      const relayArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILateCoordinator { function run(bool choose) external; }
      contract LateRelay(address coordinator) {
        function relay(bool choose) public {
          ILateCoordinator(coordinator).run(choose);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
      const relayBase = new Contract(relayArtifact, [coordinator.inner.lockingBytecode], { provider });
      const relaySetup = await setupStatefulUtxos(
        provider, relayBase, relayArtifact.stateLayout!, {}, { saltContract: true },
      );
      const relay = StatefulContract.withCategory(
        relayBase.withCategory(hexToBin(relaySetup.categoryId)), relaySetup.categoryId,
      );
      relay._registerResolvedExternal('ILateCoordinator', coordinator);

      const rootArtifact = compileString(`pragma solidity ^0.8.0;
      contract LateRoot(address implementation) {
        function execute(bytes rawPayload) public {
          implementation.delegatecall(rawPayload);
          require(true);
        }
      }`, KERNEL);
      expect(rootArtifact.messageBus?.convention).toBe('kernel-row-loop');
      // The root is a foreign-delegate proxy: its own body is the pre-auth covenant and no helper reaches the
      // two-use floor, so there is no OP_INVOKE to look for. The published delegate forwarding is what states
      // that this route executes the implementation it was given as constructor argument 0.
      expect(rootArtifact.abi.find((entry) => entry.name === 'execute')?.delegateForwarding)
        .toMatchObject({ targetBinding: { kind: 'constructorArg', input: 0, name: 'implementation' } });
      const rootBase = new Contract(rootArtifact, [relay.inner.lockingBytecode], { provider });
      const rootSetup = await setupStatefulUtxos(
        provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
      );
      const root = StatefulContract.withCategory(
        rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
      );
      expect(rootArtifact.abi.find((entry) => entry.name === 'execute')!.lowLevelCalls).toHaveLength(1);
      const coordinatorCalls = coordinatorArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
      expect(coordinatorCalls.map((call) => call.functionName))
        .toEqual(['decide', 'select', 'select', 'record']);
      expect(coordinatorCalls.slice(1, 3).every((call) => call.occurrence === 'conditional')).toBe(true);

      const payload = hexToBin(relayArtifact.abi.find((entry) => entry.name === 'relay')!.selector!);
      const builder = await root.call.execute(payload).withCall(relay, 'relay', [choose]).build();
      const participantContracts = builder.inputs.flatMap((input) => (
        'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
      ));
      expect(participantContracts.filter((name) => name === 'LateRelay')).toHaveLength(1);
      expect(participantContracts.filter((name) => name === 'LateCoordinator')).toHaveLength(1);
      expect(participantContracts.filter((name) => name === 'LateDecisionProducer')).toHaveLength(1);
      const activeBranch = choose ? 'LateLeftBranch' : 'LateRightBranch';
      const inactiveBranch = choose ? 'LateRightBranch' : 'LateLeftBranch';
      expect(participantContracts.filter((name) => name === activeBranch)).toHaveLength(1);
      expect(participantContracts).not.toContain(inactiveBranch);
      expect(participantContracts.filter((name) => name === 'LateResultSink')).toHaveLength(1);
      expect(vmAccepts(builder)).toBe(true);
    },
    180_000,
  );
});
