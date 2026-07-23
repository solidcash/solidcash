import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract, SignatureTemplate, StatefulContract, decodeEntryCommitment, keyToSlot,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobPkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Simple factory with deploy modifier
const FACTORY = `
contract Factory() {
    int childCount;

    function createChild(int fundingInputIndex) {
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != 0x0000000000000000000000000000000000000000000000000000000000000000);
        this.childCount = this.childCount + 1;
    }

    function getCount() {
        require(this.childCount > 0);
    }
}
`;

// Child contract - a simple stateful counter
const CHILD = `
contract Child(bytes20 owner) {
    int counter;

    function increment() {
        require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(owner));
        this.counter = this.counter + 1;
    }

    function getCounter() {
        require(this.counter > 0);
    }
}
`;

// Create3 factory with mapping(salt -> categoryId)
const CREATE3_FACTORY = `
contract Create3Factory() {
    int childCount;
    mapping(bytes32 => bytes32) children;

    function create3(bytes32 salt, int fundingInputIndex) {
        bytes32 childCategoryId = tx.inputs[fundingInputIndex].outpointTransactionHash;
        require(this.children[salt] == 0x0000000000000000000000000000000000000000000000000000000000000000);
        this.children[salt] = childCategoryId;
        this.childCount = this.childCount + 1;
    }
}
`;

// Factory whose deploy function overwrites a mapping entry (no `== 0` guard), to exercise
// deployFrom's existing-entry write path.
const OVERWRITE_FACTORY = `
contract OverwriteFactory() {
    int childCount;
    mapping(bytes32 => bytes32) children;

    function recreate(bytes32 salt, int fundingInputIndex) {
        bytes32 childCategoryId = tx.inputs[fundingInputIndex].outpointTransactionHash;
        this.children[salt] = childCategoryId;
        this.childCount = this.childCount + 1;
    }
}
`;

