import { describe, expect, it } from 'vitest';
import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../src/compiler.js';

/**
 * Direct calls to a callee a function calls several times (docs/wip/call-records/DESIGN.md, section 4): each call
 * digests the ordinal of its frame in the callee's one multi-call spend, fixed in source order for straight-line
 * calls and counted at run time once a call sits in a loop or a branch. No bus batch is built.
 */

const BOOK = `
interface IBook {
  function priceOf(bigint key) external view returns (bigint);
  function totalOf() external view returns (bigint);
  function setTotal(bigint value) external;
}
contract Book() {
  mapping(bigint => bigint) prices;
  bigint total;
  function setTotal(bigint value) public { this.total = value; }
  function priceOf(bigint key) public returns (bigint) { return this.prices[key]; }
  function totalOf() public returns (bigint) { return this.total; }
}`;

const READERS = `
contract PairReader(address book) {
  bigint last;
  function sum(bigint a, bigint b) public { this.last = IBook(book).priceOf(a) + IBook(book).priceOf(b); }
}
contract LoopReader(address book) {
  bigint last;
  function loop(bigint n) public {
    bigint acc = 0;
    for (bigint i = 0; i < n; i = i + 1) { acc = acc + IBook(book).priceOf(i); }
    this.last = acc;
  }
}
contract PickReader(address book) {
  bigint last;
  function pick(bool both, bigint a, bigint b) public {
    bigint acc = IBook(book).priceOf(a);
    if (both) { acc = acc + IBook(book).priceOf(b); }
    this.last = acc;
  }
}
contract TotalReader(address book) {
  bigint last;
  function spread(bigint a) public {
    bigint before = IBook(book).totalOf();
    bigint price = IBook(book).priceOf(a);
    bigint after = IBook(book).totalOf();
    this.last = before * 100 + price * 10 + after;
  }
}`;

const SOURCE = `pragma solidcash >=0.8.0;\n${BOOK}\n${READERS}`;

const WRITER = `pragma solidcash >=0.8.0;\n${BOOK}
contract Writer(address book) {
  bigint last;
  function twice(bigint a) public {
    IBook(book).setTotal(a);
    IBook(book).setTotal(a + 1);
    this.last = a;
  }
}`;

let direct: ReturnType<typeof compileStringMulti> | undefined;
const directArtifacts = (): ReturnType<typeof compileStringMulti> => {
  direct ??= compileStringMulti(SOURCE, { messageBus: false, suppressWarnings: true });
  return direct;
};
const fn = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;
const calls = (artifact: Artifact, name: string): readonly ExternalCallAbi[] => fn(artifact, name).externalCalls ?? [];
const selector = (name: string): string => fn(directArtifacts().Book, name).selector!;
const CALL_BATCH = { selector: '53434442' };

