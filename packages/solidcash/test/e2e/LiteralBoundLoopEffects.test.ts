/**
 * A loop with a literal bound whose body pays, sends, transfers tokens or emits: each turn's effect is an output of its
 * own, pinned in turn order as a hand-written one is, and the satoshi container may lose what every turn pays and no
 * more. The SDK derives every output from the call's own run. Each call is checked under the production limits with
 * stock libauth's standard VM, honest and tampered; a refusal of the container's balance has a one-variable control.
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
const recipients = [0x33, 0x44, 0x55].map((byte) => new Uint8Array(20).fill(byte));
const lockOf = (pkh: Uint8Array): string => binToHex(encodeLockingBytecodeP2pkh(pkh));
const recipientLocks = recipients.map(lockOf);

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

/** The outputs paying any of the recipients, in output order, as `lock:value`. */
const payments = (spend: Spend): string[] => spend.transaction.outputs
  .filter((output: any) => recipientLocks.includes(binToHex(output.lockingBytecode)) && output.token === undefined)
  .map((output: any) => `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}`);

const paid = (recipient: number, value: bigint): string => `${recipientLocks[recipient]}:${value}`;

/** The outputs that carry an immutable NFT: the events. */
const eventOutputs = (spend: Spend): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (output.token?.nft?.capability === 'none' ? index : -1))
  .filter((index: number) => index >= 0);

/** The same transaction with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

/** The same transaction without output `index`, its value left to the fee. */
function withoutOutput(spend: Spend, index: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs.splice(index, 1);
  return copy;
}

/** The same transaction with the locks of outputs `left` and `right` exchanged. */
function swapLocks(spend: Spend, left: number, right: number): Spend {
  const copy: Spend = structuredClone(spend);
  const { outputs } = copy.transaction;
  [outputs[left].lockingBytecode, outputs[right].lockingBytecode] = [
    outputs[right].lockingBytecode, outputs[left].lockingBytecode];
  return copy;
}

interface Setup {
  provider: MockNetworkProvider;
  captured: Spend[];
  artifact: any;
  deployed: any;
  contract: any;
  containerLock: string;
}

/**
 * Deploys `source` under the production limits, with 50,000 satoshis in its container when `balance` is set, and
 * returns the contract connected to a funded wallet.
 */
async function setup(source: string, initialState: Record<string, bigint>, balance = false): Promise<Setup> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, { suppressWarnings: true } as never);
  const funding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState,
    ...(balance && { initialBalance: 50_000n }),
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const containerLock = balance
    ? binToHex(addressToLockScript(getSatoshiContainerAddress(deployed.contract.inner, deployed.categoryId)))
    : '';
  for (const txid of ['b2', 'b3']) {
    await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
  }
  return {
    provider, captured, artifact, deployed, containerLock,
    contract: deployed.contract.connect(new Signer(alicePriv, provider)),
  };
}

const abiOf = (artifact: any, name: string): any => artifact.abi.find((entry: any) => entry.name === name);

/** The last output at the wallet's lock: the call's change. */
const changeOf = (spend: Spend): number => outputsAt(spend, binToHex(aliceLock)).at(-1)!;

/** The container keeps one satoshi less than it should: refused; one more: accepted. */
function expectContainerBalancePinned(spend: Spend, containerLock: string, kept: bigint): void {
  const [container] = outputsAt(spend, containerLock);
  expect(spend.transaction.outputs[container!].valueSatoshis).toBe(kept);
  expect(verify(moveOne(spend, container!, changeOf(spend)))).not.toBe(true);
  expect(verify(moveOne(spend, changeOf(spend), container!))).toBe(true);
}

