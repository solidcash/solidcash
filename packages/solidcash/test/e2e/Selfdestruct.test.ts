import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract,
  getDataNftAddress,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobAddress,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Simple counter with selfdestruct
const SELFDESTRUCT_COUNTER = `
pragma solidcash >=0.8.0;

contract SelfdestructCounter(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function destroy(sig s) selfdestruct {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Contract without selfdestruct (for error tests)
const NO_SELFDESTRUCT = `
pragma solidcash >=0.8.0;

contract NoSelfdestruct(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function regularFunc(sig s) {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const selfdestructArtifact = compileString(SELFDESTRUCT_COUNTER);
const noSelfdestructArtifact = compileString(NO_SELFDESTRUCT);

describe('StatefulContract.destroy()', () => {
  describe('selfdestruct modifier in artifact ABI', () => {
    it('should include selfdestruct in ABI modifiers', () => {
      const destroyAbi = selfdestructArtifact.abi.find((f) => f.name === 'destroy');
      expect(destroyAbi).toBeDefined();
      expect(destroyAbi!.modifiers).toContain('selfdestruct');
    });

    it('should not have selfdestruct modifier on non-selfdestruct functions', () => {
      const incrementAbi = selfdestructArtifact.abi.find((f) => f.name === 'increment');
      expect(incrementAbi).toBeDefined();
      expect(incrementAbi!.modifiers ?? []).not.toContain('selfdestruct');
    });
  });

  describe('deploy, increment, then destroy', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'aacd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(selfdestructArtifact, [alicePub], {
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

    it('should increment the counter', async () => {
      const tx = await deployedContract.call.increment().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, selfdestructArtifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
    });

    it('should destroy the contract and reclaim funds', async () => {
      const result = await StatefulContract.destroy({
        provider,
        contract: deployedContract,
        destroyFunctionName: 'destroy',
        destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
        recipient: bobAddress,
      });

      expect(result.txs).toHaveLength(1);
      expect(result.totalReclaimed).toBeGreaterThan(0n);

      const txOutputs = getTxOutputs(result.txs[0]);

      // Should have a single output to the recipient (no minting NFT preserved)
      expect(txOutputs).toHaveLength(1);
      expect(txOutputs[0].to).toBe(bobAddress);

      // No tokens on the output (master NFT destroyed)
      expect(txOutputs[0].token).toBeUndefined();
    });
  });

  describe('error cases', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    beforeAll(async () => {
      const fundingUtxo: Utxo = {
        txid: 'cccd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(noSelfdestructArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
    });

    it('should reject destroy if function lacks selfdestruct modifier', async () => {
      await expect(StatefulContract.destroy({
        provider,
        contract: deployedContract,
        destroyFunctionName: 'regularFunc',
        destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
        recipient: bobAddress,
      })).rejects.toThrow('does not have the \'selfdestruct\' modifier');
    });

    it('should reject destroy if function does not exist', async () => {
      await expect(StatefulContract.destroy({
        provider,
        contract: deployedContract,
        destroyFunctionName: 'nonexistent',
        destroyFunctionArgs: [],
        recipient: bobAddress,
      })).rejects.toThrow('not found in contract');
    });
  });

  describe('batch destruction with maxInputsPerTx', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('should batch destruction into multiple transactions when input count exceeds limit', async () => {
      // Deploy a simple counter contract
      const fundingUtxo: Utxo = {
        txid: 'ddcd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(selfdestructArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      const deployedContract = result.contract;
      const categoryId = result.categoryId;

      // The deployed contract has 1 master + 1 data NFT = 2 inputs.
      // To test batching, we need more inputs. We can manually add extra
      // "phantom" data NFTs at the data NFT address. These will be discovered
      // by destroy() and included as additional data NFT inputs.
      // (In practice, extra data NFTs appear when state layout has many fields.)
      const dataNftAddress = getDataNftAddress(deployedContract.inner, categoryId);

      // Add phantom data NFTs with vout > 1 to sort after the real one.
      // Give them valid pushdata commitments (matching the stateLayout for nftIdx 0).
      // For `int counter`, a valid commitment is just an encoded int value.
      const { buildPushdataCommitment } = await import('@solidcash/utils');
      for (let i = 0; i < 4; i++) {
        const commitment = buildPushdataCommitment(
          selfdestructArtifact.stateLayout!, { counter: BigInt(i + 10) }, 0,
        );
        const phantomUtxo: Utxo = {
          txid: `d${i + 1}`.padEnd(64, `${i + 1}`),
          vout: i + 2, // vout > 1 to sort after real data NFT
          satoshis: 1200n,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable', commitment },
          },
        };
        await provider.addUtxo(dataNftAddress, phantomUtxo);
      }

      // Total inputs: master(1) + real dataNft(1) + phantom dataNfts(4) = 6
      // With maxInputsPerTx=3, need multiple batches
      const destroyResult = await StatefulContract.destroy({
        provider,
        contract: deployedContract,
        destroyFunctionName: 'destroy',
        destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
        recipient: bobAddress,
        maxInputsPerTx: 3,
      });

      // Should need multiple transactions
      expect(destroyResult.txs.length).toBeGreaterThanOrEqual(2);
      expect(destroyResult.totalReclaimed).toBeGreaterThan(0n);

      // Verify final transaction has no minting NFT in outputs
      const finalTx = destroyResult.txs[destroyResult.txs.length - 1];
      const finalOutputs = getTxOutputs(finalTx);
      const hasMintingNft = finalOutputs.some(
        (o) => o.token?.category === categoryId && o.token?.nft?.capability === 'minting',
      );
      expect(hasMintingNft).toBe(false);

      // Intermediate transactions should preserve the master (minting NFT)
      if (destroyResult.txs.length > 1) {
        for (let i = 0; i < destroyResult.txs.length - 1; i++) {
          const intermediateOutputs = getTxOutputs(destroyResult.txs[i]);
          const hasMinting = intermediateOutputs.some(
            (o) => o.token?.category === categoryId && o.token?.nft?.capability === 'minting',
          );
          expect(hasMinting).toBe(true);
        }
      }
    });
  });

  describe('multi-threaded destruction', () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('should destroy all thread masters', async () => {
      const fundingUtxo: Utxo = {
        txid: 'eecd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(selfdestructArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
        threadCount: 2,
      });

      const deployedContract = result.contract;

      // Destroy - should handle both thread masters
      const destroyResult = await StatefulContract.destroy({
        provider,
        contract: deployedContract,
        destroyFunctionName: 'destroy',
        destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
        recipient: bobAddress,
      });

      expect(destroyResult.txs.length).toBeGreaterThanOrEqual(1);
      expect(destroyResult.totalReclaimed).toBeGreaterThan(0n);

      // All outputs should go to recipient, no minting NFTs
      const finalTx = destroyResult.txs[destroyResult.txs.length - 1];
      const finalOutputs = getTxOutputs(finalTx);
      const hasMintingNft = finalOutputs.some(
        (o) => o.token?.nft?.capability === 'minting',
      );
      expect(hasMintingNft).toBe(false);
    });
  });
});
