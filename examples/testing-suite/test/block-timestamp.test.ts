/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * block.timestamp time-travel demo (the Solidity/Hardhat time surface - NOT tx.locktime). A TimeVault covenant
 * reads `block.timestamp`, which on SolidCash is an oracle-backed state register. The harness `time.increaseTo`
 * advances the mock chain, `mockBlockOracleRpc` bridges that into the contract via the BlockOracleUpdater keeper,
 * and the withdraw covenant flips from reverting to succeeding - exactly like Hardhat's `time.increaseTo` moving
 * `block.timestamp` for a ported Solidity timelock.
 */
import { compileString } from 'solidc';
import { getContractFactory, StatefulContract } from 'solidcash';
import { ethers, network, loadFixture, time, mockBlockOracleRpc, BlockOracleUpdater } from '@solidcash/testing';
import { expect } from '@solidcash/testing/chai';

const provider = network.provider;

const VAULT_SRC = `contract TimeVault(int unlockTime) {
  function withdraw() {
    require(block.timestamp >= unlockTime, "still locked");
  }
}`;

async function deployVaultFixture() {
  const artifact = compileString(VAULT_SRC);
  const [keeper] = await ethers.getSigners();
  const unlockTime = BigInt(await time.latest()) + BigInt(time.duration.days(7));
  // block.* makes the contract stateful; seed the injected registers (register + owner key of the keeper).
  const deployed = await getContractFactory(artifact, keeper).deploy(unlockTime, {
    initialState: { __block_timestamp: 0n, __blockOracleOwner: keeper.publicKey },
  });
  const contract = (deployed as any).inner;
  const categoryId = (deployed as any).categoryId;
  const oracle = new BlockOracleUpdater({
    contract, categoryId, keeperKey: keeper.privateKey, rpc: mockBlockOracleRpc(provider),
  });
  await oracle.syncOnce(); // push the current block.timestamp into the contract
  const vault = StatefulContract.withCategory(contract, categoryId);
  return { vault, oracle, unlockTime };
}

describe('harness: block.timestamp time-travel', () => {
  it('withdraw is locked until block.timestamp reaches unlockTime, then unlocks', async () => {
    const { vault, oracle, unlockTime } = await loadFixture(deployVaultFixture);

    // Locked: the oracle-backed block.timestamp register is below unlockTime.
    expect((await vault.getState()).__block_timestamp).to.be.lt(unlockTime);
    await expect((vault as any).withdraw().send()).to.be.rejected;

    // Advance the chain past the unlock time (Hardhat-style), then refresh the oracle.
    await time.increaseTo(Number(unlockTime) + 1);
    await oracle.syncOnce();

    // Unlocked: block.timestamp register now >= unlockTime and the covenant passes.
    expect((await vault.getState()).__block_timestamp).to.be.gte(unlockTime);
    const tx = await (vault as any).withdraw().send();
    expect(!!tx.txid).to.equal(true);
  });
});
