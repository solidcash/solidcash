import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

// A helper that calls one indexed element of a storage struct array, inlined where an entry passes its own
// parameter as the index (MasterChef `deposit` -> `updatePool(_pid)` -> `poolInfo[_pid].lpToken.balanceOf`). The
// inliner binds the parameter to `__inl<N>__pid` and the conditionally written array is read through its cache, so
// the target was never hoisted and was taken for a call on every element of the array. It is one call on one callee.
const TOKEN = `pragma solidity ^0.8.0;
contract Token {
    uint256 public total;
    uint256 public reads;
    function balanceOf(address owner) external returns (uint256) {
        require(owner != address(0));
        reads = reads + 1;
        return total;
    }
}`;

const SINK = `pragma solidity ^0.8.0;
contract Sink {
    uint256 public bumps;
    function bump(uint256 v) external returns (uint256) {
        bumps = bumps + v;
        return v;
    }
}`;

const POOLS = `pragma solidity ^0.8.0;
interface ISink {
    function bump(uint256 v) external returns (uint256);
}
interface IToken {
    function balanceOf(address owner) external returns (uint256);
}
contract Pools {
    struct Pool {
        IToken token;
        uint256 weight;
    }
    Pool[] public pools;
    ISink public sink;
    uint256 public seen;
    uint256 public refreshes;
    function add(IToken token) public {
        pools.push(Pool(token, 1));
    }
    // Skipped once the contract has refreshed \`limit\` times, like MasterChef's updatePool returning early.
    function refresh(uint256 _pid, uint256 limit) public {
        Pool storage pool = pools[_pid];
        if (refreshes >= limit) {
            return;
        }
        seen = pool.token.balanceOf(address(this));
        refreshes = refreshes + sink.bump(1);
    }
    function poke(uint256 _pid, uint256 limit) public {
        refresh(_pid, limit);
    }
    function pokeAll(uint256 limit) public {
        uint256 length = pools.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            refresh(pid, limit);
        }
    }
}`;

const options = { solidityImportCompat: true, forceStateful: true } as const;

describe('a call on one indexed element of a storage array', () => {
  it('is one call on that element\'s callee, refused with another element\'s, and needs none when skipped', async () => {
    const provider = createTestProvider();
    const deploy = async (source: string, state: Record<string, unknown>): Promise<any> => {
      const artifact = compileString(source, options);
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, artifact.stateLayout!, state, { saltContract: true },
      );
      return {
        artifact,
        sc: StatefulContract.withCategory(contract, categoryId),
        addr: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
      };
    };
    const first = await deploy(TOKEN, { total: 7n, reads: 0n });
    const second = await deploy(TOKEN, { total: 11n, reads: 0n });
    const sink = await deploy(SINK, { bumps: 0n });
    const pools = await deploy(POOLS, { pools: [], sink: sink.addr, seen: 0n, refreshes: 0n });

    // The entry's call is a single call; the loop over every pool keeps the call on every element.
    const calls = (name: string): any[] => pools.artifact.abi.find((entry: any) => entry.name === name).externalCalls;
    expect(calls('poke')[0].loopArrayVar).toBeUndefined();
    expect(calls('poke')[0].addressParam).toBeDefined();
    expect(calls('pokeAll')[0].loopArrayVar).toBe('pools');

    await pools.sc.add(first.addr).send();
    await pools.sc.add(second.addr).send();

    // Pool 1 settles with its own token and no other.
    await pools.sc.poke(1n, 5n).withExternalCall(second.sc).withExternalCall(sink.sc).send();
    expect((await second.sc.getState()).reads).toBe(1n);
    expect((await first.sc.getState()).reads).toBe(0n);
    expect((await sink.sc.getState()).bumps).toBe(1n);

    // Pool 0's call co-spending pool 1's token is refused by the caller's covenant.
    await expect(pools.sc.poke(0n, 5n).withExternalCall(second.sc).withExternalCall(sink.sc).send())
      .rejects.toThrow(/input 0/);
    expect((await second.sc.getState()).reads).toBe(1n);

    // Skipped (one refresh made and the limit is 1): no callee is co-spent.
    await pools.sc.poke(1n, 1n).send();
    expect((await second.sc.getState()).reads).toBe(1n);
    expect((await first.sc.getState()).reads).toBe(0n);
    expect((await sink.sc.getState()).bumps).toBe(1n);
  });
});
