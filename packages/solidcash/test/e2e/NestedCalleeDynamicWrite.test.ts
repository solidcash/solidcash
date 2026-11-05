import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const PRAGMA = 'pragma solidcash >=0.8.0;';

// A second method makes an interface select its callee by selector, so the caller reads no void call record.
const SECOND_METHOD = ' function reset() { require(true); }';
const SECOND_DECLARATION = ' function reset();';

const counterSource = (method = ''): string => `${PRAGMA}
contract Counter() { int count;${method}
  function poke() { this.count = this.count + 1; require(this.count > 0); } }`;

const COUNTER = counterSource();

const ADDER = `${PRAGMA}
contract Adder() { int total;
  function add(int v) returns (int) { this.total = this.total + v; require(v >= 0); return this.total; } }`;

const chainedWriterSource = (method = '', declaration = ''): string => `${PRAGMA}
interface ICounter { function poke();${declaration} }
contract ChainedWriter(bytes counter) { string message;${method}
  function set(string next) {
    this.message = next;
    ICounter(counter).poke();
    require(next.length >= 0);
  } }`;

const READING_WRITER = `${PRAGMA}
interface IAdder { function add(int v) returns (int); }
contract ReadingWriter(bytes adder) { string message; int last;
  function set(string next, int v) {
    this.last = IAdder(adder).add(v);
    this.message = next;
    require(this.last >= 0);
  } }`;

const rootSource = (declaration = ''): string => `${PRAGMA}
interface IWriter { function set(string next);${declaration} }
contract Root(bytes writer) { int runs;
  function run(string next) {
    IWriter(writer).set(next);
    this.runs = this.runs + 1;
    require(next.length >= 0);
  } }`;

const ROOT = rootSource();

const READING_ROOT = `${PRAGMA}
interface IWriter { function set(string next, int v); }
contract ReadingRoot(bytes writer) { int runs;
  function run(string next, int v) {
    IWriter(writer).set(next, v);
    this.runs = this.runs + 1;
    require(v >= 0);
  } }`;

const LEAF_WRITER = `${PRAGMA}
contract LeafWriter() { string message;
  function set(string next) { this.message = next; require(next.length >= 0); } }`;

const SIBLING_ROOT = `${PRAGMA}
interface IWriter { function set(string next); }
interface ICounter { function poke(); }
contract SiblingRoot(bytes writer, bytes counter) { int runs;
  function run(string next) {
    IWriter(writer).set(next);
    ICounter(counter).poke();
    this.runs = this.runs + 1;
    require(next.length >= 0);
  } }`;

const EVENT_WRITER = `${PRAGMA}
contract EventWriter() { string message;
  event Noted(bigint value);
  function set(string next) {
    this.message = next;
    emit Noted(7);
    require(next.length >= 0);
  } }`;

const ENTRY_WRITER = `${PRAGMA}
contract EntryWriter() { string message; mapping(bytes20 => int) balances;
  function set(string next, bytes20 holder, int value) {
    this.message = next;
    this.balances[holder] = value;
    require(value >= 0);
  } }`;

const ENTRY_ROOT = `${PRAGMA}
interface IWriter { function set(string next, bytes20 holder, int value); }
contract EntryRoot(bytes writer) { int runs;
  function run(string next, bytes20 holder, int value) {
    IWriter(writer).set(next, holder, value);
    this.runs = this.runs + 1;
    require(value >= 0);
  } }`;

const RETURNING_WRITER = `${PRAGMA}
contract ReturningWriter() { string message;
  function set(string next, int v) returns (int) {
    require(v >= 0);
    this.message = next;
    return v + 1;
  } }`;

const RETURN_READING_ROOT = `${PRAGMA}
interface IWriter { function set(string next, int v) returns (int); }
contract ReturnReadingRoot(bytes writer) { int last;
  function run(string next, int v) {
    this.last = IWriter(writer).set(next, v);
    require(this.last > 0);
  } }`;

const text = (length: number): string => 'x'.repeat(length);

