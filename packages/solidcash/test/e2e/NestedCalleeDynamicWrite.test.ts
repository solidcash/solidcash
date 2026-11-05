import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const PRAGMA = 'pragma solidcash >=0.8.0;';

const COUNTER = `${PRAGMA}
contract Counter() { int count;
  function poke() { this.count = this.count + 1; require(this.count > 0); } }`;

const ADDER = `${PRAGMA}
contract Adder() { int total;
  function add(int v) returns (int) { this.total = this.total + v; require(v >= 0); return this.total; } }`;

const CHAINED_WRITER = `${PRAGMA}
interface ICounter { function poke(); }
contract ChainedWriter(bytes counter) { string message;
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

const ROOT = `${PRAGMA}
interface IWriter { function set(string next); }
contract Root(bytes writer) { int runs;
  function run(string next) {
    IWriter(writer).set(next);
    this.runs = this.runs + 1;
    require(next.length >= 0);
  } }`;

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

const text = (length: number): string => 'x'.repeat(length);

describe('a callee that writes dynamic state and calls on', () => {
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

  it('settles a first write, a growth and a shrink past the block it calls', async () => {
    const provider = createTestProvider();
    const counter = await deploy(provider, COUNTER, [], { count: 0n });
    const writer = await deploy(provider, CHAINED_WRITER, [counter.lock], { message: '' }, { ICounter: counter.sc });
    const root = await deploy(provider, ROOT, [writer.lock], { runs: 0n }, { IWriter: writer.sc });

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
});
