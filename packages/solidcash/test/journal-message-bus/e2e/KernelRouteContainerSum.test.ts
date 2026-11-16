/**
 * A kernel route's handlers pay inside their own invoked frames, so only the route can bound every coin at the
 * satoshi container lock. A builder who puts a second container coin in a pad's place and drains it to a filler
 * would otherwise keep its satoshis. Checked with the VM on every covenant input of the composed transaction.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { fillerLockingBytecode } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getSatoshiContainerAddress } from '../../../src/stateful/covenant-helpers.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const isP2pkh = (lock: Uint8Array): boolean => lock.length === 25 && lock[0] === 0x76 && lock[1] === 0xa9;

const SOURCE = `interface IPayer { function pay(bytes recipient, int amount); }
contract Payer() {
  int n;
  function pay(bytes recipient, int amount) public { this.transfer(recipient, amount); require(true); }
}
contract Driver(address payer) {
  function run(bytes recipient, int amount) public { IPayer(payer).pay(recipient, amount); require(true); }
}`;

describe('a kernel route bounds every coin at its satoshi container lock', () => {
  it('refuses a second container coin drained in a pad\'s place', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(SOURCE, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const connect = async (artifact: Artifact, args: Uint8Array[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    const containerLock = addressToLockScript(getSatoshiContainerAddress(payer.inner, payer.categoryId));
    await provider.addUtxo(binToHex(containerLock), { txid: 'd6'.repeat(32), vout: 1, satoshis: 30_000n });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const active = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [recipient, 2_000n] },
        { contract: payer, functionName: 'pay', args: [recipient, 2_000n] },
      ],
      funder: fee, changeAddress: recipient,
    }).build();
    const transaction = active.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(active.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    // The builder signs its own P2PKH inputs again; every covenant input must pass as it stands.
    const refusals = (tx: typeof transaction, spent: typeof sourceOutputs): number[] => tx.inputs.flatMap(
      (_input, inputIndex) => (isP2pkh(spent[inputIndex]!.lockingBytecode)
        || vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: spent, transaction: tx })) === true
        ? [] : [inputIndex]),
    );
    expect(refusals(transaction, sourceOutputs)).toEqual([]);

    const container = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(containerLock));
    expect(container).toBeGreaterThanOrEqual(0);
    // A pad: a coin of the balanced layout whose output is a carrier, at the middle of the pad run.
    const padLock = binToHex(sourceOutputs[container + 1]!.lockingBytecode);
    const pads = sourceOutputs.flatMap((output, index) => (binToHex(output.lockingBytecode) === padLock ? [index] : []));
    expect(pads.length).toBeGreaterThan(2);
    const pad = pads[Math.floor(pads.length / 2)]!;
    const changeIndex = transaction.outputs.length - 1;
    expect(binToHex(transaction.outputs[changeIndex]!.lockingBytecode)).toBe(binToHex(recipient));
    // Control: another coin of the pad's own kind in its place passes.
    const otherPad = structuredClone(transaction);
    otherPad.inputs[pad] = { ...otherPad.inputs[pad]!, outpointTransactionHash: hexToBin('d8'.repeat(32)) };
    expect(refusals(otherPad, sourceOutputs)).toEqual([]);
    // A second container coin of 20,000 satoshis in the pad's place, drained to a filler, the rest to the change.
    // The container covenant accepts a filler at its index; only the payer's route can count the coin.
    const tx = structuredClone(transaction);
    const spent = structuredClone(sourceOutputs);
    const filler = 576n;
    tx.inputs[pad] = {
      ...tx.inputs[pad]!, outpointTransactionHash: hexToBin('d7'.repeat(32)),
      unlockingBytecode: transaction.inputs[container]!.unlockingBytecode,
    };
    const taken = 20_000n - spent[pad]!.valueSatoshis + tx.outputs[pad]!.valueSatoshis - filler;
    spent[pad] = { lockingBytecode: containerLock, valueSatoshis: 20_000n };
    tx.outputs[pad] = { lockingBytecode: fillerLockingBytecode(), valueSatoshis: filler };
    tx.outputs[changeIndex] = {
      ...tx.outputs[changeIndex]!, valueSatoshis: tx.outputs[changeIndex]!.valueSatoshis + taken,
    };
    expect(refusals(tx, spent)).not.toEqual([]);
  }, 300_000);
});
