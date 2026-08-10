import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { ContractFactory } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

describe('ERC20Mock approve (mistswap artifact)', () => {
  it('approve bob and chef after MasterChef.add', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    if ((provider as any).policy) (provider as any).policy.enforceProductionInputLimit = false;
    const [alice, bob, dev] = await getSigners(3, { provider, fundingUtxos: 10 });
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
  });
});
