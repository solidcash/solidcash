import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

type KernelHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handler = (members: string): KernelHandler | undefined => compileString(`pragma solidity ^0.8.0;
  contract C {
    function first(uint value) external pure returns (uint) { return value + 1; }
    function second(uint value) external pure returns (uint) { return value + 2; }
    ${members}
  }`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'pointer');

describe('kernel fixed function-pointer return layout', () => {
  it('admits a singleton result whose self target is fixed in the function body', () => {
    expect(handler(`
      function pointer() public view returns (function(uint) external returns (uint)) {
        return this.first;
      }
    `)).toMatchObject({
      eligible: true,
      outputs: [{ type: 'int256' }],
      resultEncoding: 'evm-abi-v1',
    });
  });

  it('admits the equivalent named-return spelling', () => {
    expect(handler(`
      function pointer() public view returns (function(uint) external returns (uint) selected) {
        selected = this.first;
      }
    `)).toMatchObject({ eligible: true });
  });

  it('admits multiple terminating returns only when every path selects the same self target', () => {
    expect(handler(`
      function pointer(bool choose) public view returns (function(uint) external returns (uint)) {
        if (choose) return this.first;
        return this.first;
      }
    `)).toMatchObject({ eligible: true, outputs: [{ type: 'int256' }] });
  });

  it.each([
    ['a ternary', 'return choose ? this.first : this.second;'],
    ['distinct terminating returns', 'if (choose) return this.second; return this.first;'],
  ])('admits a finite direct-self target set selected by %s', (_shape, body) => {
    expect(handler(`
      function pointer(bool choose) public view returns (function(uint) external returns (uint)) {
        ${body}
      }
    `)).toMatchObject({ eligible: true, outputs: [{ type: 'int256' }] });
  });

  it('admits a proven self pointer as one component of a multi-return', () => {
    expect(handler(`
      function pointer() public view returns (function(uint) external returns (uint), uint) {
        return (this.first, 7);
      }
    `)).toMatchObject({
      eligible: true,
      outputs: [{ type: 'int256' }, { type: 'uint256' }],
      resultEncoding: 'evm-abi-v1',
    });
  });

  it('proves the pointer slot across every terminating multi-return', () => {
    expect(handler(`
      function pointer(bool choose) public view returns (function(uint) external returns (uint), uint) {
        if (choose) return (this.first, 7);
        return (this.first, 9);
      }
    `)).toMatchObject({ eligible: true, outputs: [{ type: 'int256' }, { type: 'uint256' }] });
  });

  it('admits independent scalar values across a finite multi-return pointer set', () => {
    expect(handler(`
      function pointer(bool choose) public view returns (function(uint) external returns (uint), uint) {
        if (choose) return (this.second, 7);
        return (this.first, 9);
      }
    `)).toMatchObject({ eligible: true, outputs: [{ type: 'int256' }, { type: 'uint256' }] });
  });

  it.each([
    ['caller-supplied target', `
      function pointer(function(uint) external returns (uint) selected) public pure
        returns (function(uint) external returns (uint)) {
        return selected;
      }
    `],
  ])('keeps %s as callable/control metadata rather than scalar result data', (_name, members) => {
    expect(handler(members)).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it.each([
    ['foreign', 'Foreign(remote).target'],
  ])('does not let a final fixed tuple hide an earlier %s pointer', (_kind, early) => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface Foreign { function target(uint value) external returns (uint); }
      contract C {
        function first(uint value) external pure returns (uint) { return value + 1; }
        function second(uint value) external pure returns (uint) { return value + 2; }
        function pointer(bool choose, address remote) public view
          returns (function(uint) external returns (uint), uint) {
          if (choose) return (${early}, 3);
          return (this.first, 7);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pointer'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it.each([
    ['caller-supplied', `
      function pointer(function(uint) external returns (uint) selected) public pure
        returns (function(uint) external returns (uint), uint) {
        return (selected, 7);
      }
    `],
    ['runtime-ambiguous', `
      function pointer(bool choose, function(uint) external returns (uint) selected) public view
        returns (function(uint) external returns (uint), uint) {
        return (choose ? this.first : selected, 7);
      }
    `],
  ])('refuses a %s pointer component in a multi-return', (_kind, members) => {
    expect(handler(members)).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('does not let a final self return hide an earlier foreign return', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface Foreign {
        function target(uint value) external returns (uint);
      }
      contract C {
        function first(uint value) external pure returns (uint) { return value + 1; }
        function pointer(bool choose, address remote) public view
          returns (function(uint) external returns (uint)) {
          if (choose) return Foreign(remote).target;
          return this.first;
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pointer'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
