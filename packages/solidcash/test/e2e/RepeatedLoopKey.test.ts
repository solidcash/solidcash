import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import {
  Contract, StatefulContract, SignatureTemplate, keyToSlot, getEntryNftAddress, SortedList,
} from '../../src/index.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

/**
 * A key a sorted-mapping loop repeats, and two spellings of one key outside a loop, on the direct convention.
 *
 * The EVM runs every turn: a turn that reads the entry it writes sees what an earlier turn of the same key wrote. The
 * transaction co-spends each entry once, so it cannot serve that later turn. The SDK used to merge such a key's turns
 * into one and send the call with fewer keys than the caller passed (`bump([7, 7])` left 4 where the EVM leaves 5);
 * it now refuses the repeat by name. A read-modify-write `+=` keeps accumulating every turn, and distinct keys settle
 * with the EVM's values. Two spellings of one key outside a loop are refused before anything is signed.
 */
const LOOPS: Record<string, string> = {
  bump: 'int n = this.bal[ks[i]]; this.bal[ks[i]] = n + 1;',
  double: 'int n = this.bal[ks[i]]; this.bal[ks[i]] += n;',
  tally: 'int n = this.bal[ks[i]]; this.seen = this.seen + n; this.bal[ks[i]] = 5;',
  drain: 'int b = this.bal[ks[i]]; delete this.bal[ks[i]]; this.seen = this.seen + b + 1;',
  index: 'this.bal[ks[i]] = i;',
  increment: 'this.bal[ks[i]] += 1;',
  restate: 'this.bal[ks[i]] = this.bal[ks[i]] + 1;',
  fill: 'this.bal[ks[i]] = 42;',
};
const source = (body: string): string => 'contract Book() { int seen; mapping(int => int) bal;'
  + ' function seed(int a, int v) { this.bal[a] = v; }'
  + ' function transfer(int from, int to, int v) { require(this.bal[from] >= v);'
  + '   this.bal[from] = this.bal[from] - v; this.bal[to] = this.bal[to] + v; }'
  + ' function setThenRead(int a, int b, int v) { this.bal[a] = v; this.seen = this.bal[b]; }'
  + ` function run(int[] ks) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const REPEAT = /vmap upsert loop bal: key \d+ of 'ks' repeats an earlier key/;

describe('a key a sorted-mapping loop repeats', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x7a10;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  interface Book {
    call: (fn: string, ...args: unknown[]) => Promise<void>;
    bal: (k: bigint) => Promise<bigint>;
    seen: () => Promise<bigint>;
  }
  const deploy = async (loop: string): Promise<Book> => {
    const artifact = compileString(source(LOOPS[loop]));
    const funding = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, funding);
    const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {},
      changeAddress: p2pkh.address,
    });
    const entries = getEntryNftAddress(contract.inner, categoryId, 'bal');
    type Calls = Record<string, (...a: unknown[]) => { send: () => Promise<unknown> }>;
    const book: Book = {
      call: async (fn, ...args) => {
        await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 200000n });
        await (contract as unknown as Calls)[fn](...args).send();
      },
      bal: async (k) => {
        const entry = SortedList.fromUtxos(await provider.getUtxos(entries)).find(keyToSlot(bigIntToVmNumber(k)));
        return entry ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint : 0n;
      },
      seen: async () => (await contract.getState() as { seen: bigint }).seen,
    };
    await book.call('seed', 7n, 3n);
    await book.call('seed', 9n, 4n);
    return book;
  };

  it.each([
    ['bump', '7, 7'], ['bump', '7, 9, 7'], ['double', '7, 7'], ['tally', '7, 7'], ['drain', '7, 7'], ['index', '7, 7'],
  ] as const)('refuses %s over the keys %s, leaving the entry as it was', async (loop, keys) => {
    const book = await deploy(loop);
    await expect(book.call('run', keys.split(', ').map(BigInt))).rejects.toThrow(REPEAT);
    expect(await book.bal(7n)).toBe(3n);
    expect(await book.seen()).toBe(0n);
  });

  it.each([
    ['bump', 4n, 5n, 0n], ['double', 6n, 8n, 0n], ['tally', 5n, 5n, 7n], ['drain', 0n, 0n, 9n], ['index', 0n, 1n, 0n],
  ] as const)('settles %s over distinct keys with the values the EVM leaves', async (loop, seven, nine, seen) => {
    const book = await deploy(loop);
    await book.call('run', [7n, 9n]);
    expect([await book.bal(7n), await book.bal(9n), await book.seen()]).toStrictEqual([seven, nine, seen]);
  });

  it.each([['increment'], ['restate']] as const)('accumulates every turn of a repeated key under %s', async (loop) => {
    const book = await deploy(loop);
    await book.call('run', [7n, 9n, 7n]);
    expect([await book.bal(7n), await book.bal(9n)]).toStrictEqual([5n, 5n]);
  });

  it('settles a repeated key whose loop stores one constant', async () => {
    const book = await deploy('fill');
    await book.call('run', [7n, 7n]);
    expect(await book.bal(7n)).toBe(42n);
  });

  it('refuses two spellings of one key outside a loop before anything is signed', async () => {
    const book = await deploy('fill');
    await expect(book.call('transfer', 7n, 7n, 2n)).rejects.toThrow(/duplicate slot/);
    await expect(book.call('setThenRead', 7n, 7n, 11n)).rejects.toThrow(/Duplicate stateful input/);
    await book.call('transfer', 7n, 9n, 2n);
    await book.call('setThenRead', 7n, 9n, 11n);
    expect([await book.bal(7n), await book.bal(9n), await book.seen()]).toStrictEqual([11n, 6n, 6n]);
  });

  it('publishes which loops read the entry they write, on the direct convention only', () => {
    const published = (loop: string, composition?: 'framed'): boolean | undefined => {
      const artifact = composition === undefined ? compileString(source(LOOPS[loop]))
        : compileStringMulti(source(LOOPS[loop]), { composition }).Book!;
      return artifact.abi.find((entry) => entry.name === 'run')?.sortedUpsertLoopInfo?.[0]?.readsWrittenEntry;
    };
    expect(['bump', 'double', 'tally', 'drain'].map((loop) => published(loop))).toStrictEqual([true, true, true, true]);
    expect(['index', 'increment', 'restate', 'fill'].map((loop) => published(loop)))
      .toStrictEqual([undefined, undefined, undefined, undefined]);
    expect(published('bump', 'framed')).toBeUndefined();
  });
});
