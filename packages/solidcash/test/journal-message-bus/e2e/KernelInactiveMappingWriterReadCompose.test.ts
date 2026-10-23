import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { compose } from '../../../src/message-bus/index.js';
import { getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel inactive mapping writer beside selected read', () => {
  it.each([
    { key: 7n, present: true },
    { key: 8n, present: false },
  ])('counts a read-only record when another collection is written ($present)', async ({ key, present }) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Store() {
      mapping(int => int) members;
      mapping(int => int) results;
      event Recorded(int key);
      function seed(int key) public { this.members[key] = 1; require(true); }
      function exists(int key) public view returns (bool) { return this.members[key] > 0; }
      function touch(int key) public { this.results[key] = 1; emit Recorded(key); require(true); }
    }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    await store.call.seed(7n).send();

    const callerArtifact = compileString(`
      interface IStore {
        function exists(int key) external view returns (bool);
        function touch(int key) external;
      }
      contract Caller() {
        function run(address target, int key) public {
          IStore(target).exists(key);
          IStore(target).touch(key);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);
    const callsites = callerArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = compose({
      preparedCalls: [
        { contract: caller, functionName: 'run', args: [store.inner.lockingBytecode, key] },
        { contract: store, functionName: 'exists', args: [key], callsiteId: callsites[0].callsiteId },
        { contract: store, functionName: 'touch', args: [key], callsiteId: callsites[1].callsiteId },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await call.build();
    const memberLock = binToHex(addressToLockScript(getEntryNftAddress(store.inner, setup.categoryId, 'members')));
    const memberIndex = builder.inputs.findIndex((input) =>
      binToHex(input.unlocker.generateLockingBytecode()) === memberLock);
    expect(memberIndex).toBeGreaterThan(0);
    expect(builder.outputs[memberIndex].token).toEqual(builder.inputs[memberIndex].token);
    const transaction = builder.buildLibauthTransaction();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    })) === true)).toBe(true);
    transaction.outputs[memberIndex].token!.nft!.commitment = Uint8Array.of(0xff);
    expect(transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    })) !== true)).toBe(true);
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect(await store.call.exists(7n).staticCall()).toBe(true);
    expect(await store.call.exists(key).staticCall()).toBe(present);
  }, 120_000);
});
