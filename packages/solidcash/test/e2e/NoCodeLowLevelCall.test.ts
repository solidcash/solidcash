import { binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { getContractFactory } from '../../src/stateful/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

// solc's low-level call to an account without code succeeds with empty return data and runs nothing, so a call to a
// target that is no P2SH lock co-spends no callee: it returns `(true, "")`. A P2SH target is refused rather than
// skipped, a value call pays its target, and a high-level call to an account without code still reverts.
const OPTIONS = { evmCompat: true, forceStateful: true, enforceFinalRequire: false } as const;

const CALLER = `pragma solidity ^0.8.0;
contract Caller {
  uint256 public calls;
  function plain(address to) public {
    (bool ok, bytes memory data) = to.call("");
    require(ok && data.length == 0);
    calls = calls + 1;
  }
  function literal() public {
    (bool ok, ) = address(0xffff).call("");
    require(ok);
    calls = calls + 1;
  }
  function pay(address payable to, uint256 amount) public {
    (bool ok, bytes memory data) = to.call{value: amount}("");
    require(ok && data.length == 0);
    calls = calls + 1;
  }
}`;

const TYPED = `pragma solidity ^0.8.0;
interface ITarget { function ping() external; }
contract TypedCaller {
  uint256 public calls;
  function typed(address to) public {
    ITarget(to).ping();
    calls = calls + 1;
  }
}`;

function lockOf(address: string): string {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
}

async function setup(artifact: Artifact, initialBalance?: bigint): Promise<{ contract: any; payee: any }> {
  const provider = createTestProvider();
  const [owner, payee] = await getSigners(2, { provider, fundingUtxos: 8 });
  const factory = getContractFactory(artifact, owner);
  const contract = initialBalance === undefined ? await factory.deploy() : await factory.deploy({ initialBalance });
  return { contract, payee };
}

describe('low-level call to an address without code', () => {
  const caller = compileString(CALLER, OPTIONS);
  const typed = compileString(TYPED, OPTIONS);

  it('publishes no callee for a value-less empty call', () => {
    for (const name of ['plain', 'literal']) {
      const fn = caller.abi.find((entry) => entry.name === name)!;
      expect(fn.externalCalls ?? []).toEqual([]);
      expect(fn.inputs.some((input) => input.name.startsWith('__internal__externalReturnOutputIdx'))).toBe(false);
    }
  });

  it('returns (true, empty) for a P2PKH target and for a constant one', async () => {
    const { contract, payee } = await setup(caller);
    await contract.plain(payee.getAddress()).send();
    await contract.literal().send();
    expect((await contract.getState()).calls).toBe(2n);
  });

  it('refuses a P2SH target instead of skipping its callee', async () => {
    const { contract } = await setup(caller);
    await expect(contract.plain(contract.address).send()).rejects.toThrow(/Program failed an OP_VERIFY operation/);
    expect((await contract.getState()).calls).toBe(0n);
  });

  it('pays a P2PKH target from a value call, which returns (true, empty)', async () => {
    const { contract, payee } = await setup(caller, 30_000n);
    const tx = await contract.pay(payee.getAddress(), 2_000n).send();
    const paid = decodeTransactionUnsafe(hexToBin(tx.hex)).outputs.some((output) => output.valueSatoshis === 2_000n
      && binToHex(output.lockingBytecode) === lockOf(payee.getAddress()));
    expect(paid).toBe(true);
    expect((await contract.getState()).calls).toBe(1n);
  });

  it('reverts a high-level call to a P2PKH target', async () => {
    const { contract, payee } = await setup(typed);
    await expect(contract.typed(payee.getAddress()).send()).rejects.toThrow();
    expect((await contract.getState()).calls).toBe(0n);
  });
});
