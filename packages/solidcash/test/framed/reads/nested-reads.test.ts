import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  buildPushdataCommitment,
  encodeIntegerValue,
  encodeResultList,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { readFramedEntry, type FramedReadOptions } from '../../../src/framed/read/index.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a view that reads another contract's view off chain, through the shipped read module.
 *
 * The caller names the other contracts in `externals`; the module plans one `STATIC` frame per contract over that
 * contract's own live records, learns each callee before its caller, and returns the root entry's own answer. A
 * read is never broadcast, so the provider's transaction count is asserted to show it. A nested entry that
 * refuses is reported as the innermost frame's refusal, and an entry calling a contract the caller did not supply
 * is refused by name.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const A = seededCategory('nested reads A');
const B = seededCategory('nested reads B');
const C = seededCategory('nested reads C');
const A_HEX = bytesToHex(A);
const B_HEX = bytesToHex(B);
const C_HEX = bytesToHex(C);
const ADDRESS_B = validatorAddress(B, VALIDATOR_PROGRAM);
const ADDRESS_C = validatorAddress(C, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

interface UtxoShape {
  readonly txid: string;
  readonly vout: number;
  readonly satoshis: bigint;
  readonly token: {
    readonly category: string;
    readonly amount: bigint;
    readonly nft: { readonly capability: 'minting' | 'mutable'; readonly commitment: string };
  };
}

/** One live UTXO as the provider holds it: a token at `lock`, with the commitment it carries. */
function utxo(
  txid: string, satoshis: bigint, category: string, capability: 'minting' | 'mutable', commitment: Uint8Array,
): UtxoShape {
  return {
    txid, vout: 0, satoshis,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

/**
 * Funds one contract's deployment: its master pool, its records, and — for the group root — a validator.
 *
 * The master and the validator sit where `deployMaster` puts them; each record sits at the data-NFT covenant the
 * contract's category derives, carrying the pushdata commitment the constructor would have written.
 */
async function fund(
  provider: MockNetworkProvider,
  options: {
    readonly artifact: Artifact;
    readonly category: Uint8Array;
    readonly categoryHex: string;
    readonly seed: string;
    readonly records?: readonly Uint8Array[];
    readonly withValidator?: boolean;
  },
): Promise<void> {
  const deployed = deployMaster(options.artifact, options.category, VALIDATOR_PROGRAM);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(txid('11', 'a'), 20_000n, options.categoryHex, 'minting', empty));
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address),
      utxo(txid('22', 'b'), 20_000n, options.categoryHex, 'mutable', empty));
  }
  for (const [index, commitment] of (options.records ?? []).entries()) {
    await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(options.categoryHex)),
      utxo(txid(`${33 + index}`, 'c'), 20_000n, options.categoryHex, 'mutable', commitment));
  }
}

