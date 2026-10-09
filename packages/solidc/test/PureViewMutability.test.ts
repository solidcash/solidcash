import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Native (no compatibility flag) pure/view mutability and payability enforcement. These cases pin the rules
// that were previously gated behind evmCompat: a native `pure`/`view` function must not write state,
// read environment ops, create contracts, or make state-modifying calls, and `msg.value` / value-bearing deploys
// require a payable context. The shipped compiler entry (`src/index.js`) drives every case; no dist import.

const compile = (src: string): ReturnType<typeof compileString> =>
  compileString(src, { messageBus: false, enforceFinalRequire: false });

const STATE_WRITE = /'pure'\/'view' functions cannot modify contract state/;
const ENV_READ = /'pure' functions cannot read 'msg.sender'/;
const MSG_VALUE = /'msg.value' can only be read by payable constructors or payable public\/external functions/;
const DEPLOY_VALUE = /cannot set deployment value because constructor of 'Child' is not payable/;
const CREATE = /pure or view functions cannot create contracts/;
const EXTERNAL_CALL = /'view' function cannot call 'nonpayable' external function 'go'/;
const LOW_LEVEL = /'pure'\/'view' functions cannot perform state-modifying low-level calls/;

describe('native pure/view mutability enforcement (Tier 1)', () => {
  it('T1-1 rejects a view function writing scalar state', () => {
    expect(() => compile('contract C() { int x; function f() view { this.x = 5; } }')).toThrow(STATE_WRITE);
  });

  it('T1-1 rejects a pure function writing scalar state', () => {
    expect(() => compile('contract C() { int x; function f() pure { this.x = 5; } }')).toThrow(STATE_WRITE);
  });

  it('T1-2 rejects a view function pushing/popping a state array', () => {
    expect(() => compile('contract C() { int[] a; function f() view { this.a.push(1); } }')).toThrow(STATE_WRITE);
    expect(() => compile('contract C() { int[] a; function f() view { this.a.pop(); } }')).toThrow(STATE_WRITE);
  });

  it('T1-3 rejects a view function assigning a state array element', () => {
    expect(() => compile('contract C() { int[] a; function f() view { this.a[0] = 1; } }')).toThrow(STATE_WRITE);
  });

  it('T1-3 rejects a view function deleting a state array element', () => {
    expect(() => compile('contract C() { int[] a; function f() view { delete this.a[0]; } }')).toThrow(STATE_WRITE);
  });

  it('T1-3 rejects a view function writing a mapping entry', () => {
    expect(() => compile('contract C() { mapping(int => int) m; function f() view { this.m[1] = 2; } }'))
      .toThrow(STATE_WRITE);
  });

  it('T1-3 rejects a view function writing a mapping struct field', () => {
    expect(() => compile(
      'contract C() { struct S { int a; } mapping(int => S) m; function f() view { this.m[1].a = 2; } }',
    )).toThrow(STATE_WRITE);
  });

  it('T1-3 rejects a view function deleting a mapping entry', () => {
    expect(() => compile('contract C() { mapping(int => int) m; function f() view { delete this.m[1]; } }'))
      .toThrow(STATE_WRITE);
  });

  it('T1-4 rejects a pure function reading an environment op', () => {
    expect(() => compile('contract C() { int x; function f() pure returns (address) { return msg.sender; } }'))
      .toThrow(ENV_READ);
  });

  it('T1-5 rejects msg.value in a non-payable view entry', () => {
    expect(() => compile('contract C() { function f() view { require(msg.value >= 0); } }')).toThrow(MSG_VALUE);
  });

  it('T1-5 rejects msg.value in a non-payable constructor', () => {
    expect(() => compile('contract C() { int x; constructor() { require(msg.value >= 0); } }')).toThrow(MSG_VALUE);
  });

  it('T1-5 admits msg.value in a payable constructor', () => {
    expect(compile('contract C() { int x; constructor() payable { require(msg.value >= 0); } }').contractName)
      .toBe('C');
  });

  it('T1-6 rejects value-bearing deploy to a non-payable constructor', () => {
    const src = 'contract Child(bytes20 d) { bytes20 s; constructor() { this.s = d; } }'
      + ' contract F() { int n; function c(bytes20 d) deploy { Child child = new Child{value: 1000}(d); } }';
    expect(() => compile(src)).toThrow(DEPLOY_VALUE);
  });

  it('T1-6 admits value-bearing deploy to an implicit-constructor child', () => {
    // `contract Child(args)` has no `constructor` body to carry a `payable` modifier, and native SolidCash has no
    // value gate on receiving value, so the deployment value is permitted (the child still receives it).
    const src = 'contract Child(bytes20 d) { bytes20 s; }'
      + ' contract F(pubkey admin) { int n; function c(sig s, bytes20 d) deploy {'
      + ' require(checkSig(s, admin)); Child child = new Child{value: 1000}(d); } }';
    expect(compile(src).contractName).toBe('F');
  });

  it('T1-7 rejects a view function creating a contract', () => {
    const src = 'contract Child() { int x; } contract F() { int n; function c() view { Child child = new Child(); } }';
    expect(() => compile(src)).toThrow(CREATE);
  });

  it('T1-8 rejects a view function calling a non-view external function', () => {
    const src = 'interface I { function go() external; } contract C() { int n; function f(I t) view { t.go(); } }';
    expect(() => compile(src)).toThrow(EXTERNAL_CALL);
  });

  it('T1-9 rejects a view function making a state-modifying low-level call', () => {
    const src = 'contract C() { int n; function f(address a, bytes d) view { a.call(d); } }';
    expect(() => compile(src)).toThrow(LOW_LEVEL);
  });
});