// Factory WITHOUT deploy modifier (for negative tests)
const NO_DEPLOY_FACTORY = `
contract NoDeployFactory() {
    int childCount;

    function createChild() {
        this.childCount = this.childCount + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('StatefulContract.deployFrom()', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const findC2Entry = (outputs: ReturnType<typeof getTxOutputs>, category: string, key: Uint8Array) => {
    const slotHex = binToHex(keyToSlot(key));
    const output = outputs.find((o) => o.token?.category === category
      && o.token?.nft?.capability === 'mutable'
      && o.token.nft.commitment.slice(0, 64) === slotHex);
    if (!output?.token?.nft?.commitment) throw new Error('C2 target output not found');
    return decodeEntryCommitment(hexToBin(output.token.nft.commitment));
  };

  const factoryArtifact = compileString(FACTORY);
  const childArtifact = compileString(CHILD);
  const create3FactoryArtifact = compileString(CREATE3_FACTORY);
  const overwriteFactoryArtifact = compileString(OVERWRITE_FACTORY);
  const noDeployArtifact = compileString(NO_DEPLOY_FACTORY);

  describe('deploy modifier in artifact ABI', () => {
    it('should include deploy in ABI modifiers', () => {
      const createChildAbi = factoryArtifact.abi.find((f) => f.name === 'createChild');
      expect(createChildAbi).toBeDefined();
      expect(createChildAbi!.modifiers).toContain('deploy');
    });

    it('should not have deploy modifier on non-deploy functions', () => {
      const getCountAbi = factoryArtifact.abi.find((f) => f.name === 'getCount');
      expect(getCountAbi).toBeDefined();
      expect(getCountAbi!.modifiers ?? []).not.toContain('deploy');
    });

    it('should include deploy in create3 factory ABI', () => {
      const create3Abi = create3FactoryArtifact.abi.find((f) => f.name === 'create3');
      expect(create3Abi).toBeDefined();
      expect(create3Abi!.modifiers).toContain('deploy');
    });
  });

  describe('basic deployFrom (create pattern)', () => {
    let factoryContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let factoryCategoryId: string;

    it('should deploy the factory contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'c1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(factoryArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });

      factoryContract = result.contract;
      factoryCategoryId = result.categoryId;

      expect(factoryCategoryId).toBe(fundingUtxo.txid);
      expect(factoryContract.categoryId).toBe(factoryCategoryId);
    });

    it('should deploy a child contract from the factory', async () => {
      const childFundingUtxo: Utxo = {
        txid: 'c2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFundingUtxo);

      // createChild reads the genesis input (tx.inputs[fundingInputIndex].outpointTransactionHash) as the child
      // category - which infers the `deploy` modifier, so no explicit keyword. Funding input sits after the
      // factory's own master + data NFTs (same computation as the create3 pattern below).
      const createChildAbi = factoryArtifact.abi.find((f) => f.name === 'createChild')!;
      const requiredNftCount = createChildAbi.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
      const fundingInputIndex = 1 + requiredNftCount;

      const result = await StatefulContract.deployFrom({
        provider,
        factory: factoryContract,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [BigInt(fundingInputIndex)],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      expect(result.childCategoryId).toBe(childFundingUtxo.txid);
      expect(result.child).toBeDefined();
      expect(result.child.categoryId).toBe(result.childCategoryId);
      expect(result.tx.txid).toBeDefined();

      // Verify transaction outputs
      const txOutputs = getTxOutputs(result.tx);

      // Output 0: factory master (preserved with same categoryId)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(factoryCategoryId);

      // Output 1: factory data NFT (childCount updated)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(factoryCategoryId);
      const factoryState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
      );
      expect(factoryState.childCount).toBe(1n);

      // Output 2: child minting NFT (new category from funding UTXO)
      expect(txOutputs[2].token?.nft?.capability).toBe('minting');
      expect(txOutputs[2].token?.category).toBe(result.childCategoryId);

      // Output 3: child data NFT (counter = 0)
      expect(txOutputs[3].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[3].token?.category).toBe(result.childCategoryId);
      const childState = parsePushdataCommitment(
        txOutputs[3].token!.nft!.commitment, childArtifact.stateLayout!, 0,
      );
      expect(childState.counter).toBe(0n);

      // Update factory reference for subsequent tests
      factoryContract = result.factory;
    });

    it('should deploy a second child with a different categoryId', async () => {
      const childFundingUtxo2: Utxo = {
        txid: 'c3cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFundingUtxo2);

      // createChild reads the genesis input (tx.inputs[fundingInputIndex].outpointTransactionHash) as the child
      // category - which infers the `deploy` modifier, so no explicit keyword. Funding input sits after the
      // factory's own master + data NFTs (same computation as the create3 pattern below).
      const createChildAbi = factoryArtifact.abi.find((f) => f.name === 'createChild')!;
      const requiredNftCount = createChildAbi.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
      const fundingInputIndex = 1 + requiredNftCount;

      const result = await StatefulContract.deployFrom({
        provider,
        factory: factoryContract,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [BigInt(fundingInputIndex)],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo2,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      // Different funding UTXO -> different categoryId
      expect(result.childCategoryId).toBe(childFundingUtxo2.txid);
      expect(result.childCategoryId).not.toBe('c2cd'.repeat(16));

      // Factory childCount should be 2
      const txOutputs = getTxOutputs(result.tx);
      const factoryState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, factoryArtifact.stateLayout!, 0,
      );
      expect(factoryState.childCount).toBe(2n);

      factoryContract = result.factory;
    });
  });

  describe('create3 deployFrom pattern', () => {
    let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the create3 factory', async () => {
      const fundingUtxo: Utxo = {
        txid: 'd1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(create3FactoryArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });

      factory = result.contract;
      expect(factory.categoryId).toBe(fundingUtxo.txid);
    });

    it('should deploy a child via create3 with salt', async () => {
      const salt = '00'.repeat(31) + '01'; // salt = 1
      const childFundingUtxo: Utxo = {
        txid: 'd2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFundingUtxo);

      // C2 always co-spends a proof node (HEAD for the first insert), so funding follows the entry slot.
      const create3Abi = create3FactoryArtifact.abi.find((f) => f.name === 'create3')!;
      const requiredNftCount = create3Abi.requiredNftIndices?.length
        ?? create3FactoryArtifact.stateLayout!.dataNftCount;
      const fundingInputIndex = 2 + requiredNftCount; // master + data NFTs + C2 predecessor

      const result = await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'create3',
        deployFunctionArgs: [salt, BigInt(fundingInputIndex)],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      expect(result.childCategoryId).toBe(childFundingUtxo.txid);
      expect(result.child).toBeDefined();
      expect(result.tx.txid).toBeDefined();

      // Verify the factory's state includes the mapping entry
      const txOutputs = getTxOutputs(result.tx);

      // Factory master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(factory.categoryId);

      // Factory data NFT (output 1) childCount incremented to 1
      const factoryState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, create3FactoryArtifact.stateLayout!, 0,
      );
      expect(factoryState.childCount).toBe(1n);

      // Factory entry NFT (output 2): children[salt] = child category, factory-keyed
      const entryOutput = txOutputs[2];
      expect(entryOutput.token?.category).toBe(factory.categoryId);
      expect(entryOutput.token?.nft?.capability).toBe('mutable');
      const entry = findC2Entry(txOutputs, factory.categoryId, hexToBin(salt));
      expect(binToHex(entry.slot)).toBe(binToHex(keyToSlot(hexToBin(salt))));
      // Stored value is outpointTransactionHash (internal byte order = reversed txid)
      const childCategoryInternal = binToHex(hexToBin(result.childCategoryId).reverse());
      expect(binToHex(entry.value as Uint8Array)).toBe(childCategoryInternal);

      const enumerated = await factory.getEntries('children');
      expect(enumerated.length).toBe(1);

      // Child minting NFT created
      const childOutputIndex = txOutputs.findIndex(
        (o) => o.token?.category === result.childCategoryId && o.token?.nft?.capability === 'minting',
      );
      expect(childOutputIndex).toBeGreaterThan(0);

      factory = result.factory;
    });
  });

  describe('deployFrom overwriting an existing mapping entry', () => {
    let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    const salt = '00'.repeat(31) + '07'; // bytes32 hex

    it('should deploy the overwrite factory', async () => {
      const fundingUtxo: Utxo = { txid: 'e1cd'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(overwriteFactoryArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });

      factory = result.contract;
      expect(factory.categoryId).toBe(fundingUtxo.txid);
    });

    it('should create the entry on first deploy with a C2 predecessor proof', async () => {
      const childFundingUtxo: Utxo = { txid: 'e2cd'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, childFundingUtxo);

      // HEAD fills the C2 proof slot, so funding follows it at input 3.
      const result = await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'recreate',
        deployFunctionArgs: [salt, 3n],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      const txOutputs = getTxOutputs(result.tx);
      const entry = findC2Entry(txOutputs, factory.categoryId, hexToBin(salt));
      expect(binToHex(entry.slot)).toBe(binToHex(keyToSlot(hexToBin(salt))));
      expect(binToHex(entry.value as Uint8Array)).toBe(binToHex(hexToBin(result.childCategoryId).reverse()));

      const entries = await factory.getEntries('children');
      expect(entries.length).toBe(1);

      factory = result.factory;
    });

    it('should overwrite the existing C2 entry on second deploy', async () => {
      const childFundingUtxo: Utxo = { txid: 'e3cd'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, childFundingUtxo);

      // Entry now exists: it takes the entry slot, funding shifts to the deploy slot (index 3)
      const result = await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'recreate',
        deployFunctionArgs: [salt, 3n],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      const txOutputs = getTxOutputs(result.tx);

      // childCount incremented to 2 (state preserved across the overwrite)
      const factoryState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, overwriteFactoryArtifact.stateLayout!, 0,
      );
      expect(factoryState.childCount).toBe(2n);

      // Entry overwritten in place with the new child's category, same key
      const entry = findC2Entry(txOutputs, factory.categoryId, hexToBin(salt));
      expect(binToHex(entry.slot)).toBe(binToHex(keyToSlot(hexToBin(salt))));
      expect(binToHex(entry.value as Uint8Array)).toBe(binToHex(hexToBin(result.childCategoryId).reverse()));

      // Exactly one entry remains - overwritten, not duplicated
      const entries = await factory.getEntries('children');
      expect(entries.length).toBe(1);

      factory = result.factory;
    });
  });

  describe('create2 pattern - deterministic addresses', () => {
    // In BCH, contract addresses are always deterministic:
    //   address = hash(bytecode + constructorArgs + salt)
    // where salt = categoryId for stateful contracts.
    // This means every deployment is inherently "create2" - given a known
    // funding UTXO txid (= categoryId), the child's address is predictable
    // BEFORE the deployment transaction is broadcast.

    let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    it('should deploy the factory', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(factoryArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });

      factory = result.contract;
    });

    it('should predict child address before deployment', async () => {
      const childFundingUtxo: Utxo = {
        txid: 'f2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFundingUtxo);

      // --- Predict address BEFORE deployment ---
      // The child's categoryId will be the funding UTXO's txid. Constructing a Contract with the same artifact,
      // args, and category (the SDK self-pin) gives the same address the create2-deployed child will have -
      // demonstrating SDK-direct and create2 use the identical self-pin mechanism.
      const predictedCategoryId = childFundingUtxo.txid;
      const predictedChild = new Contract(childArtifact, [alicePkh], {
        provider,
        category: hexToBin(predictedCategoryId),
      });
      const predictedAddress = predictedChild.address;
      const predictedTokenAddress = predictedChild.tokenAddress;

      // --- Deploy the child ---
      const result = await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [BigInt(1 + (factoryArtifact.abi.find((f) => f.name === 'createChild')!.requiredNftIndices?.length
          ?? factoryArtifact.stateLayout!.dataNftCount))],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      // --- Verify prediction matches actual ---
      expect(result.child.inner.address).toBe(predictedAddress);
      expect(result.child.inner.tokenAddress).toBe(predictedTokenAddress);
      expect(result.childCategoryId).toBe(predictedCategoryId);

      factory = result.factory;
    });

    it('different constructor args produce different addresses (same categoryId)', () => {
      // Same bytecode and salt, different constructor args -> different address.
      // This is the "create2" property: address = f(bytecode, args, salt).
      const categoryId = 'aacd'.repeat(16);
      const salt = hexToBin(categoryId);

      const childAlice = new Contract(childArtifact, [alicePkh], { provider, salt });
      const childBob = new Contract(childArtifact, [bobPkh], { provider, salt });

      expect(childAlice.address).not.toBe(childBob.address);
      expect(childAlice.tokenAddress).not.toBe(childBob.tokenAddress);
    });

    it('different salts (categoryIds) produce different addresses (same args)', () => {
      // Same bytecode and constructor args, different salt -> different address.
      const childA = new Contract(childArtifact, [alicePkh], {
        provider,
        salt: hexToBin('aacd'.repeat(16)),
      });
      const childB = new Contract(childArtifact, [alicePkh], {
        provider,
        salt: hexToBin('bbcd'.repeat(16)),
      });

      expect(childA.address).not.toBe(childB.address);
      expect(childA.tokenAddress).not.toBe(childB.tokenAddress);
    });

    it('same inputs always produce the same address (deterministic)', () => {
      // Constructing the same Contract twice with identical inputs
      // must yield the same address - pure function, no randomness.
      const salt = hexToBin('cccd'.repeat(16));

      const child1 = new Contract(childArtifact, [alicePkh], { provider, salt });
      const child2 = new Contract(childArtifact, [alicePkh], { provider, salt });

      expect(child1.address).toBe(child2.address);
      expect(child1.tokenAddress).toBe(child2.tokenAddress);
    });
  });

  describe('error cases', () => {
    let deployedFactory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let noDeployContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    beforeAll(async () => {
      // Deploy a factory for testing
      const fundingUtxo1: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo1);

      const result1 = await StatefulContract.deploy(factoryArtifact, [], {
        provider,
        fundingUtxo: fundingUtxo1,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });
      deployedFactory = result1.contract;

      // Deploy a contract without deploy modifier
      const fundingUtxo2: Utxo = {
        txid: 'e2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo2);

      const result2 = await StatefulContract.deploy(noDeployArtifact, [], {
        provider,
        fundingUtxo: fundingUtxo2,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { childCount: 0n },
        changeAddress: p2pkh.address,
      });
      noDeployContract = result2.contract;
    });

    it('should reject deployFrom if function lacks deploy modifier', async () => {
      const childFunding: Utxo = {
        txid: 'e3cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFunding);

      await expect(StatefulContract.deployFrom({
        provider,
        factory: noDeployContract,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [],
        childArtifact,
        childConstructorArgs: [alicePkh],
        fundingUtxo: childFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      })).rejects.toThrow('does not have the \'deploy\' modifier');
    });

    it('should reject deployFrom if function name does not exist', async () => {
      const childFunding: Utxo = {
        txid: 'e4cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, childFunding);

      await expect(StatefulContract.deployFrom({
        provider,
        factory: deployedFactory,
        deployFunctionName: 'nonExistentFunction',
        deployFunctionArgs: [],
        childArtifact,
        childConstructorArgs: [alicePkh],
        fundingUtxo: childFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      })).rejects.toThrow('not found');
    });

    it('should reject deployFrom if funding UTXO vout is not 0', async () => {
      const childFunding: Utxo = {
        txid: 'e5cd'.repeat(16),
        vout: 1, // invalid - must be 0
        satoshis: 100000n,
      };
      // No addUtxo: deployFrom validates fundingUtxo.vout before any node use, and on regtest
      // addUtxo would back-fill vout to 0, masking the rejection this test asserts.

      await expect(StatefulContract.deployFrom({
        provider,
        factory: deployedFactory,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [],
        childArtifact,
        childConstructorArgs: [alicePkh],
        fundingUtxo: childFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      })).rejects.toThrow('vout 0');
    });
  });
});
