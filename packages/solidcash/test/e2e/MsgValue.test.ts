import { compileString } from '../direct-compile.js';
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
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { addressToLockScript } from '../../src/utils.js';

// =============================================================================
// Contract Sources
// =============================================================================

// Contract that checks msg.value during this.transfer() (withdraw scenario)
const WITHDRAW_CONTRACT = `
pragma solidcash >=0.8.0;

contract MsgValueWithdraw(pubkey admin) {
    int lastMsgValue;

    function sendFunds(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        require(msg.value == 0 - amount);
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.lastMsgValue = msg.value;
    }
}
`;

// Contract that checks msg.value == 0 (no satoshi container involvement)
const ZERO_VALUE_CONTRACT = `
pragma solidcash >=0.8.0;

contract MsgValueZero() {
    int counter;

    function increment() {
        require(msg.value == 0);
        this.counter = this.counter + 1;
    }
}
`;

// Contract that stores msg.value for verification
const STORE_VALUE_CONTRACT = `
pragma solidcash >=0.8.0;

contract MsgValueStore(pubkey admin) {
    int storedValue;

    function withdraw(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.storedValue = msg.value;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('msg.value', () => {
  // ---------- Compilation Tests ----------

  describe('compilation', () => {
    it('should compile a contract using msg.value', () => {
      const artifact = compileString(WITHDRAW_CONTRACT);
      expect(artifact.abi).toBeDefined();
      expect(artifact.bytecode).toBeDefined();
    });

    it('should compile msg.value as int type', () => {
      // msg.value is used in arithmetic/comparison, confirming it resolves to int
      const source = `
        contract Test() {
            int x;
            function check(int expected) {
                require(msg.value == expected);
                require(msg.value > 0 - 1000000);
                this.x = msg.value + 1;
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi).toBeDefined();
    });
  });

  // ---------- msg.value == 0 (no satoshi container in transaction) ----------

  describe('msg.value == 0 (no satoshi container movement)', () => {
    const provider = createTestProvider();
    const artifact = compileString(ZERO_VALUE_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
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
    });

    it('should succeed when msg.value == 0 (function does not touch satoshi container)', async () => {
      const tx = await deployedContract.call.increment().send();
      expect(tx.txid).toBeDefined();

      // Verify counter was incremented
      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
    });
  });

  // ---------- msg.value negative (withdraw via this.transfer()) ----------

  describe('msg.value negative (withdraw via this.transfer())', () => {
    const provider = createTestProvider();
    const artifact = compileString(WITHDRAW_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the contract with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f2cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { lastMsgValue: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      deployedContract = result.contract;
      expect(result.categoryId).toBe(fundingUtxo.txid);
    });

    it('should succeed when msg.value matches -amount during transfer', async () => {
      // msg.value depends on transfer amount (circular dependency) - manual override needed
      const bobLockingBytecode = addressToLockScript(bobAddress);
      const tx = await deployedContract.call
        .sendFunds(new SignatureTemplate(alicePriv), bobPkh, 10000n)
        .transfer(bobLockingBytecode, 10000n)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify the transfer output
      const txOutputs = getTxOutputs(tx);
      const transferOutput = txOutputs.find(
        (o) => o.to === bobAddress && o.amount === 10000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();

      // Verify satoshi container balance reduced
      const balance = await deployedContract.satoshiContainer.getBalance();
      expect(balance).toBe(40000n);

      // Verify lastMsgValue was stored correctly
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable',
      );
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.lastMsgValue).toBe(-10000n);
    });
  });

  // ---------- msg.value stored in state ----------

  describe('msg.value stored in state variable', () => {
    const provider = createTestProvider();
    const artifact = compileString(STORE_VALUE_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy with satoshi container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f3cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { storedValue: 0n },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      deployedContract = result.contract;
    });

    it('should store msg.value correctly after withdraw of 5000', async () => {
      // msg.value depends on transfer amount (circular dependency) - manual override needed
      const bobLockingBytecode = addressToLockScript(bobAddress);
      const tx = await deployedContract.call
        .withdraw(new SignatureTemplate(alicePriv), bobPkh, 5000n)
        .transfer(bobLockingBytecode, 5000n)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify storedValue == -5000
      const txOutputs = getTxOutputs(tx);
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable',
      );
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.storedValue).toBe(-5000n);

      // Verify container balance
      const balance = await deployedContract.satoshiContainer.getBalance();
      expect(balance).toBe(45000n);
    });

    it('should store msg.value correctly after withdraw of 20000', async () => {
      // msg.value depends on transfer amount (circular dependency) - manual override needed
      const bobLockingBytecode = addressToLockScript(bobAddress);
      const tx = await deployedContract.call
        .withdraw(new SignatureTemplate(alicePriv), bobPkh, 20000n)
        .transfer(bobLockingBytecode, 20000n)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify storedValue == -20000
      const txOutputs = getTxOutputs(tx);
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable',
      );
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.storedValue).toBe(-20000n);

      // Container balance should be 45000 - 20000 = 25000
      const balance = await deployedContract.satoshiContainer.getBalance();
      expect(balance).toBe(25000n);
    });
  });
});
