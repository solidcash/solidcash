import { compileString } from '../direct-compile.js';
import {
  Contract,
  FailedRequireError,
  randomUtxo,
  SignatureTemplate,
  TransactionBuilder,
} from '../../src/index.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { alicePriv, alicePub, bobPriv, bobPub } from '../fixture/vars.js';
import { assertApplicationScriptSize } from '../application-size-budgets.js';

describe('CustomModifier', () => {
  describe('single placeholder', () => {
    const CODE = `
      contract Guarded(pubkey owner, pubkey cosigner) {
          modifier onlyOwner(sig ownerSig) {
              require(checkSig(ownerSig, owner));
              _;
          }

          function spend(sig s, sig cs) onlyOwner(s) {
              require(checkSig(cs, cosigner));
          }
      }
    `;

    it('should compile', () => {
      const artifact = compileString(CODE);
      assertApplicationScriptSize('ownershipAccess', artifact);
    });

    it('should produce same bytecode as manually inlined modifier', () => {
      const withModifier = compileString(CODE);
      const inlined = compileString(`
        contract Guarded(pubkey owner, pubkey cosigner) {
            function spend(sig s, sig cs) {
                sig ownerSig = s;
                require(checkSig(ownerSig, owner));
                require(checkSig(cs, cosigner));
            }
        }
      `);

      expect(withModifier.bytecode).toBe(inlined.bytecode);
    });

    it('should execute successfully with valid signatures', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE);
      const contract = new Contract(artifact, [alicePub, bobPub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(
          new SignatureTemplate(alicePriv),
          new SignatureTemplate(bobPriv),
        ))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('multiple modifiers on one function', () => {
    const CODE = `
      contract MultiGuarded(pubkey owner, pubkey cosigner) {
          modifier onlyOwner(sig ownerSig) {
              require(checkSig(ownerSig, owner));
              _;
          }

          modifier onlyCosigner(sig cosignerSig) {
              require(checkSig(cosignerSig, cosigner));
              _;
          }

          function spend(sig s, sig cs) onlyOwner(s) onlyCosigner(cs) {
              require(true);
          }
      }
    `;

    it('should compile', () => {
      expect(() => compileString(CODE)).not.toThrow();
    });

    it('should produce same bytecode as manually inlined modifiers', () => {
      const withModifiers = compileString(CODE);
      const inlined = compileString(`
        contract MultiGuarded(pubkey owner, pubkey cosigner) {
            function spend(sig s, sig cs) {
                sig ownerSig = s;
                require(checkSig(ownerSig, owner));
                sig cosignerSig = cs;
                require(checkSig(cosignerSig, cosigner));
                require(true);
            }
        }
      `);

      expect(withModifiers.bytecode).toBe(inlined.bytecode);
    });

    it('should execute successfully', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE);
      const contract = new Contract(artifact, [alicePub, bobPub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(
          new SignatureTemplate(alicePriv),
          new SignatureTemplate(bobPriv),
        ))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('multiple placeholders', () => {
    const CODE = `
      contract DoubleCheck(pubkey owner) {
          modifier checkTwice {
              _;
              _;
          }

          function spend(sig s) checkTwice {
              require(checkSig(s, owner));
          }
      }
    `;

    it('should compile with two placeholders', () => {
      expect(() => compileString(CODE)).not.toThrow();
    });

    it('should produce same bytecode as manually duplicated body', () => {
      const withModifier = compileString(CODE);
      const inlined = compileString(`
        contract DoubleCheck(pubkey owner) {
            function spend(sig s) {
                require(checkSig(s, owner));
                require(checkSig(s, owner));
            }
        }
      `);

      expect(withModifier.bytecode).toBe(inlined.bytecode);
    });

    it('should execute successfully', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE);
      const contract = new Contract(artifact, [alicePub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(new SignatureTemplate(alicePriv)))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should fail when the require in the body fails', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE);
      // Use bob's key but contract expects alice's -> sig check fails
      const contract = new Contract(artifact, [bobPub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(new SignatureTemplate(alicePriv)))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('multiple placeholders with pre/post code', () => {
    const CODE_COMPILE = `
      contract PrePost(bytes20 pkh) {
          modifier wrapped {
              require(tx.time >= 1000);
              _;
              require(this.age >= 100);
              _;
          }

          function spend(pubkey pk, sig s) wrapped {
              require(hash160(pk) == pkh);
              require(checkSig(s, pk));
          }
      }
    `;

    const CODE_E2E = `
      contract PrePost(pubkey owner) {
          modifier wrapped(int minVal) {
              require(minVal >= 0);
              _;
              require(minVal < 10000);
              _;
          }

          function spend(sig s) wrapped(42) {
              require(checkSig(s, owner));
          }
      }
    `;

    it('should compile', () => {
      expect(() => compileString(CODE_COMPILE)).not.toThrow();
    });

    it('should produce same bytecode as manually inlined expansion', () => {
      const withModifier = compileString(CODE_COMPILE);
      const inlined = compileString(`
        contract PrePost(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
                require(tx.time >= 1000);
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
                require(this.age >= 100);
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
            }
        }
      `);

      expect(withModifier.bytecode).toBe(inlined.bytecode);
    });

    it('should execute successfully', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE_E2E);
      const contract = new Contract(artifact, [alicePub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(new SignatureTemplate(alicePriv)))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('triple placeholder with parameters', () => {
    const CODE_COMPILE = `
      contract TripleCheck(bytes20 pkh) {
          modifier checkThrice(int timeout) {
              require(tx.time >= timeout);
              _;
              require(this.age >= 100);
              _;
              require(tx.time >= timeout);
              _;
          }

          function spend(pubkey pk, sig s) checkThrice(1000) {
              require(hash160(pk) == pkh);
              require(checkSig(s, pk));
          }
      }
    `;

    const CODE_E2E = `
      contract TripleCheck(pubkey owner) {
          modifier checkThrice(int minVal) {
              require(minVal > 0);
              _;
              require(minVal < 10000);
              _;
              require(minVal > 0);
              _;
          }

          function spend(sig s) checkThrice(42) {
              require(checkSig(s, owner));
          }
      }
    `;

    it('should compile with three placeholders', () => {
      expect(() => compileString(CODE_COMPILE)).not.toThrow();
    });

    it('should produce same bytecode as manually inlined expansion', () => {
      const withModifier = compileString(CODE_COMPILE);
      const inlined = compileString(`
        contract TripleCheck(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
                int timeout = 1000;
                require(tx.time >= timeout);
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
                require(this.age >= 100);
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
                require(tx.time >= timeout);
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
            }
        }
      `);

      expect(withModifier.bytecode).toBe(inlined.bytecode);
    });

    it('should execute successfully', async () => {
      const provider = createTestProvider();
      const artifact = compileString(CODE_E2E);
      const contract = new Contract(artifact, [alicePub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(new SignatureTemplate(alicePriv)))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('compile-time enforcement', () => {
    it('should reject a modifier with zero placeholders', () => {
      const code = `
        contract Test(bytes20 pkh) {
            modifier noPlaceholder {
                require(this.age >= 100);
            }

            function spend(pubkey pk, sig s) noPlaceholder {
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
            }
        }
      `;

      expect(() => compileString(code)).toThrow(/at least one '_' placeholder/);
    });

    it('should reject use of an undefined modifier', () => {
      const code = `
        contract Test(pubkey owner) {
            function spend(sig s) nonexistent {
                require(checkSig(s, owner));
            }
        }
      `;

      expect(() => compileString(code)).toThrow(/Undefined modifier/);
    });
  });
});
