import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, TransactionBuilder, SignatureTemplate,
  StatefulContract, FailedRequireError,
  getDataNftAddress,
} from '../../src/index.js';
import { buildInitialStateCommitments, parsePushdataCommitment } from '@solidcash/utils';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos, getTxOutputs } from '../test-util.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';

// --- Helpers ----------------------------------------------------------------

function setupContract(source: string, constructorArgs: any[] = []): {
  provider: MockNetworkProvider;
  contract: Contract;
} {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract };
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

// --- Tests ------------------------------------------------------------------

describe('Delete Keyword', () => {
  // --- delete local variable ------------------------------------------------

  describe('delete local variable', () => {
    it('should reset int to 0', async () => {
      const source = `
        contract DeleteInt() {
            function test(int val) {
                int x = val;
                delete x;
                require(x == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(42n));
      expect(tx.txid).toBeDefined();
    });

    it('should reset bool to false', async () => {
      const source = `
        contract DeleteBool() {
            function test(bool val) {
                bool b = val;
                delete b;
                require(b == false);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(true));
      expect(tx.txid).toBeDefined();
    });

    it('should reset bytes to empty', async () => {
      const source = `
        contract DeleteBytes() {
            function test(bytes val) {
                bytes data = val;
                delete data;
                require(data == 0x);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(
        provider, contract, contract.unlock.test(hexToBin('deadbeef')),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should reset string to empty', async () => {
      const source = `
        contract DeleteString() {
            function test(string val) {
                string s = val;
                delete s;
                require(s == "");
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('hello'));
      expect(tx.txid).toBeDefined();
    });

    it('should reset flat struct fields to defaults', async () => {
      const source = `
        contract DeleteStruct() {
            struct Point { int x; int y; }
            function test() {
                Point p = Point(10, 20);
                delete p;
                require(p.x == 0);
                require(p.y == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should reset nested struct fields recursively', async () => {
      const source = `
        contract DeleteNestedStruct() {
            struct Inner { int a; int b; }
            struct Outer { Inner inner; int z; }
            function test() {
                Outer o = Outer(Inner(1, 2), 3);
                delete o;
                require(o.inner.a == 0);
                require(o.inner.b == 0);
                require(o.z == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should reset deeply nested struct (3 levels)', async () => {
      const source = `
        contract DeleteDeepNested() {
            struct A { int val; }
            struct B { A a; int mid; }
            struct C { B b; int top; }
            function test() {
                C c = C(B(A(99), 50), 25);
                delete c;
                require(c.b.a.val == 0);
                require(c.b.mid == 0);
                require(c.top == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should reset struct with mixed field types', async () => {
      const source = `
        contract DeleteMixedStruct() {
            struct Record { int id; bool active; bytes4 tag; }
            function test() {
                Record r = Record(42, true, 0xdeadbeef);
                delete r;
                require(r.id == 0);
                require(r.active == false);
                require(r.tag == 0x00000000);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should fail require after delete with wrong comparison', async () => {
      const source = `
        contract DeleteFail() {
            function test(int val) {
                int x = val;
                delete x;
                require(x == 42);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test(42n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- delete state variable ------------------------------------------------

  describe('delete state variable', () => {
    const DELETE_STATE_CONTRACT = `
      pragma solidcash >=0.8.0;

      contract DeleteState() {
          int counter;
          bool flag;

          function setValues(int newCounter, bool newFlag) {
              this.counter = newCounter;
              this.flag = newFlag;
          }

          function resetCounter() {
              delete this.counter;
          }

          function resetFlag() {
              delete this.flag;
          }

          function resetBoth() {
              delete this.counter;
              delete this.flag;
          }

          function authorize(pubkey pk, sig s) unsafe {
              require(checkSig(s, pk));
          }
      }
    `;

    const provider = createTestProvider();
    const artifact = compileString(DELETE_STATE_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;
    const categoryId = 'cccd'.repeat(16);
    // StatefulContract.withCategory() auto-salts with categoryId, so use the salted contract's addresses
    const saltedContract = contract.withSalt(hexToBin(categoryId));
    const dataNftAddress = getDataNftAddress(saltedContract, categoryId);

    const initialCommitments = buildInitialStateCommitments(stateLayout, {
      counter: 5n, flag: true,
    });

    const masterUtxo: Utxo = {
      txid: 'ddcd'.repeat(16), vout: 0, satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'ddcd'.repeat(16), vout: 1, satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
    });

    it('should read initial state', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const state = await sc.getState();
      expect(state.counter).toBe(5n);
      expect(state.flag).toBe(true);
    });

    it('should reset counter to 0 via delete this.counter', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.resetCounter()
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.counter).toBe(0n);
      expect(parsedState.flag).toBe(true);
    });

    it('should reset flag to false via delete this.flag', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.resetFlag()
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.counter).toBe(0n);
      expect(parsedState.flag).toBe(false);
    });

    it('should reset both state variables at once', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.resetBoth()
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.counter).toBe(0n);
      expect(parsedState.flag).toBe(false);
    });
  });

  // --- delete struct state variable ------------------------------------------

  describe('delete struct state variable', () => {
    const STRUCT_STATE_CONTRACT = `
      pragma solidcash >=0.8.0;

      contract DeleteStructState() {
          struct Point { int x; int y; }
          Point point;

          function setPoint(int x, int y) {
              this.point = Point(x, y);
          }

          function resetPoint() {
              delete this.point;
          }

          function authorize(pubkey pk, sig s) unsafe {
              require(checkSig(s, pk));
          }
      }
    `;

    it('should reset struct state to default values', async () => {
      const provider = createTestProvider();
      const artifact = compileString(STRUCT_STATE_CONTRACT);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const categoryId = 'abcd'.repeat(16);
      const saltedContract = contract.withSalt(hexToBin(categoryId));
      const dataNftAddress = getDataNftAddress(saltedContract, categoryId);

      const initialCommitments = buildInitialStateCommitments(stateLayout, {
        point: { x: 10n, y: 20n },
      });

      const masterUtxo: Utxo = {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      };
      const dataNftUtxo: Utxo = {
        txid: 'aacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: initialCommitments[0] },
        },
      };

      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);

      const sc = StatefulContract.withCategory(contract, categoryId);
      const state = await sc.getState();
      expect(state.point).toEqual({ x: 10n, y: 20n });

      const tx = await sc.resetPoint()
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.point).toEqual({ x: 0n, y: 0n });
    });

    it('should reset nested struct state to default values', async () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract DeleteNestedState() {
            struct Inner { int a; int b; }
            struct Outer { Inner inner; int z; }
            Outer data;

            function setData(int a, int b, int z) {
                this.data = Outer(Inner(a, b), z);
            }

            function resetData() {
                delete this.data;
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;

      const provider = createTestProvider();
      const artifact = compileString(source);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const categoryId = 'bacd'.repeat(16);
      const saltedContract = contract.withSalt(hexToBin(categoryId));
      const dataNftAddress = getDataNftAddress(saltedContract, categoryId);

      const initialCommitments = buildInitialStateCommitments(stateLayout, {
        data: { inner: { a: 5n, b: 10n }, z: 15n },
      });

      const masterUtxo: Utxo = {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      };
      const dataNftUtxo: Utxo = {
        txid: 'bbcd'.repeat(16), vout: 1, satoshis: 10000n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: initialCommitments[0] },
        },
      };

      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);

      const sc = StatefulContract.withCategory(contract, categoryId);
      const state = await sc.getState();
      expect(state.data).toEqual({ inner: { a: 5n, b: 10n }, z: 15n });

      const tx = await sc.resetData()
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, stateLayout, 0,
      );
      expect(parsedState.data).toEqual({ inner: { a: 0n, b: 0n }, z: 0n });
    });
  });

  // --- delete this.mapping[key] ---------------------------------------------

  describe('delete this.mapping[key] syntax', () => {
    it('should compile delete mapping entry as alternative to .delete()', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract DeleteMapping() {
            int counter;
            mapping(bytes20 => int) balances;

            function removeEntry(bytes20 key) {
                delete this.balances[key];
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();

      // Verify the ABI has the function
      const fn = artifact.abi.find((f: any) => f.name === 'removeEntry');
      expect(fn).toBeDefined();
    });

    it('should produce same bytecode as .delete() syntax', () => {
      const sourceDelete = `
        pragma solidcash >=0.8.0;

        contract DeleteSyntax() {
            int counter;
            mapping(bytes20 => int) balances;

            function remove(bytes20 key) {
                delete this.balances[key];
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const sourceDotDelete = `
        pragma solidcash >=0.8.0;

        contract DotDeleteSyntax() {
            int counter;
            mapping(bytes20 => int) balances;

            function remove(bytes20 key) {
                this.balances.delete(key);
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;

      const artifactDelete = compileString(sourceDelete);
      const artifactDotDelete = compileString(sourceDotDelete);

      // Both should produce the same bytecode for the remove function
      expect(artifactDelete.bytecode).toBe(artifactDotDelete.bytecode);
    });
  });

  // --- delete mapping entry output structure (e2e) --------------------------

  describe('delete mapping entry removes UTXO from outputs', () => {
    const MAPPING_DELETE_CONTRACT = `
      pragma solidcash >=0.8.0;

      contract MappingDelete() {
          int counter;
          mapping(bytes20 => int) balances;

          function setBalance(bytes20 key, int amount) {
              this.balances[key] = amount;
              this.counter = this.counter + 1;
          }

          function removeBalance(bytes20 key) {
              delete this.balances[key];
              this.counter = this.counter - 1;
          }

          function authorize(pubkey pk, sig s) unsafe {
              require(checkSig(s, pk));
          }
      }
    `;

    const provider = createTestProvider();
    const deleteArtifact = compileString(MAPPING_DELETE_CONTRACT);
    const p2pkh = new Contract(
      compileString(`
        contract P2PKH(bytes20 pkh) {
            function spend(pubkey pk, sig s) {
                require(hash160(pk) == pkh);
                require(checkSig(s, pk));
            }
        }
      `),
      [alicePkh],
      { provider },
    );

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy and add a mapping entry', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(deleteArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
      expect(categoryId).toBe(fundingUtxo.txid);

      // Add an entry
      const tx = await deployedContract.call
        .setBalance(alicePkh, 100n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Should have: master, data NFT, entry NFT (new)
      const entryOutputs = txOutputs.filter(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
      );
      // data NFT + entry NFT = 2 mutable NFTs
      expect(entryOutputs.length).toBe(2);
    });

    it('should remove the entry NFT from outputs when deleting', async () => {
      // Now delete the entry
      const tx = await deployedContract.call
        .removeBalance(alicePkh)
        .deleteEntry(0)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // After deletion, there should be no entry NFT in outputs
      // Only master (minting) and data NFT (mutable) should remain
      const mutableNfts = txOutputs.filter(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
      );
      // Only 1 mutable NFT: the data NFT (entry was deleted)
      expect(mutableNfts.length).toBe(1);

      // Master should still exist
      const masterOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'minting' && o.token?.category === categoryId,
      );
      expect(masterOutput).toBeDefined();

      // Verify counter decremented
      const parsed = parsePushdataCommitment(
        mutableNfts[0].token!.nft!.commitment, deleteArtifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(0n);
    });
  });

  // --- compilation verification ---------------------------------------------

  describe('compilation verification', () => {
    it('delete int variable produces OP_0', () => {
      const source = `
        contract DeleteIntBytecode() {
            function test(int x) {
                delete x;
                require(x == 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toContain('OP_0');
    });

    it('delete state variable compiles', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract DeleteStateBytecode() {
            int counter;

            function reset() {
                delete this.counter;
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });

    it('delete mapping entry compiles', () => {
      const source = `
        pragma solidcash >=0.8.0;

        contract DeleteMappingBytecode() {
            int counter;
            mapping(bytes20 => int) data;

            function remove(bytes20 key) {
                delete this.data[key];
            }

            function authorize(pubkey pk, sig s) unsafe {
                require(checkSig(s, pk));
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });
  });
});
