import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate,
  StatefulContract,
} from '../../src/index.js';
import { Artifact } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SPLIT_MERGE_CONTRACT = `
pragma solidcash >=0.8.0;

contract SplitMerge(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function fork(int n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function consolidate(int n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('SplitMerge', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let artifact: Artifact;

  beforeAll(() => {
    artifact = compileString(SPLIT_MERGE_CONTRACT);
  });

  describe('ABI structure', () => {
    it('should include split modifier and splitCountParam in ABI', () => {
      const forkAbi = artifact.abi.find((f) => f.name === 'fork');
      expect(forkAbi).toBeDefined();
      expect(forkAbi!.modifiers).toContain('split');
      expect(forkAbi!.splitCountParam).toBe('n');
    });

    it('should include merge modifier and mergeCountParam in ABI', () => {
      const consolidateAbi = artifact.abi.find((f) => f.name === 'consolidate');
      expect(consolidateAbi).toBeDefined();
      expect(consolidateAbi!.modifiers).toContain('merge');
      expect(consolidateAbi!.mergeCountParam).toBe('n');
    });

    it('should have empty requiredNftIndices for split function', () => {
      const forkAbi = artifact.abi.find((f) => f.name === 'fork');
      expect(forkAbi!.requiredNftIndices).toEqual([]);
    });

    it('should have empty requiredNftIndices for merge function', () => {
      const consolidateAbi = artifact.abi.find((f) => f.name === 'consolidate');
      expect(consolidateAbi!.requiredNftIndices).toEqual([]);
    });

    it('should have correct input types for fork(int n, sig s)', () => {
      const forkAbi = artifact.abi.find((f) => f.name === 'fork');
      expect(forkAbi!.inputs.length).toBe(2);
      expect(forkAbi!.inputs[0].name).toBe('n');
      expect(forkAbi!.inputs[0].type).toBe('int');
      expect(forkAbi!.inputs[1].name).toBe('s');
      expect(forkAbi!.inputs[1].type).toBe('sig');
    });

    it('should have all 4 functions in the ABI', () => {
      expect(artifact.abi.length).toBe(4);
      expect(artifact.abi.map((f) => f.name).sort()).toEqual(
        ['authorize', 'consolidate', 'fork', 'increment'],
      );
    });
  });

  describe('StatefulContract.split()', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;

      expect(categoryId).toBe(fundingUtxo.txid);
      expect(deployedContract.categoryId).toBe(categoryId);
    });

    it('should split the minting NFT into 3 new masters', async () => {
      // Add funding for the split (need to pay for 3 new minting outputs)
      const fundingUtxo: Utxo = {
        txid: 'b1cd'.repeat(16),
        vout: 0,
        satoshis: 50000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'fork',
        splitFunctionArgs: [3n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
        // fee auto-computed from tx size (1 sat/byte)
        newMintingAmount: 1200n,
      });

      expect(result.tx.txid).toBeDefined();
      expect(result.categoryId).toBe(categoryId);

      const txOutputs = getTxOutputs(result.tx);
      // Expected: master_preserved + 3 new minting + change = 5 outputs
      expect(txOutputs.length).toBe(5);

      // Output 0: master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Outputs 1-3: new minting NFTs with same category
      for (let i = 1; i <= 3; i++) {
        expect(txOutputs[i].token?.nft?.capability).toBe('minting');
        expect(txOutputs[i].token?.category).toBe(categoryId);
        expect(txOutputs[i].amount).toBe(1200n);
      }

      // Output 4: change
      expect(txOutputs[4].token).toBeUndefined();
    });

    it('should have 4 minting NFTs after split (original + 3 new)', async () => {
      // After split, the provider should have 4 minting NFTs at the token address
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(4);
    });
  });

  describe('StatefulContract.merge()', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'c1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
    });

    it('should split into 2 new masters first', async () => {
      const fundingUtxo: Utxo = {
        txid: 'd1cd'.repeat(16),
        vout: 0,
        satoshis: 50000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'fork',
        splitFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
        // fee auto-computed from tx size (1 sat/byte)
        newMintingAmount: 1200n,
      });

      expect(result.tx.txid).toBeDefined();

      // After split: 3 minting NFTs (original + 2 new)
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(3);
    });

    it('should merge 2 consumed masters back into 1', async () => {
      // Get all minting UTXOs
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(3);

      // The surviving master is the first one, consume the other 2
      const consumedMasters = mintingUtxos.slice(1);

      const fundingUtxo: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 10000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.merge({
        provider,
        contract: deployedContract,
        mergeFunctionName: 'consolidate',
        mergeFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        consumedMasterUtxos: consumedMasters,
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
        // fee auto-computed from tx size (1 sat/byte)
      });

      expect(result.tx.txid).toBeDefined();
      expect(result.categoryId).toBe(categoryId);

      const txOutputs = getTxOutputs(result.tx);
      // Expected: master_preserved + change = 2 outputs
      expect(txOutputs.length).toBe(2);

      // Output 0: surviving master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Output 1: change (reclaimed satoshis from burned masters + funding - fee)
      expect(txOutputs[1].token).toBeUndefined();
    });

    it('should have only 1 minting NFT after merge', async () => {
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(1);
    });
  });

  describe('sc.call split', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'aacd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
    });

    it('should split via sc.call.fork().withSplitFunding().send()', async () => {
      const fundingUtxo: Utxo = {
        txid: 'abcd'.repeat(16),
        vout: 0,
        satoshis: 50000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const tx = await deployedContract.call
        .fork(3n, new SignatureTemplate(alicePriv))
        .withSplitFunding(
          [fundingUtxo],
          p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
          p2pkh.address,
        )
        .withNewMintingAmount(1200n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Expected: master_preserved + 3 new minting + change = 5 outputs
      expect(txOutputs.length).toBe(5);

      // Output 0: master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Outputs 1-3: new minting NFTs
      for (let i = 1; i <= 3; i++) {
        expect(txOutputs[i].token?.nft?.capability).toBe('minting');
        expect(txOutputs[i].token?.category).toBe(categoryId);
        expect(txOutputs[i].amount).toBe(1200n);
      }
    });

    it('should have 4 minting NFTs after sc.call split', async () => {
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(4);
    });
  });

  describe('sc.call merge', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy and split first', async () => {
      const fundingUtxo: Utxo = {
        txid: 'bacd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;

      // Split into 2 new masters
      const splitFunding: Utxo = {
        txid: 'bbcd'.repeat(16),
        vout: 0,
        satoshis: 50000n,
      };
      await provider.addUtxo(p2pkh.address, splitFunding);

      await StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'fork',
        splitFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [splitFunding],
        changeAddress: p2pkh.address,
        // fee auto-computed from tx size (1 sat/byte)
        newMintingAmount: 1200n,
      });

      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(3);
    });

    it('should merge via sc.call.consolidate().withConsumedMasters().send()', async () => {
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      const consumedMasters = mintingUtxos.slice(1);

      const fundingUtxo: Utxo = {
        txid: 'bccd'.repeat(16),
        vout: 0,
        satoshis: 10000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const tx = await deployedContract.call
        .consolidate(2n, new SignatureTemplate(alicePriv))
        .withConsumedMasters(consumedMasters, p2pkh.address)
        .withMergeFunding(
          [fundingUtxo],
          p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        )
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Expected: master_preserved + change = 2 outputs
      expect(txOutputs.length).toBe(2);

      // Output 0: surviving master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });

    it('should have only 1 minting NFT after sc.call merge', async () => {
      const utxos = await provider.getUtxos(deployedContract.inner.tokenAddress);
      const mintingUtxos = utxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      );
      expect(mintingUtxos.length).toBe(1);
    });
  });

  describe('sc.call error cases', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    beforeAll(async () => {
      const fundingUtxo: Utxo = {
        txid: 'cacd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });
      deployedContract = result.contract;
    });

    it('should reject split without withSplitFunding()', async () => {
      await expect(
        deployedContract.call.fork(2n, new SignatureTemplate(alicePriv)).send(),
      ).rejects.toThrow('Split functions require funding');
    });

    it('should reject merge without withConsumedMasters()', async () => {
      await expect(
        deployedContract.call.consolidate(2n, new SignatureTemplate(alicePriv)).send(),
      ).rejects.toThrow('Merge functions require consumed masters');
    });

    it('should reject merge with mismatched consumed count via sc.call', async () => {
      const consumed: Utxo = {
        txid: 'cbcd'.repeat(16), vout: 0, satoshis: 1200n,
        token: {
          category: deployedContract.categoryId, amount: 0n,
          nft: { capability: 'minting' as const, commitment: '' },
        },
      };

      await expect(
        deployedContract.call
          .consolidate(2n, new SignatureTemplate(alicePriv))
          .withConsumedMasters([consumed], p2pkh.address)
          .send(),
      ).rejects.toThrow('Merge count is 2 but 1 consumed UTXOs provided');
    });
  });

  describe('error cases', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    beforeAll(async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });
      deployedContract = result.contract;
    });

    it('should reject split with non-split function name', async () => {
      const fundingUtxo: Utxo = { txid: 'f2cd'.repeat(16), vout: 0, satoshis: 50000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      await expect(StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'increment',
        splitFunctionArgs: [3n],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
      })).rejects.toThrow("does not have the 'split' modifier");
    });

    it('should reject split with non-existent function name', async () => {
      const fundingUtxo: Utxo = { txid: 'f3cd'.repeat(16), vout: 0, satoshis: 50000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      await expect(StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'nonexistent',
        splitFunctionArgs: [3n],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
      })).rejects.toThrow('not found in contract');
    });

    it('should reject split with zero count', async () => {
      const fundingUtxo: Utxo = { txid: 'f4cd'.repeat(16), vout: 0, satoshis: 50000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      await expect(StatefulContract.split({
        provider,
        contract: deployedContract,
        splitFunctionName: 'fork',
        splitFunctionArgs: [0n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        fundingUtxos: [fundingUtxo],
        changeAddress: p2pkh.address,
      })).rejects.toThrow('Split count must be a positive integer');
    });

    it('should reject merge with non-merge function name', async () => {
      await expect(StatefulContract.merge({
        provider,
        contract: deployedContract,
        mergeFunctionName: 'increment',
        mergeFunctionArgs: [1n],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        consumedMasterUtxos: [],
        fundingUtxos: [],
        changeAddress: p2pkh.address,
      })).rejects.toThrow("does not have the 'merge' modifier");
    });

    it('should reject merge with mismatched consumed count', async () => {
      const consumed: Utxo = {
        txid: 'f5cd'.repeat(16), vout: 0, satoshis: 1200n,
        token: { category: deployedContract.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
      };

      await expect(StatefulContract.merge({
        provider,
        contract: deployedContract,
        mergeFunctionName: 'consolidate',
        mergeFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        consumedMasterUtxos: [consumed], // says 2 but provides 1
        fundingUtxos: [],
        changeAddress: p2pkh.address,
      })).rejects.toThrow('Merge count is 2 but 1 consumed UTXOs provided');
    });
  });
});
