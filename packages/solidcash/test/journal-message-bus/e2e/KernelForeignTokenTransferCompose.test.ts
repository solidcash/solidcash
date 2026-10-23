import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { alicePkh } from '../../fixture/vars.js';
import {
  createBareP2pkhFeeFunder, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const aliceP2pkh = new Uint8Array([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]);

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel foreign token-container transfer under composition', () => {
  it('Caller→Token settles recipient payment and remainder, fail-closed on amount tamper', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const tokenArtifact = compileString(`contract Token() {
      function transfer(
        bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount
      ) public {
        require(this.tokens[category].tokenAmount >= amount);
        require(this.tokens[preservedCategory].tokenAmount >= 0);
        this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
        require(amount > 0);
      }
    }`, KERNEL);
    expect(tokenArtifact.messageBus?.handlers.find((handler) => handler.name === 'transfer'))
      .toMatchObject({ eligible: true });
    const tokenBase = new Contract(tokenArtifact, [], { provider });
    const tokenSetup = await setupStatefulUtxos(
      provider, tokenBase, tokenArtifact.stateLayout!, {}, { saltContract: true },
    );
    const tokenInner = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
    const token = StatefulContract.withCategory(tokenInner, tokenSetup.categoryId);
    const ft = await genesisFtContainer(provider, tokenInner, tokenSetup.categoryId, [100n]);
    const preserved = await genesisFtContainer(provider, tokenInner, tokenSetup.categoryId, [100n]);

    const callerArtifact = compileString(`
      interface IToken {
        function transfer(
          bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount
        );
      }
      contract Caller(address tokenAddress) {
        function poke(
          bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount
        ) public {
          IToken(tokenAddress).transfer(category, preservedCategory, recipient, amount);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [tokenInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const category = hexToBin(ft.category);
    const preservedCategory = hexToBin(preserved.category);
    const amount = 7n;
    const funder = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.poke(category, preservedCategory, alicePkh, amount),
        token.call.transfer(category, preservedCategory, alicePkh, amount),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const transaction = builder.buildLibauthTransaction();
    const tokenOutputs = transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === ft.category);
    expect(tokenOutputs.some((output) => output.token?.amount === amount
      && binToHex(output.lockingBytecode) === binToHex(aliceP2pkh))).toBe(true);
    expect(tokenOutputs.some((output) => output.token?.amount === 93n)).toBe(true);

    const hostile = builder.buildLibauthTransaction();
    const payment = hostile.outputs.find((output) => output.token?.amount === amount
      && binToHex(output.lockingBytecode) === binToHex(aliceP2pkh));
    expect(payment).toBeDefined();
    payment!.token!.amount += 1n;
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const tokenRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Token'
      && input.unlocker.abiFunction.name === tokenArtifact.messageBus!.route.name);
    expect(tokenRoute).toBeGreaterThanOrEqual(0);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: tokenRoute, sourceOutputs, transaction: hostile,
    }))).not.toBe(true);
  }, 180_000);
});
