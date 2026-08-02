import { compileString } from '../direct-compile.js';
import { SignatureTemplate, getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
import { alicePriv, alicePub, bobPriv } from '../fixture/vars.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
const nullFail = 'layer3: BCH-2026 preflight failed at input 0: Program failed a signature verification '
  + 'with a non-null signature (violating the "NULLFAIL" rule). Algorithm used: Schnorr.';

// Each test compiles its inline source with { forceStateful: true } and deploys directly, so the spend is
// the short `await sc.<fn>(args)` self-poke covenant (no dummy state, no manual UTXO gathering). Every
// contract here takes a single `pubkey owner` constructor arg (alicePub). A failing require/assert/revert
// surfaces at the BCH-2026 preflight boundary on this path, so failure tests name OP_VERIFY or signature
// NULLFAIL rather than relying on an SDK error class.

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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const tx = await sc.check(new SignatureTemplate(alicePriv), true);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.check(new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow(verifyFailure);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const tx = await sc.check(new SignatureTemplate(alicePriv), 5n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.check(new SignatureTemplate(alicePriv), 0n);
      await expect(txPromise).rejects.toThrow(verifyFailure);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.fail(new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow(verifyFailure);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.fail(new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow(verifyFailure);
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
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.withdraw(new SignatureTemplate(alicePriv), 100n, 50n);
      await expect(txPromise).rejects.toThrow(verifyFailure);
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
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const tx = await sc.withdraw(new SignatureTemplate(alicePriv), 30n, 50n);
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
      const factoryDenied = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const scDenied = await factoryDenied.deploy(alicePub);
      const txPromise = scDenied.restricted(new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow(verifyFailure);

      // allowed = true passes
      const factoryAllowed = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const scAllowed = await factoryAllowed.deploy(alicePub);
      const tx = await scAllowed.restricted(new SignatureTemplate(alicePriv), true);
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
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const tx = await sc.checkBalance(new SignatureTemplate(alicePriv), 10n, 100n);
      expect(tx.txid).toBeDefined();
    });

    it('checkBalance fails when amount > balance (revert)', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.checkBalance(new SignatureTemplate(alicePriv), 100n, 10n);
      await expect(txPromise).rejects.toThrow(verifyFailure);
    });

    it('checkBalance fails when amount <= 0 (assert)', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.checkBalance(new SignatureTemplate(alicePriv), 0n, 100n);
      await expect(txPromise).rejects.toThrow(verifyFailure);
    });

    it('checkBalance fails with wrong signature', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.checkBalance(new SignatureTemplate(bobPriv), 10n, 100n);
      await expect(txPromise).rejects.toThrow(nullFail);
    });

    it('failAlways always fails', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.failAlways(new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow(verifyFailure);
    });

    it('failEmpty always fails', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.failEmpty(new SignatureTemplate(alicePriv));
      await expect(txPromise).rejects.toThrow(verifyFailure);
    });

    it('simpleAssert(true) succeeds', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const tx = await sc.simpleAssert(new SignatureTemplate(alicePriv), true);
      expect(tx.txid).toBeDefined();
    });

    it('simpleAssert(false) fails', async () => {
      const factory = getContractFactory(compileString(combinedCode, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy(alicePub);
      const txPromise = sc.simpleAssert(new SignatureTemplate(alicePriv), false);
      await expect(txPromise).rejects.toThrow(verifyFailure);
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
