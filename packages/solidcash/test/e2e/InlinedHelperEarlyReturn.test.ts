import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { fundedSigner } from '../test-util.js';

// A public function that writes state is inlined where another function calls it. A `return;` in it leaves that
// function only. Spliced verbatim, the return left the caller instead: `poke` skipped its own write whenever
// `accrue` returned early (KashiPair's withdrawFees after accrue()'s `if (elapsedTime == 0) return;`), and the
// transaction was still accepted.
const SOURCE = `contract InlinedEarlyReturn {
  bool public paused;
  int public accrued;
  int public pokes;
  function setPaused(bool p) public { paused = p; }
  function accrue() public {
    if (paused) {
      return;
    }
    accrued = accrued + 1;
  }
  function accrueBy(int n) public {
    if (n == 0) {
      return;
    }
    if (n == 1) {
      accrued = accrued + 10;
      return;
    }
    accrued = accrued + 100;
  }
  function poke() public {
    accrue();
    pokes = pokes + 1;
  }
  function pokeBy(int n) public {
    accrueBy(n);
    pokes = pokes + 1;
  }
}`;

// MasterChef's shape: `deposit` calls `updatePool`, which returns early while the pool is up to date. The old
// splice ended `deposit` there, and on a pool kept in an array chunk its transaction failed outright.
const CHEF = `pragma solidity ^0.8.0;
contract Chef {
  struct PoolInfo { uint256 alloc; uint256 last; uint256 acc; }
  struct UserInfo { uint256 amount; uint256 debt; }
  PoolInfo[] public poolInfo;
  mapping(uint256 => mapping(address => UserInfo)) public userInfo;
  function add(uint256 alloc, uint256 last) public { poolInfo.push(PoolInfo({alloc: alloc, last: last, acc: 0})); }
  function updatePool(uint256 pid, uint256 now_) public {
    PoolInfo storage pool = poolInfo[pid];
    if (now_ <= pool.last) {
      return;
    }
    pool.acc = pool.acc + 1;
    pool.last = now_;
  }
  function deposit(uint256 pid, uint256 now_, uint256 amount) public {
    updatePool(pid, now_);
    PoolInfo storage pool = poolInfo[pid];
    UserInfo storage user = userInfo[pid][msg.sender];
    user.amount = user.amount + amount;
    user.debt = user.amount * pool.acc;
  }
}`;

describe('an inlined helper returning early', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('leaves the helper and runs the rest of its caller', async () => {
    const sc: any = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.setPaused(true);
    await sc.poke();
    expect((await sc.getState()).pokes).toBe(1n);
    expect((await sc.getState()).accrued).toBe(0n);

    await sc.setPaused(false);
    await sc.poke();
    expect((await sc.getState()).pokes).toBe(2n);
    expect((await sc.getState()).accrued).toBe(1n);
  });

  it('skips the helper statements after a return taken in either branch', async () => {
    const sc: any = await getContractFactory(artifact, await fundedSigner()).deploy();
    await sc.pokeBy(0n);
    expect((await sc.getState()).pokes).toBe(1n);
    expect((await sc.getState()).accrued).toBe(0n);

    await sc.pokeBy(1n);
    expect((await sc.getState()).pokes).toBe(2n);
    expect((await sc.getState()).accrued).toBe(10n);

    await sc.pokeBy(2n);
    expect((await sc.getState()).pokes).toBe(3n);
    expect((await sc.getState()).accrued).toBe(110n);
  });

  it('keeps depositing when updatePool returns early on a chunked pool', async () => {
    const signer = await fundedSigner();
    const chef: any = await getContractFactory(
      compileString(CHEF, { solidityImportCompat: true, forceStateful: true }), signer,
    ).deploy();
    const me = addressToLockScript(signer.getAddress());
    await chef.add(100n, 10n);

    await chef.deposit(0n, 5n, 100n);
    expect(await chef.state.poolInfo(0n)).toMatchObject({ alloc: 100n, last: 10n, acc: 0n });
    expect(await chef.state.userInfo(0n, me)).toMatchObject({ amount: 100n, debt: 0n });

    await chef.deposit(0n, 20n, 50n);
    expect(await chef.state.poolInfo(0n)).toMatchObject({ alloc: 100n, last: 20n, acc: 1n });
    expect(await chef.state.userInfo(0n, me)).toMatchObject({ amount: 150n, debt: 150n });
  });
});