describe('reading a view that reads another contract\'s view off chain', () => {
  it('returns the composed value, with nothing broadcast', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function value() view returns (int); }'
      + ' contract B { int public v; function value() view returns (int) { return this.v; } }'
      + ' contract A {'
      + `   function peek() view returns (int) { return IB(0x${hex(ADDRESS_B)}).value(); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const bArtifact = artifacts.B!;
    const commitment = new Uint8Array(Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { v: 7n }, 0), 'hex'));

    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });
    await fund(provider, { artifact: bArtifact, category: B, categoryHex: B_HEX, seed: 'b', records: [commitment] });

    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider,
      artifact: artifacts.A!,
      categoryId: A_HEX,
      functionName: 'peek',
      externals: { IB: { artifact: bArtifact, categoryId: B_HEX } },
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(7n);
    expect(result.retval).toStrictEqual(encodeResultList([encodeIntegerValue(7n)]));
    // The read is a local evaluation: the provider's transaction count does not move.
    expect(transactionCount(provider)).toBe(before);
  });

  it('returns the value at the end of a three-contract chain', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function mid() view returns (int); }'
      + ' interface IC { function leaf() view returns (int); }'
      + ' contract C { int public c; function leaf() view returns (int) { return this.c; } }'
      + ' contract B {'
      + `   function mid() view returns (int) { return IC(0x${hex(ADDRESS_C)}).leaf(); }`
      + ' }'
      + ' contract A {'
      + `   function top() view returns (int) { return IB(0x${hex(ADDRESS_B)}).mid(); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const cArtifact = artifacts.C!;
    const commitment = new Uint8Array(Buffer.from(buildPushdataCommitment(cArtifact.stateLayout!, { c: 42n }, 0), 'hex'));

    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });
    await fund(provider, { artifact: artifacts.B!, category: B, categoryHex: B_HEX, seed: 'b' });
    await fund(provider, { artifact: cArtifact, category: C, categoryHex: C_HEX, seed: 'c', records: [commitment] });

    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider,
      artifact: artifacts.A!,
      categoryId: A_HEX,
      functionName: 'top',
      externals: {
        IB: { artifact: artifacts.B!, categoryId: B_HEX },
        IC: { artifact: cArtifact, categoryId: C_HEX },
      },
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(42n);
    expect(transactionCount(provider)).toBe(before);
  });

  it('reports the innermost refusal when a nested view refuses, and builds nothing', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function grab() view returns (int); }'
      + ' contract B {'
      + '   int public v;'
      + '   function grab() view returns (int) {'
      + '     require(this.v > 0, "v must be positive");'
      + '     return this.v;'
      + '   }'
      + ' }'
      + ' contract A {'
      + `   function probe() view returns (int) { return IB(0x${hex(ADDRESS_B)}).grab(); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const bArtifact = artifacts.B!;
    // The record holds zero, which the callee's own guard refuses.
    const zero = new Uint8Array(Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { v: 0n }, 0), 'hex'));

    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });
    await fund(provider, { artifact: bArtifact, category: B, categoryHex: B_HEX, seed: 'b', records: [zero] });

    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider,
      artifact: artifacts.A!,
      categoryId: A_HEX,
      functionName: 'probe',
      externals: { IB: { artifact: bArtifact, categoryId: B_HEX } },
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(false);
    // The callee is the innermost frame: the caller's body never returns because the callee refused.
    expect(result.refusal?.innermost?.contract).toBe('B');
    expect(result.refusal?.innermost?.functionName).toBe('B.grab()');
    expect(result.objection).toMatch(/frame "read-1" of B\.grab\(\) at line \d+/);
    expect(result.objection).toMatch(/OP_VERIFY/);
    // The artifact publishes the callee's `require` message, and the innermost reason carries it.
    expect(bArtifact.debug?.requires?.some((entry) => entry.message === 'v must be positive')).toBe(true);
    expect(result.refusal?.innermost?.reason.message).toBe('v must be positive');
    expect(result.values).toStrictEqual([]);
    expect(transactionCount(provider)).toBe(before);
  });

  it('reports the root\'s own guard between two reads, not the later read it never makes', async () => {
    // A paging getter: the root reads a count, refuses an index past it, and only then reads the element. The element
    // read is planned too and refuses its own index, but the root stops before making that call, so its guard is the
    // refusal the execution meets first (spec V6).
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function count() view returns (int); function at(int i) view returns (int); }'
      + ' contract B {'
      + '   int public n;'
      + '   function count() view returns (int) { return this.n; }'
      + '   function at(int i) view returns (int) { require(i < this.n, "no such element"); return i * 10; }'
      + ' }'
      + ' contract A {'
      + '   function page(int index) view returns (int) {'
      + `     int total = IB(0x${hex(ADDRESS_B)}).count();`
      + '     require(index < total, "index out of bounds");'
      + `     return IB(0x${hex(ADDRESS_B)}).at(index);`
      + '   }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const bArtifact = artifacts.B!;
    const two = new Uint8Array(Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { n: 2n }, 0), 'hex'));

    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });
    await fund(provider, { artifact: bArtifact, category: B, categoryHex: B_HEX, seed: 'b', records: [two] });
    // The read runs one frame per call, so the chain holds a master of B for each.
    await provider.addUtxo(bytesToHex(deployMaster(bArtifact, B, VALIDATOR_PROGRAM).lockingBytecode),
      utxo('b211'.padEnd(64, 'd'), 20_000n, B_HEX, 'minting', empty));

    const read = (index: bigint): ReturnType<typeof readFramedEntry> => readFramedEntry({
      provider, artifact: artifacts.A!, categoryId: A_HEX, functionName: 'page', args: [index],
      externals: { IB: { artifact: bArtifact, categoryId: B_HEX } }, vm: compositionMachine(),
    });
    expect((await read(1n)).value).toBe(10n);

    const result = await read(2n);
    expect(result.accepted).toBe(false);
    expect(result.refusal?.innermost?.functionName).toBe('A.page()');
    expect(result.refusal?.innermost?.reason.message).toBe('index out of bounds');
    expect(result.objection).toContain('index out of bounds');
    expect(result.refusal?.refusals.map((refusal) => refusal.reason.message))
      .toEqual(expect.arrayContaining(['index out of bounds', 'no such element']));
  });

  it('refuses by name an entry calling a contract the caller did not supply', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IB { function mid() view returns (int); }'
      + ' interface IC { function leaf() view returns (int); }'
      + ' contract C { int public c; function leaf() view returns (int) { return this.c; } }'
      + ' contract B {'
      + `   function mid() view returns (int) { return IC(0x${hex(ADDRESS_C)}).leaf(); }`
      + ' }'
      + ' contract A {'
      + `   function top() view returns (int) { return IB(0x${hex(ADDRESS_B)}).mid(); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const provider = new MockNetworkProvider();
    await fund(provider, { artifact: artifacts.A!, category: A, categoryHex: A_HEX, seed: 'a', withValidator: true });

    // Only the first contract of the chain is supplied, so the second contract's call names a contract the caller
    // did not supply.
    const options: FramedReadOptions = {
      provider,
      artifact: artifacts.A!,
      categoryId: A_HEX,
      functionName: 'top',
      externals: { IB: { artifact: artifacts.B!, categoryId: B_HEX } },
      vm: compositionMachine(),
    };
    await expect(readFramedEntry(options)).rejects.toThrow(
      /entry "B\.mid\(\)" makes 1 external call\(s\): "IC\.leaf\(\)" .* is not supplied in externals/,
    );
  });
});
