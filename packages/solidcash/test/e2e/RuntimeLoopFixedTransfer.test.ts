/**
 * A runtime loop's transfers out of a satoshi container, alone and beside a fixed transfer, built under the production
 * limits (where the SDK reads the loop's payments from a reduced probe trace).
 *
 * The container may lose what the call pays, the fixed and the looped payments together, and no more, summed over
 * every coin at its lock. Each call is checked with stock libauth's standard VM, honest and tampered; every refusal
 * has a one-variable control that passes.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const fixedPkh = new Uint8Array(20).fill(0x33);
const loopPkh = new Uint8Array(20).fill(0x44);
const lockOf = (pkh: Uint8Array): string => binToHex(encodeLockingBytecodeP2pkh(pkh));

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
}

/** Signs the wallet's P2PKH inputs again, as a builder signs its own transaction, and asks the standard VM. */
function verify(spend: Spend): true | string {
  const copy: Spend = structuredClone(spend);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(copy as never) as true | string;
}

/** The outputs of `spend` at `lock`, by index. */
const outputsAt = (spend: Spend, lock: string): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (binToHex(output.lockingBytecode) === lock ? index : -1))
  .filter((index: number) => index >= 0);

/** The same transaction with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

/**
 * The same call co-spending `extra`, a second coin at the container lock, at the first input index past every output,
 * with wallet coins filling the indices between. The container covenant then asks only that the output at its index
 * stays at the container lock, at `kept` satoshis; the wallet takes the rest of the coin at the next output.
 */
function withSecondContainerCoin(spend: Spend, containerLock: string, extra: bigint, kept: bigint): Spend {
  const copy: Spend = structuredClone(spend);
  const container = copy.sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === containerLock);
  if (container < 0) throw new Error('the call spends no container coin');
  const unlocking = copy.transaction.inputs[container].unlockingBytecode;
  const target = copy.transaction.outputs.length;
  if (target <= copy.transaction.inputs.length) throw new Error('the call has no more outputs than inputs');
  let fill = 0n;
  for (let index = copy.transaction.inputs.length; index < target; index += 1) {
    copy.transaction.inputs.push({
      outpointTransactionHash: hexToBin((0x70 + index).toString(16).padStart(2, '0').repeat(32)), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    });
    copy.sourceOutputs.push({ lockingBytecode: aliceLock, valueSatoshis: 5_000n });
    fill += 5_000n;
  }
  copy.transaction.inputs.push({
    outpointTransactionHash: hexToBin('e3'.repeat(32)), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: unlocking,
  });
  copy.sourceOutputs.push({ lockingBytecode: hexToBin(containerLock), valueSatoshis: extra });
  copy.transaction.outputs.push({ lockingBytecode: hexToBin(containerLock), valueSatoshis: kept });
  copy.transaction.outputs.push({ lockingBytecode: aliceLock, valueSatoshis: fill + extra - kept - 3_000n });
  return copy;
}

/** Each form of the fixed payment, with the value its `fixedTo` parameter takes. */
const FORMS: Record<string, { source: string; fixedTo: Uint8Array }> = {
  'this.transfer': {
    source: `contract Payout {
    int paid;
    function run(int k, bytes20 to, bytes20 fixedTo) public {
        this.transfer(new LockingBytecodeP2PKH(fixedTo), 3000);
        for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 1000 + i); }
        this.paid = this.paid + 1;
    }
}`,
    fixedTo: fixedPkh,
  },
  'to.transfer': {
    source: `contract Payout {
    int paid;
    function run(int k, bytes20 to, address payable fixedTo) public {
        fixedTo.transfer(3000);
        for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 1000 + i); }
        this.paid = this.paid + 1;
    }
}`,
    fixedTo: encodeLockingBytecodeP2pkh(fixedPkh),
  },
};

/**
 * Deploys `source` under the production limits with 50,000 satoshis in its container, pays a second coin of 20,000 to
 * the container lock from outside, and returns the contract connected to a funded wallet.
 */
