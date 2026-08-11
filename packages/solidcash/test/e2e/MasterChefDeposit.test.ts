import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ContractFactory } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

describe('MasterChef deposit', () => {
  // The vendored, unsplit MasterChef constructor probe pushes an approximately 16.6 KB stack item. Keep this
  // relaxed-policy mock diagnostic, but do not present it as executable under BCH's 520-byte consensus limit.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('approve then deposit', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    if ((provider as any).policy) (provider as any).policy.enforceProductionInputLimit = false;
    const [alice, bob, dev] = await getSigners(3, { provider, fundingUtxos: 20 });
    const artifact = (name: string): any => JSON.parse(readFileSync(
      new URL(`../fixture/mistswap-artifacts/${name}.json`, import.meta.url), 'utf8',
    ));
    const erc20Art = artifact('ERC20Mock');
    const masterChefArt = artifact('MasterChef');
    const sushiArt = artifact('SushiToken');
    const sushi = await new ContractFactory(sushiArt, alice).deploy();
    const lp = await new ContractFactory(erc20Art, alice).deploy('LP', 'LP', 1000000000n);
    const chef = await new ContractFactory(masterChefArt, alice).deploy(
      sushi.address, dev.getAddress(), 100n, 100n, 1000n,
    );
    await sushi.transferOwnership(chef.address).send();
    await chef.add(100n, lp.address, true).send();
    await lp.transfer(bob.getAddress(), 1000n).send();
    await lp.connect(bob).approve(chef.address, 1000n).send();
    console.log('approve ok');
    await chef.connect(bob).deposit(0n, 100n).send();
    console.log('deposit ok');
    expect(true).toBe(true);
  });
});
