import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// receive() / fallback() (Solidity porting: empty bodies, return types, forwarding proxies).

describe('empty void functions synthesize a no-op body (Solidity porting: receive/fallback/payable)', () => {
  it('compiles empty receive(), payable, and plain void functions under solidityImportCompat', () => {
    for (const body of [
      'function inc() public { n++; } receive() external payable {}',
      'function deposit() public payable {} function inc() public { n++; }',
      'function f() public {} function inc() public { n++; }',
      'function inc() public { n++; } fallback() external payable {}',
    ]) {
      const src = `pragma solidity ^0.8.0; contract C { int n; ${body} }`;
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    }
  });

  it('synthesizes a no-op body for an empty function (default; was gated behind solidityImportCompat)', () => {
    expect(compileString('contract C() { int n; function f() {} }').contractName).toBe('C');
  });
});

// A receive() must stay external + payable, but Solidity allows virtual/override interleaved in any order.
describe('receive(): virtual/override interleaved with external payable', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `receive() external virtual payable`', () => {
    expect(cc('contract C { uint bal; receive() external virtual payable { bal = 1; }'
      + ' function f() public { require(true); } }')).toBe('C');
  });
  it('still rejects a receive() missing payable', () => {
    expect(() => compileString('contract C { receive() external { } function f() public { require(true); } }',
      { solidityImportCompat: true })).toThrow();
  });
});

// A Solidity forwarding-proxy fallback declares a return type: `fallback(bytes) external payable returns (bytes)`.
// Lowers like the already-supported fallback-with-params plus a returns clause; the body forwards via the same
// opaque-data low-level call model as MultiSigWallet (`target.call{value}(data)`), which is covenant-sound.
describe('fallback with input + return type (forwarding proxy)', () => {
  const SRC = 'contract C { address immutable target; constructor(address _t) { target = _t; }'
    + ' fallback(bytes calldata data) external payable returns (bytes memory) {'
    + ' (bool ok, bytes memory res) = target.call{value: msg.value}(data); require(ok); return res; } }';
  it('parses and compiles a fallback with a bytes return type', () => {
    expect(compileString(SRC, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('captures the forward as a low-level call (sound forwarding covenant)', () => {
    const fb = compileString(SRC, { solidityImportCompat: true }).abi.find((f) => f.name === '__fallback');
    expect(fb?.isFallback).toBe(true);
    expect(fb?.lowLevelCalls?.[0]?.callMode).toBe('call');
  });
  it('rejects Solidity fallback(bytes) without its required bytes return type', () => {
    expect(() => compileString('contract C { int n; fallback(bytes calldata data) external payable {'
      + ' (bool ok, bytes memory res) = msg.sender.call{value: msg.value}(data); require(ok); this.n = res.length; } }',
    { solidityImportCompat: true })).toThrow(/Fallback function either has to have the signature/);
  });
});
