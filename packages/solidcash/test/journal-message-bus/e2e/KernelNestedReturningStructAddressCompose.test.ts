/**
 * Graph-emission struct args with address fields (G2b).
 * Struct address leaves use the same solidity-compat ABI value-lane as top-level address args.
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

describe('kernel struct address-field graph-arg composition', () => {
  it('settles Peer{who,tag} when who is address(this) under ABI struct lanes', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const calleeArtifact = compileString(`pragma solidity ^0.8.0;
      struct Peer { address who; uint256 tag; }
      contract Callee {
        uint256 public hits;
        function act(Peer memory peer) public {
          require(peer.who != address(0));
          require(peer.tag > 0);
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
      struct Peer { address who; uint256 tag; }
      interface ICallee { function act(Peer memory peer) external; }
      contract Owner(address callee) {
        function apply() public {
          ICallee(callee).act(Peer({ who: address(this), tag: 7 }));
          require(true);
        }
      }`, KERNEL);
    expect(ownerArtifact.messageBus?.handlers.find((h) => h.name === 'apply')?.eligible).toBe(true);

    const ownerBase = new Contract(
      ownerArtifact,
      [callee.inner.lockingBytecode],
      { provider },
    );
    const ownerSetup = await setupStatefulUtxos(
      provider, ownerBase, ownerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const owner = StatefulContract.withCategory(
      ownerBase.withCategory(hexToBin(ownerSetup.categoryId)), ownerSetup.categoryId,
    );

    const callsite = ownerArtifact.abi.find((e) => e.name === 'apply')!
      .externalCalls!.find((c) => c.functionName === 'act');
    expect(callsite?.callsiteId).toBeTypeOf('number');
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: owner, functionName: 'apply', args: [] },
        {
          contract: callee, functionName: 'act',
          args: [{
            who: owner.inner.lockingBytecode instanceof Uint8Array
              ? owner.inner.lockingBytecode
              : hexToBin(owner.inner.lockingBytecode as string),
            tag: 7n,
          }],
          callsiteId: callsite!.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    expect(builder.inputs.length).toBeGreaterThanOrEqual(2);
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);

  it('settles a nested returning address inside a later struct graph argument', async () => {
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
      struct Peer { address who; uint256 tag; }
      contract Callee(address expected) {
        uint256 public hits;
        function act(Peer memory peer) public {
          require(peer.who == expected);
          require(peer.tag == 7);
          hits = hits + 1;
          require(true);
        }
      }`, KERNEL);
    const calleeBase = new Contract(calleeArtifact, [helper.inner.lockingBytecode], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { hits: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const ownerArtifact = compileString(`pragma solidity ^0.8.0;
      struct Peer { address who; uint256 tag; }
      interface IHelper { function who() external view returns (address); }
      interface ICallee { function act(Peer memory peer) external; }
      contract Owner(address helper, address callee) {
        function apply() public {
          ICallee(callee).act(Peer({ who: IHelper(helper).who(), tag: 7 }));
          require(true);
        }
      }`, KERNEL);
    expect(ownerArtifact.messageBus?.handlers.find((h) => h.name === 'apply')?.eligible).toBe(true);
    const ownerBase = new Contract(
      ownerArtifact, [helper.inner.lockingBytecode, callee.inner.lockingBytecode], { provider },
    );
    const ownerSetup = await setupStatefulUtxos(
      provider, ownerBase, ownerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const owner = StatefulContract.withCategory(
      ownerBase.withCategory(hexToBin(ownerSetup.categoryId)), ownerSetup.categoryId,
    );

    const calls = ownerArtifact.abi.find((entry) => entry.name === 'apply')!.externalCalls!;
    const whoCall = calls.find((call) => call.functionName === 'who');
    const actCall = calls.find((call) => call.functionName === 'act');
    expect(whoCall?.callsiteId).toBeTypeOf('number');
    expect(actCall?.callsiteId).toBeTypeOf('number');
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: owner, functionName: 'apply', args: [] },
        { contract: helper, functionName: 'who', args: [], callsiteId: whoCall!.callsiteId! },
        {
          contract: callee, functionName: 'act',
          args: [{ who: helper.inner.lockingBytecode, tag: 7n }],
          callsiteId: actCall!.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);
});
