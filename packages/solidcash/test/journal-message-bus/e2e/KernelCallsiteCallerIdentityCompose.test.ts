import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
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

describe('kernel callsite caller identity under composition', () => {
  it('publishes active entry identity and settles Root→Callee with msg.sender equal to the root lock', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const calleeArtifact = compileString(`pragma solidity ^0.8.0;
      contract CallerIdentityCallee {
        function check(address expectedSender) public {
          require(msg.sender == expectedSender);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(calleeArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(calleeArtifact.abi.find((entry) => entry.name === 'check')?.usesMsgSender).toBe(true);

    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ICallerIdentityCallee {
        function check(address expectedSender) external;
      }
      contract CallerIdentityRoot(address callee) {
        function fire(address expectedSender) public {
          ICallerIdentityCallee(callee).check(expectedSender);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.convention).toBe('kernel-row-loop');
    const fireAbi = callerArtifact.abi.find((entry) => entry.name === 'fire')!;
    const checkCall = fireAbi.externalCalls!.find((call) => call.functionName === 'check')!;
    expect(checkCall.callerIdentity).toEqual({
      version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff,
    });

    const callerBase = new Contract(
      callerArtifact, [callee.inner.lockingBytecode], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const expectedSender = hexToBin(caller.inner.lockingBytecode);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'fire', args: [expectedSender] },
        {
          contract: callee,
          functionName: 'check',
          args: [expectedSender],
          callsiteId: checkCall.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);

  it('carries a nested CREATE identity through Middle→Leaf as msg.sender', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract IdentityLeaf {
        function check(address expectedSender) public {
          require(msg.sender == expectedSender);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );

    const middleArtifact = compileString(`pragma solidity ^0.8.0;
      interface IIdentityLeaf { function check(address expectedSender) external; }
      contract IdentityMiddle(address leaf) {
        function forward(address expectedSender) public {
          IIdentityLeaf(leaf).check(expectedSender);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const signer = new Signer(new Uint8Array(32).fill(0x59), provider);
    for (let index = 0; index < 8; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const middle = await getContractFactory(middleArtifact, signer).deploy(leaf.inner.lockingBytecode);
    const middleLogicalLock = binToHex(addressToLockScript(middle.target));
    expect(middleLogicalLock).not.toBe(middle.inner.lockingBytecode);

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface IIdentityMiddle { function forward(address expectedSender) external; }
      contract IdentityRoot(address middle) {
        function fire(address expectedSender) public {
          IIdentityMiddle(middle).forward(expectedSender);
          require(true);
        }
      }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [hexToBin(middleLogicalLock)], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );

    const rootToMiddle = rootArtifact.abi.find((entry) => entry.name === 'fire')!
      .externalCalls!.find((call) => call.functionName === 'forward')!;
    const middleToLeaf = middleArtifact.abi.find((entry) => entry.name === 'forward')!
      .externalCalls!.find((call) => call.functionName === 'check')!;
    expect(rootToMiddle.callerIdentity).toMatchObject({ role: 'active', authOffset: 0xffff });
    expect(middleToLeaf.callerIdentity).toMatchObject({ role: 'active', authOffset: 0xffff });

    const expectedSender = hexToBin(middleLogicalLock);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'fire', args: [expectedSender] },
        {
          contract: middle, functionName: 'forward', args: [expectedSender],
          callsiteId: rootToMiddle.callsiteId!,
        },
        {
          contract: leaf, functionName: 'check', args: [expectedSender],
          callsiteId: middleToLeaf.callsiteId!,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
