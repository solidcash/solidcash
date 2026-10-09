import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../dist/compiler.js';

const SOURCE = `
interface IA {
  function echo(bytes b) external returns (bytes);
  function wide(uint n, bytes39 b) external returns (uint, bytes39);
}
contract A {
  bigint marker;
  function echo(bytes b) public returns (bytes) { this.marker = this.marker + 1; return b; }
  function pair(uint n, bytes39 b) internal pure returns (uint, bytes39) { return (n, b); }
  function wide(uint n, bytes39 b) public returns (uint, bytes39) {
    this.marker = this.marker + 1;
    return pair(n, b);
  }
}
contract B {
  bytes32 digest;
  bytes39 saved;
  uint seen;
  function use(address a, bytes b, uint n, bytes39 wideValue) public {
    this.digest = sha256(IA(a).echo(b));
    (uint returned, bytes39 value) = IA(a).wide(n, wideValue);
    this.seen = returned;
    this.saved = value;
  }
}`;

describe('external result encoding metadata', () => {
  it('publishes one compiler-owned tuple encoding on producers and callsites', () => {
    const artifacts = compileStringMulti(SOURCE, {
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
      __artifactCache: false,
    });
    const echo = artifacts.A.abi.find((fn) => fn.name === 'echo')!;
    const wide = artifacts.A.abi.find((fn) => fn.name === 'wide')!;
    expect(echo.resultEncoding).toBe('evm-abi-v1');
    expect(wide.resultEncoding).toBe('compact-pushdata-v1');
    const use = artifacts.B.abi.find((fn) => fn.name === 'use')!;
    expect(use.externalCalls?.map((call) => [call.functionName, call.resultEncoding])).toEqual([
      ['echo', 'evm-abi-v1'],
      ['wide', 'compact-pushdata-v1'],
    ]);
    const summary = artifacts.B.invocationAnalysis?.functions.find((fn) => fn.name === 'use');
    expect(summary?.resultDependencies?.map((dependency) => dependency.resultEncoding)).toEqual([
      'evm-abi-v1', 'compact-pushdata-v1',
    ]);
  });

  it('publishes an authenticated preimage slot for a dynamic struct return', () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      struct Record { uint256 id; string label; }
      interface ISource { function read() external view returns (Record memory); }
      contract Source {
        function read() public pure returns (Record memory) { return Record(7, "a long label"); }
      }
      contract Consumer {
        function copy(address source) public view returns (Record memory) {
          return ISource(source).read();
        }
      }`, {
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
      __artifactCache: false,
    });
    const copy = artifacts.Consumer.abi.find((fn) => fn.name === 'copy')!;
    expect(copy.externalCalls?.[0]?.resultEncoding).toBe('evm-abi-v1');
    expect(copy.inputs.map((input) => input.name)).toContain('__internal__externalReturnPreimage');
  });
});
