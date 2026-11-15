/**
 * A loop with a literal bound whose body emits or pays, called through a kernel message-bus route: each turn's effect
 * is an output of its own, as under the direct convention (LiteralBoundLoopEffects.test.ts). The compiler unrolls the
 * loop before route admission, so the handler the route admits takes a site per turn; a rolled loop's one register
 * would refuse its second turn. Each call is checked under the production limits with stock libauth's standard VM,
 * honest and tampered.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const BUS = { messageBus: true, messageBusKernel: true, suppressWarnings: true } as const;

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

/** The same transaction without output `index`, its value left to the fee. */
function withoutOutput(spend: Spend, index: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs.splice(index, 1);
  return copy;
}

/** The outputs that carry an immutable NFT: the events. */
const eventOutputs = (spend: Spend): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (output.token?.nft?.capability === 'none' ? index : -1))
  .filter((index: number) => index >= 0);

/** The token-free outputs at `lock`, by index. */
const paymentsTo = (spend: Spend, lock: Uint8Array): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (binToHex(output.lockingBytecode) === binToHex(lock)
    && output.token === undefined ? index : -1))
  .filter((index: number) => index >= 0);

/**
 * Deploys `source` as a kernel message-bus build under the production limits, which mint no coin: the wallet's seeded
 * coins fund the deployment and each call, as in LiteralBoundLoopEffects.test.ts.
 */
async function setup(source: string, initialState: Record<string, bigint>, initialBalance?: bigint): Promise<{
  artifact: ReturnType<typeof compileString>; contract: any; captured: Spend[];
}> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, BUS);
  const funding: Utxo = { txid: 'b7'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState,
    ...(initialBalance !== undefined && { initialBalance }),
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  for (const txid of ['b8', 'b9']) {
    await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
  }
  return { artifact, captured, contract: deployed.contract.connect(new Signer(alicePriv, provider)) };
}

/** The call's events, from its receipt once mined where the send returns a pending call. */
async function eventsOf(sent: any): Promise<any[]> {
  const receipt = typeof sent?.wait === 'function' ? await sent.wait() : sent;
  return receipt?.events ?? [];
}

const handlerOf = (artifact: ReturnType<typeof compileString>, name: string): unknown => artifact.messageBus?.handlers
  .find((handler) => handler.name === name);

describe('a literal-bound loop that emits or pays, called through a message-bus route', () => {
  it('emits three events, each turn\'s event pinned in turn order', async () => {
    const { artifact, contract, captured } = await setup(`contract Ticker {
    int n;
    event Tick(int turn, int value);
    function run(int base) public {
        for (int i = 0; i < 3; i++) { emit Tick(i, base + i * 7); }
        this.n = this.n + 1;
    }
}`, { n: 0n });
    expect(handlerOf(artifact, 'run')).toMatchObject({ eligible: true });

    const emitted = await eventsOf(await contract.run(40n).send());
    expect(emitted.map((event: any) => [event.args.turn, event.args.value]))
      .toEqual([[0n, 40n], [1n, 47n], [2n, 54n]]);
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    const events = eventOutputs(call);
    expect(events).toHaveLength(3);
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
      // One turn's commitment in another turn's event: refused.
      const forged: Spend = structuredClone(call);
      forged.transaction.outputs[events[to]!].token.nft.commitment = call.transaction.outputs[events[from]!].token.nft
        .commitment;
      expect(verify(forged)).not.toBe(true);
    }
    for (const event of events) {
      // A turn's event dropped: refused.
      expect(verify(withoutOutput(call, event))).not.toBe(true);
    }
  }, 600_000);

  it('pays one recipient three times, each turn at an output of its own in turn order', async () => {
    const { artifact, contract, captured } = await setup(`contract Payout {
    int paid;
    function run(bytes recipient) public {
        for (int i = 0; i < 3; i++) { this.transfer(recipient, 1000 + i); }
        this.paid = this.paid + 1;
    }
}`, { paid: 0n }, 50_000n);
    expect(handlerOf(artifact, 'run')).toMatchObject({ eligible: true });
    const recipient = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));

    await eventsOf(await contract.run(recipient).send());
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    const turns = paymentsTo(call, recipient);
    expect(turns.map((index) => call.transaction.outputs[index].valueSatoshis)).toEqual([1000n, 1001n, 1002n]);
    for (const turn of turns) {
      // A turn's payment one satoshi short, the satoshi left to the fee: refused.
      const short: Spend = structuredClone(call);
      short.transaction.outputs[turn].valueSatoshis -= 1n;
      expect(verify(short)).not.toBe(true);
      // A turn's payment dropped: refused.
      expect(verify(withoutOutput(call, turn))).not.toBe(true);
    }
  }, 600_000);
});
