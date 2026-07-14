import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobPkh,
  bobAddress,
  carolPkh,
  carolAddress,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
// Contract with this.transfer() - draws from satoshi container
const TRANSFER_CONTRACT = `
pragma solidcash >=0.8.0;

contract TransferContract(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function sendFunds(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const artifact = compileString(TRANSFER_CONTRACT);

describe('Satoshi Container', () => {
  describe('ABI: transferCount in sendFunds', () => {
    it('should have transferCount=1 for sendFunds', () => {
      const sendFundsAbi = artifact.abi.find((f) => f.name === 'sendFunds');
      expect(sendFundsAbi).toBeDefined();
      expect(sendFundsAbi!.transferCount).toBe(1);
    });

    it('should have no transferCount for increment', () => {
      const incrementAbi = artifact.abi.find((f) => f.name === 'increment');
      expect(incrementAbi).toBeDefined();
      expect(incrementAbi!.transferCount ?? 0).toBe(0);
    });
  });

  describe('deploy with initialBalance', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract with a satoshi container output', async () => {
      const fundingUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;

      expect(categoryId).toBe(fundingUtxo.txid);

      // Verify transaction outputs
      const txOutputs = getTxOutputs(result.tx);
      // Output 0: master minting NFT
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      // Output 1: data NFT
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      // There should be a satoshi container output (no token, 50000 sats)
      const containerOutput = txOutputs.find(
        (o) => !o.token && o.amount === 50000n && o.to !== p2pkh.address,
      );
      expect(containerOutput).toBeDefined();
    });

    it('should read satoshi container balance', async () => {
      const balance = await deployedContract.satoshiContainer.getBalance();
      expect(balance).toBe(50000n);
    });

    it('should increment counter (no satoshi container involvement)', async () => {
      const tx = await deployedContract.call.increment().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Master output should preserve exact satoshis (1200n default)
      expect(txOutputs[0].amount).toBe(1200n);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // Data NFT should preserve exact satoshis
      expect(txOutputs[1].amount).toBe(1200n);

      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
    });

    it('should send funds via this.transfer() drawing from satoshi container', async () => {
      // Auto-derivation extracts transfer bytecode+amount from VM trace
      const tx = await deployedContract.call
        .sendFunds(new SignatureTemplate(alicePriv), bobPkh, 10000n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Master should preserve exact satoshis
      expect(txOutputs[0].amount).toBe(1200n);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // sendFunds doesn't access state, so data NFTs are not in the transaction
      // (requiredNftIndices: [] - no state variable accesses)

      // Satoshi container should have reduced balance (50000 - 10000 = 40000)
      const containerOutput = txOutputs.find(
        (o) => !o.token && o.amount === 40000n,
      );
      expect(containerOutput).toBeDefined();

      // Transfer output to recipient
      const transferOutput = txOutputs.find(
        (o) => o.to === bobAddress && o.amount === 10000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();
    });

    it('should have updated satoshi container balance after transfer', async () => {
      const balance = await deployedContract.satoshiContainer.getBalance();
      expect(balance).toBe(40000n);
    });
  });

  describe('deploy without initialBalance (no satoshi container)', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('should deploy without satoshi container when initialBalance not set', async () => {
      const fundingUtxo: Utxo = {
        txid: 'b1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      const txOutputs = getTxOutputs(result.tx);
      // Should have master + data NFT + change (no satoshi container)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
    });
  });

  describe('error: transfer without satoshi container', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('should throw when trying to call transfer function without satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'c1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        // No initialBalance - no satoshi container
      });

      const deployedContract = result.contract;

      // Should fail because no satoshi container UTXO exists
      await expect(
        deployedContract.call
          .sendFunds(new SignatureTemplate(alicePriv), bobPkh, 10000n)
          .send(),
      ).rejects.toThrow('Satoshi container UTXO not found');
    });
  });

  describe('full drain (transfer all satoshis)', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the contract with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'd1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      deployedContract = result.contract;
      expect(await deployedContract.satoshiContainer.getBalance()).toBe(50000n);
    });

    it('should transfer ALL satoshis, removing the container output', async () => {
      // Full drain removes the container output - auto-derivation can't handle this
      // because the output structure changes (no container preservation). Use manual override.
      const { addressToLockScript } = await import('../../src/utils.js');
      const bobLockingBytecode = addressToLockScript(bobAddress);
      const tx = await deployedContract.call
        .sendFunds(new SignatureTemplate(alicePriv), bobPkh, 50000n)
        .transfer(bobLockingBytecode, 50000n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Master output should still exist
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // Transfer output to recipient
      const transferOutput = txOutputs.find(
        (o) => o.to === bobAddress && o.amount === 50000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();

      // No satoshi container output (drained)
      const containerOutput = txOutputs.find(
        (o) => o.to === deployedContract.satoshiContainer.address,
      );
      expect(containerOutput).toBeUndefined();
    });
  });

  describe('auto-derived transfer (no manual .transfer())', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the contract with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      deployedContract = result.contract;
      expect(await deployedContract.satoshiContainer.getBalance()).toBe(50000n);
    });

    it('should auto-derive transfer output without manual .transfer()', async () => {
      // Call sendFunds WITHOUT chaining .transfer() - let auto-derivation handle it
      const tx = await deployedContract.call
        .sendFunds(new SignatureTemplate(alicePriv), bobPkh, 10000n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Master output preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // Satoshi container should have reduced balance (50000 - 10000 = 40000)
      const containerOutput = txOutputs.find(
        (o) => !o.token && o.amount === 40000n,
      );
      expect(containerOutput).toBeDefined();

      // Transfer output to recipient (auto-derived from VM trace)
      const transferOutput = txOutputs.find(
        (o) => o.to === bobAddress && o.amount === 10000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();
    });
  });

  // --- Fan-out: 1 satoshi container -> N transfer outputs ------------
  describe('fan-out (1->N transfers)', () => {
    const FANOUT_CONTRACT = `
