/**
 * A payment in a loop the runtime transfer stream does not admit, and which does not unroll, keeps one transfer slot:
 * one register pair, which the epilogue pins to one output. A call that runs it twice fails instead of paying once and
 * dropping the other. A literal-bound loop unrolls into a payment per turn (LiteralBoundLoopEffects.test.ts) unless its
 * body moves the counter. Checked under the production limits, and with stock libauth's standard VM against a builder
 * that runs it twice.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, decodeTransaction,
  encodeAuthenticationInstructions, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress, Opcodes,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const toPkh = new Uint8Array(20).fill(0x55);

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

async function setup(source: string): Promise<{ captured: Spend[]; artifact: any; contract: any }> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, { suppressWarnings: true } as never);
  const funding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { n: 0n }, initialBalance: 50_000n,
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  for (const txid of ['c2', 'c3']) {
    await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
  }
  return { captured, artifact, contract: deployed.contract.connect(new Signer(alicePriv, provider)) };
}

const paymentsTo = (spend: Spend): bigint[] => spend.transaction.outputs
  .filter((output: any) => binToHex(output.lockingBytecode) === binToHex(encodeLockingBytecodeP2pkh(toPkh)))
  .map((output: any) => output.valueSatoshis);

describe('a payment in a loop that keeps one transfer slot', () => {
  it('refuses a literal-bound loop that moves its counter and pays twice, rather than paying once', async () => {
    // The body moves the counter, so the loop stays rolled with its one transfer slot.
    const { artifact, contract } = await setup(`contract Payout {
    int n;
    function run(bytes20 to) public {
        for (int i = 0; i < 3; i++) {
            this.transfer(new LockingBytecodeP2PKH(to), 1500);
            if (i == 0) { i = i + 1; }
        }
        this.n = this.n + 1;
    }
}`);
    const run = artifact.abi.find((entry: any) => entry.name === 'run');
    expect(run?.runtimeLoopTransfers).toBeUndefined();
    expect(run?.transferCount).toBe(1);
    // The turns i = 0 and i = 2 both pay.
    await expect(contract.run(toPkh).send()).rejects.toThrow();
  }, 600_000);

  it('pays a loop that runs its payment once, and refuses a run that pays twice', async () => {
    // The counter also moves inside the body, which the runtime transfer stream does not admit.
    const { captured, artifact, contract } = await setup(`contract Payout {
    int n;
    function run(int k, address payable to) public {
        for (int i = 0; i < k; i++) {
            to.transfer(1500);
            if (i == 0) { i = i + 10; }
        }
        this.n = this.n + 1;
    }
}`);
    expect(artifact.abi.find((entry: any) => entry.name === 'run')?.runtimeLoopTransfers).toBeUndefined();
    // k = 11 runs the payment once (i = 0, then 11).
    await contract.run(11n, encodeLockingBytecodeP2pkh(toPkh)).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(paymentsTo(call)).toEqual([1500n]);
    // k = 12 runs it twice (i = 0 and 11).
    await expect(contract.run(12n, encodeLockingBytecodeP2pkh(toPkh)).send()).rejects.toThrow();
    // The same transaction with k = 12 and its one payment: the master's input refuses it.
    const instructions = decodeAuthenticationInstructions(call.transaction.inputs[0].unlockingBytecode);
    const kPushes = instructions.map((instruction, index) => (instruction.opcode === Opcodes.OP_11 ? index : -1))
      .filter((index) => index >= 0);
    expect(kPushes).toHaveLength(1);
    instructions[kPushes[0]!] = { opcode: Opcodes.OP_12 } as never;
    const twice: Spend = structuredClone(call);
    twice.transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);
    expect(verify(twice)).not.toBe(true);
  }, 600_000);

  it('refuses a run of a loop\'s `to.send` that sends twice, which used to pay the last send only', async () => {
    const { captured, artifact, contract } = await setup(`contract Payout {
    int n;
    function run(int k, address payable to) public {
        for (int i = 0; i < k; i++) { require(to.send(1500)); }
        this.n = this.n + 1;
    }
}`);
    expect(artifact.abi.find((entry: any) => entry.name === 'run')?.transferCount).toBe(1);
    // k = 1 sends once.
    await contract.run(1n, encodeLockingBytecodeP2pkh(toPkh)).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(paymentsTo(call)).toEqual([1500n]);
    // k = 2 sends twice.
    await expect(contract.run(2n, encodeLockingBytecodeP2pkh(toPkh)).send()).rejects.toThrow();
    // The same transaction with k = 2 and its one send: the master's input refuses it.
    const instructions = decodeAuthenticationInstructions(call.transaction.inputs[0].unlockingBytecode);
    const kPushes = instructions.map((instruction, index) => (instruction.opcode === Opcodes.OP_1 ? index : -1))
      .filter((index) => index >= 0);
    expect(kPushes).toHaveLength(1);
    instructions[kPushes[0]!] = { opcode: Opcodes.OP_2 } as never;
    const twice: Spend = structuredClone(call);
    twice.transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);
    expect(verify(twice)).not.toBe(true);
  }, 600_000);
});