async function setup(source: string): Promise<{ captured: Spend[]; containerLock: string; contract: any }> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, { suppressWarnings: true } as never);
  expect(artifact.abi.find((entry) => entry.name === 'run')?.runtimeLoopTransfers).toHaveLength(1);
  const funding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { paid: 0n }, initialBalance: 50_000n,
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const containerAddress = getSatoshiContainerAddress(deployed.contract.inner, deployed.categoryId);
  const containerLock = binToHex(addressToLockScript(containerAddress));
  // The call spends the larger coin; the second is what a builder could co-spend beside it.
  await provider.seedUtxo(containerLock, { txid: 'e3'.repeat(32), vout: 0, satoshis: 20_000n });
  await provider.seedUtxo(binToHex(aliceLock), { txid: 'e2'.repeat(32), vout: 0, satoshis: 300_000n });
  return { captured, containerLock, contract: deployed.contract.connect(new Signer(alicePriv, provider)) };
}

describe('a runtime loop\'s transfers, alone and beside a fixed transfer', () => {
  it('pays a runtime loop alone, and keeps a second container coin', async () => {
    const { captured, containerLock, contract } = await setup(`contract Payout {
    int paid;
    function run(int k, bytes20 to) public {
        for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 1000 + i); }
        this.paid = this.paid + 1;
    }
}`);
    await contract.run(2n, loopPkh).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    const looped = outputsAt(call, lockOf(loopPkh));
    expect(looped.map((index) => call.transaction.outputs[index].valueSatoshis)).toEqual([1_000n, 1_001n]);
    const [kept] = outputsAt(call, containerLock);
    expect(call.transaction.outputs[kept!].valueSatoshis).toBe(50_000n - 2_001n);
    const changeIndex = outputsAt(call, binToHex(aliceLock)).at(-1)!;
    expect(verify(moveOne(call, kept!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(call, changeIndex, kept!))).toBe(true);
    expect(verify(withSecondContainerCoin(call, containerLock, 20_000n, 20_000n))).toBe(true);
    expect(verify(withSecondContainerCoin(call, containerLock, 20_000n, 1_000n))).not.toBe(true);
  }, 600_000);

  it.each(Object.keys(FORMS))('pays both from the container with %s, and no more', async (form) => {
    const { source, fixedTo } = FORMS[form]!;
    const { captured, containerLock, contract } = await setup(source);
    await contract.run(2n, loopPkh, fixedTo).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(1n);
    const [fixed] = outputsAt(call, lockOf(fixedPkh));
    expect(call.transaction.outputs[fixed!].valueSatoshis).toBe(3_000n);
    const looped = outputsAt(call, lockOf(loopPkh));
    expect(looped.map((index) => call.transaction.outputs[index].valueSatoshis)).toEqual([1_000n, 1_001n]);
    const [kept] = outputsAt(call, containerLock);
    expect(call.transaction.outputs[kept!].valueSatoshis).toBe(50_000n - 5_001n);

    // The container keeps one satoshi less than the call pays out of it: refused. Keeping one more is allowed.
    const changeIndex = outputsAt(call, binToHex(aliceLock)).at(-1)!;
    expect(verify(moveOne(call, kept!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(call, changeIndex, kept!))).toBe(true);
    // A payment one satoshi short, the satoshi moved to the change: refused, fixed or looped.
    expect(verify(moveOne(call, fixed!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(call, looped[1]!, changeIndex))).not.toBe(true);
    // A second container coin co-spent and recreated whole passes; recreated short, the wallet taking the rest: refused.
    expect(verify(withSecondContainerCoin(call, containerLock, 20_000n, 20_000n))).toBe(true);
    expect(verify(withSecondContainerCoin(call, containerLock, 20_000n, 1_000n))).not.toBe(true);
  }, 600_000);
});
