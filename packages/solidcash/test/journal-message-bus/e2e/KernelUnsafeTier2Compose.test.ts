import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  type TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel unsafe tier-2 composition', () => {
  it('executes a read-only validation row and rejects a forged state commitment', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const guardedArtifact = compileString(`contract GuardedState() {
      int stored;
      function validate(int expected) unsafe(2) { require(this.stored == expected); }
    }`, KERNEL);
    const coordinatorArtifact = compileString(`interface IGuardedState {
      function validate(int expected);
    }
    contract Coordinator() {
      function execute(address target, int expected) public {
        IGuardedState(target).validate(expected);
        require(true);
      }
    }`, KERNEL);
    expect(guardedArtifact.messageBus?.handlers.find((handler) => handler.name === 'validate'))
      .toMatchObject({ eligible: true });

    const guardedBase = new Contract(guardedArtifact, [], { provider });
    const guardedSetup = await setupStatefulUtxos(
      provider, guardedBase, guardedArtifact.stateLayout!, { stored: 7n }, { saltContract: true },
    );
    const guarded = StatefulContract.withCategory(
      guardedBase.withCategory(hexToBin(guardedSetup.categoryId)), guardedSetup.categoryId,
    );
    const coordinatorBase = new Contract(coordinatorArtifact, [], { provider });
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const build = (): Promise<TransactionBuilder> =>
      messageBus.compose({
        calls: [
          coordinator.call.execute(guarded.inner.lockingBytecode, 7n),
          guarded.call.validate(7n),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();

    const builder = await build();
    assertAuthenticatingVmEvidence(builder);
    expect(() => messageBus.preflightMessageBusTransaction(builder)).not.toThrow();

    const hostile = await build();
    const stateOutput = hostile.outputs.find((output) => output.token?.category === guardedSetup.categoryId
      && output.token.nft?.capability === 'mutable');
    expect(stateOutput?.token?.nft).toBeDefined();
    const commitment = stateOutput!.token!.nft!.commitment;
    stateOutput!.token = {
      ...stateOutput!.token!,
      nft: {
        ...stateOutput!.token!.nft!,
        commitment: commitment.length === 0
          ? '01' : `${commitment.slice(0, -2)}${commitment.endsWith('00') ? '01' : '00'}`,
      },
    };
    const routeInput = hostile.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === guardedArtifact.contractName
      && input.unlocker.abiFunction.name === guardedArtifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const hostileTransaction = hostile.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(hostile.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const hostileResult = vm.evaluate({
      inputIndex: routeInput,
      sourceOutputs,
      transaction: hostileTransaction,
    });
    expect(vm.stateSuccess(hostileResult)).toBe('Program failed an OP_VERIFY operation.');
    expect(() => messageBus.preflightMessageBusTransaction(hostile)).toThrow();
  }, 120_000);
});
