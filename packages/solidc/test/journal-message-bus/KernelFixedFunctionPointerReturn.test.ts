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
    ['runtime target', `
      function pointer(bool choose) public view returns (function(uint) external returns (uint)) {
        return choose ? this.first : this.second;
      }
    `],
    ['early runtime target', `
      function pointer(bool choose) public view returns (function(uint) external returns (uint)) {
        if (choose) return this.second;
        return this.first;
      }
    `],
    ['caller-supplied target', `
      function pointer(function(uint) external returns (uint) selected) public pure
        returns (function(uint) external returns (uint)) {
        return selected;
      }
    `],
    ['fixed pointer mixed into a multi-return', `
      function pointer() public view returns (function(uint) external returns (uint), uint) {
        return (this.first, 7);
      }
    `],
  ])('keeps %s as callable/control metadata rather than scalar result data', (_name, members) => {
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