describe('a callee that writes dynamic state', () => {
  const deploy = async (
    provider: any, source: string, args: unknown[], state: Record<string, unknown>, externals?: Record<string, any>,
  ): Promise<any> => {
    const artifact = compileString(source);
    const contract = new Contract(artifact, args as any, { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, state, { saltContract: true },
    );
    return {
      sc: StatefulContract.withCategory(contract, categoryId, { externals }),
      lock: contract.withCategory(hexToBin(categoryId)).lockingBytecode,
    };
  };

  it.each([
    ['reads', COUNTER, chainedWriterSource(), ROOT],
    ['does not read', counterSource(SECOND_METHOD), chainedWriterSource(SECOND_METHOD, SECOND_DECLARATION),
      rootSource(SECOND_DECLARATION)],
  ])('settles every run size past the block it calls when its caller %s the record', async (
    _reading, counterCode, writerCode, rootCode,
  ) => {
    const provider = createTestProvider();
    const counter = await deploy(provider, counterCode, [], { count: 0n });
    const writer = await deploy(provider, writerCode, [counter.lock], { message: '' }, { ICounter: counter.sc });
    const root = await deploy(provider, rootCode, [writer.lock], { runs: 0n }, { IWriter: writer.sc });

    const lengths = [60, 241, 121, 1];
    for (const length of lengths) await root.sc.run(text(length)).send();

    expect((await writer.sc.getState()).message).toBe(text(1));
    expect((await counter.sc.getState()).count).toBe(BigInt(lengths.length));
    expect((await root.sc.getState()).runs).toBe(BigInt(lengths.length));
  });

  it('keeps the return record of the call it reads ahead of its run', async () => {
    const provider = createTestProvider();
    const adder = await deploy(provider, ADDER, [], { total: 0n });
    const writer = await deploy(provider, READING_WRITER, [adder.lock], { message: '', last: 0n }, { IAdder: adder.sc });
    const root = await deploy(provider, READING_ROOT, [writer.lock], { runs: 0n }, { IWriter: writer.sc });

    await root.sc.run(text(60), 2n).send();
    await root.sc.run(text(241), 3n).send();

    expect(await writer.sc.getState()).toEqual(expect.objectContaining({ message: text(241), last: 5n }));
    expect((await adder.sc.getState()).total).toBe(5n);
  });

  // The run's own count is pinned, so a copy of a chunk the write consumed is refused rather than left behind.
  it('pads a consumed chunk between a shrinking callee and the block after it', async () => {
    const provider = createTestProvider();
    const counter = await deploy(provider, COUNTER, [], { count: 0n });
    const writer = await deploy(provider, LEAF_WRITER, [], { message: '' });
    const root = await deploy(
      provider, SIBLING_ROOT, [writer.lock, counter.lock], { runs: 0n },
      { IWriter: writer.sc, ICounter: counter.sc },
    );
    await writer.sc.set(text(241)).send();

    await root.sc.run(text(121)).send();

    expect((await writer.sc.getState()).message).toBe(text(121));
    expect((await counter.sc.getState()).count).toBe(1n);
  });

  it('places the run past a block that emits', async () => {
    const provider = createTestProvider();
    const writer = await deploy(provider, EVENT_WRITER, [], { message: '' });
    const root = await deploy(provider, ROOT, [writer.lock], { runs: 0n }, { IWriter: writer.sc });

    await root.sc.run(text(60)).send();
    await root.sc.run(text(241)).send();

    expect((await writer.sc.getState()).message).toBe(text(241));
  });

  it('places the run past the return record its caller reads', async () => {
    const provider = createTestProvider();
    const writer = await deploy(provider, RETURNING_WRITER, [], { message: '' });
    const root = await deploy(provider, RETURN_READING_ROOT, [writer.lock], { last: 0n }, { IWriter: writer.sc });

    await root.sc.run(text(60), 1n).send();
    await root.sc.run(text(241), 6n).send();

    expect((await writer.sc.getState()).message).toBe(text(241));
    expect((await root.sc.getState()).last).toBe(7n);
  });

  it('refuses by name a run beside a block that updates an entry', async () => {
    const provider = createTestProvider();
    const writer = await deploy(provider, ENTRY_WRITER, [], { message: '' });
    const root = await deploy(provider, ENTRY_ROOT, [writer.lock], { runs: 0n }, { IWriter: writer.sc });
    await writer.sc.set(text(60), alicePkh, 1n).send();

    await expect(root.sc.run(text(121), alicePkh, 2n).send()).rejects.toThrow(/beside the entry slot/);
  });
});
