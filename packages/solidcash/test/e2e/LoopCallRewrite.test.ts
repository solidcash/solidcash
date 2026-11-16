/**
 * A sorted-mapping loop call the SDK would rewrite to reach the one order the covenant folds.
 *
 * The covenant folds a gap's new keys only one after another in ascending slot order, each right after the credited
 * entry it follows; it takes a repeated key merged into one turn, and leaves msg.sender's own credit out when the
 * sender's entry is co-spent once for the debit. The direct SDK used to rewrite the call's own arrays to reach that
 * order whatever the loop did with them, so it built and the covenant accepted another call than the caller's:
 * `put([1, 2])` storing `100 + i` stored 1 -> 101 and 2 -> 100, a turn's `this.last = ks[i]` or a later `ks[0]` saw the
 * reordered array, and netting the sender's own credit out dropped a turn whose value was its index, or a credit the
 * debit did not pay for.
 *
 * The compiler now publishes `pairwise` on a loop each of whose turns its own (key, value) pair fixes, and `senderDebit`
 * where each turn also debits msg.sender by what it credits; the SDK rewrites only those. A call the covenant folds as
 * given is built as given, and any other is refused before anything is built, naming the order the covenant takes and
 * why a rewrite would change the call. Each built call is checked with stock libauth's standard VM under the
 * production profile.
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
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv, aliceAddress, bobAddress, carolAddress } from '../fixture/vars.js';
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

interface Book {
  artifact: any;
  /** Sends a call as alice, the signer and so msg.sender, and checks the transaction it broadcast with the VM. */
  call: (fn: string, ...args: unknown[]) => Promise<any>;
  /** A mapping entry's value, or undefined while the key has no entry. */
  bal: (key: bigint | string) => Promise<bigint | undefined>;
  state: () => Promise<Record<string, unknown>>;
}

let seed = 0x40;
async function setup(source: string, initialState: Record<string, unknown> = {}): Promise<Book> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compileString(source, { suppressWarnings: true } as never);
  const coin = (): Utxo => { seed += 1; return { txid: seed.toString(16).padStart(64, '0'), vout: 0, satoshis: 400_000n }; };
  const funding = coin();
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState, changeAddress: change.address,
    senderLockingBytecode: aliceLock,
  } as never);
  for (let i = 0; i < 6; i += 1) await provider.seedUtxo(binToHex(aliceLock), coin());
  const signed = contract.connect(new Signer(alicePriv, provider)) as unknown as Record<string, any>;
  const entries = getEntryNftAddress(contract.inner, categoryId, 'bal');
  return {
    artifact,
    call: async (fn, ...args) => {
      const before = captured.length;
      const result = await signed[fn](...args).send();
      expect(captured.length).toBe(before + 1);
      expect(verify(captured[captured.length - 1]!)).toBe(true);
      return result;
    },
    bal: async (key) => {
      const bytes = typeof key === 'bigint' ? bigIntToVmNumber(key) : addressToLockScript(key);
      const entry = SortedList.fromUtxos(await provider.getUtxos(entries)).find(keyToSlot(bytes));
      return entry ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint : undefined;
    },
    state: async () => await contract.getState() as Record<string, unknown>,
  };
}

const loopOf = (artifact: any, fn: string): any => artifact.abi.find((entry: any) => entry.name === fn)
  ?.sortedUpsertLoopInfo?.[0];