describe('a loop with a literal bound that pays, sends, transfers tokens or emits', () => {
  it('pays three recipients, each turn at an output of its own in turn order', async () => {
    const { captured, artifact, contract, containerLock } = await setup(`contract Payout {
    int paid;
    function run(bytes20[] to) public {
        for (int i = 0; i < 3; i++) { this.transfer(new LockingBytecodeP2PKH(to[i]), 1000 + i); }
        this.paid = this.paid + 1;
    }
}`, { paid: 0n }, true);
    expect(abiOf(artifact, 'run')).toMatchObject({ transferCount: 3 });
    expect(abiOf(artifact, 'run').runtimeLoopTransfers).toBeUndefined();

    await contract.run(recipients).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(1n);
    expect(payments(call)).toEqual([paid(0, 1000n), paid(1, 1001n), paid(2, 1002n)]);
    expectContainerBalancePinned(call, containerLock, 50_000n - 3_003n);

    const turns = recipientLocks.map((lock) => outputsAt(call, lock)[0]!);
    for (const turn of turns) {
      // A turn's payment one satoshi short, the satoshi moved to the change: refused.
      expect(verify(moveOne(call, turn, changeOf(call)))).not.toBe(true);
      // A turn's payment dropped: refused.
      expect(verify(withoutOutput(call, turn))).not.toBe(true);
    }
    // The first and last turns' recipients exchanged: refused.
    expect(verify(swapLocks(call, turns[0]!, turns[2]!))).not.toBe(true);
  }, 600_000);

  it('emits three events, each turn\'s event pinned in turn order', async () => {
    const { captured, artifact, contract } = await setup(`contract Ticker {
    int n;
    event Tick(int turn, int value);
    function run(int base) public {
        for (int i = 0; i < 3; i++) { emit Tick(i, base + i * 7); }
        this.n = this.n + 1;
    }
}`, { n: 0n });
    expect(abiOf(artifact, 'run').emits).toHaveLength(3);
    expect(abiOf(artifact, 'run').runtimeLoopEvents).toBeUndefined();

    const result = await contract.run(40n).send();
    expect(result.events.map((event: any) => [event.args.turn, event.args.value]))
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

  it('pays and emits in each turn of one loop', async () => {
    const { captured, contract, containerLock } = await setup(`contract Payout {
    int paid;
    event Paid(bytes20 to, int amount);
    function run(bytes20[] to) public {
        for (int i = 0; i < 3; i++) {
            this.transfer(new LockingBytecodeP2PKH(to[i]), 2000 + i);
            emit Paid(to[i], 2000 + i);
        }
        this.paid = this.paid + 1;
    }
}`, { paid: 0n }, true);
    const result = await contract.run(recipients).send();
    const hexOf = (value: string | Uint8Array): string => (typeof value === 'string' ? value : binToHex(value));
    expect(result.events.map((event: any) => [hexOf(event.args.to), event.args.amount]))
      .toEqual(recipients.map((pkh, turn) => [binToHex(pkh), 2000n + BigInt(turn)]));
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(payments(call)).toEqual([paid(0, 2000n), paid(1, 2001n), paid(2, 2002n)]);
    expectContainerBalancePinned(call, containerLock, 50_000n - 6_003n);

    const second = outputsAt(call, recipientLocks[1]!)[0]!;
    expect(verify(moveOne(call, second, changeOf(call)))).not.toBe(true);
    const events = eventOutputs(call);
    expect(events).toHaveLength(3);
    const forged: Spend = structuredClone(call);
    forged.transaction.outputs[events[2]!].token.nft.commitment = call.transaction.outputs[events[1]!].token.nft
      .commitment;
    expect(verify(forged)).not.toBe(true);
    expect(verify(withoutOutput(call, events[0]!))).not.toBe(true);
  }, 600_000);

  it('pays the turns of a nested loop its counters select', async () => {
    const { captured, artifact, contract, containerLock } = await setup(`contract Payout {
    int paid;
    function run(bytes20[] to) public {
        for (int i = 0; i < 2; i++) {
            for (int j = 0; j < 3; j++) {
                if (j != i) { this.transfer(new LockingBytecodeP2PKH(to[j]), 1000 + 10 * i + j); }
            }
        }
        this.paid = this.paid + 1;
    }
}`, { paid: 0n }, true);
    expect(abiOf(artifact, 'run')).toMatchObject({ transferCount: 4 });

    await contract.run(recipients).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(payments(call)).toEqual([paid(1, 1001n), paid(2, 1002n), paid(0, 1010n), paid(2, 1012n)]);
    expectContainerBalancePinned(call, containerLock, 50_000n - 4_025n);
    const last = outputsAt(call, recipientLocks[2]!).at(-1)!;
    expect(verify(moveOne(call, last, changeOf(call)))).not.toBe(true);
    expect(verify(withoutOutput(call, last))).not.toBe(true);
  }, 600_000);

  it('sends with `to.transfer` and `to.send`, each turn at an output of its own', async () => {
    const { captured, artifact, contract, containerLock } = await setup(`contract Payout {
    int paid;
    function run(address payable to) public {
        for (int i = 0; i < 2; i++) { to.transfer(1500 + i); }
        for (int i = 0; i < 2; i++) { require(to.send(1600 + i)); }
        this.paid = this.paid + 1;
    }
}`, { paid: 0n }, true);
    expect(abiOf(artifact, 'run')).toMatchObject({ transferCount: 4 });

    await contract.run(encodeLockingBytecodeP2pkh(recipients[0]!)).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    expect(payments(call)).toEqual([paid(0, 1500n), paid(0, 1501n), paid(0, 1600n), paid(0, 1601n)]);
    expectContainerBalancePinned(call, containerLock, 50_000n - 6_202n);
    const sends = outputsAt(call, recipientLocks[0]!);
    expect(verify(moveOne(call, sends[3]!, changeOf(call)))).not.toBe(true);
    expect(verify(withoutOutput(call, sends[1]!))).not.toBe(true);
  }, 600_000);

  it('transfers tokens to three recipients, each turn at an output of its own', async () => {
    const { provider, captured, deployed, contract } = await setup(`contract TokenPayout {
    int sent;
    function run(bytes32 series, bytes20[] to) public {
        for (int i = 0; i < 3; i++) { this.tokens[series].transfer(new LockingBytecodeP2PKH(to[i]), 5 + i); }
        this.sent = this.sent + 1;
    }
}`, { sent: 0n });
    const { categoryId: series } = await provider.addTokenUtxosDynamic((category) => [{
      address: deployed.contract.getTokenContainerAddress(category), satoshis: 1200n, token: { amount: 50n },
    }]);
    await contract.run(hexToBin(series), recipients).send();
    const call = captured[captured.length - 1]!;
    expect(verify(call)).toBe(true);
    const carrying = (lock: string): number[] => outputsAt(call, lock)
      .filter((index) => binToHex(call.transaction.outputs[index].token?.category ?? Uint8Array.of()) === series);
    const turns = recipientLocks.map((lock) => carrying(lock));
    expect(turns.map((indices) => indices.length)).toEqual([1, 1, 1]);
    expect(turns[0]![0]! < turns[1]![0]! && turns[1]![0]! < turns[2]![0]!).toBe(true);
    expect(turns.map(([index]) => call.transaction.outputs[index!].token.amount)).toEqual([5n, 6n, 7n]);
    const [container] = carrying(binToHex(addressToLockScript(deployed.contract.getTokenContainerAddress(series))));
    expect(call.transaction.outputs[container!].token.amount).toBe(32n);

    // A turn's recipient takes one token less, the container keeps it: refused.
    const short: Spend = structuredClone(call);
    short.transaction.outputs[turns[1]![0]!].token.amount -= 1n;
    short.transaction.outputs[container!].token.amount += 1n;
    expect(verify(short)).not.toBe(true);
    // A turn's token transfer dropped, its tokens kept by the container: refused.
    const dropped: Spend = structuredClone(call);
    dropped.transaction.outputs[container!].token.amount += 7n;
    expect(verify(withoutOutput(dropped, turns[2]![0]!))).not.toBe(true);
  }, 600_000);
});
