/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * block.timestamp time-travel demo (the Solidity/Hardhat time surface - NOT tx.locktime). A TimeVault covenant
 * reads `block.timestamp`, which on SolidCash is a field of a block-info coin of an oracle pool that the reader
 * co-spends. The mock chain's pool keeper publishes the chain's clock (the second before its tip) on every mined block,
 * so the harness `time.increaseTo` moves `block.timestamp` and the withdraw covenant flips from reverting to
 * succeeding - exactly like Hardhat's `time.increaseTo` for a ported Solidity timelock.
 */
import { compileString } from '@solidcash/solidc';
import { getContractFactory, StatefulContract } from '@solidcash/solidcash/stateful';
import { readPoolTimestamp } from '@solidcash/solidcash/oracle';
import { ethers, network, loadFixture, time } from '@solidcash/testing';
import { expect } from '@solidcash/testing/chai';

const provider = network.provider;

const VAULT_SRC = `contract TimeVault(int unlockTime) {
  function withdraw() {
    require(block.timestamp >= unlockTime, "still locked");
  }
}`;

async function deployVaultFixture() {
  // A block.* reader is stateful; it binds the provider's oracle pool.
  const artifact = compileString(VAULT_SRC);
  const [deployer] = await ethers.getSigners();
  const unlockTime = BigInt(await time.latest()) + BigInt(time.duration.days(7));
  const deployed = await getContractFactory(artifact, deployer).deploy(unlockTime);
  const contract = (deployed as any).inner;
  const categoryId = (deployed as any).categoryId;
  // The vault binds the mock chain's oracle pool; its block.timestamp is the timestamp of that pool's coins.
  const clock = () => readPoolTimestamp(provider as any, contract.oraclePool);
  const vault = StatefulContract.withCategory(contract, categoryId);
  return { vault, clock, unlockTime };
}

describe('harness: block.timestamp time-travel', () => {
  it('withdraw is locked until block.timestamp reaches unlockTime, then unlocks', async () => {
    const { vault, clock, unlockTime } = await loadFixture(deployVaultFixture);

    // Locked: the pool's block.timestamp is below unlockTime.
    expect(await clock()).to.be.lt(unlockTime);
    await expect((vault as any).withdraw().send()).to.be.rejected;

    // Advance the chain past the unlock time (Hardhat-style). The mined block's clock reaches the pool.
    await time.increaseTo(Number(unlockTime) + 1);

    // Unlocked: block.timestamp now >= unlockTime and the covenant passes.
    expect(await clock()).to.be.gte(unlockTime);
    const tx = await (vault as any).withdraw().send();
    expect(!!tx.txid).to.equal(true);
  });
});
