/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * block.timestamp time-travel demo (the Solidity/Hardhat time surface - NOT tx.locktime). A TimeVault covenant
 * reads `block.timestamp`, which on SolidCash is a field of the commitment of the vault's own block oracle, a coin of
 * its category that the reader co-spends. The mock chain writes its clock into that commitment when it mines, so the
 * harness `time.increaseTo` moves `block.timestamp` and the withdraw covenant flips from reverting to succeeding -
 * exactly like Hardhat's `time.increaseTo` for a ported Solidity timelock. On a live chain the oracle owner's
 * BlockOracleUpdater pushes those fields; `mockBlockOracleRpc` points it at the mock chain.
 */
import { compileString } from '@solidcash/solidc';
import { getContractFactory, StatefulContract } from '@solidcash/solidcash/stateful';
import { ethers, network, loadFixture, time, mockBlockOracleRpc, BlockOracleUpdater } from '@solidcash/testing';
import { expect } from '@solidcash/testing/chai';

const provider = network.provider;

const VAULT_SRC = `contract TimeVault(int unlockTime) {
  function withdraw() {
    require(block.timestamp >= unlockTime, "still locked");
  }
}`;

async function deployVaultFixture() {
  // A block.* reader is stateful: its genesis mints its own oracle.
  const artifact = compileString(VAULT_SRC);
  const [deployer] = await ethers.getSigners();
  const unlockTime = BigInt(await time.latest()) + BigInt(time.duration.days(7));
  const deployed = await getContractFactory(artifact, deployer).deploy(unlockTime);
  const contract = (deployed as any).inner;
  const categoryId = (deployed as any).categoryId;
  // The mock chain keeps every oracle naming its owner key; the keeper signs with that key and reads the vault's.
  const oracle = new BlockOracleUpdater({
    contract, categoryId, keeperKey: (provider as any).blockOracleOwnerKey, rpc: mockBlockOracleRpc(provider as any),
  });
  const vault = StatefulContract.withCategory(contract, categoryId);
  return { vault, oracle, unlockTime };
}

describe('harness: block.timestamp time-travel', () => {
  it('withdraw is locked until block.timestamp reaches unlockTime, then unlocks', async () => {
    const { vault, oracle, unlockTime } = await loadFixture(deployVaultFixture);

    // Locked: the oracle's block.timestamp is below unlockTime.
    expect(await oracle.oracleTimestamp()).to.be.lt(unlockTime);
    await expect((vault as any).withdraw().send()).to.be.rejected;

    // Advance the chain past the unlock time (Hardhat-style). The mined block writes the clock into the oracle,
    // so the keeper's sync finds it current.
    await time.increaseTo(Number(unlockTime) + 1);
    await oracle.syncOnce();

    // Unlocked: block.timestamp now >= unlockTime and the covenant passes.
    expect(await oracle.oracleTimestamp()).to.be.gte(unlockTime);
    const tx = await (vault as any).withdraw().send();
    expect(!!tx.txid).to.equal(true);
  });
});
