import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
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

describe('kernel staticcall / view compose', () => {
  // I5: explicit void `.staticcall()` under kernel compose. Batch wire carries SCB2 mode byte for
  // staticcall edges so MessageBusVerifier.spend accepts callManifestMode bit 0 (previously version-1
  // batches forced mode==0 and OP_VERIFYed). Typed void / value-returning view / SDK `.staticCall()` below.
  it('settles a foreign void peek via .staticcall() under kernel compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract ViewSink {
        function peek() public pure { require(true); }
      }`, KERNEL);
    expect(sinkArtifact.abi.find((entry) => entry.name === 'peek')).toBeDefined();
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IViewSink { function peek() external pure; }
      contract ViewCaller(address sink) {
        function invoke() public {
          IViewSink(sink).peek.staticcall();
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.abi.find((entry) => entry.name === 'invoke')
      ?.externalCalls?.find((call) => call.functionName === 'peek'))
      .toMatchObject({ callMode: 'staticcall' });
    const callerBase = new Contract(callerArtifact, [sink.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'invoke')!
      .externalCalls!.find((call) => call.functionName === 'peek')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'invoke', args: [] },
        { contract: sink, functionName: 'peek', args: [], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it('composes a typed foreign view read (Leaf→Root) with non-empty return commitments', async () => {
    // Value-returning view path under kernel (TwoHop pattern) — SDK .staticCall() covered below.
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILeaf { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function check(uint256 value) public view returns (uint256) {
          return ILeaf(leaf).read(value);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'check')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'check', args: [3n] },
        { contract: leaf, functionName: 'read', args: [3n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(builder)).toBe(true);
  }, 120_000);

  it('exposes SDK .staticCall() decode for a kernel view handler', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Counter {
        uint256 value;
        function set(uint256 next) public { value = next; require(true); }
        function get() public view returns (uint256) { return value; }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { value: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await sc.call.set(11n).send();
    await expect(sc.call.get().staticCall()).resolves.toBe(11n);
  }, 120_000);
});
