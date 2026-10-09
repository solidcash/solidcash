import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { fundedSigner } from '../test-util.js';

// MasterChefV2 updates a user's `amount` and `rewardDebt` as two field writes to one mapping entry, with SafeMath
// calls in the values. Coalescing reads the entry once and writes the whole struct once; it refused any call in a
// value, so the second write read the entry after the first and the direct convention refused the body
// (DirectStaleReadError). A call to a pure library or free function reads no state and may move with the rebuild.
const LIBRARIES = `library BoringMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= b, "add"); return c; }
  function sub(uint256 a, uint256 b) internal pure returns (uint256) { require(b <= a, "sub"); return a - b; }
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a * b;
    require(a == 0 || c / a == b, "mul");
    return c;
  }
}
library SignedSafeMath {
  function add(int256 a, int256 b) internal pure returns (int256) {
    int256 c = a + b;
    require((b >= 0 && c >= a) || (b < 0 && c < a), "add");
    return c;
  }
  function sub(int256 a, int256 b) internal pure returns (int256) {
    int256 c = a - b;
    require((b >= 0 && c <= a) || (b < 0 && c > a), "sub");
    return c;
  }
}
library Rates {
  // Labelled view: it may read state, so it must not move with the rebuild.
  function scale(uint256 a) internal view returns (uint256) { return a * 3; }
}
function times(uint256 a, uint256 b) pure returns (uint256) { return a * b; }`;

const chef = (scaled: string, extra = ''): string => `pragma solidity 0.6.12;
${LIBRARIES}
contract Chef {
  using BoringMath for uint256;
  using SignedSafeMath for int256;
  struct UserInfo { uint256 amount; int256 rewardDebt; }
  uint256 private constant ACC_SUSHI_PRECISION = 1e12;
  uint256 public accSushiPerShare;
  mapping(uint256 => mapping(address => UserInfo)) public userInfo;
  ${extra}
  function setAcc(uint256 acc) public { accSushiPerShare = acc; }
  function deposit(uint256 pid, uint256 amount, address to) public {
    UserInfo storage user = userInfo[pid][to];
    user.amount = user.amount.add(amount);
    user.rewardDebt = user.rewardDebt.add(int256(${scaled} / ACC_SUSHI_PRECISION));
  }
  function withdraw(uint256 pid, uint256 amount, address to) public {
    UserInfo storage user = userInfo[pid][to];
    user.rewardDebt = user.rewardDebt.sub(int256(${scaled} / ACC_SUSHI_PRECISION));
    user.amount = user.amount.sub(amount);
  }
}`;

const options = { solidityImportCompat: true, forceStateful: true };

describe('field writes to one entry with pure library or free function calls in their values', () => {
  it('settle the MasterChefV2 amount and rewardDebt updates with the EVM values', async () => {
    const signer = await fundedSigner(8);
    const sc: any = await getContractFactory(
      compileString(chef('amount.mul(accSushiPerShare)'), options), signer,
    ).deploy();
    const to = addressToLockScript(signer.getAddress());

    await sc.setAcc(3_000_000_000_000n);
    await sc.deposit(0n, 100n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 100n, rewardDebt: 300n });

    await sc.setAcc(5_000_000_000_000n);
    await sc.deposit(0n, 50n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 150n, rewardDebt: 550n });

    // Written in the other field order: rewardDebt first, then amount.
    await sc.withdraw(0n, 30n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 120n, rewardDebt: 400n });

    await sc.setAcc(10_000_000_000_000n);
    await sc.withdraw(0n, 100n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 20n, rewardDebt: -600n });
  });

  it('settles a pure free function in the same position', async () => {
    const signer = await fundedSigner(8);
    const sc: any = await getContractFactory(
      compileString(chef('times(amount, accSushiPerShare)'), options), signer,
    ).deploy();
    const to = addressToLockScript(signer.getAddress());

    await sc.setAcc(2_000_000_000_000n);
    await sc.deposit(0n, 40n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 40n, rewardDebt: 80n });
    await sc.withdraw(0n, 15n, to);
    expect(await sc.state.userInfo(0n, to)).toMatchObject({ amount: 25n, rewardDebt: 50n });
  });

  it('still refuses when the call in that position may read state', () => {
    const refusal = /a read of `userInfo\[pid\]\[to\]` after its write when the body writes it again/;
    // A view library function, and a view contract function.
    expect(() => compileString(chef('Rates.scale(amount)'), options)).toThrow(refusal);
    expect(() => compileString(chef('scaled(amount)',
      'function scaled(uint256 a) internal view returns (uint256) { return a * accSushiPerShare; }'), options))
      .toThrow(refusal);
  });
});
