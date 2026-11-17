import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import { compileString, compileStringMulti } from './direct-compile.js';

/**
 * A raw low-level call through a target its function writes before the call. SynthesizeExternalAddressLocals reads the
 * call's receiver into a compiler local at the top of the body: a stored address (`payee.call{value: v}("")`), a
 * stored struct's field or a collection entry (`__extaddr_ll_split_to`, `__extaddr_ll_book_k`), a parameter's field
 * or element. A low-level call pinned and paid that local where it ran, and a raw call's identity check after the body
 * read it too, so after `payee = p` the call was bound to the address the variable held at the top of the body, which
 * the EVM's call does not go to. The call site now reads the written value, where an entry it cannot read there is
 * refused by name, and a raw call written before publishes that a builder cannot resolve its callee from the state.
 *
 * The payments and the raw call's callee are checked on the VM in LowLevelCallSiteTarget.e2e.test.ts.
 */

/** A payer whose one function is `body`, over a stored address, a stored struct and a mapping of addresses. */
const payer = (body: string): string => `pragma solidcash >=0.8.0;
contract Payer {
  struct Split { address to; int share; }
  address payee;
  Split split;
  mapping(int => address) book;
  int sends;
  ${body}
}`;

/** Each shape: a value call made after a write of its target, or with no write before it. */
const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ['through a stored address written first', `function f(address p, int amount) external {
    payee = p;
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    sends = sends + 1;
  }`],
  ['through a stored struct\'s field written first', `function f(address p, int amount) external {
    split = Split(p, 2);
    (bool ok, bytes data) = split.to.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through the entry written first', `function f(int k, address p, int amount) external {
    book[k] = p;
    (bool ok, bytes data) = book[k].call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through a parameter\'s field written first', `function f(Split s, address p, int amount) external {
    s.to = p;
    (bool ok, bytes data) = s.to.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through a parameter\'s element written first', `function f(address[] payees, int i, address p, int amount)
    external {
    payees[i] = p;
    (bool ok, bytes data) = payees[i].call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['before a write of its target', `function f(address p, int amount) external {
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    payee = p;
  }`],
  ['with no write of its target', `function f(int amount) external {
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['as a statement after a write', `function f(address p, int amount) external {
    payee = p;
    payee.call{value: amount}("");
  }`],
  ['as a statement through a stored struct\'s field', `function f(int amount) external {
    split.to.call{value: amount}("");
  }`],
];

/**
 * SafeERC20's raw call through a stored token address (`__extaddr_ll_token`): its callee is co-spent and checked after
 * the body.
 */
const CALLER = `pragma solidcash >=0.8.0;
contract Caller {
  address token;
  bigint paid;
  function retargetThenCall(address t, uint amount) external {
    this.token = t;
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
  function callThenRetarget(address t, uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
    this.token = t;
  }
  function callOnly(uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
}`;

const rawCallOf = (artifact: Artifact, entry: string): ExternalCallAbi | undefined => artifact.abi
  .find((fn) => fn.name === entry)?.externalCalls?.find((call) => call.interfaceName === '__raw__');

describe('a low-level call through a target its function writes before the call', () => {
  it.each(SHAPES)('compiles a value call %s, with its payment slot', (_shape, body) => {
    const artifact = compileString(payer(body), { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.transferCount).toBe(1);
  });

  it('refuses by name a value call through an entry the function writes under another key first', () => {
    const compile = (): Artifact => compileString(payer(`function f(int j, int k, address p, int amount) external {
      book[j] = p;
      (bool ok, bytes data) = book[k].call{value: amount}("");
      require(ok && data.length == 0);
    }`), { forceStateful: true });
    expect(compile).toThrow(/ENTRY_TARGET_WRITTEN_BEFORE_CALL/);
    expect(compile).toThrow(/'f' writes 'book' before making a low-level call through an entry of it/);
    expect(compile).toThrow(/Make the call before the write, or write the same entry unconditionally/);
  });

  it('refuses by name a constructor\'s raw call through a stored target it writes first (Deploy<C>)', () => {
    // The receiver is read at the top of `create`, before the constructor writes it; the genesis checks bind the call
    // to that read where the call runs and after the body.
    const compile = (): Artifact => compileString(`pragma solidcash >=0.8.0;
      interface I { function f(int x) external returns (bool); }
      contract C {
        address token;
        bool ok;
        constructor(address t) {
          token = t;
          (bool success, bytes data) = token.call(abi.encodeWithSelector(I.f.selector, 5));
          ok = success;
        }
        function read() external { require(ok); }
      }`, { deployer: true, genesisCalls: true } as never);
    expect(compile).toThrow(/GENESIS_TARGET_WRITTEN_BEFORE_CALL/);
    expect(compile).toThrow(/writes the target of a low-level call before the call/);
  });

  it('publishes a raw call whose stored target the function writes first, and no other', () => {
    const artifact = compileString(CALLER, { evmCompat: true, forceStateful: true });
    expect(rawCallOf(artifact, 'retargetThenCall')?.targetWrittenBeforeCall).toBe(true);
    expect(rawCallOf(artifact, 'callThenRetarget')).toBeDefined();
    expect(rawCallOf(artifact, 'callThenRetarget')?.targetWrittenBeforeCall).toBeUndefined();
    expect(rawCallOf(artifact, 'callOnly')).toBeDefined();
    expect(rawCallOf(artifact, 'callOnly')?.targetWrittenBeforeCall).toBeUndefined();
  });

  it('publishes a statement call through a stored struct\'s field as written first only after a write of it', () => {
    // The statement form reads its receiver where it runs; the flag tells a builder not to resolve the callee from the
    // state before the call.
    const artifact = compileString(payer(`
      function reshare(int s, int amount) external { split.share = s; split.to.call{value: amount}(""); }
      function resplit(address p, int amount) external { split.to = p; split.to.call{value: amount}(""); }`), {
      forceStateful: true,
    });
    const row = (entry: string): { targetWrittenBeforeCall?: true } | undefined => artifact.abi
      .find((fn) => fn.name === entry)?.lowLevelCalls?.[0];
    expect(row('reshare')).toBeDefined();
    expect(row('reshare')?.targetWrittenBeforeCall).toBeUndefined();
    expect(row('resplit')?.targetWrittenBeforeCall).toBe(true);
  });
});

/**
 * Jobs held as EACC's MarketplaceV1 holds them: a packed struct array, whose field write the AstBuilder lowers to a
 * rebuild of the whole element, and a mapping of structs; and a stored struct. `payStartJob` writes `job.state` and
 * `job.roles.worker`, then SafeERC20 makes a raw call through `job.token`, which it never writes: the value read at
 * the top of the body is current there. The written-first check compares field paths, so such a call keeps that
 * binding, while a write that can reach the target's field is bound to the written value or refused as before.
 */
const jobs = (members: string): string => `pragma solidity ^0.8.0;
contract Jobs {
  struct Roles { address creator; address worker; }
  struct Job { uint8 state; Roles roles; address token; uint256 amount; }
  struct Config { address token; uint256 fee; }
  Job[] jobs;
  mapping(uint256 => Job) book;
  Config config;
  ${members}
}`;

/** A function `name(params, amount)` that runs `writes`, then SafeERC20's raw call through `target`. */
const payAfter = (name: string, params: string, writes: string, target: string): string => `
  function ${name}(${params}, uint256 amount) external {
    ${writes}
    (bool success, bytes memory data) = ${target}.call(abi.encodeWithSelector(0xa9059cbb, msg.sender, amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
  }`;

/** Calls through a field no write before them can reach: each keeps the value read at the top of the body. */
const CURRENT = [
  payAfter('takeElement', 'uint256 k, address w',
    'Job storage job = jobs[k]; job.state = 1; job.roles.worker = w;', 'job.token'),
  payAfter('takeEntry', 'uint256 k, address w',
    'Job storage job = book[k]; job.state = 1; job.roles.worker = w;', 'job.token'),
  payAfter('takeEntryCopy', 'uint256 k, address w',
    'Job memory job = book[k]; job.state = 1; book[k] = job;', 'book[k].token'),
  payAfter('takeOtherEntry', 'uint256 j, uint256 k, address w',
    'book[j].state = 1; book[j].roles.worker = w;', 'book[k].token'),
  payAfter('refee', 'uint256 fee', 'config.fee = fee;', 'config.token'),
  payAfter('payOnly', 'uint256 k', '', 'book[k].token'),
];

/** A call through a field a write before it reaches, which the call reads again where it runs. */
const BOUND = payAfter('retoken', 'address t', 'config.token = t;', 'config.token');

/** Calls through a field of a packed array element a write before them reaches, which they cannot read again. */
const REFUSED: ReadonlyArray<readonly [string, string]> = [
  ['the element\'s target field', payAfter('f', 'uint256 k, address t', 'jobs[k].token = t;', 'jobs[k].token')],
  ['the element\'s struct holding the target', payAfter('f', 'uint256 k, address w',
    'jobs[k].roles = Roles(msg.sender, w);', 'jobs[k].roles.worker')],
];

describe('a call through a field of an entry its function writes other fields of first', () => {
  it('keeps the value read at the top of the body, and binds a call through the written field again', () => {
    const artifact = compileString(jobs([...CURRENT, BOUND].join('\n')), { evmCompat: true, forceStateful: true });
    for (const entry of ['takeElement', 'takeEntry', 'takeEntryCopy', 'takeOtherEntry', 'refee', 'payOnly']) {
      expect(rawCallOf(artifact, entry), entry).toBeDefined();
      expect(rawCallOf(artifact, entry)?.targetWrittenBeforeCall, entry).toBeUndefined();
    }
    expect(rawCallOf(artifact, 'retoken')?.targetWrittenBeforeCall).toBe(true);
  });

  it('publishes a call after a write of its entry\'s target field, which it reads through the entry cache', () => {
    // Under evmCompat the field write is cached (`__vmapcache_book_<n>`) and written back after the call; the call
    // reads the cache where it runs. A builder resolves the stored field before the call, which the write changes.
    const artifact = compileString(jobs(payAfter('retokenEntry', 'uint256 k, address t', 'book[k].token = t;',
      'book[k].token')), { evmCompat: true, forceStateful: true });
    const call = rawCallOf(artifact, 'retokenEntry');
    expect(call?.targetWrittenBeforeCall).toBe(true);
    expect(call?.addressSource).toMatchObject({
      kind: 'expression', expression: { kind: 'field', name: 'token', expression: { kind: 'stateAccess', name: 'book' } },
    });
  });

  it.each(REFUSED)('refuses by name a call after a write of %s', (_write, member) => {
    const compile = (): Artifact => compileString(jobs(member), { evmCompat: true, forceStateful: true });
    expect(compile).toThrow(/ENTRY_TARGET_WRITTEN_BEFORE_CALL/);
    expect(compile).toThrow(/'f' writes 'jobs' before making a low-level call through an entry of it/);
  });

  it('keeps a framed call through a stored struct\'s field its function does not write', () => {
    const reader = (member: string): string => `pragma solidity ^0.8.0;
      interface IOracle { function price() external view returns (uint256); }
      contract Reader {
        struct Feed { IOracle oracle; uint256 reads; }
        Feed feed;
        uint256 public last;
        constructor(IOracle o) { feed = Feed(o, 0); }
        ${member}
      }`;
    expect(compileStringMulti(reader(`function countThenRead() external returns (uint256) {
      feed.reads = feed.reads + 1; last = feed.oracle.price(); return last; }`), {
      composition: 'framed', evmCompat: true,
    } as never).Reader).toBeDefined();
    expect(() => compileStringMulti(reader(`function refeedThenRead(IOracle o) external returns (uint256) {
      feed = Feed(o, 1); last = feed.oracle.price(); return last; }`), {
      composition: 'framed', evmCompat: true,
    } as never)).toThrow(/FRAMED_TARGET_WRITTEN_BEFORE_CALL/);
  });

  it('keeps a framed call through a packed element\'s field its function does not write, and names one it refuses', () => {
    // framed/call/proxy-dynamic-struct-conditional-update.test.ts's `close`: a framed body checks every call's target.
    const registry = (member: string): string => `pragma solidity ^0.8.20;
      interface ISink { function transfer(address to, uint256 amount) external returns (bool); }
      contract Registry {
        struct Record { uint8 state; string note; uint256 amount; address token; }
        Record[] records;
        ${member}
      }`;
    const framed = {
      composition: 'framed', evmCompat: true, tagSingletonDataNfts: true, maximumInputBytes: 10_000_000,
    } as never;
    expect(compileStringMulti(registry(`function close(uint256 id) external {
      Record storage record = records[id]; record.state = 2;
      require(ISink(record.token).transfer(msg.sender, record.amount)); }`), framed).Registry).toBeDefined();
    expect(() => compileStringMulti(registry(`function close(uint256 id, address t) external {
      Record storage record = records[id]; record.token = t;
      require(ISink(record.token).transfer(msg.sender, record.amount)); }`), framed))
      .toThrow(/'close' writes 'records' before calling ISink\.transfer through an entry of it/);
  });
});