pragma solidcash >=0.8.0;

contract FanOut(pubkey admin) {
    int counter;

    function sendTwo(sig s, bytes20 recipA, int amtA, bytes20 recipB, int amtB) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipA), amtA);
        this.transfer(new LockingBytecodeP2PKH(recipB), amtB);
    }

    function sendThree(sig s, bytes20 rA, int aA, bytes20 rB, int aB, bytes20 rC, int aC) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(rA), aA);
        this.transfer(new LockingBytecodeP2PKH(rB), aB);
        this.transfer(new LockingBytecodeP2PKH(rC), aC);
    }

    function authorize(pubkey pk, sig s) unsafe(1) {
        require(checkSig(s, pk));
    }
}
`;

    const fanoutArtifact = compileString(FANOUT_CONTRACT);
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should compile with correct transferCounts', () => {
      const sendTwo = fanoutArtifact.abi.find((f) => f.name === 'sendTwo');
      expect(sendTwo?.transferCount).toBe(2);
      const sendThree = fanoutArtifact.abi.find((f) => f.name === 'sendThree');
      expect(sendThree?.transferCount).toBe(3);
    });

    it('should deploy with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16), vout: 0, satoshis: 300000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(fanoutArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 100000n,
      });

      deployedContract = result.contract;
      expect(await deployedContract.satoshiContainer.getBalance()).toBe(100000n);
    });

    it('should fan-out to 2 recipients via auto-derivation', async () => {
      const tx = await deployedContract.call
        .sendTwo(new SignatureTemplate(alicePriv), bobPkh, 10000n, carolPkh, 15000n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Satoshi container: 100000 - 10000 - 15000 = 75000
      const containerOutput = txOutputs.find((o) => !o.token && o.amount === 75000n);
      expect(containerOutput).toBeDefined();

      // Transfer outputs
      expect(txOutputs.find((o) => o.to === bobAddress && o.amount === 10000n)).toBeDefined();
      expect(txOutputs.find((o) => o.to === carolAddress && o.amount === 15000n)).toBeDefined();
    });

    it('should auto-derive fan-out to 2 recipients', async () => {
      const tx = await deployedContract.call
        .sendTwo(new SignatureTemplate(alicePriv), bobPkh, 5000n, carolPkh, 8000n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Satoshi container: 75000 - 5000 - 8000 = 62000
      const containerOutput = txOutputs.find((o) => !o.token && o.amount === 62000n);
      expect(containerOutput).toBeDefined();

      // Auto-derived transfer outputs
      expect(txOutputs.find((o) => o.to === bobAddress && o.amount === 5000n)).toBeDefined();
      expect(txOutputs.find((o) => o.to === carolAddress && o.amount === 8000n)).toBeDefined();
    });

    it('should auto-derive fan-out to 3 recipients', async () => {
      const tx = await deployedContract.call
        .sendThree(
          new SignatureTemplate(alicePriv),
          alicePkh, 1000n, bobPkh, 2000n, carolPkh, 3000n,
        )
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Satoshi container: 62000 - 1000 - 2000 - 3000 = 56000
      const containerOutput = txOutputs.find((o) => !o.token && o.amount === 56000n);
      expect(containerOutput).toBeDefined();

      // All 3 transfer outputs
      const transferOutputs = txOutputs.filter(
        (o) => !o.token && o.amount <= 3000n && o.amount >= 1000n,
      );
      expect(transferOutputs.length).toBe(3);
    });
  });

  // SOUNDNESS: the covenant must pin the satoshi container's OUTPUT to the container's own address (or a 0-sat
  // drain), else a caller could satisfy the value conservation (containerIn <= containerOut + transfers) by
  // parking the preserved remainder at a FOREIGN address - stealing the contract's balance. The drain-guard
  // (emitSatoshiContainerIdentity: output LBC == expected OR output value == 0) closes this. This uses a
  // no-checkSig function so the ONLY covenant that can reject the mutated tx is the container preservation.
  describe('container output redirect is rejected (drain-guard)', () => {
    const NOSIG = `
