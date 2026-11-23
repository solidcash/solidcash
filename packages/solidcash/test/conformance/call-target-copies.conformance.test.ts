/**
 * A call through a local copy of a stored target, against the EVM. A copy holds the value it was given where it is
 * declared: `Escrow memory e = escrow;` copies the struct, `address t = token;` the address, and a later write of the
 * stored value leaves the copy as it was. SafeERC20-style helpers take the target as a parameter, which the inliner
 * binds to the copy's field, and the address-local pass followed that binding back to the stored value: it read the
 * receiver from storage instead of the copy. After a write of the stored value between the copy and the call, the
 * covenant bound the call to the written value, while the EVM's call goes to the copy's.
 *
 * A helper's parameter is such a copy too: the inliner binds it to the argument where the helper is called, and a
 * write of the stored value inside the helper leaves it as it was.
 *
 * One source runs on both sides. The EVM deploys two tokens and the vault, points the vault at the first and calls an
 * entry naming the second; its tokens report which one moved. The BCH spend of the same entry must accept the EVM's
 * callee, and the vault, input 0, must refuse the other.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { deployEvmSystem } from './evm.js';

const SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
library SafeTransfer {
  function safeTransfer(address token, address to, uint256 value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
  }
}
interface IToken { function transfer(address to, uint256 amount) external returns (bool); }
contract Token {
  uint256 public moved;
  function transfer(address, uint256 amount) external returns (bool) { moved += amount; return true; }
}
contract Vault {
  struct Escrow { address currency; uint256 amount; }
  struct Line { IToken token; uint256 amount; }
  Escrow escrow;
  Line line;
  address token;
  IToken itoken;
  function setUp(address c) external { escrow = Escrow(c, 5); line = Line(IToken(c), 1); token = c; itoken = IToken(c); }
  function payFromCopy(address x) external {
    Escrow memory e = escrow;
    escrow.currency = x;
    SafeTransfer.safeTransfer(e.currency, address(this), e.amount);
  }
  function payFromAddressCopy(address x) external {
    address t = token;
    token = x;
    SafeTransfer.safeTransfer(t, address(this), 5);
  }
  function payFromChangedCopy(address x) external {
    Line memory l = line;
    l.amount = 5;
    line.token = IToken(x);
    l.token.transfer(address(this), l.amount);
  }
  function payFromInterfaceCopy(address x) external {
    IToken t = itoken;
    itoken = IToken(x);
    t.transfer(address(this), 5);
  }
  function payFromRetargetedCopy(address x) external {
    Escrow memory e = escrow;
    e.currency = x;
    SafeTransfer.safeTransfer(e.currency, address(this), e.amount);
  }
  function payFromHelperArgument(address x) external { retokenThenPay(token, x); }
  function retokenThenPay(address t, address x) internal {
    token = x;
    SafeTransfer.safeTransfer(t, address(this), 5);
  }
  function payFromHelperCopy(address x) external { rerouteThenPay(escrow, x); }
  function rerouteThenPay(Escrow memory e, address x) internal {
    escrow.currency = x;
    SafeTransfer.safeTransfer(e.currency, address(this), e.amount);
  }
}`;

/** Each entry, with the token its call goes to on the EVM: the copy's, the stored one before the write. */
const ENTRIES = [
  ['a memory copy of a stored struct', 'payFromCopy', 'first'],
  ['a copy of a stored address', 'payFromAddressCopy', 'first'],
  ['a memory copy of a stored struct the function changes', 'payFromChangedCopy', 'first'],
  ['a copy of a stored interface', 'payFromInterfaceCopy', 'first'],
  ['a memory copy whose target field the function rewrites', 'payFromRetargetedCopy', 'second'],
  ['a helper\'s address parameter', 'payFromHelperArgument', 'first'],
  ['a helper\'s memory struct parameter', 'payFromHelperCopy', 'first'],
] as const;

/** The token the EVM's call goes to: the vault set up with `first`, then `entry(second)`. */
async function evmCallee(entry: string): Promise<'first' | 'second'> {
  const evm = await deployEvmSystem(SOURCE, { first: 'Token', second: 'Token', vault: 'Vault' });
  await evm.call('vault', 'setUp', [evm.address('first')]);
  await evm.call('vault', entry, [evm.address('second')]);
  const [first] = await evm.call('first', 'moved');
  const [second] = await evm.call('second', 'moved');
  expect([first, second].filter((moved) => moved === 5n)).toHaveLength(1);
  return first === 5n ? 'first' : 'second';
}

type Deployed = { contract: any; address: Uint8Array };

async function deploy(provider: ReturnType<typeof createTestProvider>, artifact: Artifact): Promise<Deployed> {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  return { contract, address };
}

describe('a call through a local copy of a stored target, against the EVM (evmCompat)', () => {
  const artifacts = compileStringMulti(SOURCE, { evmCompat: true, forceStateful: true });

  /** Two tokens and a vault set up with the first. */
  async function setUp(): Promise<{ tokens: Record<'first' | 'second', Deployed>; vault: Deployed }> {
    const provider = createTestProvider();
    const first = await deploy(provider, artifacts.Token!);
    const second = await deploy(provider, artifacts.Token!);
    const vault = await deploy(provider, artifacts.Vault!);
    await vault.contract.setUp(first.address).send();
    return { tokens: { first, second }, vault };
  }

  it.each(ENTRIES)('calls the token %s holds, as the EVM does', async (_copy, entry, expected) => {
    const callee = await evmCallee(entry);
    expect(callee).toBe(expected);
    const other = callee === 'first' ? 'second' : 'first';

    const accepted = await setUp();
    await accepted.vault.contract[entry](accepted.tokens.second.address)
      .withExternalCall(accepted.tokens[callee].contract, 'transfer', [accepted.vault.address, 5n]).send();
    expect((await accepted.tokens[callee].contract.getState()).moved).toBe(5n);
    expect((await accepted.tokens[other].contract.getState()).moved).toBe(0n);

    const refused = await setUp();
    await expect(refused.vault.contract[entry](refused.tokens.second.address)
      .withExternalCall(refused.tokens[other].contract, 'transfer', [refused.vault.address, 5n]).send())
      .rejects.toThrow(/input 0\b/);
    expect((await refused.tokens[other].contract.getState()).moved).toBe(0n);
  }, 300_000);
});