// Two int keys by slot: on an empty map both are new in the HEAD gap, which the covenant folds only as [LO, HI].
const slotOf = (key: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(key)));
const [LO, HI] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n].sort((a, b) => (slotOf(a) < slotOf(b) ? -1 : 1));
// The fixtures' addresses by slot: bob < carol < alice. Alice signs, so she is msg.sender.
const book = (body: string): string => `contract Book() { int seen; int last; int first;
  mapping(int => int) bal; event Seen(int k, int v);
  function seed(int a, int v) { this.bal[a] = v; }
  function put(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const token = (body: string, valueType = 'int'): string => `contract Token() { mapping(address => ${valueType}) bal;
  function setBal(address a, ${valueType} v) { this.bal[a] = v; }
  function run(address[] rs, ${valueType}[] amounts) { for (int i = 0; i < rs.length; i++) { ${body} } } }`;
const MULTI_TRANSFER = 'this.bal[msg.sender] -= amounts[i]; this.bal[rs[i]] += amounts[i];';
const REVERSED = 'this.bal[msg.sender] -= amounts[i]; this.bal[rs[i]] += amounts[rs.length - 1 - i];';
const SCALAR_DEBIT = `contract Token() { mapping(address => int) bal;
  function setBal(address a, int v) { this.bal[a] = v; }
  function run(address[] rs, int[] amounts, int total) { this.bal[msg.sender] -= total;
    for (int i = 0; i < rs.length; i++) { this.bal[rs[i]] += amounts[i]; } } }`;

describe('a sorted-mapping loop call the SDK would rewrite', () => {
  it('refuses to reorder a loop whose value is its turn (`100 + i`), and builds the order the covenant folds', async () => {
    const loop = await setup(`contract Book() { mapping(int => int) bal;
      function put(int[] ks) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = 100 + i; } } }`);
    expect(loopOf(loop.artifact, 'put')).toMatchObject({ varyingArrayParam: 'ks', valueRuntimeExpression: true });
    expect(loopOf(loop.artifact, 'put').pairwise).toBeUndefined();
    // As given, HI takes 100 and LO 101. The covenant folds only [LO, HI], which stores the other way round.
    await expect(loop.call('put', [HI, LO])).rejects.toThrow(new RegExp(
      "vmap upsert loop bal: the covenant takes 'ks' only in the order of indices \\[1, 0\\].*each turn computes "
      + 'its value on chain, which may read its position'));
    expect([await loop.bal(HI), await loop.bal(LO)]).toStrictEqual([undefined, undefined]);
    await loop.call('put', [LO, HI]);
    expect([await loop.bal(LO), await loop.bal(HI)]).toStrictEqual([100n, 101n]);
  }, 600_000);

  it('leaves the arrays of a loop that emits an event per turn as the caller passed them', async () => {
    // The compiler runs a loop with an event per turn through its own permutation: the public arrays stay as given.
    const lowered = compileString(book('this.bal[ks[i]] = vs[i]; emit Seen(ks[i], i);'), { suppressWarnings: true } as never);
    expect(loopOf(lowered, 'put').varyingArrayParam).toMatch(/^__internal__vmapCounterPerm_ks_/);
    expect(loopOf(lowered, 'put').pairwise).toBeUndefined();
    // One that reads the entry first stays a loop over the public array, whose turns each emit: it is not reordered.
    const loop = await setup(book('emit Seen(ks[i], this.bal[ks[i]]); this.bal[ks[i]] += vs[i];'));
    expect(loopOf(loop.artifact, 'put')).toMatchObject({ varyingArrayParam: 'ks', siblingEffect: true });
    await expect(loop.call('put', [HI, LO], [10n, 20n])).rejects.toThrow(new RegExp(
      "the covenant takes 'ks' only in the order of indices \\[1, 0\\].*each turn has an effect besides this write"));
  }, 600_000);

  it('refuses a reorder a sibling write would see (`this.last = ks[i]`), and builds the folded order', async () => {
    const loop = await setup(book('this.bal[ks[i]] = vs[i]; this.last = ks[i];'), { seen: 0n, last: 0n, first: 0n });
    expect(loopOf(loop.artifact, 'put').siblingEffect).toBe(true);
    await expect(loop.call('put', [HI, LO], [10n, 20n])).rejects.toThrow(/only in the order of indices \[1, 0\]/);
    expect((await loop.state()).last).toBe(0n);
    await loop.call('put', [LO, HI], [20n, 10n]);
    expect([await loop.bal(LO), await loop.bal(HI), (await loop.state()).last]).toStrictEqual([20n, 10n, HI]);
  }, 600_000);

  it('refuses a reorder the function would see in a read of the array outside the loop', async () => {
    const loop = await setup(`contract Book() { int first; mapping(int => int) bal;
      function put(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] += vs[i]; }
        this.first = ks[0]; } }`, { first: 0n });
    expect(loopOf(loop.artifact, 'put').pairwise).toBeUndefined();
    await expect(loop.call('put', [HI, LO], [10n, 20n])).rejects.toThrow(
      /only in the order of indices \[1, 0\].*the compiler did not prove that each turn is fixed by its own key and value/);
    expect((await loop.state()).first).toBe(0n);
  }, 600_000);

  it('refuses to net out the sender\'s own credit where the turn\'s index sets the value', async () => {
    // As given: alice 100 (the loop's write runs after the debit), carol 101. Dropping alice's turn shifts carol to 100.
    const loop = await setup(`contract Token() { mapping(address => int) bal;
      function setBal(address a, int v) { this.bal[a] = v; }
      function run(address[] rs) { this.bal[msg.sender] -= 1;
        for (int i = 0; i < rs.length; i++) { this.bal[rs[i]] = 100 + i; } } }`);
    await loop.call('setBal', aliceAddress, 1000n);
    await expect(loop.call('run', [aliceAddress, carolAddress])).rejects.toThrow(new RegExp(
      "vmap upsert loop bal: element 0 of 'rs' credits the sender itself.*each turn computes its value on chain"));
    expect([await loop.bal(aliceAddress), await loop.bal(carolAddress)]).toStrictEqual([1000n, undefined]);
    await loop.call('run', [carolAddress]);
    expect([await loop.bal(aliceAddress), await loop.bal(carolAddress)]).toStrictEqual([999n, 100n]);
  }, 600_000);

  it('refuses to net out a credit the debit does not pay for, or one whose value index is not its own', async () => {
    // `bal[msg.sender] -= total` is not the turn's own debit: dropping alice's credit of 10 would lose it.
    const total = await setup(SCALAR_DEBIT);
    await total.call('setBal', aliceAddress, 1000n);
    await expect(total.call('run', [aliceAddress, carolAddress], [10n, 20n], 30n)).rejects.toThrow(
      /element 0 of 'rs' credits the sender itself.*the loop is not proven to debit the sender by the value it credits/);
    expect(await total.bal(aliceAddress)).toBe(1000n);
    // `amounts[rs.length - 1 - i]` is not the turn's own amount.
    const reversed = await setup(token(REVERSED));
    await reversed.call('setBal', aliceAddress, 1000n);
    await expect(reversed.call('run', [aliceAddress, carolAddress], [10n, 20n])).rejects.toThrow(
      /element 0 of 'rs' credits the sender itself/);
    expect(await reversed.bal(aliceAddress)).toBe(1000n);
  }, 600_000);

  it('still reorders, merges and nets a multiTransfer, whose result is its pairs alone', async () => {
    const loop = await setup(token(MULTI_TRANSFER));
    await loop.call('setBal', aliceAddress, 1000n);
    await loop.call('setBal', bobAddress, 100n);
    // carol is new in bob's gap, so the covenant takes bob first: the SDK reorders the pairs.
    await loop.call('run', [carolAddress, bobAddress], [20n, 10n]);
    expect([await loop.bal(aliceAddress), await loop.bal(bobAddress), await loop.bal(carolAddress)])
      .toStrictEqual([970n, 110n, 20n]);
    // A repeated key merges, and alice's own credit nets out against her debit.
    await loop.call('run', [bobAddress, aliceAddress, carolAddress, bobAddress], [1n, 50n, 2n, 3n]);
    expect([await loop.bal(aliceAddress), await loop.bal(bobAddress), await loop.bal(carolAddress)])
      .toStrictEqual([964n, 114n, 22n]);
  }, 600_000);

  it('still orders a credit loop\'s new keys in one gap, pairing each key with its own value', async () => {
    const credit = await setup(book('this.bal[ks[i]] += vs[i];'));
    await credit.call('put', [HI, LO], [10n, 20n]);
    expect([await credit.bal(HI), await credit.bal(LO)]).toStrictEqual([10n, 20n]);
    // A repeated key of a plain store keeps the last value, as the EVM leaves it.
    const store = await setup(book('this.bal[ks[i]] = vs[i];'));
    await store.call('put', [HI, LO, HI], [1n, 2n, 3n]);
    expect([await store.bal(HI), await store.bal(LO)]).toStrictEqual([3n, 2n]);
  }, 600_000);

  it('refuses to net out the sender\'s own credit where the EVM would revert at that turn', async () => {
    // An unsigned balance: alice's debit of 20 at her own turn takes her below zero, so the EVM reverts the call.
    const unsigned = await setup(token(MULTI_TRANSFER, 'uint'));
    await unsigned.call('setBal', aliceAddress, 10n);
    await expect(unsigned.call('run', [aliceAddress], [20n])).rejects.toThrow(
      /under the EVM this call reverts: turn 0 debits the sender to -10/);
    expect(await unsigned.bal(aliceAddress)).toBe(10n);
    await unsigned.call('run', [aliceAddress, carolAddress], [5n, 4n]);
    expect([await unsigned.bal(aliceAddress), await unsigned.bal(carolAddress)]).toStrictEqual([6n, 4n]);
  }, 600_000);
});
