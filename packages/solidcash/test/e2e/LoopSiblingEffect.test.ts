import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract, SignatureTemplate, keyToSlot, getEntryNftAddress, SortedList,
} from '../../src/index.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

/**
 * A sorted-mapping loop with a per-turn effect besides the write, and a repeated key.
 *
 * The EVM runs every turn's effect once. The SDK merges a repeated key's turns into one co-spend, so a per-turn
 * effect the write does not carry - a scalar `seen += 1`, an event, a per-turn require - would run one time fewer.
 * `bal[k] = 42; seen += 1` over [7, 7] left seen 1 where the EVM leaves 2. The compiler now publishes `siblingEffect`
 * on such a loop and the SDK refuses a repeated key by name. A loop whose only per-turn work is the write it merges
 * exactly (`+= v[i]`, a plain `= c`, a scalar `+= a`) keeps its merge, and distinct keys settle unchanged.
 */
const LOOPS: Record<string, string> = {
  setThenCount: 'this.bal[ks[i]] = 42; this.seen = this.seen + 1;',
  deleteThenCount: 'delete this.bal[ks[i]]; this.seen = this.seen + 1;',
  creditThenCount: 'this.bal[ks[i]] += 1; this.seen = this.seen + 1;',
  setOnly: 'this.bal[ks[i]] = 42;',
  creditPerKey: 'this.bal[ks[i]] += vs[i];',
  creditFixed: 'this.bal[ks[i]] += amount;',
};
const source = (body: string): string => 'contract Book() { int seen; mapping(int => int) bal;'
  + ' function seed(int a, int v) { this.bal[a] = v; }'
  + ` function run(int[] ks, int[] vs, int amount) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const REFUSAL = /vmap upsert loop bal: key \d+ of 'ks' repeats an earlier key, and each turn has its own effect/;

describe('a sorted-mapping loop with a per-turn effect besides its write', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x5100;
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

  it.each([['setThenCount'], ['deleteThenCount'], ['creditThenCount']] as const)(
    'refuses %s with a repeated key, leaving seen untouched', async (loop) => {
      const book = await deploy(loop);
      await expect(book.call('run', [7n, 7n], [1n, 1n], 1n)).rejects.toThrow(REFUSAL);
      expect(await book.seen()).toBe(0n);
    });

  it('counts each distinct turn of a sibling scalar (seen reaches 2, bal set)', async () => {
    const book = await deploy('setThenCount');
    await book.call('run', [7n, 9n], [1n, 1n], 1n);
    expect([await book.bal(7n), await book.bal(9n), await book.seen()]).toStrictEqual([42n, 42n, 2n]);
  });

  it('keeps the merge of a loop whose only per-turn work is the write it merges exactly', async () => {
    const setOnly = await deploy('setOnly');
    await setOnly.call('run', [7n, 7n], [0n, 0n], 0n);
    expect(await setOnly.bal(7n)).toBe(42n);

    const perKey = await deploy('creditPerKey');
    await perKey.call('run', [7n, 7n], [10n, 20n], 0n);
    expect(await perKey.bal(7n)).toBe(33n); // 3 + 10 + 20, the accumulate the covenant applies per occurrence

    const fixed = await deploy('creditFixed');
    await fixed.call('run', [7n, 7n], [0n, 0n], 5n);
    expect(await fixed.bal(7n)).toBe(13n); // 3 + 5 + 5
  });

  it('publishes siblingEffect only where the loop body has an effect besides the write', () => {
    const published = (loop: string): boolean | undefined =>
      compileString(source(LOOPS[loop])).abi.find((entry) => entry.name === 'run')
        ?.sortedUpsertLoopInfo?.[0]?.siblingEffect;
    expect(['setThenCount', 'deleteThenCount', 'creditThenCount'].map(published)).toStrictEqual([true, true, true]);
    expect(['setOnly', 'creditPerKey', 'creditFixed'].map(published)).toStrictEqual([undefined, undefined, undefined]);
  });
});