contract C(bytes20 owner) {
    int counter;
    function pay(int amount) {
        this.transfer(new LockingBytecodeP2PKH(owner), amount);
    }
}`;
    const noSigArtifact = compileString(NOSIG);
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('rejects redirecting the preserved container output to a foreign address; honest tx is accepted', async () => {
      const { addressToLockScript } = await import('../../src/utils.js');
      const fu: Utxo = { txid: 'ad03'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, fu);
      const contract = (await StatefulContract.deploy(noSigArtifact, [alicePkh], {
        provider,
        fundingUtxo: fu,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      })).contract;

      // Honest partial transfer: 10000 to owner, container preserved at 40000.
      const builder = await contract.call.pay(10000n).build();
      const scIdx = builder.outputs.findIndex((o) => o.amount === 40000n);
      expect(scIdx).toBeGreaterThanOrEqual(0);
      const honestRaw = builder.build();

      // ATTACK: redirect the 40000-sat preserved container output to a foreign address, keeping its value
      // (so the value conservation still holds). Only the LBC identity guard can catch this.
      builder.outputs[scIdx].to = addressToLockScript(bobAddress);
      const attackRaw = builder.build();

      // Submitted against LIVE utxos (a rejected tx spends nothing): rejected by the covenant, not a utxo error.
      let msg = '';
      await expect(provider.sendRawTransaction(attackRaw).catch((e) => { msg = (e as Error).message; throw e; }))
        .rejects.toThrow();
      expect(/missingorspent|inputs/i.test(msg)).toBe(false);
      expect(/verify|script/i.test(msg)).toBe(true);

      // The honest, container-preserving tx (built before the mutation) IS accepted against the same utxos.
      await expect(provider.sendRawTransaction(honestRaw)).resolves.toBeDefined();
    });
  });
});
