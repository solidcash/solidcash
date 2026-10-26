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
