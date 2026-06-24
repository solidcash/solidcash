import { compileString } from 'solidc';
import {
  Contract, StatefulTransactionBuilder, StatefulContract,
  StateReader,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

// A stateful contract with an immutable state variable:
//   bigint immutable maxValue   - can only be assigned in constructor
// Constructor sets maxValue to 100.
// Function check() reads maxValue and enforces the constraint.
const IMMUTABLE_CONTRACT = `
pragma solidcash >=0.8.0;

contract ImmutableTest() {
    bigint immutable maxValue;

    constructor() {
        this.maxValue = 100;
    }

    function check(bigint amount) {
        require(amount <= this.maxValue);
    }
}
`;

// Equivalent contract without immutable for bytecode comparison
const MUTABLE_CONTRACT = `
pragma solidcash >=0.8.0;

contract MutableTest() {
    bigint maxValue;

    constructor() {
        this.maxValue = 100;
    }

    function check(bigint amount) {
        require(amount <= this.maxValue);
    }
}
`;

describe('ImmutableModifier', () => {
  describe('artifact', () => {
    it('should compile a contract with immutable state variable', () => {
      expect(() => compileString(IMMUTABLE_CONTRACT)).not.toThrow();
    });

    it('should mark immutable state variable in stateLayout', () => {
      const artifact = compileString(IMMUTABLE_CONTRACT);
      expect(artifact.stateLayout).toBeDefined();
      const stateLayout = artifact.stateLayout!;

      expect(stateLayout.variables).toHaveLength(1);
      expect(stateLayout.variables[0].name).toBe('maxValue');
      expect(stateLayout.variables[0].type).toBe('bigint');
      expect(stateLayout.variables[0].nftIndex).toBe(0);
      expect(stateLayout.variables[0].fieldIndex).toBe(0);
      expect(stateLayout.variables[0].immutable).toBe(true);
    });

    it('should not mark non-immutable state variable as immutable', () => {
      const artifact = compileString(MUTABLE_CONTRACT);
      const stateLayout = artifact.stateLayout!;

      expect(stateLayout.variables[0].name).toBe('maxValue');
      expect(stateLayout.variables[0].immutable).toBeUndefined();
    });

    it('should have constructorInputs in stateLayout', () => {
      const artifact = compileString(IMMUTABLE_CONTRACT);
      const stateLayout = artifact.stateLayout!;
      expect(stateLayout.constructorInputs).toBeDefined();
    });

    it('immutable modifier should not affect compiled bytecode', () => {
      const withImmutable = compileString(IMMUTABLE_CONTRACT);
      const withoutImmutable = compileString(MUTABLE_CONTRACT);

      // The bytecode should be identical - immutable is a compile-time check only
      expect(withImmutable.bytecode).toBe(withoutImmutable.bytecode);
    });

    it('immutable on parameters should not affect bytecode', () => {
      const withMod = compileString(`
        contract Test(pubkey owner) {
            function spend(sig s, bigint immutable amount) {
                require(checkSig(s, owner));
                require(amount > 0);
            }
        }
      `);

      const withoutMod = compileString(`
        contract Test(pubkey owner) {
            function spend(sig s, bigint amount) {
                require(checkSig(s, owner));
                require(amount > 0);
            }
        }
      `);

      expect(withMod.bytecode).toBe(withoutMod.bytecode);
    });

    it('immutable on local variables should not affect bytecode', () => {
      const withMod = compileString(`
        contract Test() {
            function run(bigint x) {
                bigint immutable y = x + 1;
                require(y > 0);
            }
        }
      `);

      const withoutMod = compileString(`
        contract Test() {
            function run(bigint x) {
                bigint y = x + 1;
                require(y > 0);
            }
        }
      `);

      expect(withMod.bytecode).toBe(withoutMod.bytecode);
    });
  });

  describe('e2e', () => {
    const provider = createTestProvider();
    const artifact = compileString(IMMUTABLE_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    // Build initial state: maxValue=100
    const initialCommitments = buildInitialStateCommitments(stateLayout, { maxValue: 100n });

    // Populated by real genesis in beforeAll (category == genesis txid, can't be hardcoded).
    let categoryId: string;
    let dataNftAddress: string;
    let masterUtxo: Utxo;
    let dataNftUtxo: Utxo;

    beforeAll(async () => {
      const { categoryId: cat, utxos } = await (provider as any).addTokenUtxosDynamic((c: string) => [
        { address: contract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(contract, c), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } } },
      ]);
      categoryId = cat;
      dataNftAddress = getDataNftAddress(contract, cat);
      [masterUtxo, dataNftUtxo] = utxos;
    });

    it('should read initial state with immutable variable', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo]);
      expect(state.maxValue).toBe(100n);
    });

    it('should read state from chain via StateReader', async () => {
      const reader = new StateReader(stateLayout);
      const result = await reader.readStateFromChain(
        provider,
        categoryId,
        [contract.tokenAddress, dataNftAddress],
      );

      expect(result.masterUtxo).toBeDefined();
      expect(result.dataNftUtxos).toHaveLength(1);
      expect(result.state.maxValue).toBe(100n);
    });

    it('should succeed calling check() with amount <= maxValue (manual STB)', async () => {
      // check(50): amount=50 <= maxValue=100 passes
      // This is a read-only function - no state writes, just reads immutable state
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: { ...masterUtxo, unlocker: contract.unlock.check(50n) },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: createDataNftUnlocker(contract, 0, categoryId) }],
      })
        .setState('maxValue', 100n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify master UTXO preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Verify data NFT commitment preserved (immutable state unchanged)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(categoryId);
      expect(txOutputs[1].token?.nft?.commitment).toBe(initialCommitments[0]);

      // Parse state - maxValue should still be 100
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.maxValue).toBe(100n);
    });

    it('should auto-derive immutable state via convenience API', async () => {
      // Use separate provider so UTXOs are fresh (manual STB test above consumed the shared ones)
      const autoProvider = createTestProvider();
      const autoContract = new Contract(artifact, [], { provider: autoProvider });
      // Real genesis at the salted addresses StatefulContract.withCategory expects.
      const { categoryId: autoCategoryId } = await setupStatefulUtxos(
        autoProvider, autoContract, stateLayout, { maxValue: 100n }, { saltContract: true },
      );

      // Auto-derivation for read-only/immutable functions: the convenience API
      // auto-derives output state by preserving current on-chain commitments.
      // No manual .setState() needed.
      const sc = StatefulContract.withCategory(autoContract, autoCategoryId);
      const tx = await sc.check(50n).send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify master UTXO preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(autoCategoryId);

      // Verify data NFT commitment preserved (immutable state unchanged)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(autoCategoryId);
      expect(txOutputs[1].token?.nft?.commitment).toBe(initialCommitments[0]);

      // Parse state - maxValue should still be 100
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.maxValue).toBe(100n);
    });

    // Note: MockNetworkProvider does not fully validate covenant-based state access
    // (OP_UTXOTOKENCOMMITMENT reads from data NFT inputs), so require() failures
    // that depend on reading immutable state cannot be tested with the mock provider.
    // Such validation is enforced at the node level on-chain.
  });

  describe('compile-time enforcement', () => {
    it('should reject assignment to immutable state variable outside constructor', () => {
      const code = `
        contract Bad() {
            bigint immutable maxValue;

            constructor() {
                this.maxValue = 100;
            }

            function update(bigint newMax) {
                this.maxValue = newMax;
                require(newMax > 0);
            }
        }
      `;

      expect(() => compileString(code)).toThrow(/Cannot assign to immutable state variable/);
    });

    it('should allow assignment to immutable state variable inside constructor', () => {
      const code = `
        contract Good() {
            bigint immutable maxValue;

            constructor() {
                this.maxValue = 100;
            }

            function check(bigint amount) {
                require(amount <= this.maxValue);
            }
        }
      `;

      expect(() => compileString(code)).not.toThrow();
    });

    it('should allow multiple immutable state variables', () => {
      const code = `
        contract MultiImmutable() {
            bigint immutable x;
            bigint immutable y;

            constructor() {
                this.x = 10;
                this.y = 20;
            }

            function check(bigint val) {
                require(val >= this.x);
                require(val <= this.y);
            }
        }
      `;

      const artifact = compileString(code);
      const stateLayout = artifact.stateLayout!;
      expect(stateLayout.variables).toHaveLength(2);
      expect(stateLayout.variables[0].immutable).toBe(true);
      expect(stateLayout.variables[1].immutable).toBe(true);
    });
  });
});
