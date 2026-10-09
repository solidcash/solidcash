import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const options = { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, suppressWarnings: true,
  maximumInputBytes: 1_000_000 } as const;

describe('callsite value metadata', () => {
  it.each([['amount', true], ['0', false]] as const)('publishes raw value %s explicitly', (value, expected) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function store(uint value) external returns (bool); }
      contract Payer {
        function pay(address target, uint amount) public {
          (bool success, bytes memory data) = target.call{value: ${value}}(abi.encodeCall(ISink.store, (amount)));
          require(success && data.length > 0);
        }
      }`, options);
    expect(artifact.abi.find((fn) => fn.name === 'pay')!.externalCalls)
      .toMatchObject([{ callValueEffect: expected }]);
  });

  it('distinguishes helper calls with value and literal zero', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function store(uint value) external returns (bool); }
      library Raw {
        function invoke(address target, uint amount, uint value) internal {
          (bool success, bytes memory data) = target.call{value: amount}(abi.encodeCall(ISink.store, (value)));
          require(success && data.length > 0);
        }
      }
      contract Payer {
        function pay(address target, uint amount) public {
          Raw.invoke(target, amount, 1);
          Raw.invoke(target, 0, 2);
        }
      }`, options);
    const calls = artifact.abi.find((fn) => fn.name === 'pay')!.externalCalls!;
    expect(calls.map((call) => call.callValueEffect)).toEqual([true, false]);
  });

  it('publishes explicit value-free markers on grouped logical rows', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function store(uint value) external; }
      contract Router {
        function run(address target) public { ISink(target).store(1); ISink(target).store(2); }
      }`, options);
    const calls = artifact.abi.find((fn) => fn.name === 'run')!.externalCalls!;
    expect(calls).toHaveLength(1);
    expect(calls[0].batchInvocations?.map((row) => row.callValueEffect)).toEqual([false, false]);
  });
});
