/**
 * Nested returning address feeds a later graph-emission address argument.
 * Graph address lanes use solidity ABI words so returned identities match authenticated args.
 */
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel nested returning address graph-arg composition', () => {
  it('settles a nested returning address into a later graph call beside address(this)', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const helperArtifact = compileString(`pragma solidity ^0.8.0;
      contract Helper {
        function who() public view returns (address) { return address(this); }
      }`, KERNEL);
    const helperBase = new Contract(helperArtifact, [], { provider });
    const helperSetup = await setupStatefulUtxos(
      provider, helperBase, helperArtifact.stateLayout!, {}, { saltContract: true },
    );
    const helper = StatefulContract.withCategory(
      helperBase.withCategory(hexToBin(helperSetup.categoryId)), helperSetup.categoryId,
    );

    const calleeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Callee {
        uint256 public hits;
        function act(address owner, address peer) public {
          require(owner != address(0));
          require(peer != address(0));
          hits = hits + 1;
          require(true);
        }
      }`, KERNEL);
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { hits: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const ownerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IHelper { function who() external view returns (address); }
      interface ICallee { function act(address owner, address peer) external; }
      contract Owner(address helper, address callee) {
        function apply() public {
          ICallee(callee).act(address(this), IHelper(helper).who());
          require(true);
        }
      }`, KERNEL);
    expect(ownerArtifact.messageBus?.handlers.find((h) => h.name === 'apply')?.eligible).toBe(true);

    const ownerBase = new Contract(
      ownerArtifact,
      [helper.inner.lockingBytecode, callee.inner.lockingBytecode],
      { provider },
    );
    const ownerSetup = await setupStatefulUtxos(
      provider, ownerBase, ownerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const owner = StatefulContract.withCategory(
      ownerBase.withCategory(hexToBin(ownerSetup.categoryId)), ownerSetup.categoryId,
    );

    const calls = ownerArtifact.abi.find((e) => e.name === 'apply')!.externalCalls!;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: owner, functionName: 'apply', args: [] },
        {
          contract: helper, functionName: 'who', args: [],
          callsiteId: calls.find((c) => c.functionName === 'who')?.callsiteId ?? calls[0]!.callsiteId!,
        },
        {
          contract: callee, functionName: 'act',
          args: [owner.inner.lockingBytecode, helper.inner.lockingBytecode],
          callsiteId: calls.find((c) => c.functionName === 'act')?.callsiteId ?? calls[1]!.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    expect(builder.inputs.length).toBeGreaterThanOrEqual(3);
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);

  it('keeps address-typed call-target args as native locks beside the nested-address settle', async () => {
    // Peer: poke(address store, …) / IStore(store).write — store is a call target, not an ABI word.
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Store {
        int public value;
        event Written(int n);
        function writeEmit(int n) public {
          value = n;
          emit Written(n);
          require(true);
        }
      }`, KERNEL);
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, { value: 0n }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IStore {
        function writeEmit(int n) external;
      }
      contract Caller {
        function poke(address store, int n) public {
          IStore(store).writeEmit(n);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((h) => h.name === 'poke')?.eligible).toBe(true);

    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeEmit');
    expect(callsite?.callsiteId).toBeTypeOf('number');

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        {
          contract: caller,
          functionName: 'poke',
          args: [store.inner.lockingBytecode, 7n],
        },
        {
          contract: store,
          functionName: 'writeEmit',
          args: [7n],
          callsiteId: callsite!.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    expect(builder.inputs.length).toBeGreaterThanOrEqual(2);
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);
});
