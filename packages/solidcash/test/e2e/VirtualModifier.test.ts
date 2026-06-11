import { compileString } from 'solidc';
import {
  Contract, TransactionBuilder, SignatureTemplate,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { alicePriv, alicePub } from '../fixture/vars.js';

describe('VirtualModifier', () => {
  describe('artifact', () => {
    it('should compile with virtual modifier', () => {
      const code = `
        contract Test(pubkey owner) {
            function spend(sig s) virtual {
                require(checkSig(s, owner));
            }
        }
      `;

      expect(() => compileString(code)).not.toThrow();
    });

    it('virtual modifier should not affect the compiled bytecode', () => {
      const withVirtual = compileString(`
        contract Test(pubkey owner) {
            function spend(sig s) virtual {
                require(checkSig(s, owner));
            }
        }
      `);

      const withoutVirtual = compileString(`
        contract Test(pubkey owner) {
            function spend(sig s) {
                require(checkSig(s, owner));
            }
        }
      `);

      expect(withVirtual.bytecode).toBe(withoutVirtual.bytecode);
    });

    it('should support virtual combined with other modifiers', () => {
      const code = `
        contract Test(pubkey owner) {
            function helper(int a, int b) internal pure virtual returns (int) {
                return a + b;
            }
            function spend(sig s, int x) {
                require(checkSig(s, owner));
                require(helper(x, 1) > 0);
            }
        }
      `;

      expect(() => compileString(code)).not.toThrow();
    });

    it('virtual + override should both be accepted', () => {
      // In Solidity, a function can be both virtual and override
      // (overrides parent but can also be overridden by children)
      const code = `
        contract Test(pubkey owner) {
            function spend(sig s) virtual override {
                require(checkSig(s, owner));
            }
        }
      `;

      expect(() => compileString(code)).not.toThrow();
    });
  });

  describe('e2e', () => {
    it('should execute correctly with virtual modifier', async () => {
      const provider = createTestProvider();
      const artifact = compileString(`
        contract Test(pubkey owner) {
            function spend(sig s) virtual {
                require(checkSig(s, owner));
            }
        }
      `);
      const contract = new Contract(artifact, [alicePub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.spend(new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });
});
