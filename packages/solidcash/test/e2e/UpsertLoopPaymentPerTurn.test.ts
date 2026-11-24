/**
 * A sorted-mapping loop that pays BCH every turn beside its mapping write, on the direct convention.
 *
 * A direct call's covenant mints the loop's entries from emitTrailingWriteOutputBase and reads the per-turn payments
 * from past the complete fixed block plus the entry band (emitRuntimeLoopEffectVerification). The SDK once based the
 * entries on the complete block and padded a returnEvent slot ahead of them, which put every entry one output past
 * where the covenant reads it. A void entry running a runtime mapping loop reserves no returnEvent slot (7c7650814),
 * so the payments follow the entries directly. Each call is checked with stock libauth's standard VM under the
 * production profile, honest and tampered.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, bigIntToVmNumber, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress, vmNumberToBigInt,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import {
  StatefulContract, SortedList, bytesToSlotValue, getEntryNftAddress, keyToSlot,
} from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);
const payeeLock = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));

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
const outputsAt = (spend: Spend, lock: Uint8Array): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (binToHex(output.lockingBytecode) === binToHex(lock) ? index : -1))
  .filter((index: number) => index >= 0);

/** The entry outputs of `spend`: its mutable NFTs. */
const entriesOf = (spend: Spend): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (output.token?.nft?.capability === 'mutable' ? index : -1))
  .filter((index: number) => index >= 0);

/** What `spend` pays the payee, output by output. */
const paymentsOf = (spend: Spend): bigint[] => outputsAt(spend, payeeLock)
  .map((index) => spend.transaction.outputs[index].valueSatoshis as bigint);

/** The satoshis at `lock` across `outputs`. */
const valueAt = (outputs: any[], lock: Uint8Array): bigint => outputs
  .filter((output) => binToHex(output.lockingBytecode) === binToHex(lock))
  .reduce((sum: bigint, output) => sum + (output.valueSatoshis as bigint), 0n);

/** The same transaction with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

/** Where the covenant reads each output: the entries side by side, then the payments side by side. */
function expectLayout(spend: Spend, entryCount: number, paymentCount: number): void {
  const entries = entriesOf(spend);
  const payments = outputsAt(spend, payeeLock);
  expect(entries).toHaveLength(entryCount);
  expect(payments).toHaveLength(paymentCount);
  entries.forEach((index, ordinal) => expect(index).toBe(entries[0]! + ordinal));
  payments.forEach((index, ordinal) => expect(index).toBe(entries.at(-1)! + 1 + ordinal));
}

interface Book {
  /** Sends a call as alice and checks the transaction it broadcast with the VM. */
  call: (fn: string, ...args: unknown[]) => Promise<Spend>;
  /** An entry's value, or undefined while the key has no entry. */
  bal: (key: bigint) => Promise<bigint | undefined>;
  /** The coins at the payee's lock and at the contract's satoshi container, summed. */
  balances: () => Promise<{ payee: bigint; container: bigint }>;
  containerLock: Uint8Array;
}

const SOURCE = `contract Book() { mapping(int => int) bal;
  function seed(int a, int v) { this.bal[a] = v; }
  function put(int[] ks, int[] vs, address to) {
    for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = vs[i]; this.transfer(to, 1000 + i); } } }`;
const CONTAINER = 50_000n;

