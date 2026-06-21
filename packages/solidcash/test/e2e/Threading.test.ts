import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract,
  StateReader, ThreadManager, ThreadHandle,
  getDataNftAddress,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import {
  alicePkh,
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Contract with two external state variables on separate data NFTs,
// plus a non-stateful authorize function for gated split/merge.
const THREADABLE_CONTRACT = `
pragma solidcash >=0.8.0;

contract ThreadableCounter() {
    external int x;
    external int y;

    function incrementX() {
        this.x = this.x + 1;
    }

    function incrementY() {
        this.y = this.y + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('Threading', () => {
  const artifact = compileString(THREADABLE_CONTRACT);
  const stateLayout = artifact.stateLayout!;

  describe('deploy with threadCount', () => {
    it('should deploy with threadCount=2 creating 2 minting NFTs', async () => {
      const provider = createTestProvider();
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

      const fundingUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: 0n, y: 0n },
        changeAddress: p2pkh.address,
        threadCount: 2,
      });

      const txOutputs = getTxOutputs(result.tx);

      // Outputs 0 and 1: minting NFTs
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(result.categoryId);
      expect(txOutputs[1].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.category).toBe(result.categoryId);

      // Outputs 2 and 3: data NFTs (mutable)
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(result.categoryId);
      expect(txOutputs[3].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[3].token?.category).toBe(result.categoryId);
    });

    it('should deploy with default threadCount=1 (backward compat)', async () => {
      const provider = createTestProvider();
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

      const fundingUtxo: Utxo = {
        txid: 'a2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: 0n, y: 0n },
        changeAddress: p2pkh.address,
      });

      const txOutputs = getTxOutputs(result.tx);

      // Output 0: single minting NFT
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      // Output 1: first data NFT (mutable)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
    });

    it('should throw on invalid threadCount', async () => {
      const provider = createTestProvider();
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

      const fundingUtxo: Utxo = {
        txid: 'a3cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      await expect(StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: 0n, y: 0n },
        changeAddress: p2pkh.address,
        threadCount: 0,
      })).rejects.toThrow('threadCount must be a positive integer');
    });
  });

  describe('StateReader.findMasterUtxos', () => {
    it('should find all minting NFTs sorted by vout', () => {
      const reader = new StateReader(stateLayout);
      const categoryId = 'cccd'.repeat(16);

      const utxos: Utxo[] = [
        {
          txid: 'aacd'.repeat(16), vout: 2, satoshis: 1200n,
          token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        },
        {
          txid: 'aacd'.repeat(16), vout: 0, satoshis: 1200n,
          token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        },
        {
          txid: 'aacd'.repeat(16), vout: 1, satoshis: 1200n,
          token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '00' } },
        },
      ];

      const masters = reader.findMasterUtxos(utxos, categoryId);
      expect(masters).toHaveLength(2);
      expect(masters[0].vout).toBe(0);
      expect(masters[1].vout).toBe(2);
    });

    it('should return empty array when no minting NFTs', () => {
      const reader = new StateReader(stateLayout);
      const masters = reader.findMasterUtxos([], 'cccd'.repeat(16));
      expect(masters).toHaveLength(0);
    });
  });

  describe('ThreadManager', () => {
    // Helper to set up a connected stateful contract via real token genesis.
    // Genesis-es `masterCount` minting NFTs + dataNftCount mutable data NFTs under
    // one real category, salting addresses the way withCategory expects.
    async function setupContract(
      masterCount: number,
      opts?: { masterSatoshis?: bigint },
    ): Promise<{
        sc: ReturnType<typeof StatefulContract.withCategory>;
        provider: MockNetworkProvider; categoryId: string;
      }> {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const commits = buildInitialStateCommitments(stateLayout, { x: 0n, y: 0n });
      const masterSatoshis = opts?.masterSatoshis ?? 10000n;

      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const dataNftAddr = getDataNftAddress(salted, cat);
        const outs = [];
        for (let i = 0; i < masterCount; i++) {
          outs.push({
            address: salted.tokenAddress, satoshis: masterSatoshis,
            token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
          });
        }
        for (let i = 0; i < commits.length; i++) {
          outs.push({
            address: dataNftAddr, satoshis: 10000n,
            token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: commits[i] } },
          });
        }
        return outs;
      });

      const sc = StatefulContract.withCategory(contract, categoryId);
      return { sc, provider, categoryId };
    }

    describe('discover', () => {
      it('should discover threads with round-robin partitions', async () => {
        const { sc } = await setupContract(2);
        const tm = new ThreadManager(sc);
        const threads = await tm.discover();

        expect(threads).toHaveLength(2);
        expect(threads[0].threadId).toBe(0);
        expect(threads[0].dataNftIndices).toEqual([0]);
        expect(threads[1].threadId).toBe(1);
        expect(threads[1].dataNftIndices).toEqual([1]);
      });

      it('should discover single thread when 1 minting NFT', async () => {
        const { sc } = await setupContract(1);
        const tm = new ThreadManager(sc);
        const threads = await tm.discover();

        expect(threads).toHaveLength(1);
        expect(threads[0].dataNftIndices).toEqual([0, 1]);
      });
    });

    describe('partition validation via ThreadHandle.call', () => {
      it('should throw when function requires NFT outside thread partition', async () => {
        const { sc, categoryId: cid } = await setupContract(1);

        const handle = new ThreadHandle(
          0,
          { txid: 'ffcd'.repeat(16), vout: 0, satoshis: 1200n,
            token: { category: cid, amount: 0n, nft: { capability: 'minting', commitment: '' } } },
          [0], // thread 0 only owns NFT index 0
          sc,
        );

        // incrementY requires NFT index 1, which is not in this thread's partition
        expect(() => handle.call('incrementY')).toThrow(
          /thread 0 only owns indices \[0\]/,
        );
      });

      it('should succeed when function requires NFT within thread partition', async () => {
        const { sc, categoryId: cid } = await setupContract(1);

        const handle = new ThreadHandle(
          0,
          { txid: 'ffcd'.repeat(16), vout: 0, satoshis: 1200n,
            token: { category: cid, amount: 0n, nft: { capability: 'minting', commitment: '' } } },
          [0], // thread 0 owns NFT index 0
          sc,
        );

        // incrementX requires NFT index 0, which IS in this thread's partition
        expect(() => handle.call('incrementX')).not.toThrow();
      });

      it('should throw for unknown function name', async () => {
        const { sc, categoryId: cid } = await setupContract(1);

        const handle = new ThreadHandle(
          0,
          { txid: 'ffcd'.repeat(16), vout: 0, satoshis: 1200n,
            token: { category: cid, amount: 0n, nft: { capability: 'minting', commitment: '' } } },
          [0, 1],
          sc,
        );

        expect(() => handle.call('nonexistent')).toThrow("Function 'nonexistent' not found");
      });
    });

    describe('round-robin partitioning', () => {
      it('should distribute indices evenly with 2 threads and 2 NFTs', async () => {
        const { sc } = await setupContract(2);
        const tm = new ThreadManager(sc);
        const threads = await tm.discover();

        expect(threads[0].dataNftIndices).toEqual([0]);
        expect(threads[1].dataNftIndices).toEqual([1]);
      });
    });

    describe('split validation', () => {
      it('should throw on split with threadCount < 2', async () => {
        const { sc } = await setupContract(1);
        const tm = new ThreadManager(sc);

        await expect(tm.split({
          functionName: 'authorize',
          args: [alicePub, new SignatureTemplate(alicePriv)],
          threadCount: 1,
        })).rejects.toThrow('threadCount must be at least 2');
      });

      it('should throw on split when multiple minting NFTs already exist', async () => {
        const { sc } = await setupContract(2);
        const tm = new ThreadManager(sc);

        await expect(tm.split({
          functionName: 'authorize',
          args: [alicePub, new SignatureTemplate(alicePriv)],
          threadCount: 2,
        })).rejects.toThrow('Split requires exactly 1 minting NFT');
      });

      it('should throw on overlapping partitions', async () => {
        const { sc } = await setupContract(1, { masterSatoshis: 10000n });
        const tm = new ThreadManager(sc);

        await expect(tm.split({
          functionName: 'authorize',
          args: [alicePub, new SignatureTemplate(alicePriv)],
          threadCount: 2,
          partitions: [[0, 1], [1]], // overlap on index 1
        })).rejects.toThrow('Partition overlap');
      });
    });

    describe('merge validation', () => {
      it('should throw when merging fewer than 2 threads', async () => {
        const { sc, categoryId: cid } = await setupContract(1);
        const tm = new ThreadManager(sc);

        const handle = new ThreadHandle(
          0,
          { txid: 'ffcd'.repeat(16), vout: 0, satoshis: 1200n,
            token: { category: cid, amount: 0n, nft: { capability: 'minting', commitment: '' } } },
          [0, 1],
          sc,
        );

        await expect(tm.merge([handle], {
          functionName: 'authorize',
          args: [alicePub, new SignatureTemplate(alicePriv)],
        })).rejects.toThrow('merge() requires at least 2 threads');
      });
    });

    describe('StatefulTransactionBuilder.addOutput guard', () => {
      it('should throw when adding minting NFT output of same category', async () => {
        const { sc, categoryId: cid } = await setupContract(1);

        const builder = await sc.functions.incrementX();

        expect(() => builder.addOutput({
          to: sc.tokenAddress,
          amount: 1200n,
          token: {
            amount: 0n,
            category: cid,
            nft: { capability: 'minting', commitment: '' },
          },
        })).toThrow('Cannot create additional token outputs of this category');
      });

      it('should allow adding minting NFT of a different category', async () => {
        const otherCid = 'f8cd'.repeat(16);
        const { sc } = await setupContract(1);

        const builder = await sc.functions.incrementX();

        // Should NOT throw - different category
        expect(() => builder.addOutput({
          to: sc.tokenAddress,
          amount: 1200n,
          token: {
            amount: 0n,
            category: otherCid,
            nft: { capability: 'minting', commitment: '' },
          },
        })).not.toThrow();
      });
    });

    describe('getThreads', () => {
      it('should return current thread set after discover', async () => {
        const { sc } = await setupContract(2);
        const tm = new ThreadManager(sc);

        expect(tm.getThreads()).toEqual([]);

        await tm.discover();
        const threads = tm.getThreads();

        expect(threads).toHaveLength(2);
        expect(threads[0].threadId).toBe(0);
        expect(threads[1].threadId).toBe(1);
      });
    });
  });
});
