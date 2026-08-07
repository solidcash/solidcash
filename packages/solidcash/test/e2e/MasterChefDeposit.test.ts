import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ContractFactory } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

const DIR = '/Code/cashscript/.worktrees/mistswap-native-bch/examples/mistswap-native/artifacts/solidcash';
const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

describe('MasterChef deposit', () => {
  it('approve then deposit', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob, dev] = await getSigners(3, { provider, fundingUtxos: 20 });
    const erc20Art = JSON.parse(readFileSync(`${DIR}/ERC20Mock.json`, 'utf8'));
    const masterChefArt = JSON.parse(readFileSync(`${DIR}/MasterChef.json`, 'utf8'));
    const sushiArt = JSON.parse(readFileSync(`${DIR}/SushiToken.json`, 'utf8'));
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
