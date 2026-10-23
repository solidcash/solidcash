import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// Two sibling loops write one mapping and call out through an internal helper, so the compiler threads one
// transaction-wide runtime cardinality pair. Empty lists discover no child call and take the direct delegate build.
// The initializer modifier marks every external entry delegate, as an OZ-style upgradeable implementation does.
let compiled: ReturnType<typeof compileStringMulti> | undefined;
const artifacts = (): ReturnType<typeof compileStringMulti> => compiled ??= compileStringMulti(`pragma solidity ^0.8.20;
  interface ITarget {
    function step(uint value) external;
  }
  contract Target {
    uint public total;
    function step(uint value) public { this.total += value; }
  }
  contract Registry {
    mapping(uint => bool) public flags;
    bool public sealed;
    modifier initializer() { _; }
    function initialize() public initializer { this.sealed = false; }
    function seal() public { this.sealed = true; }
    function relay(address target, uint value) internal { ITarget(target).step(value); }
    function update(address target, uint[] memory added, uint[] memory removed) public {
      require(!sealed, "registry sealed");
      for (uint i = 0; i < added.length; i++) {
        flags[added[i]] = true;
        relay(target, added[i]);
      }
      for (uint j = 0; j < removed.length; j++) {
        flags[removed[j]] = false;
        relay(target, removed[j]);
      }
    }
  }`, { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
  suppressWarnings: true, optimizeForCompilationSpeed: true });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function deploy() {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x5c), provider);
  for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
    txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
  });
  const target = await getContractFactory(artifacts().Target, signer).deploy();
  const registry = await upgrades.deployProxy(getContractFactory(artifacts().Registry, signer), []);
  registry.implementation._registerResolvedExternal('ITarget', target);
  return { target, registry };
}

const flag = (registry: unknown, key: bigint): Promise<unknown> => (
  registry as { flags: (key: bigint) => Promise<unknown> }).flags(key);

describe('direct delegate build of sibling runtime loops over one mapping', () => {
  it('fills the threaded cardinality when both lists are empty', async () => {
    const { target, registry } = await deploy();
    const address = target.inner.lockingBytecode;

    await registry.forward('update', [address, [7n], []]).send();
    expect(await flag(registry, 7n)).toBe(true);
    expect(await target.getState()).toMatchObject({ total: 7n });

    await expect(registry.forward('update', [address, [], []]).send()).resolves.toBeDefined();
    expect(await flag(registry, 7n)).toBe(true);
    expect(await target.getState()).toMatchObject({ total: 7n });

    await registry.forward('update', [address, [], [7n]]).send();
    expect(await flag(registry, 7n)).toBe(false);
    expect(await target.getState()).toMatchObject({ total: 14n });
  }, 300_000);

  it('reaches the source require when both lists are empty', async () => {
    const { target, registry } = await deploy();
    await registry.forward('seal', []).send();
    await expect(registry.forward('update', [target.inner.lockingBytecode, [], []]).send())
      .rejects.toThrow(/registry sealed/);
    expect(await registry.proxy.getState()).toMatchObject({ sealed: true });
    expect(await target.getState()).toMatchObject({ total: 0n });
  }, 180_000);
});
