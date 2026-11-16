/**
 * An event emitted in a loop whose count is known only at run time.
 *
 * A counter loop takes the runtime event stream: every iteration's event is an output of its own, pinned in source
 * order. A loop that stream does not admit keeps one register for the event, which the epilogue pins to one output,
 * so a second run of the emit makes the call fail instead of dropping the first event. Each call is checked with
 * stock libauth's standard VM, honest and tampered.
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

/** The outputs that carry an immutable NFT: the events. */
const eventOutputs = (spend: Spend): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (output.token?.nft?.capability === 'none' ? index : -1))
  .filter((index: number) => index >= 0);

async function setup(source: string): Promise<{ captured: Spend[]; artifact: any; contract: any }> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, { suppressWarnings: true } as never);
  const funding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { n: 0n },
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  for (const txid of ['f2', 'f3']) {
    await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
  }
  return { captured, artifact, contract: deployed.contract.connect(new Signer(alicePriv, provider)) };
}

describe('an event emitted in a loop whose count is known only at run time', () => {
  it('pins every iteration\'s event of a plain counter loop, in order', async () => {
    const { captured, artifact, contract } = await setup(`contract Ticker {
    int n;
    event Tick(int i);
    function run(int k) public {
        for (int i = 0; i < k; i++) { emit Tick(i); }
        this.n = this.n + 1;
    }
}`);
    const result = await contract.run(2n).send();
    expect(result.events.map((event: any) => event.args.i)).toEqual([0n, 1n]);
    expect(artifact.abi.find((entry: any) => entry.name === 'run')?.runtimeLoopEvents).toHaveLength(1);
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    const events = eventOutputs(call);
    expect(events).toHaveLength(2);
    // Either event's commitment changed to the other's: refused.
    for (const [from, to] of [[0, 1], [1, 0]]) {
      const forged: Spend = structuredClone(call);
      const { commitment } = call.transaction.outputs[events[from]!].token.nft;
      forged.transaction.outputs[events[to]!].token.nft.commitment = commitment;
      expect(verify(forged)).not.toBe(true);
    }
  }, 600_000);

  it('refuses a call that runs a loop\'s fixed emit twice, which one output could not hold', async () => {
    // The counter also moves inside the body, which the runtime event stream does not admit: the emit keeps one register.
    const { captured, artifact, contract } = await setup(`contract Ticker {
    int n;
    event Ping(int tag);
    function run(int k) public {
        for (int i = 0; i < k; i++) {
            emit Ping(7);
            if (i == 0) { i = i + 10; }
        }
        this.n = this.n + 1;
    }
}`);
    expect(artifact.abi.find((entry: any) => entry.name === 'run')?.runtimeLoopEvents).toBeUndefined();
    // k = 11 runs the emit once (i = 0, then 11): one event, accepted.
    const result = await contract.run(11n).send();
    expect(result.events.map((event: any) => event.args.tag)).toEqual([7n]);
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(eventOutputs(call)).toHaveLength(1);
    // k = 12 runs it twice (i = 0 and 11).
    await expect(contract.run(12n).send()).rejects.toThrow();
    // The same transaction with k = 12 and its one event output: the master's input refuses it.
    const master = call.transaction.inputs[0];
    const instructions = decodeAuthenticationInstructions(master.unlockingBytecode);
    const kPushes = instructions.map((instruction, index) => (instruction.opcode === Opcodes.OP_11 ? index : -1))
      .filter((index) => index >= 0);
    expect(kPushes).toHaveLength(1);
    const twice: Spend = structuredClone(call);
    instructions[kPushes[0]!] = { opcode: Opcodes.OP_12 } as never;
    twice.transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);
    expect(verify(twice)).not.toBe(true);
  }, 600_000);
});
