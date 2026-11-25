import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { callRecordDigest, parseCallRecord } from '../../src/stateful/call-record.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Direct multi-call (docs/wip/call-records/DESIGN.md, sections 3, 4 and 7): a direct caller's calls to one callee
 * run in one spend of the callee's master through its multi-call entry, each call reading its own frame's record.
 * Every contract here is a direct compile, and no transaction carries a message-bus input.
 */

const DIRECT = { forceStateful: true, evmCompat: true, suppressWarnings: true } as const;
const CALLEE = { ...DIRECT, callBatch: true } as const;
const CALL_BATCH = { selector: '53434442' };
const PRAGMA = 'pragma solidity ^0.8.0;\n';

const NUMBER_SOURCE = `${PRAGMA}contract NumberSource {
    mapping(uint256 => uint256) public values;
    function size() public pure returns (uint256) { return 2; }
    function seed(uint256 index, uint256 value) public { values[index] = value; require(true); }
    function read(uint256 index) public view returns (uint256) { return values[index]; }
  }`;

const NUMBER_COLLECTOR = `${PRAGMA}interface INumberSource {
    function size() external view returns (uint256);
    function read(uint256 index) external view returns (uint256);
  }
  contract NumberCollector(address source) {
    function collect(uint256 offset) public view returns (uint256[] memory) {
      uint256 length = INumberSource(source).size() - offset;
      uint256[] memory result = new uint256[](length);
      for (uint256 index = 0; index < length; index++) {
        result[index] = INumberSource(source).read(index + offset);
      }
      return result;
    }
  }`;

const VALUES = `${PRAGMA}contract Values {
    mapping(uint256 => uint256) items;
    function put(uint256 index, uint256 value) public { items[index] = value; require(true); }
    function at(uint256 index) public view returns (uint256) { return items[index]; }
  }`;

const READER = `${PRAGMA}interface IValues { function at(uint256 index) external view returns (uint256); }
  contract Reader(IValues store) {
    function many(uint256 index, uint256 limit) public view returns (uint256[] memory) {
      uint256 length = limit;
      uint256[] memory result = new uint256[](length);
      for (uint256 i = 0; i < length; i = i + 1) {
        result[i] = store.at(i + index);
      }
      return result;
    }
  }`;

const PAIR_LOOP = `${PRAGMA}interface IValues { function at(uint256 index) external view returns (uint256); }
  contract PairLoop(IValues store) {
    uint256 public last;
    function pairs(uint256 n) public {
      uint256 acc = 0;
      for (uint256 i = 0; i < n; i = i + 1) {
        uint256 low = store.at(i);
        uint256 high = store.at(i + 2);
        acc = acc * 100 + low * 10 + high;
      }
      last = acc;
      require(true);
    }
  }`;

const BOOK_INTERFACE = `interface IBook {
    function priceOf(uint256 key) external view returns (uint256);
    function totalOf() external view returns (uint256);
  }
  `;

const BOOK = `contract Book {
    mapping(uint256 => uint256) prices;
    uint256 total;
    function setPrice(uint256 key, uint256 value) public { prices[key] = value; require(true); }
    function setTotal(uint256 value) public { total = value; require(true); }
    function priceOf(uint256 key) public view returns (uint256) { return prices[key]; }
    function totalOf() public view returns (uint256) { return total; }
  }
  `;

const SPREAD = `contract Spread(address book) {
    uint256 public last;
    function spread(uint256 a, uint256 b) public {
      uint256 before = IBook(book).totalOf();
      uint256 p = IBook(book).priceOf(a);
      uint256 q = IBook(book).priceOf(b);
      uint256 again = IBook(book).totalOf();
      last = before * 1000 + p * 100 + q * 10 + again;
      require(true);
    }
  }`;

const SINK = `${PRAGMA}contract Sink {
    uint16 public total;
    function echo(uint16 value) public pure returns (uint16) { return value; }
  }`;

