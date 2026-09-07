import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { getSatoshiContainerAddress } from '../../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

describe('pure helper fixed BCH transfer transcript security', () => {
  it('composes the reduced recipes and rejects recipient or amount tampering', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer {
        function pay(bool enabled, bool alternate, address first, address second, uint amount);
      }
      contract Payer() {
        function choose(bool alternate, address first, address second) private pure returns (address) {
          return alternate ? second : first;
        }
        function adjusted(uint amount) internal pure returns (uint) {
          uint incremented = amount + 7;
          return incremented;
        }
        function pay(bool enabled, bool alternate, address first, address second, uint amount) public {
          if (enabled) this.transfer(choose(alternate, first, second), adjusted(amount));
          this.transfer(first, amount);
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(bool enabled, bool alternate, address first, address second, uint amount) public {
          IPayer(payer).pay(enabled, alternate, first, second, amount);
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'b7'.repeat(32), vout: 1, satoshis: 30_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const first = fee.unlocker.generateLockingBytecode();
    const second = Uint8Array.from([...first.slice(0, -1), first.at(-1)! ^ 1]);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [true, true, first, second, 2_000n] },
        { contract: payer, functionName: 'pay', args: [true, true, first, second, 2_000n] },
      ],
      funder: fee,
      changeAddress: first,
    }).build();

    expect(vmRejects(builder)).toBe(false);
    const conditional = builder.outputs.find((output) => !output.token && output.amount === 2_007n
      && binToHex(output.to as Uint8Array) === binToHex(second));
    const unconditional = builder.outputs.find((output) => !output.token && output.amount === 2_000n
      && binToHex(output.to as Uint8Array) === binToHex(first));
    expect(conditional).toBeDefined();
    expect(unconditional).toBeDefined();

    conditional!.amount += 1n;
    expect(vmRejects(builder)).toBe(true);
    conditional!.amount -= 1n;
    conditional!.to = first;
    expect(vmRejects(builder)).toBe(true);
  }, 240_000);
});
