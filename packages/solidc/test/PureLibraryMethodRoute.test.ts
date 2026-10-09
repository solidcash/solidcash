import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

describe('pure library calls in kernel route planning', () => {
  it('keeps a two-key transfer route when mapping arithmetic uses a pure library', () => {
    const source = `pragma solidity ^0.8.20;
      library Math {
        function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; }
        function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; }
      }
      contract Ledger {
        using Math for uint256;
        mapping(address => uint256) public balances;

        function transfer(address to, uint256 amount) public {
          this.balances[msg.sender] = this.balances[msg.sender].sub(amount);
          this.balances[to] = this.balances[to].add(amount);
        }

        function mint(address to, uint256 amount) public {
          this.balances[to] = this.balances[to].add(amount);
        }
      }`;
    const artifact = compileString(source, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 100_000,
      suppressWarnings: true,
    });

    for (const name of ['transfer', 'mint']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
      expect(artifact.abi.find((fn) => fn.name === name)?.externalCalls).toBeUndefined();
    }

    const caller = compileString(`pragma solidity ^0.8.20;
      library Math {
        function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; }
      }
      interface IVault { function deposit(uint256 amount) external; }
      contract Caller {
        using Math for uint256;
        uint256 public counter;
        function forward(address target, uint256 n) public {
          uint256 next = this.counter.add(n);
          IVault(target).deposit(next);
        }
      }`, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 100_000,
      suppressWarnings: true,
    });
    expect(caller.abi.find((fn) => fn.name === 'forward')?.externalCalls)
      .toMatchObject([{ interfaceName: 'IVault', functionName: 'deposit' }]);
  });
});