const COORDINATOR = `${PRAGMA}interface ISink { function echo(uint16 value) external view returns (uint16); }
  contract Coordinator(address sink) {
    uint16 public observed;
    function runReturning(uint16[3] memory values) public {
      uint16 acc = 0;
      for (uint i = 0; i < values.length; i++) {
        if (values[i] != 0) acc = acc * 10 + ISink(sink).echo(values[i]);
      }
      observed = acc;
      require(true);
    }
  }`;

const COUNTER = `${PRAGMA}contract Counter {
    uint256 count;
    function inc() public returns (uint256) { count = count + 1; require(true); return count; }
    function add(uint256 value) public { count = count + value; require(true); }
    function get() public view returns (uint256) { return count; }
  }`;

const TALLY = `${PRAGMA}interface ICounter {
    function inc() external returns (uint256);
    function add(uint256 value) external;
    function get() external view returns (uint256);
  }
  contract Tally(address counter) {
    uint256 public total;
    function tally(uint256 n) public {
      uint256 acc = 0;
      for (uint256 i = 0; i < n; i = i + 1) { acc = acc + ICounter(counter).inc(); }
      total = acc;
      require(true);
    }
    function bump(uint256 a, uint256 b) public {
      ICounter(counter).add(a);
      ICounter(counter).add(b);
      total = ICounter(counter).get();
      require(true);
    }
    function fill(uint256 n) public {
      for (uint256 i = 0; i < n; i = i + 1) { ICounter(counter).add(i + 1); }
      total = total + n;
      require(true);
    }
    function around(uint256 a) public {
      uint256 before = ICounter(counter).get();
      ICounter(counter).add(a);
      uint256 after = ICounter(counter).get();
      uint256 again = ICounter(counter).get();
      total = before * 100 + after * 10 + again;
      require(true);
    }
  }`;

const MIXED = `${PRAGMA}interface ICounter { function inc() external returns (uint256); }
  interface ISink { function echo(uint16 value) external view returns (uint16); }
  interface IEcho { function echo(uint16 value) external view returns (uint16); }
  contract Mixed(address counter, address first, address second) {
    uint256 public total;
    function run(uint256 n) public {
      uint256 acc = 0;
      for (uint256 i = 0; i < n; i = i + 1) { acc = acc + ICounter(counter).inc(); }
      uint256 low = ISink(first).echo(2);
      uint256 high = IEcho(second).echo(5);
      total = acc * 100 + high * 10 + low;
      require(true);
    }
  }`;

type Provider = ReturnType<typeof createTestProvider>;
type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;

async function deploy(
  provider: Provider, artifact: Artifact, args: Uint8Array[], state: Record<string, bigint>,
  externals?: Record<string, unknown>,
): Promise<any> {
  const base = new Contract(artifact, args, { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, state, { saltContract: true },
  );
  return StatefulContract.withCategory(base, categoryId, externals && { externals: externals as any });
}

const lockOf = (contract: { inner: { lockingBytecode: string } }): Uint8Array => hexToBin(contract.inner.lockingBytecode);

/** Each input's VM outcome, after `mutate` changes the transaction. */
const vmOutcomes = (
  builder: TransactionBuilder, mutate?: (transaction: LibauthTransaction) => void,
): Array<true | string> => {
  const transaction = builder.buildLibauthTransaction();
  mutate?.(transaction);
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ));
};

const vmAccepts = (builder: TransactionBuilder): boolean => vmOutcomes(builder).every((outcome) => outcome === true);

/** The outputs of the call records of `categoryId`, in output order. */
const recordOutputs = (transaction: LibauthTransaction, categoryId: string): LibauthTransaction['outputs'] => transaction
  .outputs.filter((output) => output.token !== undefined && binToHex(output.token.category) === categoryId
    && output.token.nft?.capability === 'none' && binToHex(output.lockingBytecode) === '51');

/** The input of a contract's master: the reader the records of its calls name. */
const masterInputOf = (builder: TransactionBuilder, categoryId: string): number => builder.inputs.findIndex(
  (input) => input.token?.category === categoryId && input.token.nft?.capability === 'minting',
);

/** The entries the inputs spending `contractName`'s master run, in input order. */
const masterSpends = (builder: TransactionBuilder, contractName: string): string[] => builder.inputs.flatMap(
  (input) => input.token?.nft?.capability === 'minting' && 'contract' in input.unlocker
    && input.unlocker.contract.artifact.contractName === contractName ? [input.unlocker.abiFunction.name] : [],
);

