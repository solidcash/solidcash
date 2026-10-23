import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel mapping-backed fixed transfers', () => {
  it.each(['transfer', 'callvalue'])('authenticates captured entry operands via %s after a write', async (mode) => {
    const artifacts = compileStringMulti(`interface IPayer { function pay(int key); }
      contract Payer() {
        struct Payment { address payable recipient; int amount; bool enabled; int marker; int[2] marks; }
        mapping(int => Payment) payments;
        function seed(int key, address payable recipient, int amount, bool enabled) public {
          this.payments[key] = Payment(recipient, amount, enabled, 0, [0, 0]);
          require(true);
        }
        function pay(int key) public {
          Payment memory payment = this.payments[key];
          payment.marker = tx.locktime;
          payment.marks[0] = tx.locktime;
          this.payments[key].marks = payment.marks;
          this.payments[key].amount = 0;
          if (payment.enabled) {
            ${mode === 'transfer' ? 'this.transfer(payment.recipient, payment.amount);'
    : '(bool success,) = payment.recipient.call{value: payment.amount}(""); require(success);'}
          }
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(int key) public { IPayer(payer).pay(key); require(true); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const connect = async (artifact: Artifact, args: Uint8Array[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId).connect(signer);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    driver._registerResolvedExternal('IPayer', payer);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    await payer.call.seed(7n, recipient, 2_000n, true).send();
    await payer.call.seed(8n, recipient, 2_000n, false).send();
    const build = (key: bigint): ReturnType<ReturnType<typeof messageBus.compose>['build']> => messageBus.compose({
      preparedCalls: [{ contract: driver, functionName: 'run', args: [key] },
        { contract: payer, functionName: 'pay', args: [key] }], funder: fee, changeAddress: recipient,
    }).build();
    // An inactive payment must build without ever funding the optional shared native container.
    const inactive = await build(8n);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(inactive.outputs.some((candidate) => !candidate.token && candidate.amount === 2_000n
      && binToHex(candidate.to as Uint8Array) === binToHex(recipient))).toBe(false);
    const inactiveTransaction = inactive.buildLibauthTransaction();
    const inactiveSources = generateLibauthSourceOutputs(inactive.inputs);
    expect(inactiveTransaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, sourceOutputs: inactiveSources, transaction: inactiveTransaction,
    })) === true)).toBe(true);
    await expect(build(7n)).rejects.toThrow(/Satoshi container UTXO not found/);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'd7'.repeat(32), vout: 1, satoshis: 30_000n,
    });
    const active = await build(7n);
    const transaction = active.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(active.inputs);
    expect(transaction.inputs.every((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true)).toBe(true);
    const payerInput = active.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'Payer' && input.unlocker.abiFunction.selector === '53434231');
    expect(payerInput).toBeGreaterThanOrEqual(0);
    const output = transaction.outputs.findIndex((candidate) => !candidate.token && candidate.valueSatoshis === 2_000n
      && binToHex(candidate.lockingBytecode) === binToHex(recipient));
    expect(output).toBeGreaterThanOrEqual(0);
    for (const kind of ['amount', 'recipient']) {
      const tampered = structuredClone(transaction);
      if (kind === 'amount') tampered.outputs[output].valueSatoshis += 1n;
      else tampered.outputs[output].lockingBytecode = Uint8Array.of(0x51);
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: payerInput, sourceOutputs, transaction: tampered })))
        .not.toBe(true);
    }
  }, 180_000);
});
