import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

describe('conditional transfer reached through an internal helper', () => {
  it('preallocates the helper transfer outside the branch cleanup scope', () => {
    const artifact = compileString(`
      contract C {
        function pay(address payable to, int amount) internal {
          to.transfer(amount);
        }
        function maybePay(bool enabled, address payable to, int amount) public {
          if (enabled) { pay(to, amount); }
          require(true);
        }
      }
    `, { solidityImportCompat: true });

    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.find((entry) => entry.name === 'maybePay')?.name).toBe('maybePay');
  });

  it('finds the helper call when it is nested in an arm expression', () => {
    const artifact = compileString(`
      contract C {
        function pay(address payable to, int amount) internal returns (bool) {
          to.transfer(amount);
          return true;
        }
        function maybePay(bool enabled, address payable to, int amount) public {
          if (enabled) { require(pay(to, amount)); }
          require(true);
        }
      }
    `, { solidityImportCompat: true });

    expect(artifact.contractName).toBe('C');
  });
});
