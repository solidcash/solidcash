import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../../src/Contract.js';
import { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { deployProxied, enterProxied, newWorld, type ProxiedDeployment } from '../ahead/composition-world.js';

const SOURCE = `pragma solidity ^0.8.20;
  interface ISink { function take(uint256 value) external returns (bool); }
  contract Sink {
    uint256 public received;
    function initialize() public { received = 0; }
    function take(uint256 value) public returns (bool) { received += value; return true; }
  }
  contract Ledger {
    uint256 public amount;
    address public sink;
    uint256 public unlockAt;
    function initialize(address target) public { amount = 100; sink = target; unlockAt = block.timestamp + 86400; }
    function update(uint256 next) public {
      if (amount != next) {
        if (next > amount) {
          require(ISink(sink).take(next - amount));
        } else {
          uint256 difference = amount - next;
          if (block.timestamp >= unlockAt) { require(ISink(sink).take(difference)); }
        }
        amount = next;
      }
    }
  }
`;

describe('a guarded unsigned difference through a proxy', () => {
  it('skips a negative untaken call argument when another guard needs the runtime clock', async () => {
    const artifacts = compileStringMulti(SOURCE, {
      evmCompat: true, composition: 'framed', tagSingletonDataNfts: true,
    });
    const world = await newWorld(0x7f);
    const sink = await deployProxied(world, artifacts.Sink!, []);
    const ledger = await deployProxied(world, artifacts.Ledger!, [sink.address]);
    const stateOf = async (deployment: ProxiedDeployment): Promise<Record<string, unknown>> => {
      const inner = new Contract(deployment.artifact, [], {
        provider: world.network, category: hexToBin(deployment.proxyCategoryId),
      });
      return StatefulContract.withCategory(inner, deployment.proxyCategoryId).getState();
    };
    for (const [next, expectedReceived, expectedCalls] of [[200n, 100n, 1], [200n, 100n, 0], [150n, 100n, 0]] as const) {
      const result = await enterProxied(world, ledger, 'update', [next], { ISink: sink.external });
      expect(result.error).toBeUndefined();
      expect(result.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
      expect(result.result!.broadcast).toBeDefined();
      expect(result.result!.completed.filter((frame) => frame.contract === 'Sink')).toHaveLength(expectedCalls);
      expect((await stateOf(ledger)).amount).toBe(next);
      expect((await stateOf(sink)).received).toBe(expectedReceived);
    }
    await world.network.send('evm_increaseTime', [86400]);
    const refunded = await enterProxied(world, ledger, 'update', [100n], { ISink: sink.external });
    expect(refunded.error).toBeUndefined();
    expect(refunded.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(refunded.result!.broadcast).toBeDefined();
    expect(refunded.result!.completed.filter((frame) => frame.contract === 'Sink')).toHaveLength(1);
    expect((await stateOf(ledger)).amount).toBe(100n);
    expect((await stateOf(sink)).received).toBe(150n);
  }, 300_000);
});