/** The commitments of the call records of `categoryId` the transaction carries, in output order. */
const recordCommitments = (builder: TransactionBuilder, categoryId: string): Uint8Array[] => builder
  .buildLibauthTransaction().outputs.flatMap((output) => (output.token !== undefined
    && binToHex(output.token.category) === categoryId && output.token.nft?.capability === 'none'
    && binToHex(output.lockingBytecode) === '51' ? [output.token.nft.commitment] : []));

/** The call records of `categoryId` the transaction carries. */
const records = (builder: TransactionBuilder, categoryId: string): number => recordCommitments(builder, categoryId)
  .length;

/** The caller edges of `categoryId` the transaction carries: an `OP_1 OP_NOP` lock. */
const edges = (builder: TransactionBuilder, categoryId: string): number => builder.buildLibauthTransaction().outputs
  .filter((output) => output.token !== undefined && binToHex(output.token.category) === categoryId
    && binToHex(output.lockingBytecode) === '5161').length;

describe('direct multi-call', () => {
  it('(a) reads each iteration of a loop over one callee in one spend, for 0, 1 and 2 iterations', async () => {
    const provider = createTestProvider();
    const sourceArtifact = compileString(NUMBER_SOURCE, CALLEE);
    expect(sourceArtifact.callBatch).toEqual(CALL_BATCH);
    const source = await deploy(provider, sourceArtifact, [], {});
    await source.call.seed(1n, 11n).send();
    await source.call.seed(0n, 10n).send();

    const collectorArtifact = compileString(NUMBER_COLLECTOR, DIRECT);
    expect(collectorArtifact.abi.find((fn) => fn.name === 'collect')!.externalCalls!
      .map((call) => [call.functionName, call.callOrdinal])).toEqual([
      ['size', { group: 0, counted: true }], ['read', { group: 0, counted: true }],
    ]);
    const collector = await deploy(provider, collectorArtifact, [lockOf(source)], {}, { INumberSource: source });

    await expect(collector.call.collect(2n).staticCall()).resolves.toEqual([]);
    await expect(collector.call.collect(1n).staticCall()).resolves.toEqual([11n]);
    await expect(collector.call.collect(0n).staticCall()).resolves.toEqual([10n, 11n]);

    // size(), read(0) and read(1) are the three frames of one spend of the source master.
    const builder = await collector.call.collect(0n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'NumberSource')).toEqual(['callBatch']);
    expect(records(builder, source.categoryId)).toBe(3);
    expect(vmAccepts(builder)).toBe(true);
  }, 300_000);

  it('(b) returns every occurrence of a caller loop over a fixed getter, not the first one repeated', async () => {
    const provider = createTestProvider();
    const valuesArtifact = compileString(VALUES, CALLEE);
    const values = await deploy(provider, valuesArtifact, [], {});
    for (const [index, value] of [11n, 22n, 33n].entries()) await values.call.put(BigInt(index), value).send();
    const readerArtifact = compileString(READER, DIRECT);
    const reader = await deploy(provider, readerArtifact, [lockOf(values)], {}, { IValues: values });

    await expect(reader.call.many(0n, 0n).staticCall()).resolves.toEqual([]);
    await expect(reader.call.many(2n, 1n).staticCall()).resolves.toEqual([33n]);
    await expect(reader.call.many(0n, 2n).staticCall()).resolves.toEqual([11n, 22n]);
    await expect(reader.call.many(1n, 2n).staticCall()).resolves.toEqual([22n, 33n]);
    await expect(reader.call.many(0n, 3n).staticCall()).resolves.toEqual([11n, 22n, 33n]);

    const builder = await reader.call.many(0n, 3n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Values')).toEqual(['callBatch']);
    expect(records(builder, values.categoryId)).toBe(3);
    expect(vmAccepts(builder)).toBe(true);
  }, 300_000);

  it('(c) settles two calls with different arguments and a zero-argument alias in one spend', async () => {
    const provider = createTestProvider();
    // Compiled together, the callee takes its multi-call entry from the caller that repeats calls to it.
    const artifacts = compileStringMulti(`${PRAGMA}${BOOK_INTERFACE}${BOOK}${SPREAD}`, DIRECT);
    expect(artifacts.Book.callBatch).toEqual(CALL_BATCH);
    expect(artifacts.Spread.abi.find((fn) => fn.name === 'spread')!.externalCalls!
      .map((call) => [call.functionName, call.callOrdinal])).toEqual([
      ['totalOf', { group: 0, ordinal: 0 }], ['priceOf', { group: 0, ordinal: 1 }],
      ['priceOf', { group: 0, ordinal: 2 }], ['totalOf', { group: 0, ordinal: 0 }],
    ]);
    const book = await deploy(provider, artifacts.Book, [], { total: 0n });
    await book.call.setTotal(4n).send();
    await book.call.setPrice(1n, 5n).send();
    await book.call.setPrice(2n, 7n).send();
    const spread = await deploy(provider, artifacts.Spread, [lockOf(book)], { last: 0n }, { IBook: book });

    // totalOf(), priceOf(1) and priceOf(2) are the three frames; the second totalOf() reads the first's record.
    const builder = await spread.call.spread(1n, 2n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Book')).toEqual(['callBatch']);
    expect(records(builder, book.categoryId)).toBe(3);
    expect(vmAccepts(builder)).toBe(true);

    await spread.call.spread(1n, 2n).send();
    expect((await spread.getState()).last).toBe(4574n);
  }, 300_000);

  it('(d) gives each reached iteration of a loop with a skipped middle iteration its own result', async () => {
    const provider = createTestProvider();
    const sinkArtifact = compileString(SINK, CALLEE);
    const sink = await deploy(provider, sinkArtifact, [], { total: 0n });
    const coordinatorArtifact = compileString(COORDINATOR, DIRECT);
    const coordinator = await deploy(
      provider, coordinatorArtifact, [lockOf(sink)], { observed: 0n }, { ISink: sink },
    );

    // Iterations 0 and 2 run echo(2) and echo(3) as frames 0 and 1; the decimal fold tells order and values apart.
    const builder = await coordinator.call.runReturning([2n, 0n, 3n]).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Sink')).toEqual(['callBatch']);
    expect(records(builder, sink.categoryId)).toBe(2);
    expect(vmAccepts(builder)).toBe(true);
    await coordinator.call.runReturning([2n, 0n, 3n]).send();
    expect((await coordinator.getState()).observed).toBe(23n);

    // One reached call keeps the standalone spend, with the reached iteration's own argument.
    const single = await coordinator.call.runReturning([0n, 0n, 3n]).build() as TransactionBuilder;
    expect(masterSpends(single, 'Sink')).toEqual(['echo']);
    expect(vmAccepts(single)).toBe(true);
    await coordinator.call.runReturning([0n, 0n, 3n]).send();
    expect((await coordinator.getState()).observed).toBe(3n);
  }, 300_000);

  it('(e) refuses a callee compiled without the multi-call entry, naming the option', async () => {
    const provider = createTestProvider();
    const bookArtifact = compileString(`${PRAGMA}${BOOK}`, DIRECT);
    expect(bookArtifact.callBatch).toBeUndefined();
    const spreadArtifact = compileString(`${PRAGMA}${BOOK_INTERFACE}${SPREAD}`, DIRECT);
    const book = await deploy(provider, bookArtifact, [], { total: 0n });
    await book.call.setTotal(4n).send();
    const spread = await deploy(provider, spreadArtifact, [lockOf(book)], { last: 0n }, { IBook: book });

    const refusal = new RegExp('makes 3 calls to Book in one transaction[\\s\\S]*'
      + 'compile it with `callBatch: true`, or compile caller and callee together');
    await expect(spread.call.spread(1n, 2n).build()).rejects.toThrow(refusal);
    await expect(spread.call.spread(1n, 2n).send()).rejects.toThrow(refusal);
    expect((await spread.getState()).last).toBe(0n);
  }, 300_000);

  it('(g) gives two calls of one loop body, over two iterations, the frames of their execution order', async () => {
    const provider = createTestProvider();
    const valuesArtifact = compileString(VALUES, CALLEE);
    const values = await deploy(provider, valuesArtifact, [], {});
    for (const [index, value] of [1n, 2n, 3n, 4n].entries()) await values.call.put(BigInt(index), value).send();
    const pairArtifact = compileString(PAIR_LOOP, DIRECT);
    expect(pairArtifact.abi.find((fn) => fn.name === 'pairs')!.externalCalls!.map((call) => call.callOrdinal))
      .toEqual([{ group: 0, counted: true }, { group: 0, counted: true }]);
    const pairs = await deploy(provider, pairArtifact, [lockOf(values)], { last: 0n }, { IValues: values });

    // at(0), at(2), at(1), at(3): frame k is the k-th call the loop makes, and its record the spend's k-th.
    const builder = await pairs.call.pairs(2n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Values')).toEqual(['callBatch']);
    const at = valuesArtifact.abi.find((fn) => fn.name === 'at')!;
    // Every frame's record names its reader, the input of the caller's master.
    const digestOf = (index: bigint, ordinal: number): string => binToHex(callRecordDigest(
      at, at.inputs.map((input) => (input.name === 'index' ? index : 0n)), {}, ordinal,
      masterInputOf(builder, pairs.categoryId),
    )!);
    expect(recordCommitments(builder, values.categoryId).map((record) => binToHex(parseCallRecord(record)!.digest)))
      .toEqual([0n, 2n, 1n, 3n].map((index, ordinal) => digestOf(index, ordinal)));
    expect(vmAccepts(builder)).toBe(true);

    await pairs.call.pairs(2n).send();
    expect((await pairs.getState()).last).toBe(1324n);
  }, 300_000);

  /** A Counter with the multi-call entry, its count at 0, and a Tally calling it. */
  async function tallied(): Promise<{ counter: any; tally: any; counterArtifact: Artifact; tallyArtifact: Artifact }> {
    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER, CALLEE);
    expect(counterArtifact.callBatch).toEqual(CALL_BATCH);
    const counter = await deploy(provider, counterArtifact, [], { count: 0n });
    const tallyArtifact = compileString(TALLY, DIRECT);
    const tally = await deploy(provider, tallyArtifact, [lockOf(counter)], { total: 0n }, { ICounter: counter });
    return { counter, tally, counterArtifact, tallyArtifact };
  }

  it('(h) runs a looped state-changing call as frames: acc += inc() three times gives 6, the callee 3', async () => {
    const { counter, tally, tallyArtifact } = await tallied();
    expect(tallyArtifact.abi.find((fn) => fn.name === 'tally')!.externalCalls!
      .map((call) => [call.functionName, call.callOrdinal])).toEqual([['inc', { group: 0, counted: true }]]);

    // inc(), inc(), inc() are the three frames of one spend: records 1, 2 and 3, each on the count the one before left.
    const builder = await tally.call.tally(3n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Counter')).toEqual(['callBatch']);
    expect(records(builder, counter.categoryId)).toBe(3);
    const master = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === 'callBatch');
    expect(master).toBeGreaterThanOrEqual(0);
    expect(vmAccepts(builder)).toBe(true);
    // A record of the callee's category answering frame 1 with another result: the callee refuses it.
    const forged = vmOutcomes(builder, (transaction) => {
      const nft = recordOutputs(transaction, counter.categoryId)[1]!.token!.nft!;
      nft.commitment = Uint8Array.of(...nft.commitment.slice(0, -1), nft.commitment.at(-1)! ^ 1);
    });
    expect(forged[master]).not.toBe(true);

    await tally.call.tally(3n).send();
    expect((await tally.getState()).total).toBe(6n);
    expect((await counter.getState()).count).toBe(3n);
  }, 300_000);

  it('(i) runs two void calls and a read in one spend', async () => {
    const { counter, tally, counterArtifact, tallyArtifact } = await tallied();
    expect(tallyArtifact.abi.find((fn) => fn.name === 'bump')!.externalCalls!
      .map((call) => [call.functionName, call.callOrdinal])).toEqual([
      ['add', { group: 0, ordinal: 0 }], ['add', { group: 0, ordinal: 1 }], ['get', { group: 0, ordinal: 2 }],
    ]);

    const builder = await tally.call.bump(2n, 5n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Counter')).toEqual(['callBatch']);
    // A void frame's record is the digest of its call and the inline form of an empty result.
    const add = counterArtifact.abi.find((fn) => fn.name === 'add')!;
    const voidRecord = (value: bigint, ordinal: number): string => `${binToHex(callRecordDigest(
      add, add.inputs.map((input) => (input.name === 'value' ? value : 0n)), {}, ordinal,
      masterInputOf(builder, tally.categoryId),
    )!)}01`;
    const commitments = recordCommitments(builder, counter.categoryId).map((record) => binToHex(record));
    expect(commitments).toHaveLength(3);
    expect(commitments.slice(0, 2)).toEqual([voidRecord(2n, 0), voidRecord(5n, 1)]);
    expect(vmAccepts(builder)).toBe(true);

    await tally.call.bump(2n, 5n).send();
    expect((await tally.getState()).total).toBe(7n);
    expect((await counter.getState()).count).toBe(7n);
  }, 300_000);

  it('(j) runs a looped void call through the multi-call entry, even for one iteration', async () => {
    const { counter, tally } = await tallied();
    for (const [n, count] of [[1n, 1n], [2n, 4n]] as const) {
      const builder = await tally.call.fill(n).build() as TransactionBuilder;
      expect(masterSpends(builder, 'Counter')).toEqual(['callBatch']);
      expect(records(builder, counter.categoryId)).toBe(Number(n));
      expect(vmAccepts(builder)).toBe(true);
      await tally.call.fill(n).send();
      expect((await counter.getState()).count).toBe(count);
    }
    expect((await tally.getState()).total).toBe(3n);
  }, 300_000);

  it('(k) reads the state a write left: a read after it runs a frame of its own', async () => {
    const { counter, tally, tallyArtifact } = await tallied();
    expect(tallyArtifact.abi.find((fn) => fn.name === 'around')!.externalCalls!
      .map((call) => [call.functionName, call.callOrdinal])).toEqual([
      ['get', { group: 0, ordinal: 0 }], ['add', { group: 0, ordinal: 1 }], ['get', { group: 0, ordinal: 2 }],
      ['get', { group: 0, ordinal: 2 }],
    ]);

    // get(), add(5), get(): the second read is the count after the write, and the third shares its record.
    const builder = await tally.call.around(5n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Counter')).toEqual(['callBatch']);
    expect(records(builder, counter.categoryId)).toBe(3);
    expect(vmAccepts(builder)).toBe(true);

    await tally.call.around(5n).send();
    expect((await tally.getState()).total).toBe(55n);
    expect((await counter.getState()).count).toBe(5n);
  }, 300_000);

  it('(l) pins the edges of the calls beside a multi-call spend, whose frames name none', async () => {
    const provider = createTestProvider();
    const counter = await deploy(provider, compileString(COUNTER, CALLEE), [], { count: 0n });
    const sinkArtifact = compileString(SINK, DIRECT);
    const first = await deploy(provider, sinkArtifact, [], { total: 0n });
    const second = await deploy(provider, sinkArtifact, [], { total: 0n });
    const mixed = await deploy(
      provider, compileString(MIXED, DIRECT), [lockOf(counter), lockOf(first), lockOf(second)], { total: 0n },
      { ICounter: counter, ISink: first, IEcho: second },
    );

    // inc() and inc() are frames of one spend; echo(2) and echo(5) follow at callsites 1 and 2, as groups 2 and 3.
    const builder = await mixed.call.run(2n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Counter')).toEqual(['callBatch']);
    expect(edges(builder, mixed.categoryId)).toBe(2);
    expect(vmAccepts(builder)).toBe(true);

    await mixed.call.run(2n).send();
    expect((await mixed.getState()).total).toBe(352n);
    expect((await counter.getState()).count).toBe(2n);
  }, 300_000);
});