describe('direct call ordinals', () => {
  it('numbers two straight-line calls 0 and 1, digests each under its own, and builds no bus batch', () => {
    const { PairReader, Book } = directArtifacts();
    const sum = calls(PairReader, 'sum');
    expect(sum.map((call) => call.callOrdinal)).toEqual([{ group: 0, ordinal: 0 }, { group: 0, ordinal: 1 }]);
    expect(sum.map((call) => [call.functionName, call.needsSelectorVerification, call.batchInvocations]))
      .toEqual([['priceOf', false, undefined], ['priceOf', false, undefined]]);
    expect(PairReader.messageBus).toBeUndefined();
    // The digest preimage opens with the ordinal as two little-endian bytes, then the selector.
    expect(PairReader.bytecode).toContain(`0000${selector('priceOf')}`);
    expect(PairReader.bytecode).toContain(`0100${selector('priceOf')}`);
    // A callee a caller here calls several times takes its multi-call entry; compiled alone it stays lean.
    expect(Book.callBatch).toEqual(CALL_BATCH);
    const alone = compileString(`pragma solidcash >=0.8.0;\n${BOOK}`, { messageBus: false, suppressWarnings: true });
    expect(alone.callBatch).toBeUndefined();
    expect(Book.bytecode).not.toBe(alone.bytecode);
  });

  it('counts the ordinal of a looped or branched call at run time', () => {
    const { LoopReader, PickReader } = directArtifacts();
    expect(calls(LoopReader, 'loop').map((call) => [call.occurrence, call.callOrdinal]))
      .toEqual([['loop', { group: 0, counted: true }]]);
    expect(calls(PickReader, 'pick').map((call) => [call.occurrence, call.callOrdinal]))
      .toEqual([['once', { group: 0, counted: true }], ['conditional', { group: 0, counted: true }]]);
    // A counted call pushes its bare selector and appends the counter's two bytes once its arguments have run.
    for (const reader of [LoopReader, PickReader]) {
      expect(reader.bytecode).not.toContain(`0000${selector('priceOf')}`);
      expect(reader.bytecode).toMatch(new RegExp(`${selector('priceOf')} (\\S+ ){4,16}OP_2 OP_NUM2BIN OP_SWAP `
        + 'OP_CAT OP_SHA256'));
    }
    // With no epilogue, the looped call checks its record's carrier where it runs.
    expect(LoopReader.bytecode).toContain('OP_TUCK OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY');
  });

  it('keeps a zero-argument readonly alias on the first call\'s record and ordinal', () => {
    const { TotalReader } = directArtifacts();
    const spread = calls(TotalReader, 'spread');
    const binding = { version: 1, selector: selector('totalOf') };
    expect(spread.map((call) => [call.functionName, call.callOrdinal, call.readonlyReturnBinding])).toEqual([
      ['totalOf', { group: 0, ordinal: 0 }, binding],
      ['priceOf', { group: 0, ordinal: 1 }, undefined],
      ['totalOf', { group: 0, ordinal: 0 }, binding],
    ]);
    expect(TotalReader.bytecode).toContain(`0000${selector('totalOf')}`);
    expect(TotalReader.bytecode).toContain(`0100${selector('priceOf')}`);
    expect(TotalReader.bytecode).not.toContain(`0200${selector('totalOf')}`);
  });

  it('still refuses a repeated state-changing call, naming the multi-call entry\'s limits', () => {
    let message = '';
    try {
      compileString(WRITER, { messageBus: false, suppressWarnings: true });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/MESSAGE_BUS_REQUIRED.*\(IBook\.setTotal -> IBook\.setTotal\)/);
    expect(message).toMatch(/multi-call entry, whose calls are view or pure, return values and name a fixed method/);
    expect(message).toMatch(/of a fixed target; this transaction cannot be built with `messageBus: false`\.$/);
    expect(message).not.toMatch(/omit the option/);
  });

  it('refuses a looped returning call to a fixed target that cannot run as a frame', () => {
    // The callee master is spent once and pins one record: further iterations would read records it never pinned.
    const looped = (body: string): string => `pragma solidcash >=0.8.0;
interface ICounter { function inc(bigint by) external returns (bigint); }
contract LoopedWriter(address counter) {
  bigint last;
  bytes stored;
  function one(bigint by) internal returns (bigint) { return ICounter(counter).inc(by); }
  function run(bigint n, bool take) public { bigint acc = 0; ${body} this.last = acc; }
}`;
    const bodies = [
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + ICounter(counter).inc(i); }',
      'bigint i = 0; while (i < n) { acc = acc + ICounter(counter).inc(i); i = i + 1; }',
      'for (bigint i = 0; i < n; i = i + 1) { if (take) { acc = acc + ICounter(counter).inc(i); } }',
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + one(i); }',
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + ICounter(this.stored).inc(i); }',
    ];
    for (const body of bodies) {
      expect(() => compileString(looped(body), { messageBus: false, suppressWarnings: true }), body)
        .toThrow(/MESSAGE_BUS_REQUIRED.*\(ICounter\.inc\).*cannot be built with `messageBus: false`\.$/);
      // The bus binds each row; a lone call stays a direct call bound by its record.
      expect(() => compileString(looped(body), { messageBus: true, suppressWarnings: true }), body).not.toThrow();
    }
    expect(() => compileString(looped('acc = ICounter(counter).inc(n);'), { messageBus: false, suppressWarnings: true }))
      .not.toThrow();
  });

  it('leaves a message-bus compile as it was', () => {
    const bus = compileStringMulti(SOURCE, { messageBus: true, suppressWarnings: true });
    const all = Object.values(bus).flatMap((artifact) => artifact.abi.flatMap((entry) => entry.externalCalls ?? []));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((call) => call.callOrdinal === undefined)).toBe(true);
    expect(bus.Book.callBatch).toBeUndefined();
    expect(calls(bus.PairReader, 'sum').map((call) => call.needsSelectorVerification)).toEqual([true, true]);
    expect(calls(bus.TotalReader, 'spread').map((call) => call.readonlyReturnBinding?.selector))
      .toEqual([selector('totalOf'), undefined, selector('totalOf')]);
    const writer = compileString(WRITER, { messageBus: true, suppressWarnings: true });
    expect(calls(writer, 'twice').map((call) => call.batchInvocations?.length)).toEqual([2]);
  });
});
