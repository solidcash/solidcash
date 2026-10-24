import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Direct multi-call (docs/wip/call-records/DESIGN.md, sections 3, 4 and 7): a direct caller's calls to one callee
 * run in one spend of the callee's master through its multi-call entry, each call reading its own frame's record.
 * Every contract here is a direct compile, and no transaction carries a message-bus input.
 */

const DIRECT = { forceStateful: true, messageBus: false, evmCompat: true, suppressWarnings: true } as const;
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

type Provider = ReturnType<typeof createTestProvider>;

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

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

/** The entries the inputs spending `contractName`'s master run, in input order. */
const masterSpends = (builder: TransactionBuilder, contractName: string): string[] => builder.inputs.flatMap(
  (input) => input.token?.nft?.capability === 'minting' && 'contract' in input.unlocker
    && input.unlocker.contract.artifact.contractName === contractName ? [input.unlocker.abiFunction.name] : [],
);

/** The call records of `categoryId` the transaction carries. */
const records = (builder: TransactionBuilder, categoryId: string): number => builder.buildLibauthTransaction()
  .outputs.filter((output) => output.token !== undefined && binToHex(output.token.category) === categoryId
    && output.token.nft?.capability === 'none' && binToHex(output.lockingBytecode) === '51').length;

/** (f) Inputs running a message-bus route: none, in every transaction here. */
const busInputs = (builder: TransactionBuilder): string[] => builder.inputs.flatMap((input) => (
  'contract' in input.unlocker && input.unlocker.abiFunction.name.startsWith('__message_bus')
    ? [input.unlocker.abiFunction.name] : []));

describe('direct multi-call', () => {
  it('(a) reads each iteration of a loop over one callee in one spend, for 0, 1 and 2 iterations', async () => {
    const provider = createTestProvider();
    const sourceArtifact = compileString(NUMBER_SOURCE, CALLEE);
    expect(sourceArtifact.callBatch).toEqual(CALL_BATCH);
    const source = await deploy(provider, sourceArtifact, [], {});
    await source.call.seed(1n, 11n).send();
    await source.call.seed(0n, 10n).send();

    const collectorArtifact = compileString(NUMBER_COLLECTOR, DIRECT);
    expect(collectorArtifact.messageBus).toBeUndefined();
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
    expect(busInputs(builder)).toEqual([]);
    expect(vmAccepts(builder)).toBe(true);
  }, 300_000);

  it('(b) returns every occurrence of a caller loop over a fixed getter, not the first one repeated', async () => {
    const provider = createTestProvider();
    const valuesArtifact = compileString(VALUES, CALLEE);
    const values = await deploy(provider, valuesArtifact, [], {});
    for (const [index, value] of [11n, 22n, 33n].entries()) await values.call.put(BigInt(index), value).send();
    const readerArtifact = compileString(READER, DIRECT);
    expect(readerArtifact.messageBus).toBeUndefined();
    const reader = await deploy(provider, readerArtifact, [lockOf(values)], {}, { IValues: values });

    await expect(reader.call.many(0n, 0n).staticCall()).resolves.toEqual([]);
    await expect(reader.call.many(2n, 1n).staticCall()).resolves.toEqual([33n]);
    await expect(reader.call.many(0n, 2n).staticCall()).resolves.toEqual([11n, 22n]);
    await expect(reader.call.many(1n, 2n).staticCall()).resolves.toEqual([22n, 33n]);
    await expect(reader.call.many(0n, 3n).staticCall()).resolves.toEqual([11n, 22n, 33n]);

    const builder = await reader.call.many(0n, 3n).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Values')).toEqual(['callBatch']);
    expect(records(builder, values.categoryId)).toBe(3);
    expect(busInputs(builder)).toEqual([]);
    expect(vmAccepts(builder)).toBe(true);
  }, 300_000);

  it('(c) settles two calls with different arguments and a zero-argument alias in one spend', async () => {
    const provider = createTestProvider();
    // Compiled together, the callee takes its multi-call entry from the caller that repeats calls to it.
    const artifacts = compileStringMulti(`${PRAGMA}${BOOK_INTERFACE}${BOOK}${SPREAD}`, DIRECT);
    expect(artifacts.Book.callBatch).toEqual(CALL_BATCH);
    expect(artifacts.Spread.messageBus).toBeUndefined();
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
    expect(busInputs(builder)).toEqual([]);
    expect(vmAccepts(builder)).toBe(true);

    await spread.call.spread(1n, 2n).send();
    expect((await spread.getState()).last).toBe(4574n);
  }, 300_000);

  it('(d) gives each reached iteration of a loop with a skipped middle iteration its own result', async () => {
    const provider = createTestProvider();
    const sinkArtifact = compileString(SINK, CALLEE);
    const sink = await deploy(provider, sinkArtifact, [], { total: 0n });
    const coordinatorArtifact = compileString(COORDINATOR, DIRECT);
    expect(coordinatorArtifact.messageBus).toBeUndefined();
    const coordinator = await deploy(
      provider, coordinatorArtifact, [lockOf(sink)], { observed: 0n }, { ISink: sink },
    );

    // Iterations 0 and 2 run echo(2) and echo(3) as frames 0 and 1; the decimal fold tells order and values apart.
    const builder = await coordinator.call.runReturning([2n, 0n, 3n]).build() as TransactionBuilder;
    expect(masterSpends(builder, 'Sink')).toEqual(['callBatch']);
    expect(records(builder, sink.categoryId)).toBe(2);
    expect(busInputs(builder)).toEqual([]);
    expect(vmAccepts(builder)).toBe(true);
    await coordinator.call.runReturning([2n, 0n, 3n]).send();
    expect((await coordinator.getState()).observed).toBe(23n);

    // One reached call keeps the standalone spend, with the reached iteration's own argument.
    const single = await coordinator.call.runReturning([0n, 0n, 3n]).build() as TransactionBuilder;
    expect(masterSpends(single, 'Sink')).toEqual(['echo']);
    expect(busInputs(single)).toEqual([]);
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
});
