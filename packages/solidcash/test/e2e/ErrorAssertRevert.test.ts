import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
  FailedTransactionError, SignatureTemplate,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import {
  alicePriv, alicePub,
  bobPriv,
} from '../fixture/vars.js';

// --- Helpers -------------------------------------------------------------

function setupContract(source: string, constructorArgs: any[] = []): {
  provider: MockNetworkProvider;
  contract: Contract;
  artifact: ReturnType<typeof compileString>;
} {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract, artifact };
}

async function addUtxos(provider: MockNetworkProvider, address: string, count: number = 2): void {
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(address, randomUtxo({ satoshis: 10000n }));
  }
}

async function sendTx(
  provider: MockNetworkProvider,
  contract: Contract,
  unlocker: ReturnType<Contract['unlock'][string]>,
): Promise<any> {
  const to = contract.address;
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount })
    .send();
}

// --- Tests ---------------------------------------------------------------

describe('Error, Assert, and Revert - SDK e2e', () => {
  // =======================================================================
  // Artifact metadata
  // =======================================================================

  describe('Artifact metadata', () => {
    it('error declarations appear in artifact errors array', () => {
      const code = `
        error InsufficientBalance(bigint requested, bigint available);
        error Unauthorized();
        contract Test(pubkey owner) {
          error ContractError(bytes32 id);
          function spend(sig s) {
            require(checkSig(s, owner));
          }
        }
      `;

      const { artifact } = setupContract(code, [alicePub]);

      expect(artifact.errors).toBeDefined();
      expect(artifact.errors).toHaveLength(3);

      expect(artifact.errors![0]).toEqual({
        name: 'InsufficientBalance',
        signature: 'InsufficientBalance(bigint,bigint)',
        parameters: [
          { name: 'requested', type: 'bigint' },
          { name: 'available', type: 'bigint' },
        ],
      });

      expect(artifact.errors![1]).toEqual({
        name: 'Unauthorized',
        signature: 'Unauthorized()',
        parameters: [],
      });

      expect(artifact.errors![2]).toEqual({
        name: 'ContractError',
        signature: 'ContractError(bytes32)',
        parameters: [
          { name: 'id', type: 'bytes32' },
        ],
      });
    });

    it('contract with no errors has no errors field', () => {
      const code = `
        contract Test(pubkey owner) {
          function spend(sig s) {
            require(checkSig(s, owner));
          }
        }
      `;

      const { artifact } = setupContract(code, [alicePub]);
      expect(artifact.errors).toBeUndefined();
    });
  });

  // =======================================================================
  // assert()
  // =======================================================================

  describe('assert()', () => {
    it('assert(true) succeeds', async () => {
      const code = `
        contract Test(pubkey owner) {
          function check(sig s, bool condition) {
            require(checkSig(s, owner));
            assert(condition);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(
        provider, contract,
        contract.unlock.check(new SignatureTemplate(alicePriv), true),
      );
      expect(tx.txid).toBeDefined();
    });

    it('assert(false) fails', async () => {
      const code = `
        contract Test(pubkey owner) {
          function check(sig s, bool condition) {
            require(checkSig(s, owner));
            assert(condition);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.check(new SignatureTemplate(alicePriv), false),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('assert with expression: assert(x > 0) succeeds for positive', async () => {
      const code = `
        contract Test(pubkey owner) {
          function check(sig s, bigint x) {
            require(checkSig(s, owner));
            assert(x > 0);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(
        provider, contract,
        contract.unlock.check(new SignatureTemplate(alicePriv), 5n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('assert with expression: assert(x > 0) fails for zero', async () => {
      const code = `
        contract Test(pubkey owner) {
          function check(sig s, bigint x) {
            require(checkSig(s, owner));
            assert(x > 0);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.check(new SignatureTemplate(alicePriv), 0n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // revert()
  // =======================================================================

  describe('revert()', () => {
    it('revert() always fails', async () => {
      const code = `
        contract Test(pubkey owner) {
          function fail(sig s) {
            require(checkSig(s, owner));
            revert();
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.fail(new SignatureTemplate(alicePriv)),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('revert("message") always fails', async () => {
      const code = `
        contract Test(pubkey owner) {
          function fail(sig s) {
            require(checkSig(s, owner));
            revert("Not implemented");
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.fail(new SignatureTemplate(alicePriv)),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('revert CustomError(args) always fails', async () => {
      const code = `
        error InsufficientBalance(bigint requested, bigint available);
        contract Test(pubkey owner) {
          function withdraw(sig s, bigint amount, bigint balance) {
            require(checkSig(s, owner));
            if (amount > balance) {
              revert InsufficientBalance(amount, balance);
            }
            require(balance - amount >= 0);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      // amount > balance triggers revert
      const txPromise = sendTx(
        provider, contract,
        contract.unlock.withdraw(new SignatureTemplate(alicePriv), 100n, 50n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('revert CustomError: succeeds when revert is not reached', async () => {
      const code = `
        error InsufficientBalance(bigint requested, bigint available);
        contract Test(pubkey owner) {
          function withdraw(sig s, bigint amount, bigint balance) {
            require(checkSig(s, owner));
            if (amount > balance) {
              revert InsufficientBalance(amount, balance);
            }
            require(balance - amount >= 0);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address);

      // amount <= balance, revert is not reached
      const tx = await sendTx(
        provider, contract,
        contract.unlock.withdraw(new SignatureTemplate(alicePriv), 30n, 50n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('revert with contract-level error', async () => {
      const code = `
        contract Test(pubkey owner) {
          error AccessDenied();
          function restricted(sig s, bool allowed) {
            require(checkSig(s, owner));
            if (!allowed) {
              revert AccessDenied();
            }
            require(true);
          }
        }
      `;

      const { provider, contract } = setupContract(code, [alicePub]);
      await addUtxos(provider, contract.address, 4);

      // allowed = false triggers revert
      const txPromise = sendTx(
        provider, contract,
        contract.unlock.restricted(new SignatureTemplate(alicePriv), false),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);

      // allowed = true passes
      const tx = await sendTx(
        provider, contract,
        contract.unlock.restricted(new SignatureTemplate(alicePriv), true),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Combined usage
  // =======================================================================

  describe('Combined error/assert/revert', () => {
    const combinedCode = `
      error InsufficientBalance(bigint requested, bigint available);
      error Unauthorized();
      contract Combined(pubkey owner) {
        error ContractError(bytes32 id);

        function checkBalance(sig s, bigint amount, bigint balance) {
          require(checkSig(s, owner));
          assert(amount > 0);
          if (amount > balance) {
            revert InsufficientBalance(amount, balance);
          }
          require(balance - amount >= 0);
        }

        function failAlways(sig s) {
          require(checkSig(s, owner));
          revert("Not implemented");
        }

        function failEmpty(sig s) {
          require(checkSig(s, owner));
          revert();
        }

        function simpleAssert(sig s, bool condition) {
          require(checkSig(s, owner));
          assert(condition);
        }
      }
    `;

    it('checkBalance succeeds when amount <= balance', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(
        provider, contract,
        contract.unlock.checkBalance(new SignatureTemplate(alicePriv), 10n, 100n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('checkBalance fails when amount > balance (revert)', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.checkBalance(new SignatureTemplate(alicePriv), 100n, 10n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('checkBalance fails when amount <= 0 (assert)', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.checkBalance(new SignatureTemplate(alicePriv), 0n, 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('checkBalance fails with wrong signature', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.checkBalance(new SignatureTemplate(bobPriv), 10n, 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('failAlways always fails', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.failAlways(new SignatureTemplate(alicePriv)),
      );
      // In multi-function contracts, revert as the final statement may go through
      // the implicit final verify path, resulting in FailedTransactionEvaluationError
      await expect(txPromise).rejects.toThrow(FailedTransactionError);
    });

    it('failEmpty always fails', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.failEmpty(new SignatureTemplate(alicePriv)),
      );
      await expect(txPromise).rejects.toThrow(FailedTransactionError);
    });

    it('simpleAssert(true) succeeds', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(
        provider, contract,
        contract.unlock.simpleAssert(new SignatureTemplate(alicePriv), true),
      );
      expect(tx.txid).toBeDefined();
    });

    it('simpleAssert(false) fails', async () => {
      const { provider, contract } = setupContract(combinedCode, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.simpleAssert(new SignatureTemplate(alicePriv), false),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('artifact has all error declarations', () => {
      const { artifact } = setupContract(combinedCode, [alicePub]);

      expect(artifact.errors).toBeDefined();
      expect(artifact.errors).toHaveLength(3);
      expect(artifact.errors!.map((e) => e.name)).toEqual([
        'InsufficientBalance', 'Unauthorized', 'ContractError',
      ]);
    });
  });
});