let seed = 0x7d0;
async function setup(): Promise<Book> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const payee = lockingBytecodeToCashAddress({ bytecode: payeeLock, prefix: 'bchtest' });
  if (typeof payee === 'string') throw new Error(payee);
  const artifact = compileString(SOURCE, { suppressWarnings: true } as never);
  expect(artifact.abi.find((entry) => entry.name === 'put')?.runtimeLoopTransfers).toHaveLength(1);
  const coin = (): Utxo => { seed += 1; return { txid: seed.toString(16).padStart(64, '0'), vout: 0, satoshis: 400_000n }; };
  const funding = coin();
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: {}, initialBalance: CONTAINER,
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  for (let i = 0; i < 8; i += 1) await provider.seedUtxo(binToHex(aliceLock), coin());
  const signed = contract.connect(new Signer(alicePriv, provider)) as unknown as Record<string, any>;
  const entries = getEntryNftAddress(contract.inner, categoryId, 'bal');
  const container = getSatoshiContainerAddress(contract.inner, categoryId);
  const sum = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
    .reduce((total, utxo) => total + utxo.satoshis, 0n);
  return {
    call: async (fn, ...args) => {
      const before = captured.length;
      await signed[fn](...args).send();
      expect(captured.length).toBe(before + 1);
      const spend = captured[captured.length - 1]!;
      expect(verify(spend)).toBe(true);
      return spend;
    },
    bal: async (key) => {
      const entry = SortedList.fromUtxos(await provider.getUtxos(entries)).find(keyToSlot(bigIntToVmNumber(key)));
      return entry ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint : undefined;
    },
    balances: async () => ({ payee: await sum(payee.address), container: await sum(container) }),
    containerLock: addressToLockScript(container),
  };
}

/** What the contract's satoshi container gave up in `spend`. */
const containerPaid = (book: Book, spend: Spend): bigint => valueAt(spend.sourceOutputs, book.containerLock)
  - valueAt(spend.transaction.outputs, book.containerLock);

// Three int keys by slot. Passed as [HI, MID] the keys run against the slot order the entries settle in.
const slotOf = (key: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(key)));
const [, MID, HI] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n].sort((a, b) => (slotOf(a) < slotOf(b) ? -1 : 1));

describe('a sorted-mapping loop that pays every turn, on the direct convention', () => {
  it('stores and pays one update and one insert', async () => {
    const book = await setup();
    await book.call('seed', MID, 5n);
    const update = await book.call('put', [MID], [9n], payeeLock);
    expectLayout(update, 1, 1);
    expect(paymentsOf(update)).toStrictEqual([1_000n]);
    expect(containerPaid(book, update)).toBe(1_000n);
    expect(await book.bal(MID)).toBe(9n);
    // The insert rewrites its predecessor and adds its own entry.
    const insert = await book.call('put', [HI], [7n], payeeLock);
    expectLayout(insert, 2, 1);
    expect(paymentsOf(insert)).toStrictEqual([1_000n]);
    expect(containerPaid(book, insert)).toBe(1_000n);
    expect([await book.bal(MID), await book.bal(HI)]).toStrictEqual([9n, 7n]);
    expect(await book.balances()).toStrictEqual({ payee: 2_000n, container: CONTAINER - 2_000n });
  }, 600_000);

  it('settles two keys given against the slot order, pays each turn in the order given, and refuses a '
    + 'payment one satoshi short or an entry band one output late', async () => {
    const book = await setup();
    await book.call('seed', MID, 5n);
    const spend = await book.call('put', [HI, MID], [1n, 2n], payeeLock);
    expectLayout(spend, 2, 2);
    expect(paymentsOf(spend)).toStrictEqual([1_000n, 1_001n]);
    expect(containerPaid(book, spend)).toBe(2_001n);
    expect([await book.bal(HI), await book.bal(MID)]).toStrictEqual([1n, 2n]);
    expect(await book.balances()).toStrictEqual({ payee: 2_001n, container: CONTAINER - 2_001n });

    const payments = outputsAt(spend, payeeLock);
    const [kept] = outputsAt(spend, book.containerLock);
    const changeIndex = outputsAt(spend, aliceLock).at(-1)!;
    // A payment one satoshi short, the satoshi moved to the change: refused. The container keeping that satoshi
    // instead, from the change, passes.
    expect(verify(moveOne(spend, payments[0]!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(spend, payments[1]!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(spend, changeIndex, kept!))).toBe(true);
    // The entry band moved one output late, past the slot, as the builder used to lay it out: refused.
    const entries = entriesOf(spend);
    const late: Spend = structuredClone(spend);
    const [slot] = late.transaction.outputs.splice(entries.at(-1)! + 1, 1);
    late.transaction.outputs.splice(entries[0]!, 0, slot);
    expect(verify(late)).not.toBe(true);
  }, 600_000);
});
