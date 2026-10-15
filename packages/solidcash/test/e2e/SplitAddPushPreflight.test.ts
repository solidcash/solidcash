import { describe, it, expect } from 'vitest';
import { compileStringSplit } from 'solidc';
import { Signer } from '../../src/index.js';
import { SplitContractBundle } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// Minimal split-delegate dynamic-array push that reaches the original preflight OP_VERIFY: the split root
// forwarder's emitOwnCategoryMutableNftConservation check counts the pushed poolInfo chunk as an excess
// mutable output (dynamic-array chunk collections are never censused; censusedCollectionSignatures only covers
// sorted-batch mappings), so the balance is -1 and OP_NUMEQUALVERIFY fails. The massUpdatePools loop is
// incidental (a split push without it fails the same check). Documents the defect while it is still open;
// flip the assertion to `resolves` when the censusing gap is fixed.
const SRC = `pragma solidity 0.6.12;
interface ICallee { function balanceOf(address) external view returns (uint256); }
contract Chef {
    struct PoolInfo { ICallee lpToken; uint256 allocPoint; uint256 lastRewardBlock; uint256 accSushiPerShare; }
    PoolInfo[] public poolInfo;
    uint256 public totalAllocPoint;
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; pid = pid + 1) { updatePool(pid); }
    }
    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        uint256 bal = pool.lpToken.balanceOf(address(this));
        pool.accSushiPerShare = pool.accSushiPerShare + bal;
    }
    function add(uint256 ap) public {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint + ap;
        poolInfo.push(PoolInfo({ lpToken: ICallee(address(0)), allocPoint: ap, lastRewardBlock: 0, accSushiPerShare: 0 }));
    }
}`;

describe('split add push preflight (documents defect)', () => {
  it('fails the poolInfo.push commitment-family scan with the input-0 OP_VERIFY', async () => {
    const compiled = compileStringSplit(SRC, { forceSplit: true, messageBus: true, evmCompat: true });
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea', 'eb', 'ec']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const deployed = await SplitContractBundle.from(compiled, signer).deploy([], {
      fundingUtxo: funding[0],
      facetOverrides: Object.fromEntries(compiled.manifest.facets.map((f, i) => [
        f.name, { fundingUtxo: funding[i + 1] },
      ])),
    });
    await expect(deployed.call.add(100n).send()).rejects.toThrow(
      /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  }, 300_000);
});
