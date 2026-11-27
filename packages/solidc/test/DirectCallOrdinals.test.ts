import { describe, expect, it } from 'vitest';
import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../src/compiler.js';

/**
 * Direct calls to a callee a function calls several times (docs/wip/call-records/DESIGN.md, section 4): each call
 * digests the ordinal of its frame in the callee's one multi-call spend, fixed in source order for straight-line
 * calls and counted at run time once a call sits in a loop or a branch.
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
  direct ??= compileStringMulti(SOURCE, { suppressWarnings: true });
  return direct;
};
const fn = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;
const calls = (artifact: Artifact, name: string): readonly ExternalCallAbi[] => fn(artifact, name).externalCalls ?? [];
const selector = (name: string): string => fn(directArtifacts().Book, name).selector!;
const CALL_BATCH = { selector: '53434442' };

describe('direct call ordinals', () => {
  it('numbers two straight-line calls 0 and 1 and digests each under its own', () => {
    const { PairReader, Book } = directArtifacts();
    const sum = calls(PairReader, 'sum');
    expect(sum.map((call) => call.callOrdinal)).toEqual([{ group: 0, ordinal: 0 }, { group: 0, ordinal: 1 }]);
    expect(sum.map((call) => [call.functionName, call.needsSelectorVerification]))
      .toEqual([['priceOf', false], ['priceOf', false]]);
    // The digest preimage opens with the ordinal as two little-endian bytes, then the selector.
    expect(PairReader.bytecode).toContain(`0000${selector('priceOf')}`);
    expect(PairReader.bytecode).toContain(`0100${selector('priceOf')}`);
    // A callee a caller here calls several times takes its multi-call entry; compiled alone it stays lean.
    expect(Book.callBatch).toEqual(CALL_BATCH);
    const alone = compileString(`pragma solidcash >=0.8.0;\n${BOOK}`, { suppressWarnings: true });
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

  it('ends a zero-argument readonly alias at a call that may write', () => {
    const around = compileString(`pragma solidcash >=0.8.0;\n${BOOK}
contract Around(address book) {
  bigint last;
  function bump(bigint v) public {
    bigint before = IBook(book).totalOf();
    IBook(book).setTotal(v);
    bigint after = IBook(book).totalOf();
    bigint again = IBook(book).totalOf();
    this.last = before * 100 + after * 10 + again;
  }
}`, { suppressWarnings: true });
    const binding = { version: 1, selector: selector('totalOf') };
    // The read after the write runs a frame of its own; the one after it shares that frame's record.
    expect(calls(around, 'bump').map((call) => [call.functionName, call.callOrdinal, call.readonlyReturnBinding]))
      .toEqual([
        ['totalOf', { group: 0, ordinal: 0 }, undefined],
        ['setTotal', { group: 0, ordinal: 1 }, undefined],
        ['totalOf', { group: 0, ordinal: 2 }, binding],
        ['totalOf', { group: 0, ordinal: 2 }, binding],
      ]);
    expect(around.bytecode).toContain(`0000${selector('totalOf')}`);
    expect(around.bytecode).toContain(`0200${selector('totalOf')}`);
    expect(around.bytecode).not.toContain(`0300${selector('totalOf')}`);
  });

  it('numbers repeated state-changing calls as frames, a void one reading `digest || 0x01`', () => {
    const writer = compileString(WRITER, { suppressWarnings: true });
    expect(calls(writer, 'twice').map((call) => [call.functionName, call.callOrdinal, call.hasReturnValues,
      call.needsSelectorVerification, call.returnTypes])).toEqual([
      ['setTotal', { group: 0, ordinal: 0 }, true, false, undefined],
      ['setTotal', { group: 0, ordinal: 1 }, true, false, undefined],
    ]);
    // Each digests its own ordinal and reads its record at a return witness of its own.
    expect(writer.bytecode).toContain(`0000${selector('setTotal')}`);
    expect(writer.bytecode).toContain(`0100${selector('setTotal')}`);
    expect(fn(writer, 'twice').inputs.map((input) => input.name).filter((name) => name.includes('ReturnOutput')))
      .toEqual(['__internal__externalReturnOutputIdx0', '__internal__externalReturnOutputIdx1']);
    // A lone void call digests its call to read the callee's void record, `digest || 0x01`. IBook names several
    // methods, so the read takes the place of the selector check and runs through a return witness, as a returning
    // call's does (the record names the method, the arguments and the reader).
    const lone = compileString(WRITER.replace('IBook(book).setTotal(a + 1);', ''),
      { suppressWarnings: true });
    expect(calls(lone, 'twice').map((call) => [call.callOrdinal, call.hasReturnValues, call.needsSelectorVerification]))
      .toEqual([[undefined, true, false]]);
    expect(lone.bytecode).toContain(`0000${selector('setTotal')}`);
    expect(fn(lone, 'twice').inputs.some((input) => input.name.includes('ReturnOutput'))).toBe(true);
  });

  it('still refuses a repeated call that cannot be a frame, naming the multi-call entry\'s limits', () => {
    let message = '';
    try {
      compileString(`pragma solidcash >=0.8.0;
interface IPaid { function pay(bigint by) external payable returns (bigint); }
contract Payer(address paid) {
  bigint last;
  function twice() public { this.last = IPaid(paid).pay{value: 1000}(1) + IPaid(paid).pay(2); }
}`, { suppressWarnings: true });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/REPEATED_CALL_UNSUPPORTED.*\(IPaid\.pay -> IPaid\.pay\)/);
    expect(message).toMatch(/multi-call entry, whose calls are regular and value-free, name a fixed method of a /);
    expect(message).toMatch(/fixed target and pass every argument their records digest; this transaction cannot be /);
    expect(message).toMatch(/this transaction cannot be built\.$/);
    expect(message).not.toMatch(/omit the option/);
  });

  it('counts a looped state-changing call as frames and refuses a looped call that can be no frame', () => {
    // The callee master is spent once: each iteration reads the record of its own frame of the callee's spend.
    const looped = (body: string): string => `pragma solidcash >=0.8.0;
interface ICounter { function inc(bigint by) external returns (bigint); }
interface IPaid { function pay(bigint by) external payable returns (bigint); }
interface ISink { function put(bigint by) external; function fund(bigint by) external payable; }
contract LoopedWriter(address counter) {
  bigint last;
  bytes stored;
  function one(bigint by) internal returns (bigint) { return ICounter(counter).inc(by); }
  function run(bigint n, bool take, address other, address[] all) public { bigint acc = 0; ${body} this.last = acc; }
}`;
    const counted = [
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + ICounter(counter).inc(i); }',
      'bigint i = 0; while (i < n) { acc = acc + ICounter(counter).inc(i); i = i + 1; }',
      'for (bigint i = 0; i < n; i = i + 1) { if (take) { acc = acc + ICounter(counter).inc(i); } }',
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + one(i); }',
      'for (bigint i = 0; i < n; i = i + 1) { acc = acc + ICounter(this.stored).inc(i); }',
    ];
    for (const body of counted) {
      const artifact = compileString(looped(body), { suppressWarnings: true });
      expect(calls(artifact, 'run').map((call) => [call.functionName, call.callOrdinal]), body)
        .toEqual([['inc', { group: 0, counted: true }]]);
      // With no epilogue, the looped call checks its record's carrier where it runs.
      expect(artifact.bytecode, body).toContain('OP_TUCK OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY');
    }
    // A loop-invariant computed target and a value call can be no frame.
    const ternary = 'for (bigint i = 0; i < n; i = i + 1) { acc = acc + ICounter(take ? counter : other).inc(i); }';
    for (const [body, chain] of [
      [ternary, 'ICounter\\.inc'],
      ['for (bigint i = 0; i < n; i = i + 1) { acc = acc + IPaid(counter).pay{value: 1000}(i); }', 'IPaid\\.pay'],
      // A void call runs once as well: a loop of them is a frame group or refused.
      ['for (bigint i = 0; i < n; i = i + 1) { ISink(take ? counter : other).put(i); }', 'ISink\\.put'],
      ['for (bigint i = 0; i < n; i = i + 1) { ISink(counter).fund{value: 1000}(i); }', 'ISink\\.fund'],
    ] as const) {
      expect(() => compileString(looped(body), { suppressWarnings: true }), body)
        .toThrow(new RegExp(`REPEATED_CALL_UNSUPPORTED.*\\(${chain}\\).*this transaction cannot be built\\.$`));
    }
    for (const body of ['acc = ICounter(counter).inc(n);',
      'for (bigint i = 0; i < all.length; i = i + 1) { acc = acc + ICounter(all[i]).inc(i); }']) {
      expect(() => compileString(looped(body), { suppressWarnings: true }), body).not.toThrow();
    }
    const voidLoop = compileString(looped('for (bigint i = 0; i < n; i = i + 1) { ISink(counter).put(i); }'),
      { suppressWarnings: true });
    expect(calls(voidLoop, 'run').map((call) => [call.functionName, call.callOrdinal]))
      .toEqual([['put', { group: 0, counted: true }]]);
    // An opaque call to one target runs once whatever its payloads: refused in a loop, its data read or not.
    const raw = (body: string): string => `contract RawLoop() {
  bigint n;
  function go(address t, address[] ts, bytes[] ps) public { bigint s = 0; ${body} this.n = s; }
}`;
    for (const body of [
      'for (bigint i = 0; i < ps.length; i = i + 1) { (bool ok, bytes memory r) = t.call(ps[i]); require(ok); '
        + 's = s + r.length; }',
      'for (bigint i = 0; i < ps.length; i = i + 1) { (bool ok, bytes memory r) = t.call(ps[i]); require(ok); s = s + 1; }',
      'for (bigint i = 0; i < ps.length; i = i + 1) { (bool ok, ) = t.call(ps[i]); require(ok); s = s + 1; }',
    ]) {
      expect(() => compileString(raw(body), { suppressWarnings: true }), body)
        .toThrow(/REPEATED_CALL_UNSUPPORTED.*this transaction cannot be built\.$/);
    }
    // A Multicall over array targets checks each iteration's callee and record where it runs.
    expect(() => compileString(raw('for (bigint i = 0; i < ts.length; i = i + 1) { (bool ok, bytes memory r) = '
      + 'ts[i].call(ps[i]); require(ok); s = s + r.length; }'), { suppressWarnings: true }))
      .not.toThrow();
  });
});
