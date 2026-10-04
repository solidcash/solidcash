import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/compiler.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
interface ISource { function read() external view returns (int); }
contract ExactExternalReturn {
  address public source;
  function exact() public view returns (int) { return ISource(source).read(); }
  function computed() public view returns (int) { return ISource(source).read() + 1; }
  function guarded() public view returns (int) {
    require(source != address(0));
    return ISource(source).read();
  }
}`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
  suppressWarnings: true, optimizeForCompilationSpeed: true });

describe('direct external return metadata', () => {
  it('proves an exact external-call return', () => {
    const exact = artifacts.ExactExternalReturn.abi.find((fn) => fn.name === 'exact');
    expect(exact?.directExternalReturn).toEqual({ callsiteId: exact?.externalCalls?.[0]?.callsiteId });
  });

  it('does not prove arithmetic or guarded external-call returns', () => {
    const abi = artifacts.ExactExternalReturn.abi;
    expect(abi.find((fn) => fn.name === 'computed')?.directExternalReturn).toBeUndefined();
    expect(abi.find((fn) => fn.name === 'guarded')?.directExternalReturn).toBeUndefined();
  });
});
