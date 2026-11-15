/**
 * A sorted-mapping loop write whose value reads another entry.
 *
 * The covenant folds `m[k] = m[k] + v` into the entry it co-spends: the new value is that entry's old value plus `v`.
 * The compiler took any mapping read on the left of `+` or `-` for that old value, so `bal[ks[i]] = bal[7] + 1` stored
 * `bal[ks[i]] + 1`: with bal[3] = 5 and bal[7] = 50, `put([3])` stored 6 where the EVM stores 51. Another mapping
 * (`other[ks[i]] + 1`), a using-for `bal[7].add(1)` and a counter loop's `bal[i] = bal[7] + amount` did the same. Such
 * a write now stores an absolute value, which the covenant computes from the other entry's own authenticated read. A
 * call one of whose turns reads an entry a turn of the same call writes is refused by name before anything is built:
 * the transaction co-spends each entry once and cannot serve that read. The same writes outside a loop were already
 * computed in full, and stay so. Each built call is checked with stock libauth's standard VM under the production
 * profile, on the direct convention and the default one.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, bigIntToVmNumber, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString as compileDefault } from '@solidcash/solidc';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract, SortedList, getEntryNftAddress, keyToSlot } from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString as compileDirect } from '../direct-compile.js';
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

interface Deployed {
  /** Sends a call as alice and checks the transaction it broadcast with the VM. */
  call: (fn: string, ...args: unknown[]) => Promise<any>;
  /** An entry's value, or undefined while the key has no entry. */
  get: (mapping: string, key: bigint) => Promise<bigint | undefined>;
}

type Compile = (source: string) => any;
/** Each convention compiles the SolidCash sources as given and the Solidity ones under evmCompat. */
const conventions: Array<[string, { compile: Compile; solidity: Compile }]> = [
  ['the direct convention', {
    compile: (source) => compileDirect(source, { suppressWarnings: true } as never),
    solidity: (source) => compileDirect(source, { suppressWarnings: true, evmCompat: true, forceStateful: true } as never),
  }],
  ['the default convention', {
    compile: (source) => compileDefault(source, { suppressWarnings: true } as never),
    solidity: (source) => compileDefault(source, { suppressWarnings: true, evmCompat: true, forceStateful: true } as never),
  }],
];

let seed = 0x5a0;
async function setup(source: string, compile: Compile): Promise<Deployed> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compile(source);
  const coin = (): Utxo => { seed += 1; return { txid: seed.toString(16).padStart(64, '0'), vout: 0, satoshis: 400_000n }; };
  const funding = coin();
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: {}, changeAddress: change.address,
    senderLockingBytecode: aliceLock,
  } as never);
  for (let i = 0; i < 8; i += 1) await provider.seedUtxo(binToHex(aliceLock), coin());
  const signed = contract.connect(new Signer(alicePriv, provider)) as unknown as Record<string, any>;
  return {
    call: async (fn, ...args) => {
      const before = captured.length;
      const result = await signed[fn](...args).send();
      expect(captured.length).toBe(before + 1);
      expect(verify(captured[captured.length - 1]!)).toBe(true);
      return result;
    },
    get: async (mapping, key) => {
      const entries = getEntryNftAddress(contract.inner, categoryId, mapping);
      const entry = SortedList.fromUtxos(await provider.getUtxos(entries)).find(keyToSlot(bigIntToVmNumber(key)));
      return entry ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint : undefined;
    },
  };
}

const book = (body: string): string => `contract Book() { mapping(int => int) bal; mapping(int => int) other;
  event Seen(int k, int v);
  function seed(int a, int v) { this.bal[a] = v; }
  function seedOther(int a, int v) { this.other[a] = v; }
  function put(int[] ks) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const safeMath = (functions: string): string => `pragma solidity ^0.8.0;
library SafeMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= a); return c; }
  function sub(uint256 a, uint256 b) internal pure returns (uint256) { require(b <= a); return a - b; }
}
contract Book {
  using SafeMath for uint256;
  mapping(uint256 => uint256) bal;
  mapping(uint256 => uint256) other;
  function seed(uint256 a, uint256 v) public { bal[a] = v; }
  function seedOther(uint256 a, uint256 v) public { other[a] = v; }
  ${functions}
}`;
const READ_YOUR_WRITES = new RegExp("vmap upsert loop bal: recipient \\d+'s entry is already co-spent this tx; "
  + 'a read-your-writes transition is required');

describe.each(conventions)('a sorted-mapping loop write whose value reads another entry, on %s', (_label, { compile, solidity }) => {
  it('stores another entry of the mapping plus or minus the operand, as the EVM does', async () => {
    const plus = await setup(book('this.bal[ks[i]] = this.bal[7] + 1;'), compile);
    await plus.call('seed', 3n, 5n);
    await plus.call('seed', 7n, 50n);
    await plus.call('put', [3n]);
    expect([await plus.get('bal', 3n), await plus.get('bal', 7n)]).toStrictEqual([51n, 50n]);
    // Every turn reads the same entry 7, absent key or present.
    await plus.call('put', [3n, 4n]);
    expect([await plus.get('bal', 3n), await plus.get('bal', 4n)]).toStrictEqual([51n, 51n]);
    const minus = await setup(book('this.bal[ks[i]] = this.bal[7] - 1;'), compile);
    await minus.call('seed', 3n, 5n);
    await minus.call('seed', 7n, 50n);
    await minus.call('put', [3n]);
    expect(await minus.get('bal', 3n)).toBe(49n);
  }, 600_000);

  it('refuses by name a call whose turn reads an entry the same call writes', async () => {
    // As given, turn 0 writes entry 7 (51) and turn 1 reads it (52). The transaction co-spends entry 7 once.
    const loop = await setup(book('this.bal[ks[i]] = this.bal[7] + 1;'), compile);
    await loop.call('seed', 3n, 5n);
    await loop.call('seed', 7n, 50n);
    await expect(loop.call('put', [7n, 3n])).rejects.toThrow(READ_YOUR_WRITES);
    expect([await loop.get('bal', 3n), await loop.get('bal', 7n)]).toStrictEqual([5n, 50n]);
    // `bal[ks[0]]` is the entry turn 0 writes, so every call of this loop reads an entry it writes.
    const first = await setup(book('this.bal[ks[i]] = this.bal[ks[0]] + 1;'), compile);
    await first.call('seed', 3n, 5n);
    await expect(first.call('put', [3n])).rejects.toThrow(READ_YOUR_WRITES);
    await expect(first.call('put', [3n, 4n])).rejects.toThrow(READ_YOUR_WRITES);
    expect([await first.get('bal', 3n), await first.get('bal', 4n)]).toStrictEqual([5n, undefined]);
  }, 600_000);

  it('stores another mapping\'s entry at the same key plus the operand', async () => {
    const loop = await setup(book('this.bal[ks[i]] = this.other[ks[i]] + 1;'), compile);
    await loop.call('seed', 3n, 5n);
    await loop.call('seedOther', 3n, 50n);
    await loop.call('put', [3n]);
    expect([await loop.get('bal', 3n), await loop.get('other', 3n)]).toStrictEqual([51n, 50n]);
  }, 600_000);

  it('stores another entry plus the operand where the loop counter is the key, and folds its own entry', async () => {
    const loop = await setup(`contract Book() { mapping(int => int) bal;
      function seed(int a, int v) { this.bal[a] = v; }
      function fromSeven(int n, int amount) { for (int i = 0; i < n; i = i + 1) { bal[i] = bal[7] + amount; } require(true); }
      function credit(int n, int amount) { for (int i = 0; i < n; i = i + 1) { bal[i] = bal[i] + amount; } require(true); } }`,
    compile);
    await loop.call('seed', 0n, 5n);
    await loop.call('seed', 7n, 50n);
    await loop.call('fromSeven', 2n, 1n);
    expect([await loop.get('bal', 0n), await loop.get('bal', 1n), await loop.get('bal', 7n)]).toStrictEqual([51n, 51n, 50n]);
    await loop.call('credit', 2n, 3n);
    expect([await loop.get('bal', 0n), await loop.get('bal', 1n)]).toStrictEqual([54n, 54n]);
  }, 600_000);

  it('still folds a write of its own entry, spelled out or through a local', async () => {
    const loop = await setup(book('this.bal[ks[i]] = this.bal[ks[i]] + 1;'), compile);
    await loop.call('seed', 3n, 5n);
    await loop.call('put', [3n, 4n]);
    expect([await loop.get('bal', 3n), await loop.get('bal', 4n)]).toStrictEqual([6n, 1n]);
    // The two keys canonicalize alike through the local, so the symbol pass gives them one entry slot.
    const local = await setup(book('int k = ks[i]; this.bal[k] = this.bal[ks[i]] + 1;'), compile);
    await local.call('seed', 3n, 5n);
    await local.call('put', [3n, 4n]);
    expect([await local.get('bal', 3n), await local.get('bal', 4n)]).toStrictEqual([6n, 1n]);
  }, 600_000);

  it('stores a using-for add or sub on another entry, and folds one on its own entry', async () => {
    const loop = await setup(safeMath(`
      function other7(uint256[] memory ks) public { for (uint256 i = 0; i < ks.length; i++) { bal[ks[i]] = bal[7].add(1); } }
      function less7(uint256[] memory ks) public { for (uint256 i = 0; i < ks.length; i++) { bal[ks[i]] = bal[7].sub(1); } }
      function fromOther(uint256[] memory ks) public {
        for (uint256 i = 0; i < ks.length; i++) { bal[ks[i]] = other[ks[i]].add(1); } }
      function own(uint256[] memory ks, uint256[] memory vs) public {
        for (uint256 i = 0; i < ks.length; i++) { bal[ks[i]] = bal[ks[i]].add(vs[i]); } }`), solidity);
    await loop.call('seed', 3n, 5n);
    await loop.call('seed', 7n, 50n);
    await loop.call('seedOther', 3n, 70n);
    await loop.call('other7', [3n]);
    expect(await loop.get('bal', 3n)).toBe(51n);
    await loop.call('less7', [3n]);
    expect(await loop.get('bal', 3n)).toBe(49n);
    await loop.call('fromOther', [3n]);
    expect(await loop.get('bal', 3n)).toBe(71n);
    await loop.call('own', [3n], [2n]);
    expect(await loop.get('bal', 3n)).toBe(73n);
  }, 600_000);

  it('computes the same writes outside a loop, as it did', async () => {
    const plain = await setup(`contract Book() { mapping(int => int) bal; mapping(int => int) other;
      function seed(int a, int v) { this.bal[a] = v; }
      function seedOther(int a, int v) { this.other[a] = v; }
      function fromKey(int a, int b) { this.bal[a] = this.bal[b] + 1; }
      function fromSeven(int a) { this.bal[a] = this.bal[7] - 1; }
      function fromOther(int a) { this.bal[a] = this.other[a] + 1; } }`, compile);
    await plain.call('seed', 3n, 5n);
    await plain.call('seed', 7n, 50n);
    await plain.call('seedOther', 4n, 70n);
    await plain.call('fromKey', 3n, 7n);
    expect(await plain.get('bal', 3n)).toBe(51n);
    await plain.call('fromSeven', 3n);
    expect(await plain.get('bal', 3n)).toBe(49n);
    await plain.call('fromOther', 4n);
    expect(await plain.get('bal', 4n)).toBe(71n);
    const usingFor = await setup(safeMath(
      'function fromKey(uint256 a, uint256 b) public { bal[a] = bal[b].add(1); }',
    ), solidity);
    await usingFor.call('seed', 3n, 5n);
    await usingFor.call('seed', 7n, 50n);
    await usingFor.call('fromKey', 3n, 7n);
    expect(await usingFor.get('bal', 3n)).toBe(51n);
  }, 600_000);
});
