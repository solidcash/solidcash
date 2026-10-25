import { describe, expect, it } from 'vitest';
import { compileString } from '../dist/compiler.js';

const compile = (): ReturnType<typeof compileString> => compileString(
  `pragma solidity ^0.8.0;
    interface IFactory { function feeToAndMigrator() external view returns (address, address); }
    contract Probe() {
      mapping(address => uint256) balances;
      address factory;
      uint256 totalSupply;
      uint256 kLast;
      function mint(address to, uint256 value) public {
        address feeTo = address(0);
        uint toBalance = balances[to];
        uint zeroBalance = balances[address(0)];
        (feeTo,) = IFactory(factory).feeToAndMigrator();
        _mintFee(feeTo);
        if (totalSupply == 0) {
          totalSupply = totalSupply + 1000;
          balances[address(0)] = zeroBalance + 1000;
        }
        totalSupply = totalSupply + value;
        balances[to] = toBalance + value;
      }
      function _mintFee(address feeTo) private {
        bool feeOn = feeTo != address(0);
        uint _kLast = kLast;
        if (feeOn) {
          if (_kLast != 0) {
            uint rootK = 10;
            uint rootKLast = 5;
            if (rootK > rootKLast) {
              uint numerator = totalSupply * (rootK - rootKLast);
              uint denominator = rootK * 5 + rootKLast;
              uint liquidity = numerator / denominator;
              if (liquidity > 0) {
                totalSupply = totalSupply + liquidity;
                balances[feeTo] = balances[feeTo] + liquidity;
              }
            }
          }
        }
      }
    }`, {
    forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
    evmCompat: true, suppressWarnings: true,
  });

describe('merged fixed entry key alternatives', () => {
  it('keeps the merged literal slot and publishes the producer key as a runtime alternative', () => {
    const handler = compile().abi.find((entry) => entry.name === 'mint')!;
    const merged = handler.entryAccesses!.find(
      (access) => access.keyParams?.includes('cast:address(lit:0)'),
    )!;
    expect(merged.mutationEffectOrdinals!.length).toBeGreaterThan(1);
    expect(merged.alternatives).toEqual([{ key: 'producer:0:0' }]);
    expect(merged.keyParams).not.toContain('producer:0:0');
  });
});
