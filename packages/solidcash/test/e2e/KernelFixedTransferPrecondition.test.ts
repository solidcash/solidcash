import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel fixed transfer preconditions', () => {
  it.each([false, true])('authenticates preconditions and payments with struct capture=%s', async (capture) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer {
        function pay(address recipient, int amount, int requiredLocktime, bool enabled);
      }
      contract Payer() {
        struct Payment { address recipient; int amount; int marker; }
        function pay(address recipient, int amount, int requiredLocktime, bool enabled) public {
          require(tx.locktime >= requiredLocktime);
          ${capture ? `Payment memory payment = Payment(recipient, amount, 0);
            payment.marker = tx.locktime;
            if (enabled) this.transfer(payment.recipient, payment.amount);`
    : 'if (enabled) this.transfer(recipient, amount);'}
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(address recipient, int amount, int requiredLocktime, bool enabled) public {
          IPayer(payer).pay(recipient, amount, requiredLocktime, enabled);
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true });
    const connect = async (artifact: Artifact, args: Uint8Array[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'd6'.repeat(32), vout: 1, satoshis: 30_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const build = (requiredLocktime: bigint, enabled: boolean): ReturnType<ReturnType<typeof messageBus.compose>['build']> =>
      messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: 'run', args: [recipient, 2_000n, requiredLocktime, enabled] },
          { contract: payer, functionName: 'pay', args: [recipient, 2_000n, requiredLocktime, enabled] },
        ], funder: fee, changeAddress: recipient,
      }).build();
    const active = await build(0n, true);
    const transaction = active.buildLibauthTransaction();
    expect(transaction.locktime).toBeGreaterThanOrEqual(0);
    const sourceOutputs = generateLibauthSourceOutputs(active.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const payerInput = active.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'Payer'
      && input.unlocker.abiFunction.selector === '53434231');
    expect(payerInput).toBeGreaterThanOrEqual(0);
    const accepted = (candidate: typeof transaction): boolean => candidate.inputs.every((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction: candidate })) === true);
    expect(accepted(transaction)).toBe(true);
    const outputIndex = transaction.outputs.findIndex((output) => !output.token && output.valueSatoshis === 2_000n
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    expect(outputIndex).toBeGreaterThanOrEqual(0);
    const changedAmount = structuredClone(transaction);
    changedAmount.outputs[outputIndex].valueSatoshis += 1n;
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: payerInput, sourceOutputs, transaction: changedAmount })))
      .not.toBe(true);
    const changedRecipient = structuredClone(transaction);
    changedRecipient.outputs[outputIndex].lockingBytecode = Uint8Array.of(0x51);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: payerInput, sourceOutputs, transaction: changedRecipient })))
      .not.toBe(true);
    const inactive = await build(0n, false);
    expect(inactive.outputs.some((output) => !output.token && output.amount === 2_000n
      && binToHex(output.to as Uint8Array) === binToHex(recipient))).toBe(false);
    // Both branches retain the source require, including the branch that makes no payment at all.
    await expect(build(0x1_0000_0000n, true)).rejects.toThrow(/preflight failed.*OP_VERIFY/i);
    await expect(build(0x1_0000_0000n, false)).rejects.toThrow(/preflight failed.*OP_VERIFY/i);
  }, 180_000);
});
