import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// A call through a foreign function value `IFace(a).method` binds the arguments of the value's type, so the member
// must name one method of exactly that type, wherever the value is held; and the call must stay where an entry
// point binds its callee.
const IFACE = 'interface IT { public bigint calls; function big(uint256 v, uint256 w); function small(uint256 v); }';
const contract = (body: string): string => `pragma solidcash >=0.8.0;\n${IFACE}\ncontract C(address a) {\n${body}\n}`;
const selector = (signature: string): string => createHash('sha256').update(signature).digest('hex').slice(0, 8);
const hex = (bytecode: unknown): string => (typeof bytecode === 'string' ? bytecode
  : Buffer.from(bytecode as Uint8Array).toString('hex'));

describe('foreign function values', () => {
  it('refuses a member of another type in a state variable, a struct field or a local', () => {
    const holders = {
      state: (m: string) => `bigint n; function(uint256) external cb;
  function setCb() { this.cb = IT(a).${m}; this.n = this.n + 1; }
  function fire(uint256 v) { this.cb(v); this.n = this.n + 1; }`,
      field: (m: string) => `struct S { function(uint256) external fn; uint256 x; } bigint n; S s;
  function setS() { this.s = S(IT(a).${m}, 1); this.n = this.n + 1; }
  function fire(uint256 v) { s.fn(v); this.n = this.n + 1; }`,
      local: (m: string) => `bigint n;
  function fire(uint256 v) { function(uint256) external f = IT(a).${m}; f(v); this.n = this.n + 1; }`,
    };
    for (const holder of Object.values(holders)) {
      expect(() => compileString(contract(holder('big')))).toThrow(/does not name one method of function pointer/);
      expect(() => compileString(contract(holder('small')))).not.toThrow();
    }
  });

  it('refuses a member of another type through a typed receiver, a split argument or a named field', () => {
    const shapes = {
      receiverLocal: (m: string) => contract(`bigint n;
  function fire(uint256 v) { IT t = IT(a); function(uint256) external f = t.${m}; f(v); this.n = this.n + 1; }`),
      receiverParameter: (m: string) => `pragma solidcash >=0.8.0;\n${IFACE}\ncontract C(IT t) { bigint n;
  function fire(uint256 v) { function(uint256) external f = t.${m}; f(v); this.n = this.n + 1; } }`,
      externalArgument: (m: string) => `pragma solidcash >=0.8.0;\n${IFACE}
interface IB { function register(function(uint256) external cb, uint256 amount); }
contract C(address a, address b) { bigint n;
  function fire(uint256 amount) { IB(b).register(IT(a).${m}, amount); this.n = this.n + 1; } }`,
      namedField: (m: string) => contract(`struct S { function(uint256, uint256) external g; function(uint256) external fn; }
  bigint n; S s;
  function setS() { this.s = S({g: IT(a).${m === 'big' ? 'small' : 'big'}, fn: IT(a).${m}}); this.n = this.n + 1; }
  function fire(uint256 v) { s.fn(v); this.n = this.n + 1; }`),
    };
    for (const shape of Object.values(shapes)) {
      expect(() => compileString(shape('big'))).toThrow(/does not name one method of function pointer/);
      expect(() => compileString(shape('small'))).not.toThrow();
    }
  });

  it('passes a pointer named in an external call in its method\'s order', () => {
    const source = (args: string): string => `pragma solidcash >=0.8.0;\n${IFACE}
interface IB { function register(function(uint256) external cb, uint256 amount); }
contract C(address a, address b) { bigint n;
  function fire(uint256 amount) { IB(b).register(${args}); this.n = this.n + 1; } }`;
    expect(hex(compileString(source('{amount: amount, cb: IT(a).small}')).bytecode))
      .toBe(hex(compileString(source('IT(a).small, amount')).bytecode));
  });

  it('inlines a returning helper only with members of its parameters\' types, placed by name', () => {
    const source = (args: string): string => `pragma solidcash >=0.8.0;
interface IR {
  function ret(uint256 v) external returns (uint256); function ret2(uint256 v, uint256 w) external returns (uint256);
}
contract C(address a, address b) { bigint n;
  function ev(function(uint256) external returns (uint256) f, function(uint256, uint256) external returns (uint256) g)
    internal returns (uint256) { return f(1) + g(2, 3); }
  function fire() { this.n = int(ev(${args})); } }`;
    expect(() => compileString(source('IR(a).ret2, IR(b).ret2'))).toThrow(/does not name one method/);
    const named = compileString(source('{g: IR(a).ret2, f: IR(b).ret}'));
    expect(named.abi.find((entry) => entry.name === 'fire')!.externalCalls!.map((call) => call.functionName))
      .toEqual(['ret', 'ret2']);
  });

  it('binds a call through a value an internal helper receives at the entry point', () => {
    // The helper is the contract's only call: the value lowering makes it an external call, which the entry binds.
    const artifact = compileString(contract(`bigint n;
  function run(function(uint256) external f, uint256 v) internal { f(v); }
  function fire(uint256 v) { run(IT(a).small, v); this.n = this.n + 1; }`));
    expect(artifact.abi.find((entry) => entry.name === 'fire')!.externalCalls).toHaveLength(1);
  });

  it('refuses a constant selector of an overloaded name', () => {
    const source = (iface: string): string => `pragma solidcash >=0.8.0;
${iface}
contract S() { bytes4 constant SEL = IT.hit.selector; function s() { require(SEL != 0x00000000); } }`;
    expect(() => compileString(source('interface IT { function hit(uint256 v, uint256 w); function hit(uint256 v); }')))
      .toThrow(/is overloaded: its selector does not name one method/);
    expect(() => compileString(source('interface IT { function hit(uint256 v); function other(uint256 v); }')))
      .not.toThrow();
  });

  it('refuses a whole table copy of another method', () => {
    const source = (method: string): string => `pragma solidcash >=0.8.0;
interface IT { public bigint calls; function hit(uint256 v); function zap(uint256 v); }
contract T(address a, address b) {
  function(uint256) external[] fns;
  function(uint256) external[] others;
  function reg() { this.fns.push(IT(a).hit); this.others.push(IT(b).${method}); }
  function copy() { this.fns = this.others; }
  function fire(uint256 v) { for (uint256 i = 0; i < fns.length; i = i + 1) { fns[i](v); } }
}`;
    expect(() => compileString(source('zap'))).toThrow(/must copy a table of the same interface and method/);
    expect(() => compileString(source('hit'))).not.toThrow();
  });

  it('checks a framed call of an overloaded method against the overload it encodes', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
interface I { function m(bytes b); function m(uint256 v, uint256 w); }
contract C() {
  bigint n;
  function go(address t) { (bool ok, ) = address(t).call(abi.encodeCall(I.m, (5, 7))); require(ok); this.n = this.n + 1; }
}`, { composition: 'framed' });
    expect(hex(artifact.bytecode)).toContain(selector('m(uint256,uint256)'));
    expect(hex(artifact.bytecode)).not.toContain(selector('m(bytes)'));
  });
});
