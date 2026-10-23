/**
 * Nested returning uint feeds a later graph-emission argument (G1).
 * Stream head at consumer construction must consume the helper row first.
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

describe('kernel nested returning uint graph-arg composition', () => {
  it('settles a nested returning uint into a later graph call', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const helperArtifact = compileString(`pragma solidity ^0.8.0;
      contract Helper {
        function quote(uint256 n) public pure returns (uint256) { return n + 1; }
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
        uint256 public last;
        function act(uint256 n) public {
          last = n;
          require(n > 0);
          require(true);
        }
      }`, KERNEL);
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { last: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const ownerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IHelper { function quote(uint256 n) external pure returns (uint256); }
      interface ICallee { function act(uint256 n) external; }
      contract Owner(address helper, address callee) {
        function apply(uint256 n) public {
          ICallee(callee).act(IHelper(helper).quote(n));
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
    const n = 6n;
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: owner, functionName: 'apply', args: [n] },
        {
          contract: helper, functionName: 'quote', args: [n],
          callsiteId: calls.find((c) => c.functionName === 'quote')?.callsiteId ?? calls[0]!.callsiteId!,
        },
        {
          contract: callee, functionName: 'act',
          args: [n + 1n],
          callsiteId: calls.find((c) => c.functionName === 'act')?.callsiteId ?? calls[1]!.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    expect(builder.inputs.length).toBeGreaterThanOrEqual(3);
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);
});
