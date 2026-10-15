import { describe, expect, it } from 'vitest';
import { compileStringSplit } from '../src/compiler.js';

// A message-bus route over a dynamically-written state array that also makes an array-element external call:
// massUpdatePools loops over poolInfo, the inlined updatePool calls poolInfo[i].lpToken.balanceOf(...) and then
// writes poolInfo[i].accSushiPerShare. Route synthesis marks the poolInfo read-modify-write value for the
// array-external-call co-spend cleanup (coSpendPreservedDynValues); splitting previously dropped that value in
// the delegate single-write cleanup and then threw "Expected variable '__internal__dynwrite_value_poolInfo'
// does not exist on the stack" in emitExternalCallVerification. Regression pin.
const SOURCE = `
pragma solidity 0.6.12;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract MiniChef {
    struct PoolInfo {
        IERC20 lpToken;
        uint256 accSushiPerShare;
        uint256 lastRewardBlock;
    }
    PoolInfo[] public poolInfo;

    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        uint256 supply = pool.lpToken.balanceOf(address(this));
        pool.accSushiPerShare = pool.accSushiPerShare + supply;
        pool.lastRewardBlock = block.number;
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }
}
`;

describe('dynamic-write array split with array-element external call', () => {
  it('splits a message-bus route over a written array without dropping the co-spend RMW value', () => {
    const bundle = compileStringSplit(SOURCE, {
      evmCompat: true,
      messageBus: true,
      maxShardBytes: 4000,
      maximumInputBytes: 4000,
    });
    expect(bundle.manifest.facets.length).toBeGreaterThan(0);
  });
});
