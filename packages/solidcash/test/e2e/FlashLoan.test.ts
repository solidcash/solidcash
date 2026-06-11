import { compileString } from 'solidc';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  Contract, SignatureTemplate, TransactionBuilder,
} from '../../src/index.js';
import {
  alicePkh, alicePub, alicePriv, aliceAddress, aliceTokenAddress,
  bobPkh, bobPub, bobPriv, bobAddress,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { FailedRequireError } from '../../src/Errors.js';
import { randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixture');

function loadCash(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, name), 'utf-8');
}

// Fee calculation: 0.09% = amount * 9 / 10000
const calcFee = (amount: bigint): bigint => (amount * 9n) / 10000n;

describe('FlashLoan', () => {
  const provider = createTestProvider();
  const flashLoanSource = loadCash('flash_loan.scash');
  const artifact = compileString(flashLoanSource);

  // Flash loan pool owned by Alice
  const flashLoanContract = new Contract(artifact, [alicePkh], { provider });

  // Borrower (Bob) has a P2PKH wallet
  const bobP2pkh = new Contract(p2pkhArtifact, [bobPkh], { provider });

  const minerFee = 1000n;

  beforeAll(async () => {
    console.log('FlashLoan contract address:', flashLoanContract.address);
    console.log('FlashLoan token address:', flashLoanContract.tokenAddress);
  });

  // ============================================================
  // BCH Flash Loans
  // ============================================================
  describe('BCH flash loan (loan)', () => {
    it('should execute a BCH flash loan with correct fee', async () => {
      // Pool has 1,000,000 sats available for lending
      const poolAmount = 1_000_000n;
      const loanFee = calcFee(poolAmount); // 900 sats
      const poolUtxo = randomUtxo({ satoshis: poolAmount });

      // Borrower has funds to pay the fee + miner fee
      const borrowerUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.address, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerUtxo);

      // Flash loan transaction:
      // Input 0: FlashLoan contract UTXO (the pool)
      // Input 1: Borrower's UTXO (to cover fee + miner fee)
      // Output 0: Return to FlashLoan contract at same index (original + fee)
      // Output 1: Borrower gets change
      const borrowerChange = borrowerUtxo.satoshis - loanFee - minerFee;

      const tx = await new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(false))
        .addInput(borrowerUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: flashLoanContract.address, amount: poolAmount + loanFee })
        .addOutput({ to: bobAddress, amount: borrowerChange })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([
        { to: flashLoanContract.address, amount: poolAmount + loanFee },
      ]));
    });

    it('should fail BCH flash loan when fee is insufficient', async () => {
      const poolAmount = 1_000_000n;
      const insufficientFee = calcFee(poolAmount) - 1n; // 1 sat short
      const poolUtxo = randomUtxo({ satoshis: poolAmount });
      const borrowerUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.address, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerUtxo);

      const borrowerChange = borrowerUtxo.satoshis - insufficientFee - minerFee;

      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(false))
        .addInput(borrowerUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: flashLoanContract.address, amount: poolAmount + insufficientFee })
        .addOutput({ to: bobAddress, amount: borrowerChange })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail BCH flash loan when output is not sent back to contract', async () => {
      const poolAmount = 1_000_000n;
      const loanFee = calcFee(poolAmount);
      const poolUtxo = randomUtxo({ satoshis: poolAmount });
      const borrowerUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.address, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerUtxo);

      // Send repayment to wrong address (borrower instead of contract)
      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(false))
        .addInput(borrowerUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: bobAddress, amount: poolAmount + loanFee })
        .addOutput({ to: bobAddress, amount: borrowerUtxo.satoshis - loanFee - minerFee })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail BCH flash loan when borrower tries to steal funds (no repayment)', async () => {
      const poolAmount = 1_000_000n;
      const poolUtxo = randomUtxo({ satoshis: poolAmount });
      const borrowerUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.address, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerUtxo);

      // Borrower tries to take all funds without repaying
      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(false))
        .addInput(borrowerUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: bobAddress, amount: poolAmount + borrowerUtxo.satoshis - minerFee })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // ============================================================
  // Token Flash Loans
  // ============================================================
  describe('Token flash loan (loan)', () => {
    it('should execute a token flash loan with correct fee', async () => {
      const tokenCategory = 'aacd'.repeat(16);
      const tokenAmount = 100_000n;
      const loanFee = calcFee(tokenAmount); // 90 tokens
      const poolSats = 10_000n;

      // Pool UTXO: contract holds tokens
      const poolUtxo: Utxo = {
        ...randomUtxo({ satoshis: poolSats }),
        token: { category: tokenCategory, amount: tokenAmount },
      };

      // Borrower has tokens to pay the fee
      const borrowerTokenUtxo: Utxo = {
        ...randomUtxo({ satoshis: 1_000n }),
        token: { category: tokenCategory, amount: 1_000n },
      };
      const borrowerBchUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.tokenAddress, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerTokenUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerBchUtxo);

      // Token flash loan transaction:
      // Input 0: FlashLoan UTXO with tokens (the pool)
      // Input 1: Borrower's token UTXO (to cover token fee)
      // Input 2: Borrower's BCH UTXO (to cover miner fee)
      // Output 0: Return to FlashLoan at same index with original tokens + fee, same BCH
      // Output 1: Borrower gets remaining tokens
      // Output 2: Borrower gets BCH change
      const borrowerRemainingTokens = borrowerTokenUtxo.token!.amount - loanFee;

      const tx = await new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(true))
        .addInput(borrowerTokenUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addInput(borrowerBchUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({
          to: flashLoanContract.tokenAddress,
          amount: poolSats,
          token: { category: tokenCategory, amount: tokenAmount + loanFee },
        })
        .addOutput({
          to: aliceTokenAddress,
          amount: borrowerTokenUtxo.satoshis,
          token: { category: tokenCategory, amount: borrowerRemainingTokens },
        })
        .addOutput({ to: bobAddress, amount: borrowerBchUtxo.satoshis - minerFee })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([
        {
          to: flashLoanContract.tokenAddress,
          amount: poolSats,
          token: { category: tokenCategory, amount: tokenAmount + loanFee },
        },
      ]));
    });

    it('should fail token flash loan when token fee is insufficient', async () => {
      const tokenCategory = 'bbcd'.repeat(16);
      const tokenAmount = 100_000n;
      const loanFee = calcFee(tokenAmount);
      const insufficientFee = loanFee - 1n;
      const poolSats = 10_000n;

      const poolUtxo: Utxo = {
        ...randomUtxo({ satoshis: poolSats }),
        token: { category: tokenCategory, amount: tokenAmount },
      };
      const borrowerTokenUtxo: Utxo = {
        ...randomUtxo({ satoshis: 1_000n }),
        token: { category: tokenCategory, amount: 1_000n },
      };
      const borrowerBchUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.tokenAddress, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerTokenUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerBchUtxo);

      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(true))
        .addInput(borrowerTokenUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addInput(borrowerBchUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({
          to: flashLoanContract.tokenAddress,
          amount: poolSats,
          token: { category: tokenCategory, amount: tokenAmount + insufficientFee },
        })
        .addOutput({
          to: aliceTokenAddress,
          amount: borrowerTokenUtxo.satoshis,
          token: { category: tokenCategory, amount: borrowerTokenUtxo.token!.amount - insufficientFee },
        })
        .addOutput({ to: bobAddress, amount: borrowerBchUtxo.satoshis - minerFee })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail token flash loan when BCH value changes', async () => {
      const tokenCategory = 'cccd'.repeat(16);
      const tokenAmount = 100_000n;
      const loanFee = calcFee(tokenAmount);
      const poolSats = 10_000n;

      const poolUtxo: Utxo = {
        ...randomUtxo({ satoshis: poolSats }),
        token: { category: tokenCategory, amount: tokenAmount },
      };
      const borrowerTokenUtxo: Utxo = {
        ...randomUtxo({ satoshis: 1_000n }),
        token: { category: tokenCategory, amount: 1_000n },
      };
      const borrowerBchUtxo = randomUtxo({ satoshis: 100_000n });

      await provider.addUtxo(flashLoanContract.tokenAddress, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerTokenUtxo);
      await provider.addUtxo(bobP2pkh.address, borrowerBchUtxo);

      // Try to steal 1 sat of BCH from the pool
      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(true))
        .addInput(borrowerTokenUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addInput(borrowerBchUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({
          to: flashLoanContract.tokenAddress,
          amount: poolSats - 1n, // 1 sat less than input
          token: { category: tokenCategory, amount: tokenAmount + loanFee },
        })
        .addOutput({
          to: aliceTokenAddress,
          amount: borrowerTokenUtxo.satoshis,
          token: { category: tokenCategory, amount: borrowerTokenUtxo.token!.amount - loanFee },
        })
        .addOutput({ to: bobAddress, amount: borrowerBchUtxo.satoshis - minerFee + 1n })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // ============================================================
  // Owner Withdrawal
  // ============================================================
  describe('withdraw', () => {
    it('should allow owner to withdraw funds', async () => {
      const poolUtxo = randomUtxo({ satoshis: 500_000n });
      await provider.addUtxo(flashLoanContract.address, poolUtxo);

      const withdrawAmount = poolUtxo.satoshis - minerFee;

      const tx = await new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.withdraw(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to: aliceAddress, amount: withdrawAmount })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([
        { to: aliceAddress, amount: withdrawAmount },
      ]));
    });

    it('should reject withdrawal with wrong key', async () => {
      const poolUtxo = randomUtxo({ satoshis: 500_000n });
      await provider.addUtxo(flashLoanContract.address, poolUtxo);

      const withdrawAmount = poolUtxo.satoshis - minerFee;

      // Bob tries to withdraw from Alice's flash loan pool
      const txPromise = new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.withdraw(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: bobAddress, amount: withdrawAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // ============================================================
  // Realistic Scenario: Flash Loan Arbitrage
  // ============================================================
  describe('flash loan arbitrage scenario', () => {
    it('should demonstrate a multi-step flash loan with profit', async () => {
      // Scenario: Bob takes a flash loan of 1,000,000 sats, "does arbitrage"
      // (simulated by having extra funds), and repays the loan with fee.
      //
      // In a real scenario, the borrower would interact with a DEX or other
      // contracts in additional inputs/outputs. Here we simulate the profit
      // by having Bob start with enough funds to cover both the fee and keep profit.

      const poolAmount = 1_000_000n;
      const loanFee = calcFee(poolAmount); // 900 sats
      const bobStartingFunds = 50_000n;
      const arbitrageProfit = 5_000n; // Bob's "profit" from the arbitrage

      const poolUtxo = randomUtxo({ satoshis: poolAmount });
      const bobUtxo = randomUtxo({ satoshis: bobStartingFunds + arbitrageProfit });

      await provider.addUtxo(flashLoanContract.address, poolUtxo);
      await provider.addUtxo(bobP2pkh.address, bobUtxo);

      // Bob's change = his funds - loan fee - miner fee
      // The "profit" is already baked into his starting balance
      const bobChange = bobUtxo.satoshis - loanFee - minerFee;

      const tx = await new TransactionBuilder({ provider })
        .addInput(poolUtxo, flashLoanContract.unlock.loan(false))
        .addInput(bobUtxo, bobP2pkh.unlock.spend(bobPub, new SignatureTemplate(bobPriv)))
        .addOutput({ to: flashLoanContract.address, amount: poolAmount + loanFee })
        .addOutput({ to: bobAddress, amount: bobChange })
        .send();

      const txOutputs = getTxOutputs(tx);

      // Pool is repaid with fee
      expect(txOutputs).toEqual(expect.arrayContaining([
        { to: flashLoanContract.address, amount: poolAmount + loanFee },
      ]));

      // Bob keeps his profit (starting funds - fee - miner fee)
      expect(txOutputs).toEqual(expect.arrayContaining([
        { to: bobAddress, amount: bobChange },
      ]));

      // Verify Bob's effective cost is only the loan fee + miner fee
      expect(bobChange).toBe(bobUtxo.satoshis - loanFee - minerFee);
    });
  });
});
