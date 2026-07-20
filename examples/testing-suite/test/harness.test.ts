import exampleArtifact from '../artifacts/example.artifact.js';
import { Contract, TransactionBuilder, randomUtxo } from 'solidcash';
// Hardhat-parity harness surface (see ../HARDHAT-PARITY.md)
import { ethers, network, loadFixture, time, mine, mineUpTo, duration } from '@solidcash/testing';
import { parseEther, formatEther, getBigNumber, keccak256, AbiCoder, ZeroAddress, ADDRESS_ZERO } from '@solidcash/testing/ethers';
import { expect } from '@solidcash/testing/chai';

const provider = network.provider;

// Named fixtures (function identity is the loadFixture cache key).
async function exampleFixture() {
  const [alice, bob] = await ethers.getSigners();
  const contract = new Contract(exampleArtifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo());
  return { contract, alice, bob };
}

describe('harness: signers (ethers.getSigners)', () => {
  it('returns pre-funded HD signers from the hardhat mnemonic', async () => {
    const signers = await ethers.getSigners();
    expect(signers.length).to.equal(20);
    const [owner] = signers;
    expect(owner.getAddress()).to.be.properAddress;
    const balance = (await owner.getUtxos()).reduce((s, u) => s + u.satoshis, 0n);
    expect(balance).to.be.gt(0n);
  });
});

describe('harness: chai matchers over TransactionBuilder', () => {
  it('reverts with the require reason', async () => {
    const { contract } = await loadFixture(exampleFixture);
    const utxo = (await provider.getUtxos(contract.address))[0];
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test(0n))
      .addOutput({ to: contract.address, amount: 10000n });
    await expect(tx).to.be.revertedWith(/Wrong value passed/);
  });

  it('does not revert on the correct value', async () => {
    const { contract } = await loadFixture(exampleFixture);
    const utxo = (await provider.getUtxos(contract.address))[0];
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test(1n))
      .addOutput({ to: contract.address, amount: 10000n });
    await expect(tx).to.not.be.reverted;
  });
});

describe('harness: loadFixture snapshot isolation', () => {
  it('A mutates the chain on top of the fixture', async () => {
    const { contract } = await loadFixture(exampleFixture);
    expect((await provider.getUtxos(contract.address)).length).to.equal(1);
    await provider.addUtxo(contract.address, randomUtxo());
    expect((await provider.getUtxos(contract.address)).length).to.equal(2);
  });

  it('B sees the fixture state restored (A mutation reverted)', async () => {
    const { contract } = await loadFixture(exampleFixture);
    // loadFixture restored the post-fixture snapshot: the extra UTXO from A is gone.
    expect((await provider.getUtxos(contract.address)).length).to.equal(1);
  });
});

describe('harness: time and block control', () => {
  it('advances the block timestamp and height', async () => {
    const t0 = await time.latest();
    await time.increase(time.duration.hours(1));
    expect((await time.latest()) - t0).to.equal(3600);

    const h0 = await provider.getBlockHeight();
    await mine(5);
    expect(await provider.getBlockHeight()).to.equal(h0 + 5);
    await mineUpTo(h0 + 100);
    expect(await provider.getBlockHeight()).to.equal(h0 + 100);
  });

  it('a normal covenant call is unaffected by advancing the chain', async () => {
    const { contract } = await loadFixture(exampleFixture);
    await mine(100);
    await time.increase(time.duration.days(30));
    const utxo = (await provider.getUtxos(contract.address))[0];
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test(1n))
      .addOutput({ to: contract.address, amount: 10000n });
    await expect(tx).to.not.be.reverted;
  });
});

describe('harness: ethers utils (forwarded to ethers v6 + v5 shims)', () => {
  it('units and BigNumber', () => {
    expect(parseEther('1')).to.equal(10n ** 18n);
    expect(formatEther(10n ** 18n)).to.equal('1.0');
    expect(getBigNumber(5, 2).toBigInt()).to.equal(500n);
    expect(getBigNumber(5, 2).mul(2).toBigInt()).to.equal(1000n);
  });

  it('hashing and ABI coding (real keccak / real coder)', () => {
    expect(keccak256('0x')).to.equal('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    const enc = new AbiCoder().encode(['uint256', 'address'], [1n, ZeroAddress]);
    expect(enc).to.equal(`0x${'0'.repeat(63)}1${'0'.repeat(64)}`);
  });

  it('duration builders (standalone) and ADDRESS_ZERO constant', () => {
    expect(duration.seconds(30)).to.equal(30);
    expect(duration.hours(2)).to.equal(7200);
    expect(duration.days(7)).to.equal(604800);
    expect(duration.years(1)).to.equal(31536000);
    expect(ADDRESS_ZERO).to.equal(ZeroAddress);
  });
});

describe('harness: string / hex matchers (waffle)', () => {
  it('properHex(length?) and hexEqual', () => {
    expect('0x1234').to.be.properHex(4);
    expect('0xabcd').to.be.properHex();
    expect('0xzz').to.not.be.properHex();
    expect('0x1234').to.not.be.properHex(6);
    expect('0x00012AB').to.hexEqual('0x12ab');
    expect('0x1').to.not.hexEqual('0x2');
  });
});

describe('harness: balance-change matcher', () => {
  it('changeBchBalance measures a funding delta', async () => {
    const [, , carol] = await ethers.getSigners();
    await expect(async () => {
      await provider.addUtxo(carol.getAddress(), { ...randomUtxo(), satoshis: 5000n });
    }).to.changeBchBalance(carol, 5000n);
  });
});
