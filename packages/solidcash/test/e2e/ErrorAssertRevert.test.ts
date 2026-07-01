import { compileString } from 'solidc';
import { SignatureTemplate } from '../../src/index.js';
import { deployStateful } from '../test-util.js';
import { alicePriv, alicePub, bobPriv } from '../fixture/vars.js';

// --- Helpers -------------------------------------------------------------

// Compiled with { forceStateful: true } so each spend is the short `await sc.call.<fn>(args)` self-poke
// covenant (no dummy state, no manual UTXO gathering). Every contract here takes a single `pubkey owner`
// constructor arg (alicePub). A failing require/assert/revert surfaces as a raw OP_VERIFY Error on this
// path, so failure tests assert bare `.rejects.toThrow()` rather than a mapped SDK error class.
async function spend(source: string, fn: string, ...args: unknown[]): Promise<any> {
  const sc = await deployStateful(compileString(source, { forceStateful: true }), [alicePub]);
  return sc.call[fn](...args); // thenable: the caller awaits, which sends
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

      const artifact = compileString(code);

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

      const artifact = compileString(code);
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

      const tx = await spend(code, 'check', new SignatureTemplate(alicePriv), true);
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

      const txPromise = spend(code, 'check', new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow();
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

      const tx = await spend(code, 'check', new SignatureTemplate(alicePriv), 5n);
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

      const txPromise = spend(code, 'check', new SignatureTemplate(alicePriv), 0n);
      await expect(txPromise).rejects.toThrow();
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

      const txPromise = spend(code, 'fail', new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow();
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

      const txPromise = spend(code, 'fail', new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow();
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

      // amount > balance triggers revert
      const txPromise = spend(code, 'withdraw', new SignatureTemplate(alicePriv), 100n, 50n);
      await expect(txPromise).rejects.toThrow();
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

      // amount <= balance, revert is not reached
      const tx = await spend(code, 'withdraw', new SignatureTemplate(alicePriv), 30n, 50n);
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

      // allowed = false triggers revert
      const txPromise = spend(code, 'restricted', new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow();

      // allowed = true passes
      const tx = await spend(code, 'restricted', new SignatureTemplate(alicePriv), true);
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
      const tx = await spend(combinedCode, 'checkBalance', new SignatureTemplate(alicePriv), 10n, 100n);
      expect(tx.txid).toBeDefined();
    });

    it('checkBalance fails when amount > balance (revert)', async () => {
      const txPromise = spend(combinedCode, 'checkBalance', new SignatureTemplate(alicePriv), 100n, 10n);
      await expect(txPromise).rejects.toThrow();
    });

    it('checkBalance fails when amount <= 0 (assert)', async () => {
      const txPromise = spend(combinedCode, 'checkBalance', new SignatureTemplate(alicePriv), 0n, 100n);
      await expect(txPromise).rejects.toThrow();
    });

    it('checkBalance fails with wrong signature', async () => {
      const txPromise = spend(combinedCode, 'checkBalance', new SignatureTemplate(bobPriv), 10n, 100n);
      await expect(txPromise).rejects.toThrow();
    });

    it('failAlways always fails', async () => {
      const txPromise = spend(combinedCode, 'failAlways', new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow();
    });

    it('failEmpty always fails', async () => {
      const txPromise = spend(combinedCode, 'failEmpty', new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow();
    });

    it('simpleAssert(true) succeeds', async () => {
      const tx = await spend(combinedCode, 'simpleAssert', new SignatureTemplate(alicePriv), true);
      expect(tx.txid).toBeDefined();
    });

    it('simpleAssert(false) fails', async () => {
      const txPromise = spend(combinedCode, 'simpleAssert', new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow();
    });

    it('artifact has all error declarations', () => {
      const artifact = compileString(combinedCode);

      expect(artifact.errors).toBeDefined();
      expect(artifact.errors).toHaveLength(3);
      expect(artifact.errors!.map((e) => e.name)).toEqual([
        'InsufficientBalance', 'Unauthorized', 'ContractError',
      ]);
    });
  });
});
