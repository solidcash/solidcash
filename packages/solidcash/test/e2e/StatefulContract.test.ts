import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, TransactionBuilder,
  StateReader, SignatureTemplate, StatefulContract,
  StatefulTransactionBuilder,
  getDataNftAddress, createDataNftUnlocker, getContractState,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, buildPushdataCommitment, parsePushdataCommitment,
  buildDataNftCovenantBytecode,
} from '@solidcash/utils';
import {
  alicePkh,
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, createFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { Utxo, TokenDetails } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A stateful contract with two state variables of different types:
//   bigint counter   - incremented each call
//   bytes4 label  - set to caller-supplied value each call
// Two functions:
//   update:    reads/writes both state variables (auto-covenant enforced)
//   authorize: simple P2PKH-like spend for data NFT inputs (no state access)
const COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

contract Counter() {
    bigint counter;
    bytes4 label;

    function update(bytes4 newLabel) {
        this.counter = this.counter + 1;
        this.label = newLabel;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// A stateful contract with sig-authenticated state writes:
//   bigint counter   - incremented only by authorized signers
// Function increment: requires signature check, then writes state (tests sig-arg auto-derivation)
// Function readCounter: read-only, no state writes (tests immutable/read-only auto-derivation)
const AUTH_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

contract AuthCounter(pubkey owner) {
    bigint counter;

    function increment(sig s) {
        require(checkSig(s, owner));
        this.counter = this.counter + 1;
    }

    function readCounter() {
        require(this.counter >= 0);
    }
}
`;

describe('Stateful Contract', () => {
  const provider = createTestProvider();
  const artifact = compileString(COUNTER_CONTRACT);
  const contract = new Contract(artifact, [], { provider });
  const stateLayout = artifact.stateLayout!;

  // P2PKH contract instance for alice (used for funding/change)
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  // Initial label: 4 zero bytes
  const zeroLabel = new Uint8Array(4);

  // Helper: build a commitment for both fields given counter and label values
  function makeCommitment(counter: bigint, label: Uint8Array): string {
    return buildPushdataCommitment(stateLayout, { counter, label }, 0);
  }

  // Category and UTXOs - set in beforeAll (regtest creates real genesis)
  let categoryId: string;
  let dataNftAddress: string;
  let initialCommitments: string[];
  let masterUtxo: Utxo;
  let dataNftUtxo: Utxo;

  beforeAll(async () => {
    initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n, label: zeroLabel });

    // Real genesis at the unsalted contract addresses (manual TransactionBuilder tests
    // below use contract.tokenAddress directly). Works on mock and regtest.
    const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => {
      const dnAddr = getDataNftAddress(contract, catId);
      return [
        { address: contract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: dnAddr, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } } },
      ];
    });
    categoryId = genesis.categoryId;
    masterUtxo = genesis.utxos[0];
    dataNftUtxo = genesis.utxos[1];
    dataNftAddress = getDataNftAddress(contract, categoryId);
  });

  describe('ethers.js-like convenience API', () => {
    // Use separate provider/UTXOs so this section is independent
    const convProvider = createTestProvider();
    const convContract = new Contract(artifact, [], { provider: convProvider });
    let convCategoryId: string;

    beforeAll(async () => {
      // withCategory salts internally; genesis at the salted addresses. Works on mock and regtest.
      ({ categoryId: convCategoryId } = await setupStatefulUtxos(
        convProvider, convContract, stateLayout, { counter: 0n, label: zeroLabel }, { saltContract: true },
      ));
    });

    it('should auto-send on await (thenable)', async () => {
      const sc = StatefulContract.withCategory(convContract, convCategoryId);
      const labelA = new Uint8Array([0xaa, 0xaa, 0xaa, 0xaa]);
      const tx = await sc.update(labelA); // no .send()!
      expect(tx.txid).toBeDefined();
    });

    it('should return flat state from getState()', async () => {
      const sc = StatefulContract.withCategory(convContract, convCategoryId);
      const state = await sc.getState();
      // getState() returns flat state, not OnChainState
      expect(state.counter).toBeDefined();
      expect(state.label).toBeDefined();
      // No masterUtxo on the flat state object
      expect((state as any).masterUtxo).toBeUndefined();
    });

    it('should return full OnChainState from getFullState()', async () => {
      const sc = StatefulContract.withCategory(convContract, convCategoryId);
      const full = await sc.getFullState();
      expect(full.masterUtxo).toBeDefined();
      expect(full.dataNftUtxos).toHaveLength(1);
      expect(full.state.counter).toBeDefined();
    });

    it('should create new instance via withProvider(runner)', () => {
      const sc = StatefulContract.withCategory(convContract, convCategoryId);
      const otherProvider = createTestProvider();
      const connected = sc.withProvider(otherProvider);
      expect(connected.categoryId).toBe(convCategoryId);
      expect(connected.provider).toBe(otherProvider);
      expect(connected.name).toBe(sc.name);
    });

    it('should create new instance via attach(target)', () => {
      const sc = StatefulContract.withCategory(convContract, convCategoryId);
      const otherCategoryId = 'ddcd'.repeat(16);
      const attached = sc.attach(otherCategoryId);
      expect(attached.categoryId).toBe(otherCategoryId);
      expect(attached.provider).toBe(convProvider);
      expect(attached.name).toBe(sc.name);
    });
  });

  describe('artifact', () => {
    it('should have stateLayout with two variables', () => {
      expect(artifact.stateLayout).toBeDefined();
      expect(stateLayout.variables).toHaveLength(2);

      // counter: bigint at field 0
      expect(stateLayout.variables[0].name).toBe('counter');
      expect(stateLayout.variables[0].type).toBe('bigint');
      expect(stateLayout.variables[0].nftIndex).toBe(0);
      expect(stateLayout.variables[0].fieldIndex).toBe(0);

      // label: bytes4 at field 1 (same data NFT)
      expect(stateLayout.variables[1].name).toBe('label');
      expect(stateLayout.variables[1].type).toBe('bytes4');
      expect(stateLayout.variables[1].nftIndex).toBe(0);
      expect(stateLayout.variables[1].fieldIndex).toBe(1);

      // Both variables fit on one data NFT
      expect(stateLayout.dataNftCount).toBe(1);
      expect(stateLayout.commitmentLimit).toBe(128);
    });

    it('should mark contract as stateful', () => {
      expect(contract.isStateful).toBe(true);
    });
  });

  describe('getDataNftAddress', () => {
    it('should return a token-aware address', () => {
      expect(dataNftAddress).toBeDefined();
      expect(dataNftAddress).not.toBe(contract.tokenAddress);
    });

    it('should be deterministic for the same category', () => {
      const contract2 = new Contract(artifact, [], { provider });
      expect(getDataNftAddress(contract2, categoryId)).toBe(dataNftAddress);
    });

    it('should produce different addresses for different categories', () => {
      const otherCategoryId = 'bbcd'.repeat(16);
      const otherAddress = getDataNftAddress(contract, otherCategoryId);
      expect(otherAddress).not.toBe(dataNftAddress);
    });

    it('should produce a consistent covenant bytecode', () => {
      const bytecode1 = buildDataNftCovenantBytecode(categoryId);
      const bytecode2 = buildDataNftCovenantBytecode(categoryId);
      expect(bytecode1).toBe(bytecode2);
    });
  });

  describe('state read', () => {
    it('should read initial state (counter=0, label=0x00000000)', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo]);
      expect(state.counter).toBe(0n);
      expect(state.label).toEqual(zeroLabel);
    });

    it('should find data NFTs by category', () => {
      const reader = new StateReader(stateLayout);
      const found = reader.findDataNfts([masterUtxo, dataNftUtxo], categoryId);
      expect(found).toHaveLength(1);
      expect(found[0].token!.nft!.commitment).toBe(initialCommitments[0]);
    });
  });

  describe('state write', () => {
    it('should update counter=1, label=0xdeadbeef after first update', async () => {
      // After first update: counter 0->1, label 0x00000000->0xdeadbeef
      const labelA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const newCommitment = makeCommitment(1n, labelA);

      // Fee funder: covenant inputs balance outputs exactly, so a separate
      // input is needed to cover the minimum relay fee.
      const feeFunder = await createFeeFunder(provider);

      const tx = await new TransactionBuilder({ provider })
        .addInput(masterUtxo, contract.unlock.update(labelA))
        .addInput(dataNftUtxo, createDataNftUnlocker(contract, 0, categoryId))
        .addInput(feeFunder.utxo, feeFunder.unlocker)
        .addOutput({
          to: contract.tokenAddress,
          amount: masterUtxo.satoshis,
          token: masterUtxo.token,
        })
        .addOutput({
          to: dataNftAddress,
          amount: dataNftUtxo.satoshis,
          token: {
            category: categoryId,
            amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: newCommitment,
            },
          },
        })
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Output 0: master UTXO preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Output 1: data NFT with updated commitment
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(categoryId);
      expect(txOutputs[1].token?.nft?.commitment).toBe(newCommitment);

      // Parse state from the new commitment
      const reader = new StateReader(stateLayout);
      const dataNftFromTx: Utxo = {
        txid: tx.txid,
        vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      const newState = reader.readState([dataNftFromTx]);
      expect(newState.counter).toBe(1n);
      expect(newState.label).toEqual(labelA);

      // Verify via parsePushdataCommitment as well
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(1n);
      expect(parsedState.label).toEqual(labelA);
    });

    it('should update counter=2, label=0xcafebabe after second update', async () => {
      const contractUtxos = await contract.getUtxos();
      const covenantUtxos = await provider.getUtxos(dataNftAddress);

      const currentMaster = contractUtxos.find(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(currentMaster).toBeDefined();

      const currentDataNft = covenantUtxos.find(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'mutable'
          && u.token?.nft?.commitment && u.token?.nft?.commitment.length > 0,
      );
      expect(currentDataNft).toBeDefined();

      // Verify current state is counter=1, label=0xdeadbeef
      const labelA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const reader = new StateReader(stateLayout);
      const currentState = reader.readState([currentDataNft!]);
      expect(currentState.counter).toBe(1n);
      expect(currentState.label).toEqual(labelA);

      // After second update: counter 1->2, label->0xcafebabe
      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      const newCommitment = makeCommitment(2n, labelB);

      // Fee funder: covenant inputs balance outputs exactly, so a separate
      // input is needed to cover the minimum relay fee.
      const feeFunder = await createFeeFunder(provider);

      const tx = await new TransactionBuilder({ provider })
        .addInput(currentMaster!, contract.unlock.update(labelB))
        .addInput(currentDataNft!, createDataNftUnlocker(contract, 0, categoryId))
        .addInput(feeFunder.utxo, feeFunder.unlocker)
        .addOutput({
          to: contract.tokenAddress,
          amount: currentMaster!.satoshis,
          token: currentMaster!.token,
        })
        .addOutput({
          to: dataNftAddress,
          amount: currentDataNft!.satoshis,
          token: {
            category: categoryId,
            amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: newCommitment,
            },
          },
        })
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs[1].token?.nft?.commitment).toBe(newCommitment);

      const dataNftFromTx: Utxo = {
        txid: tx.txid,
        vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      const newState = reader.readState([dataNftFromTx]);
      expect(newState.counter).toBe(2n);
      expect(newState.label).toEqual(labelB);

      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(2n);
      expect(parsedState.label).toEqual(labelB);
    });

    // Note: wrong commitment validation is enforced by the master contract's
    // state transition logic at the node level. Local VM validation (debug())
    // is only available for StandardUnlocker inputs (ContractUnlocker / P2PKHUnlocker),
    // so this cannot be tested with the covenant unlocker on MockNetworkProvider.
  });

  describe('readStateFromChain', () => {
    it('should read state from chain via StateReader', async () => {
      const reader = new StateReader(stateLayout);
      const result = await reader.readStateFromChain(
        provider,
        categoryId,
        [contract.tokenAddress, dataNftAddress],
      );

      expect(result.masterUtxo).toBeDefined();
      expect(result.masterUtxo!.token?.category).toBe(categoryId);
      expect(result.masterUtxo!.token?.nft?.capability).toBe('minting');

      expect(result.dataNftUtxos).toHaveLength(1);
      expect(result.dataNftUtxos[0].token?.nft?.capability).toBe('mutable');

      // After two updates: counter=2, label=0xcafebabe
      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      expect(result.state.counter).toBe(2n);
      expect(result.state.label).toEqual(labelB);
    });

    it('should read state via contract.getState with auto-discovery', async () => {
      const result = await getContractState(contract, categoryId);

      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      expect(result.masterUtxo).toBeDefined();
      expect(result.dataNftUtxos).toHaveLength(1);
      expect(result.state.counter).toBe(2n);
      expect(result.state.label).toEqual(labelB);
    });

    it('should read state via contract.getState with explicit address', async () => {
      const result = await getContractState(contract, categoryId, dataNftAddress);

      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      expect(result.masterUtxo).toBeDefined();
      expect(result.dataNftUtxos).toHaveLength(1);
      expect(result.state.counter).toBe(2n);
      expect(result.state.label).toEqual(labelB);
    });

    it('should accept an array of addresses in contract.getState', async () => {
      const result = await getContractState(contract, categoryId, [dataNftAddress]);

      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      expect(result.masterUtxo).toBeDefined();
      expect(result.state.counter).toBe(2n);
      expect(result.state.label).toEqual(labelB);
    });

    it('should throw for non-stateful contracts', async () => {
      await expect(getContractState(p2pkh, categoryId, p2pkh.tokenAddress))
        .rejects.toThrow('not a stateful contract');
    });

    it('should throw when data NFTs are not found', async () => {
      const emptyProvider = createTestProvider();
      const reader = new StateReader(stateLayout);

      await expect(reader.readStateFromChain(emptyProvider, categoryId, [contract.tokenAddress]))
        .rejects.toThrow('Expected 1 data NFT(s)');
    });
  });

  describe('deploy (genesis)', () => {
    it('should create a genesis transaction with counter=0 and label=0x00000000', async () => {
      const deployProvider = createTestProvider();
      const deployContract = new Contract(artifact, [], { provider: deployProvider });
      const deployP2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployProvider });

      let fundingUtxo: Utxo = {
        txid: 'cccd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };

      // Regtest back-fills a real funding UTXO; reassign so the genesis category
      // (== the funding input txid) is the real one. On mock the txid is preserved.
      fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

      const genesisCategoryId = fundingUtxo.txid;
      const genesisCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n, label: zeroLabel });
      const genesisDataNftAddress = getDataNftAddress(deployContract, genesisCategoryId);

      const masterAmount = 1200n;
      const dataNftAmount = 1200n;
      const fee = 1000n;
      const changeAmount = fundingUtxo.satoshis - masterAmount - dataNftAmount - fee;

      const genesisTx = await new TransactionBuilder({ provider: deployProvider })
        .addInput(fundingUtxo, deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({
          to: deployContract.tokenAddress,
          amount: masterAmount,
          token: {
            category: genesisCategoryId,
            amount: 0n,
            nft: {
              capability: 'minting',
              commitment: '',
            },
          } as TokenDetails,
        })
        .addOutput({
          to: genesisDataNftAddress,
          amount: dataNftAmount,
          token: {
            category: genesisCategoryId,
            amount: 0n,
            nft: {
              capability: 'mutable',
              commitment: genesisCommitments[0],
            },
          } as TokenDetails,
        })
        .addOutput({ to: deployP2pkh.address, amount: changeAmount })
        .send();

      expect(genesisTx.txid).toBeDefined();

      const txOutputs = getTxOutputs(genesisTx);

      // Output 0: master UTXO with minting NFT
      expect(txOutputs[0].token?.category).toBe(genesisCategoryId);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].amount).toBe(masterAmount);

      // Output 1: data NFT with initial state commitment
      expect(txOutputs[1].token?.category).toBe(genesisCategoryId);
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.nft?.commitment).toBe(genesisCommitments[0]);
      expect(txOutputs[1].amount).toBe(dataNftAmount);

      // Output 2: change output
      expect(txOutputs[2].amount).toBe(changeAmount);
      expect(txOutputs[2].token).toBeUndefined();

      // Verify initial state: counter=0, label=0x00000000
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(parsedState.counter).toBe(0n);
      expect(parsedState.label).toEqual(zeroLabel);

      // Verify via UTXO set
      const contractUtxos = await deployContract.getUtxos();
      const masterNft = contractUtxos.find(
        (u) => u.token?.category === genesisCategoryId && u.token?.nft?.capability === 'minting',
      );
      expect(masterNft).toBeDefined();

      const covenantUtxos = await deployProvider.getUtxos(genesisDataNftAddress);
      const dataNft = covenantUtxos.find(
        (u) => u.token?.category === genesisCategoryId && u.token?.nft?.capability === 'mutable',
      );
      expect(dataNft).toBeDefined();

      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNft!]);
      expect(state.counter).toBe(0n);
      expect(state.label).toEqual(zeroLabel);
    });
  });
});

describe('StatefulContract API', () => {
  const scProvider = createTestProvider();
  const scArtifact = compileString(COUNTER_CONTRACT);
  const scContract = new Contract(scArtifact, [], { provider: scProvider });
  const scStateLayout = scArtifact.stateLayout!;
  const scZeroLabel = new Uint8Array(4);

  let scCategoryId: string;
  let scSaltedContract: Contract;

  beforeAll(async () => {
    // withCategory salts internally; genesis at the salted addresses. Works on mock and regtest.
    ({ categoryId: scCategoryId } = await setupStatefulUtxos(
      scProvider, scContract, scStateLayout, { counter: 0n, label: scZeroLabel }, { saltContract: true },
    ));
    scSaltedContract = scContract.withCategory(hexToBin(scCategoryId));
  });

  describe('construction', () => {
    it('should create via connect()', () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      expect(sc.inner.category).toEqual(hexToBin(scCategoryId));
      expect(sc.categoryId).toBe(scCategoryId);
      expect(sc.address).toBe(scSaltedContract.address);
      expect(sc.tokenAddress).toBe(scSaltedContract.tokenAddress);
      expect(sc.name).toBe(scContract.name);
      expect(sc.provider).toBe(scProvider);
    });

    it('should create via from()', () => {
      const sc = StatefulContract.from(scArtifact, [], { provider: scProvider }, scCategoryId);
      expect(sc.name).toBe('Counter');
      expect(sc.categoryId).toBe(scCategoryId);
    });

    it('should throw on non-stateful contract', () => {
      const nonStateful = new Contract(p2pkhArtifact, [alicePkh], { provider: scProvider });
      expect(() => StatefulContract.withCategory(nonStateful, scCategoryId)).toThrow('not a stateful contract');
    });

    it('should discover categoryId from explicit salted address', async () => {
      const sc = await StatefulContract.discover(scContract, scSaltedContract.tokenAddress);
      expect(sc.categoryId).toBe(scCategoryId);
      expect(sc.name).toBe('Counter');
    });

    it('should throw when no minting NFT found', async () => {
      // Use a unique salt so the token address doesn't overlap with any
      // previous genesis on the regtest chain.
      const emptyProvider = createTestProvider();
      const emptyContract = new Contract(scArtifact, [], { provider: emptyProvider })
        .withSalt(hexToBin('deadbeef'.repeat(8)));
      await expect(StatefulContract.discover(emptyContract))
        .rejects.toThrow('No minting NFT found');
    });

    it('should throw discover on non-stateful contract', async () => {
      const nonStateful = new Contract(p2pkhArtifact, [alicePkh], { provider: scProvider });
      await expect(StatefulContract.discover(nonStateful))
        .rejects.toThrow('not a stateful contract');
    });
  });

  describe('state getters', () => {
    it('should read counter directly via sc.counter()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const counter = await sc.counter();
      expect(counter).toBe(0n);
    });

    it('should read label directly via sc.label()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const label = await sc.label();
      expect(label).toEqual(scZeroLabel);
    });

    it('should also work via state namespace', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      expect(await sc.state.counter()).toBe(0n);
      expect(await sc.state.label()).toEqual(scZeroLabel);
    });

    it('should read all state via getState()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const result = await sc.getState();
      expect(result.counter).toBe(0n);
      expect(result.label).toEqual(scZeroLabel);
    });

    it('should read full on-chain state via getFullState()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const result = await sc.getFullState();
      expect(result.state.counter).toBe(0n);
      expect(result.state.label).toEqual(scZeroLabel);
      expect(result.masterUtxo).toBeDefined();
      expect(result.dataNftUtxos).toHaveLength(1);
    });
  });

  describe('manual override mutation', () => {
    it('should update state via sc.update().setState().send()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const labelA = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      const tx = await sc.update(labelA)
        .setState({ counter: 1n, label: labelA })
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Output 0: master UTXO preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(scCategoryId);

      // Output 1: data NFT with updated commitment
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(scCategoryId);

      // Parse and verify state
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(parsedState.counter).toBe(1n);
      expect(parsedState.label).toEqual(labelA);
    });
  });

  describe('pro mutation (functions namespace)', () => {
    it('should return a StatefulTransactionBuilder from functions.update()', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const labelB = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);

      const builder = await sc.functions.update(labelB);
      expect(builder).toBeInstanceOf(StatefulTransactionBuilder);

      builder.setState('counter', 2n);
      builder.setState('label', labelB);

      const tx = await builder.send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(parsedState.counter).toBe(2n);
      expect(parsedState.label).toEqual(labelB);
    });
  });

  describe('auto-derived mutation', () => {
    it('should update state via sc.update().send() without manual setState', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const labelC = new Uint8Array([0x11, 0x22, 0x33, 0x44]);

      const tx = await sc.update(labelC).send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify state was auto-derived correctly
      // Previous state was counter=2, label=0xcafebabe
      // After update: counter=3, label=0x11223344
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(parsedState.counter).toBe(3n);
      expect(parsedState.label).toEqual(labelC);
    });
  });

  describe('call namespace fallback', () => {
    it('should also work via call namespace', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const labelD = new Uint8Array([0xf0, 0xf1, 0xf2, 0xf3]);

      const tx = await sc.call.update(labelD)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const parsedState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(parsedState.counter).toBe(4n);
      expect(parsedState.label).toEqual(labelD);
    });
  });

  describe('sequential mutations', () => {
    it('should progress state across multiple calls (counter 4->5->6)', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);

      // First call: counter 4->5
      const label5 = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
      const tx1 = await sc.update(label5)
        .send();

      expect(tx1.txid).toBeDefined();
      const outputs1 = getTxOutputs(tx1);
      const state1 = parsePushdataCommitment(outputs1[1].token!.nft!.commitment, scStateLayout, 0);
      expect(state1.counter).toBe(5n);
      expect(state1.label).toEqual(label5);

      // Second call: counter 5->6
      const label6 = new Uint8Array([0x55, 0x66, 0x77, 0x88]);
      const tx2 = await sc.update(label6)
        .send();

      expect(tx2.txid).toBeDefined();
      const outputs2 = getTxOutputs(tx2);
      const state2 = parsePushdataCommitment(outputs2[1].token!.nft!.commitment, scStateLayout, 0);
      expect(state2.counter).toBe(6n);
      expect(state2.label).toEqual(label6);
    });
  });

  describe('signature function handling', () => {
    it('should auto-derive state for sig function (unsafe, no state writes)', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);

      // STB-based auto-derivation generates a valid signature for the probe,
      // so even functions with sig args can auto-derive state.
      const tx = await sc.authorize(alicePub, new SignatureTemplate(alicePriv)).send();
      expect(tx.txid).toBeDefined();
    });
  });

  describe('sig-arg state-writing auto-derivation', () => {
    const sigProvider = createTestProvider();
    const sigArtifact = compileString(AUTH_COUNTER_CONTRACT);
    const sigContract = new Contract(sigArtifact, [alicePub], { provider: sigProvider });
    const sigStateLayout = sigArtifact.stateLayout!;

    let sigCategoryId: string;

    beforeAll(async () => {
      // withCategory salts internally; genesis at the salted addresses. Works on mock and regtest.
      ({ categoryId: sigCategoryId } = await setupStatefulUtxos(
        sigProvider, sigContract, sigStateLayout, { counter: 0n }, { saltContract: true },
      ));
    });

    it('should auto-derive state for sig function that writes state (counter 0->1)', async () => {
      const sc = StatefulContract.withCategory(sigContract, sigCategoryId);

      // increment(sig s) has a signature arg AND writes state (this.counter = this.counter + 1).
      // The iterative VM derivation recomputes signatures on each probe rebuild,
      // so the sighash covers the updated transaction shape.
      const tx = await sc.increment(new SignatureTemplate(alicePriv)).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toHaveLength(3); // master + data NFT + change output from fee funder

      const state = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, sigStateLayout, 0);
      expect(state.counter).toBe(1n);
    });

    it('should auto-derive read-only function (readCounter) preserving current state', async () => {
      const sc = StatefulContract.withCategory(sigContract, sigCategoryId);

      // readCounter() is read-only - reads counter but doesn't write it.
      // Auto-derivation should preserve the current on-chain state.
      // Counter is 1n because the previous increment test updated it.
      const tx = await sc.readCounter().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toHaveLength(3); // master + data NFT + change output from fee funder

      // State should be preserved (counter=1 after increment ran)
      const state = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, sigStateLayout, 0);
      expect(state.counter).toBe(1n);
    });
  });

  describe('auto category self-pin', () => {
    it('connect() should self-pin with categoryId', () => {
      const unsaltedContract = new Contract(scArtifact, [], { provider: scProvider });
      const sc = StatefulContract.withCategory(unsaltedContract, scCategoryId);

      // The self-pinned address should differ from the un-pinned contract address
      expect(sc.address).not.toBe(unsaltedContract.address);
      // The inner contract should have the category baked (the self-pin segment)
      expect(sc.inner.category).toBeDefined();
    });

    it('connect() should preserve a user salt alongside the category pin', () => {
      const customSalt = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const saltedContract = new Contract(scArtifact, [], { provider: scProvider, salt: customSalt });
      const sc = StatefulContract.withCategory(saltedContract, scCategoryId);

      // Two separate segments: the user salt is preserved AND the category pin is added.
      expect(sc.inner.salt).toEqual(customSalt);
      expect(sc.inner.category).toEqual(hexToBin(scCategoryId));
      // The address includes both segments, so it differs from the salt-only contract.
      expect(sc.address).not.toBe(saltedContract.address);
    });

    it('from() should self-pin with categoryId', () => {
      const unsaltedContract = new Contract(scArtifact, [], { provider: scProvider });
      const sc = StatefulContract.from(scArtifact, [], { provider: scProvider }, scCategoryId);

      // The self-pinned address should differ from the un-pinned contract
      expect(sc.address).not.toBe(unsaltedContract.address);
      expect(sc.inner.category).toBeDefined();
    });

    it('from() should use explicit salt when provided', () => {
      const customSalt = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const sc = StatefulContract.from(scArtifact, [], { provider: scProvider, salt: customSalt }, scCategoryId);

      // Should use the provided salt, not the categoryId
      expect(sc.inner.salt).toEqual(customSalt);

      // Address should differ from auto-salted
      const autoSalted = StatefulContract.from(scArtifact, [], { provider: scProvider }, scCategoryId);
      expect(sc.address).not.toBe(autoSalted.address);
    });
  });
});

describe('StatefulContract.deploy()', () => {
  const deployProvider = createTestProvider();
  const deployArtifact = compileString(COUNTER_CONTRACT);
  const deployP2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployProvider });
  const zeroLabel = new Uint8Array(4);

  it('should deploy with explicit initial state and read state back', async () => {
    let fundingUtxo: Utxo = {
      txid: 'f1cd'.repeat(16),
      vout: 0,
      satoshis: 100000n,
    };
    fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 5n, label: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
      changeAddress: deployP2pkh.address,
    });

    expect(result.categoryId).toBe(fundingUtxo.txid);
    expect(result.tx.txid).toBeDefined();
    expect(result.contract).toBeDefined();
    expect(result.contract.categoryId).toBe(fundingUtxo.txid);

    const txOutputs = getTxOutputs(result.tx);

    // Output 0: master UTXO with minting NFT
    expect(txOutputs[0].token?.nft?.capability).toBe('minting');
    expect(txOutputs[0].token?.category).toBe(result.categoryId);

    // Output 1: data NFT with initial state
    expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
    expect(txOutputs[1].token?.category).toBe(result.categoryId);

    // Verify state
    const parsedState = parsePushdataCommitment(
      txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0,
    );
    expect(parsedState.counter).toBe(5n);
    expect(parsedState.label).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('should deploy with all defaults (omit initialState entirely)', async () => {
    let fundingUtxo: Utxo = {
      txid: 'f2cd'.repeat(16),
      vout: 0,
      satoshis: 100000n,
    };
    fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: deployP2pkh.address,
    });

    expect(result.categoryId).toBe(fundingUtxo.txid);
    expect(result.tx.txid).toBeDefined();

    const txOutputs = getTxOutputs(result.tx);
    const parsedState = parsePushdataCommitment(
      txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0,
    );
    expect(parsedState.counter).toBe(0n);
    expect(parsedState.label).toEqual(zeroLabel);
  });

  it('should deploy with partial initial state (some defaults)', async () => {
    let fundingUtxo: Utxo = {
      txid: 'f3cd'.repeat(16),
      vout: 0,
      satoshis: 100000n,
    };
    fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 10n },
      changeAddress: deployP2pkh.address,
    });

    const txOutputs = getTxOutputs(result.tx);
    const parsedState = parsePushdataCommitment(
      txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0,
    );
    expect(parsedState.counter).toBe(10n);
    // label defaults to zero bytes
    expect(parsedState.label).toEqual(zeroLabel);
  });

  it('should throw on non-stateful artifact', async () => {
    const fundingUtxo: Utxo = {
      txid: 'f4cd'.repeat(16),
      vout: 0,
      satoshis: 100000n,
    };

    await expect(StatefulContract.deploy(p2pkhArtifact, [alicePkh], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: deployP2pkh.address,
    })).rejects.toThrow('not a stateful contract');
  });

  it('should throw when fundingUtxo.vout !== 0', async () => {
    const fundingUtxo: Utxo = {
      txid: 'f5cd'.repeat(16),
      vout: 1,
      satoshis: 100000n,
    };

    await expect(StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: deployP2pkh.address,
    })).rejects.toThrow('Funding UTXO must be at vout 0');
  });

  it('should throw on insufficient funding', async () => {
    // Use 100n on mocknet (below dust, injected directly).
    // Use 1000n on regtest (above dust but still insufficient for deploy).
    const isRegtest = !!process.env.TESTS_USE_REGTEST;
    const tooSmall = isRegtest ? 1000n : 100n;
    let fundingUtxo: Utxo = {
      txid: 'f6cd'.repeat(16),
      vout: 0,
      satoshis: tooSmall,
    };
    fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

    await expect(StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: deployP2pkh.address,
    })).rejects.toThrow('Insufficient funding');
  });

  it('should allow custom masterAmount, dataNftAmount, fee', async () => {
    let fundingUtxo: Utxo = {
      txid: 'f7cd'.repeat(16),
      vout: 0,
      satoshis: 100000n,
    };
    fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

    const result = await StatefulContract.deploy(deployArtifact, [], {
      provider: deployProvider,
      fundingUtxo,
      funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: deployP2pkh.address,
      masterAmount: 2000n,
      dataNftAmount: 1500n,
      fee: 500n,
    });

    const txOutputs = getTxOutputs(result.tx);
    expect(txOutputs[0].amount).toBe(2000n);
    expect(txOutputs[1].amount).toBe(1500n);
    // Change = 100000 - 2000 - 1500 - 500 = 96000
    expect(txOutputs[2].amount).toBe(96000n);
  });
});

// ---------- Multi-NFT Stateful Contract Tests ----------

// Two bytes100 state variables: each has max encoded size = 102 bytes (2-byte OP_PUSHDATA1 prefix + 100 data bytes).
// With commitmentLimit=128, only one fits per NFT -> dataNftCount = 2.
const TWO_CHUNKS_CONTRACT = `
pragma solidcash >=0.8.0;

contract TwoChunks() {
    bytes100 alpha;
    bytes100 beta;

    function setAlpha(bytes100 newAlpha) {
        this.alpha = newAlpha;
    }

    function setBeta(bytes100 newBeta) {
        this.beta = newBeta;
    }

    function setBoth(bytes100 newAlpha, bytes100 newBeta) {
        this.alpha = newAlpha;
        this.beta = newBeta;
    }
}
`;

describe('Multi-NFT Stateful Contract', () => {
  const provider = createTestProvider();
  const artifact = compileString(TWO_CHUNKS_CONTRACT);
  const contract = new Contract(artifact, [], { provider });
  const stateLayout = artifact.stateLayout!;

  const zeroAlpha = new Uint8Array(100);
  const zeroBeta = new Uint8Array(100);

  let categoryId: string;
  let dataNftAddress: string;
  let initialCommitments: string[];
  let masterUtxo: Utxo;
  let dataNftUtxo0: Utxo;
  let dataNftUtxo1: Utxo;

  beforeAll(async () => {
    initialCommitments = buildInitialStateCommitments(stateLayout, { alpha: zeroAlpha, beta: zeroBeta });

    // Real genesis at the unsalted contract addresses (manual TransactionBuilder tests
    // below use contract.tokenAddress directly). Works on mock and regtest.
    const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => {
      const dnAddr = getDataNftAddress(contract, catId);
      return [
        { address: contract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: dnAddr, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } } },
        { address: dnAddr, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[1] } } },
      ];
    });
    categoryId = genesis.categoryId;
    masterUtxo = genesis.utxos[0];
    dataNftUtxo0 = genesis.utxos[1];
    dataNftUtxo1 = genesis.utxos[2];
    dataNftAddress = getDataNftAddress(contract, categoryId);
  });

  describe('artifact', () => {
    it('should have stateLayout with two variables on separate NFTs', () => {
      expect(stateLayout).toBeDefined();
      expect(stateLayout.variables).toHaveLength(2);

      expect(stateLayout.variables[0].name).toBe('alpha');
      expect(stateLayout.variables[0].type).toBe('bytes100');
      expect(stateLayout.variables[0].nftIndex).toBe(0);
      expect(stateLayout.variables[0].fieldIndex).toBe(0);

      expect(stateLayout.variables[1].name).toBe('beta');
      expect(stateLayout.variables[1].type).toBe('bytes100');
      expect(stateLayout.variables[1].nftIndex).toBe(1);
      expect(stateLayout.variables[1].fieldIndex).toBe(0);

      expect(stateLayout.dataNftCount).toBe(2);
      expect(stateLayout.commitmentLimit).toBe(128);
    });

    it('should produce two initial commitments', () => {
      expect(initialCommitments).toHaveLength(2);
      expect(initialCommitments[0].length).toBeGreaterThan(0);
      expect(initialCommitments[1].length).toBeGreaterThan(0);
    });
  });

  describe('state read', () => {
    it('should read initial state (alpha=zeros, beta=zeros) from 2 data NFTs', () => {
      const reader = new StateReader(stateLayout);
      const state = reader.readState([dataNftUtxo0, dataNftUtxo1]);
      expect(state.alpha).toEqual(zeroAlpha);
      expect(state.beta).toEqual(zeroBeta);
    });

    it('should find 2 data NFTs by category', () => {
      const reader = new StateReader(stateLayout);
      const found = reader.findDataNfts([masterUtxo, dataNftUtxo0, dataNftUtxo1], categoryId);
      expect(found).toHaveLength(2);
      // Should be sorted by vout (ascending)
      expect(found[0].vout).toBe(dataNftUtxo0.vout);
      expect(found[1].vout).toBe(dataNftUtxo1.vout);
    });

    it('should sort data NFTs by vout regardless of insertion order', () => {
      const reader = new StateReader(stateLayout);
      // Pass in reverse order
      const found = reader.findDataNfts([dataNftUtxo1, masterUtxo, dataNftUtxo0], categoryId);
      expect(found).toHaveLength(2);
      expect(found[0].vout).toBe(dataNftUtxo0.vout);
      expect(found[1].vout).toBe(dataNftUtxo1.vout);
    });
  });

  describe('state write (manual TransactionBuilder)', () => {
    it('should update alpha via setAlpha with 2 data NFT outputs', async () => {
      const newAlpha = new Uint8Array(100).fill(0xaa);

      const newCommitment0 = buildPushdataCommitment(stateLayout, { alpha: newAlpha, beta: zeroBeta }, 0);
      const newCommitment1 = buildPushdataCommitment(stateLayout, { alpha: newAlpha, beta: zeroBeta }, 1);

      const feeFunder = await createFeeFunder(provider);

      const tx = await new TransactionBuilder({ provider })
        .addInput(masterUtxo, contract.unlock.setAlpha(newAlpha))
        .addInput(dataNftUtxo0, createDataNftUnlocker(contract, 0, categoryId))
        .addInput(dataNftUtxo1, createDataNftUnlocker(contract, 0, categoryId))
        .addInput(feeFunder.utxo, feeFunder.unlocker)
        .addOutput({
          to: contract.tokenAddress,
          amount: masterUtxo.satoshis,
          token: masterUtxo.token,
        })
        .addOutput({
          to: dataNftAddress,
          amount: dataNftUtxo0.satoshis,
          token: {
            category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: newCommitment0 },
          },
        })
        .addOutput({
          to: dataNftAddress,
          amount: dataNftUtxo1.satoshis,
          token: {
            category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: newCommitment1 },
          },
        })
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Output 0: master
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      // Output 1: data NFT 0 with updated alpha
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.nft?.commitment).toBe(newCommitment0);

      // Output 2: data NFT 1 with unchanged beta
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.nft?.commitment).toBe(newCommitment1);

      // Verify state read from both NFTs
      const reader = new StateReader(stateLayout);
      const dataNft0FromTx: Utxo = {
        txid: tx.txid, vout: 1, satoshis: txOutputs[1].amount, token: txOutputs[1].token,
      };
      const dataNft1FromTx: Utxo = {
        txid: tx.txid, vout: 2, satoshis: txOutputs[2].amount, token: txOutputs[2].token,
      };
      const newState = reader.readState([dataNft0FromTx, dataNft1FromTx]);
      expect(newState.alpha).toEqual(newAlpha);
      expect(newState.beta).toEqual(zeroBeta);
    });
  });

  describe('StatefulContract API with 2 data NFTs', () => {
    const scProvider = createTestProvider();
    const scArtifact = compileString(TWO_CHUNKS_CONTRACT);
    const scContract = new Contract(scArtifact, [], { provider: scProvider });
    const scStateLayout = scArtifact.stateLayout!;

    const scZeroAlpha = new Uint8Array(100);
    const scZeroBeta = new Uint8Array(100);

    let scCategoryId: string;

    beforeAll(async () => {
      // withCategory salts internally; genesis at the salted addresses. Works on mock and regtest.
      ({ categoryId: scCategoryId } = await setupStatefulUtxos(
        scProvider, scContract, scStateLayout, { alpha: scZeroAlpha, beta: scZeroBeta }, { saltContract: true },
      ));
    });

    it('should connect and read initial state', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const result = await sc.getState();

      expect(result.alpha).toEqual(scZeroAlpha);
      expect(result.beta).toEqual(scZeroBeta);

      const full = await sc.getFullState();
      expect(full.masterUtxo).toBeDefined();
      expect(full.dataNftUtxos).toHaveLength(2);
    });

    it('should update alpha only via setState (optimized: only nft0)', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const newAlpha = new Uint8Array(100).fill(0xbb);

      const tx = await sc.setAlpha(newAlpha)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Per-function optimization: setAlpha only accesses nft0
      // So transaction has 3 outputs: master + nft0 + change output from fee funder
      expect(txOutputs).toHaveLength(3);
      // Output 0: master
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      // Output 1: data NFT 0 (alpha)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(state0.alpha).toEqual(newAlpha);
    });

    it('should update both via setBoth', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const newAlpha = new Uint8Array(100).fill(0xcc);
      const newBeta = new Uint8Array(100).fill(0xdd);

      const tx = await sc.setBoth(newAlpha, newBeta)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      const state1 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, scStateLayout, 1);
      expect(state0.alpha).toEqual(newAlpha);
      expect(state1.beta).toEqual(newBeta);
    });

    it('should progress state across sequential mutations (optimized)', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);

      // First: update alpha (optimized: only nft0)
      const alpha1 = new Uint8Array(100).fill(0x11);
      const tx1 = await sc.setAlpha(alpha1)
        .send();
      expect(tx1.txid).toBeDefined();
      const tx1Outputs = getTxOutputs(tx1);
      expect(tx1Outputs).toHaveLength(3); // master + nft0 + change output from fee funder
      const state0FromTx1 = parsePushdataCommitment(tx1Outputs[1].token!.nft!.commitment, scStateLayout, 0);
      expect(state0FromTx1.alpha).toEqual(alpha1);

      // Second: update beta (optimized: only nft1)
      const beta2 = new Uint8Array(100).fill(0x22);
      const tx2 = await sc.setBeta(beta2)
        .send();
      expect(tx2.txid).toBeDefined();
      const tx2Outputs = getTxOutputs(tx2);
      expect(tx2Outputs).toHaveLength(3); // master + nft1 + change output from fee funder
      const state1FromTx2 = parsePushdataCommitment(tx2Outputs[1].token!.nft!.commitment, scStateLayout, 1);
      expect(state1FromTx2.beta).toEqual(beta2);
    });
  });

  describe('deploy with 2 data NFTs', () => {
    it('should create genesis transaction with 2 data NFT outputs', async () => {
      const deployProvider = createTestProvider();
      const deployArtifact = compileString(TWO_CHUNKS_CONTRACT);
      const deployP2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployProvider });

      let fundingUtxo: Utxo = {
        txid: 'facd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      // Regtest back-fills a real funding UTXO; deploy's category == the funding txid.
      fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

      const alpha = new Uint8Array(100).fill(0x01);
      const beta = new Uint8Array(100).fill(0x02);

      const result = await StatefulContract.deploy(deployArtifact, [], {
        provider: deployProvider,
        fundingUtxo,
        funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { alpha, beta },
        changeAddress: deployP2pkh.address,
      });

      expect(result.categoryId).toBe(fundingUtxo.txid);
      expect(result.tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(result.tx);

      // Output 0: master UTXO with minting NFT
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(result.categoryId);

      // Output 1: data NFT 0
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(result.categoryId);

      // Output 2: data NFT 1
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(result.categoryId);

      // Output 3: change
      expect(txOutputs[3].token).toBeUndefined();

      // Verify state in both commitments
      const parsedState0 = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0,
      );
      const parsedState1 = parsePushdataCommitment(
        txOutputs[2].token!.nft!.commitment, deployArtifact.stateLayout!, 1,
      );
      expect(parsedState0.alpha).toEqual(alpha);
      expect(parsedState1.beta).toEqual(beta);
    });
  });
});

// ---------- 3-NFT Per-Function Optimization Tests ----------

// Three bytes100 state variables: each has max encoded size = 102 bytes (2-byte OP_PUSHDATA1 prefix + 100 data bytes).
// With commitmentLimit=128, only one fits per NFT -> dataNftCount = 3.
const THREE_CHUNKS_CONTRACT = `
pragma solidcash >=0.8.0;

contract ThreeChunks() {
    bytes100 alpha;
    bytes100 beta;
    bytes100 gamma;

    function setAlpha(bytes100 newAlpha) {
        this.alpha = newAlpha;
    }

    function setGamma(bytes100 newGamma) {
        this.gamma = newGamma;
    }

    function setAlphaAndGamma(bytes100 newAlpha, bytes100 newGamma) {
        this.alpha = newAlpha;
        this.gamma = newGamma;
    }

    function setAll(bytes100 newAlpha, bytes100 newBeta, bytes100 newGamma) {
        this.alpha = newAlpha;
        this.beta = newBeta;
        this.gamma = newGamma;
    }

    function readGamma() {
        require(this.gamma != 0x${'00'.repeat(100)});
    }
}
`;

describe('3-NFT Per-Function Optimization', () => {
  describe('compiler artifact', () => {
    it('should have requiredNftIndices in ABI for each function', () => {
      const artifact = compileString(THREE_CHUNKS_CONTRACT);
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.dataNftCount).toBe(3);

      const setAlpha = artifact.abi.find((f) => f.name === 'setAlpha')!;
      expect(setAlpha.requiredNftIndices).toEqual([0]);

      const setGamma = artifact.abi.find((f) => f.name === 'setGamma')!;
      expect(setGamma.requiredNftIndices).toEqual([2]);

      const setAlphaAndGamma = artifact.abi.find((f) => f.name === 'setAlphaAndGamma')!;
      expect(setAlphaAndGamma.requiredNftIndices).toEqual([0, 2]);

      const setAll = artifact.abi.find((f) => f.name === 'setAll')!;
      expect(setAll.requiredNftIndices).toEqual([0, 1, 2]);

      const readGamma = artifact.abi.find((f) => f.name === 'readGamma')!;
      expect(readGamma.requiredNftIndices).toEqual([2]);
    });
  });

  describe('StatefulContract API with 3 data NFTs', () => {
    const provider = createTestProvider();
    const artifact = compileString(THREE_CHUNKS_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const zeroAlpha = new Uint8Array(100);
    const zeroBeta = new Uint8Array(100);
    const zeroGamma = new Uint8Array(100);

    let categoryId: string;

    beforeAll(async () => {
      // withCategory salts internally; genesis at the salted addresses. Works on mock and regtest.
      ({ categoryId } = await setupStatefulUtxos(
        provider, contract, stateLayout, { alpha: zeroAlpha, beta: zeroBeta, gamma: zeroGamma }, { saltContract: true },
      ));
    });

    it('setGamma() should only have 2 inputs/outputs (master + nft2)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const newGamma = new Uint8Array(100).fill(0xcc);

      const tx = await sc.setGamma(newGamma)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Per-function optimization: only master + nft2 + change output from fee funder
      expect(txOutputs).toHaveLength(3);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      // Verify nft2 commitment contains the updated gamma
      const state2 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 2);
      expect(state2.gamma).toEqual(newGamma);
    });

    it('setAlpha() should only have 2 inputs/outputs (master + nft0)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const newAlpha = new Uint8Array(100).fill(0xaa);

      const tx = await sc.setAlpha(newAlpha)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Per-function optimization: only master + nft0 + change output from fee funder
      expect(txOutputs).toHaveLength(3);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(state0.alpha).toEqual(newAlpha);
    });

    it('setAlphaAndGamma() should have 3 inputs/outputs (master + nft0 + nft2)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const newAlpha = new Uint8Array(100).fill(0x11);
      const newGamma = new Uint8Array(100).fill(0x33);

      const tx = await sc.setAlphaAndGamma(newAlpha, newGamma)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Per-function optimization: master + nft0 + nft2 (skips nft1) + change output from fee funder
      expect(txOutputs).toHaveLength(4);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      const state2 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, stateLayout, 2);
      expect(state0.alpha).toEqual(newAlpha);
      expect(state2.gamma).toEqual(newGamma);
    });

    it('setAll() should have 4 inputs/outputs (master + nft0 + nft1 + nft2)', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const newAlpha = new Uint8Array(100).fill(0xaa);
      const newBeta = new Uint8Array(100).fill(0xbb);
      const newGamma = new Uint8Array(100).fill(0xcc);

      const tx = await sc.setAll(newAlpha, newBeta, newGamma)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // All 3 NFTs used: master + nft0 + nft1 + nft2 + change output from fee funder
      expect(txOutputs).toHaveLength(5);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      const state1 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, stateLayout, 1);
      const state2 = parsePushdataCommitment(txOutputs[3].token!.nft!.commitment, stateLayout, 2);
      expect(state0.alpha).toEqual(newAlpha);
      expect(state1.beta).toEqual(newBeta);
      expect(state2.gamma).toEqual(newGamma);
    });

    it('readGamma() should only have 2 inputs/outputs (master + nft2) with read-only access', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);

      // readGamma is read-only - it reads gamma but doesn't write it
      // The data NFT is still passed through to preserve it
      const tx = await sc.readGamma().send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // master + nft2 output (nft2 preserved with current commitment) + change output from fee funder
      expect(txOutputs).toHaveLength(3);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
    });

    it('deploy should create all data NFT outputs regardless of per-function optimization', async () => {
      const deployProvider = createTestProvider();
      const deployArtifact = compileString(THREE_CHUNKS_CONTRACT);
      const deployP2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployProvider });

      let fundingUtxo: Utxo = {
        txid: 'facd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      // Regtest back-fills a real funding UTXO; deploy's category == the funding txid.
      fundingUtxo = await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

      const alpha = new Uint8Array(100).fill(0x01);
      const beta = new Uint8Array(100).fill(0x02);
      const gamma = new Uint8Array(100).fill(0x03);

      const result = await StatefulContract.deploy(deployArtifact, [], {
        provider: deployProvider,
        fundingUtxo,
        funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { alpha, beta, gamma },
        changeAddress: deployP2pkh.address,
      });

      expect(result.categoryId).toBe(fundingUtxo.txid);
      const txOutputs = getTxOutputs(result.tx);

      // Deploy always creates ALL data NFT outputs
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[3].token?.nft?.capability).toBe('mutable');

      const s0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0);
      const s1 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, deployArtifact.stateLayout!, 1);
      const s2 = parsePushdataCommitment(txOutputs[3].token!.nft!.commitment, deployArtifact.stateLayout!, 2);
      expect(s0.alpha).toEqual(alpha);
      expect(s1.beta).toEqual(beta);
      expect(s2.gamma).toEqual(gamma);
    });
  });
});
