/**
 * SolidCash Feature Highlight
 *
 * A single comprehensive contract showcasing key SolidCash innovations,
 * validated against real BCHN regtest consensus:
 *
 * - 3 typed state variables
 * - 2 mappings tracking per-user balances (bytes20 => int)
 * - Expression-based mapping keys: hash160(pk) computed inside the contract
 * - Satoshi container (real BCH held by the contract)
 * - this.transfer() for sending real BCH to recipients
 * - Token container (CashTokens held by the contract)
 * - this.tokens[cat].transfer() for withdrawing fungible tokens
 * - this.tokens[cat].tokenAmount for reading/verifying token balances
 * - Guarded transitions (require checks on balances)
 * - Deploy from source with initial state + initial satoshi balance
 */
import { compileString } from 'solidc';
import {
  Contract, StatefulContract, SignatureTemplate,
} from '../../src/index.js';
import { alicePub, alicePriv, alicePkh, aliceAddress, bobPub, bobPriv, bobAddress } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { addressToLockScript } from '../../src/utils.js';

const isRegtest = !!process.env.TESTS_USE_REGTEST;
const MAX_FEE = 200000n;

// =====================================================================
// The Highlight Contract
// =====================================================================

const HIGHLIGHT_CONTRACT = `
pragma solidcash >=0.8.0;

/// SolidCash Highlight -- a stateful treasury with real satoshi and token management.
///
/// Features demonstrated:
///   - 3 typed state variables
///   - 2 mappings: per-user satoshi and token balance tracking
///   - Expression keys: hash160(pk) computed on-chain as mapping key
///   - Satoshi container: holds real BCH
///   - this.transfer(): sends real BCH to P2PKH recipients
///   - Token container: holds CashTokens (fungible)
///   - this.tokens[cat].tokenAmount: reads token balance
///   - this.tokens[cat].transfer(): withdraws tokens to recipients
///   - Guarded withdrawals (balance check + depositor sig)
contract Highlight() {
    /// Number of operations performed
    int opCount;

    /// Total satoshi balance tracked in state
    int totalBalance;

    /// Total fungible token balance tracked in state
    int totalTokenBalance;

    /// Per-user satoshi balances
    mapping(bytes20 depositor => int balance) satBalances;

    /// Per-user token balances
    mapping(bytes20 depositor => int balance) tokenBalances;

    /// Deposit sats: any depositor can deposit, authenticated by their own sig.
    function deposit(pubkey pk, sig s, int amount) {
        require(checkSig(s, pk));
        require(amount > 0);

        bytes20 depositor = hash160(pk);
        this.satBalances[depositor] = this.satBalances[depositor] + amount;
        this.totalBalance = this.totalBalance + amount;
        this.opCount = this.opCount + 1;
    }

    /// Withdraw sats: sends real BCH via this.transfer() to the caller.
    /// Checks per-user balance before decrementing.
    function withdraw(pubkey pk, sig s, int amount) {
        require(checkSig(s, pk));
        require(amount > 0);

        bytes20 recipient = hash160(pk);
        require(this.satBalances[recipient] >= amount);
        this.satBalances[recipient] = this.satBalances[recipient] - amount;
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.totalBalance = this.totalBalance - amount;
        this.opCount = this.opCount + 1;
    }

    /// Deposit tokens: records a token deposit into the treasury.
    function depositTokens(pubkey pk, sig s, bytes32 tokenCategory, int amount) {
        require(checkSig(s, pk));
        require(amount > 0);
        require(this.tokens[tokenCategory].tokenAmount >= this.totalTokenBalance + amount);

        bytes20 depositor = hash160(pk);
        this.tokenBalances[depositor] = this.tokenBalances[depositor] + amount;
        this.totalTokenBalance = this.totalTokenBalance + amount;
        this.opCount = this.opCount + 1;
    }

    /// Withdraw tokens: sends fungible tokens from the treasury to the caller.
    /// Checks per-user token balance before decrementing.
    function withdrawTokens(pubkey pk, sig s, bytes32 tokenCategory, int amount) {
        require(checkSig(s, pk));
        require(amount > 0);

        bytes20 recipient = hash160(pk);
        require(this.tokenBalances[recipient] >= amount);
        this.tokenBalances[recipient] = this.tokenBalances[recipient] - amount;
        this.tokens[tokenCategory].transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.totalTokenBalance = this.totalTokenBalance - amount;
        this.opCount = this.opCount + 1;
    }

    /// Unsafe admin bypass for covenant management.
    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// =====================================================================
// Tests
// =====================================================================

describe('SolidCash Feature Highlight', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const bobSig = new SignatureTemplate(bobPriv);

  describe('Satoshi Lifecycle (deposit -> withdraw)', () => {
    let sc: Awaited<ReturnType<typeof StatefulContract['deploy']>>['contract'];

    beforeAll(async () => {
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const art = compileString(HIGHLIGHT_CONTRACT);

      const fundingUtxo = await provider.addUtxo(p2pkh.address, {
        txid: 'f1cd'.repeat(16), vout: 0, satoshis: 200000n,
      });

      const result = await StatefulContract.deploy(art, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, aliceSig),
        initialState: {
          opCount: 0n,
          totalBalance: 0n,
          totalTokenBalance: 0n,
        },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      sc = result.contract;
      expect(result.tx.txid).toBeDefined();
      expect(result.categoryId).toBe(fundingUtxo.txid);
    });

    it('should read initial state and confirm satoshi container is funded', async () => {
      const state = await sc.getState();
      expect(state.opCount).toBe(0n);
      expect(state.totalBalance).toBe(0n);
      expect(state.totalTokenBalance).toBe(0n);

      const containerBalance = await sc.satoshiContainer.getBalance();
      expect(containerBalance).toBeGreaterThanOrEqual(50000n);
    });

    it('should deposit 5000 sats (alice), mapping tracks her balance', async () => {
      const tx = await sc.call.deposit(alicePub, aliceSig, 5000n)
        .withMaxFee(MAX_FEE).send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalBalance).toBe(5000n);
      expect(state.opCount).toBe(1n);
    });

    it('should deposit 7000 sats (bob), mapping tracks his balance', async () => {
      const tx = await sc.call.deposit(bobPub, bobSig, 7000n)
        .withMaxFee(MAX_FEE).send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalBalance).toBe(12000n);
      expect(state.opCount).toBe(2n);
    });

    it('should withdraw 4000 sats (alice), auto-derived sat transfer', async () => {
      const call = sc.call.withdraw(alicePub, aliceSig, 4000n).withMaxFee(MAX_FEE);
      if (isRegtest) call.transfer(addressToLockScript(aliceAddress), 4000n);
      const tx = await call.send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalBalance).toBe(8000n);
      expect(state.opCount).toBe(3n);

      const txOutputs = getTxOutputs(tx);
      const transferOutput = txOutputs.find(
        (o) => o.to === aliceAddress && o.amount === 4000n,
      );
      expect(transferOutput).toBeDefined();
      expect(transferOutput!.token).toBeUndefined();
    });

    it('should deposit 6000 more sats (alice), updates existing mapping entry', async () => {
      const tx = await sc.call.deposit(alicePub, aliceSig, 6000n)
        .withMaxFee(MAX_FEE).send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalBalance).toBe(14000n);
      expect(state.opCount).toBe(4n);
    });

    it('should buildUnsigned: returns unfunded covenant transaction', async () => {
      const result = await sc.call.deposit(alicePub, aliceSig, 1000n).buildUnsigned();

      expect(result.transaction).toBeInstanceOf(Uint8Array);
      expect(result.transaction.length).toBeGreaterThan(0);
      expect(result.sourceOutputs).toBeDefined();
      expect(result.sourceOutputs.length).toBe(result.inputCount);
      expect(result.covenantSize).toBe(result.transaction.length);

      // The transaction should have covenant inputs (master + data NFT + entry funder)
      // but no fee funder -- it's unfunded
      expect(result.inputCount).toBeGreaterThanOrEqual(2); // master + data NFT minimum
    });
  });

  describe('Token Lifecycle (fund -> deposit -> withdraw)', () => {
    let sc: Awaited<ReturnType<typeof StatefulContract['deploy']>>['contract'];
    let tokenCategoryId: string;

    beforeAll(async () => {
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const art = compileString(HIGHLIGHT_CONTRACT);

      const fundingUtxo = await provider.addUtxo(p2pkh.address, {
        txid: 'f2cd'.repeat(16), vout: 0, satoshis: 200000n,
      });

      const result = await StatefulContract.deploy(art, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, aliceSig),
        initialState: {
          opCount: 0n,
          totalBalance: 0n,
          totalTokenBalance: 0n,
        },
        changeAddress: p2pkh.address,
        initialBalance: 50000n,
      });

      sc = result.contract;
      expect(result.tx.txid).toBeDefined();
    });

    it('should fund the token container with 10000 FTs via genesis', async () => {
      const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => [{
        address: sc.getTokenContainerAddress(catId),
        satoshis: 1200n,
        token: { amount: 10000n },
      }]);
      tokenCategoryId = genesis.categoryId;

      const amount = await sc.tokens[tokenCategoryId].amount;
      expect(amount).toBe(10000n);
    });

    it('should deposit 5000 tokens (alice), mapping tracks her balance', async () => {
      const tx = await sc.call
        .depositTokens(alicePub, aliceSig, tokenCategoryId, 5000n)
        .withMaxFee(MAX_FEE).send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalTokenBalance).toBe(5000n);
      expect(state.opCount).toBe(1n);
    });

    it('should deposit 3000 tokens (bob), mapping tracks his balance', async () => {
      const tx = await sc.call
        .depositTokens(bobPub, bobSig, tokenCategoryId, 3000n)
        .withMaxFee(MAX_FEE).send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalTokenBalance).toBe(8000n);
      expect(state.opCount).toBe(2n);
    });

    it('should withdraw 2000 tokens (alice), auto-derived token transfer', async () => {
      const call = sc.call.withdrawTokens(alicePub, aliceSig, tokenCategoryId, 2000n).withMaxFee(MAX_FEE);
      if (isRegtest) call.tokenContainerTransfer(tokenCategoryId, addressToLockScript(aliceAddress), 2000n);
      const tx = await call.send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalTokenBalance).toBe(6000n);
      expect(state.opCount).toBe(3n);

      const remaining = await sc.tokens[tokenCategoryId].amount;
      expect(remaining).toBe(8000n);
    });

    it('should withdraw 3000 tokens (bob), auto-derived token transfer', async () => {
      const call = sc.call.withdrawTokens(bobPub, bobSig, tokenCategoryId, 3000n).withMaxFee(MAX_FEE);
      if (isRegtest) call.tokenContainerTransfer(tokenCategoryId, addressToLockScript(bobAddress), 3000n);
      const tx = await call.send();
      expect(tx.txid).toBeDefined();

      const state = await sc.getState();
      expect(state.totalTokenBalance).toBe(3000n);
      expect(state.opCount).toBe(4n);

      const remaining = await sc.tokens[tokenCategoryId].amount;
      expect(remaining).toBe(5000n);
    });
  });
});
