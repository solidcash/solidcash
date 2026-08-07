import { compileString } from '../direct-compile.js';
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

const TIERED_UNSAFE_CONTRACT = `
pragma solidcash >=0.8.0;

contract TieredUnsafe(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function tier0(sig s) unsafe {
        require(checkSig(s, admin));
    }

    function tier1(sig s) unsafe(1) {
        require(checkSig(s, admin));
    }

    function tier2(sig s) unsafe(2) {
        require(checkSig(s, admin));
    }
}
`;

describe('UnsafeTiers', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let artifact: Artifact;

  beforeAll(() => {
    artifact = compileString(TIERED_UNSAFE_CONTRACT);
  });

  describe('ABI structure', () => {
    it('should compile with tiered unsafe modifiers', () => {
      const contract = new Contract(artifact, [alicePub], { provider });
      expect(contract).toBeDefined();
    });

    it('should have unsafeTier 0 for plain unsafe', () => {
      const tier0Abi = artifact.abi.find((f) => f.name === 'tier0');
      expect(tier0Abi).toBeDefined();
      expect(tier0Abi!.modifiers).toContain('unsafe');
      expect(tier0Abi!.unsafeTier).toBe(0);
    });

    it('should have unsafeTier 1 for unsafe(1)', () => {
      const tier1Abi = artifact.abi.find((f) => f.name === 'tier1');
      expect(tier1Abi).toBeDefined();
      expect(tier1Abi!.modifiers).toContain('unsafe');
      expect(tier1Abi!.unsafeTier).toBe(1);
    });

    it('should have unsafeTier 2 for unsafe(2)', () => {
      const tier2Abi = artifact.abi.find((f) => f.name === 'tier2');
      expect(tier2Abi).toBeDefined();
      expect(tier2Abi!.modifiers).toContain('unsafe');
      expect(tier2Abi!.unsafeTier).toBe(2);
    });

    it('should have all NFT indices for tier0 but not for tier1/tier2', () => {
      const tier0Abi = artifact.abi.find((f) => f.name === 'tier0');
      const tier1Abi = artifact.abi.find((f) => f.name === 'tier1');
      const tier2Abi = artifact.abi.find((f) => f.name === 'tier2');

      // tier0 (unsafe) gets ALL NFT indices
      expect(tier0Abi!.requiredNftIndices).toEqual([0]);

      // tier1 and tier2 get only accessed indices (empty since no state access in body)
      expect(tier1Abi!.requiredNftIndices).toEqual([]);
      expect(tier2Abi!.requiredNftIndices).toEqual([]);
    });

    it('should have all 4 functions in the ABI', () => {
      expect(artifact.abi.length).toBe(4);
      expect(artifact.abi.map((f) => f.name).sort()).toEqual(
        ['increment', 'tier0', 'tier1', 'tier2'].sort(),
      );
    });
  });

  describe('deploy and use tiered unsafe', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'abcd'.repeat(16),
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
    });

    it('should increment the counter (normal function)', async () => {
      const tx = await deployedContract.call.increment().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });

    it('should call tier1 via sc.call API (auto-derivation skipped)', async () => {
      const tx = await deployedContract.call.tier1(new SignatureTemplate(alicePriv)).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master preserved (no data NFT changes)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });

    it('should call tier2 via sc.call API (auto-derivation skipped)', async () => {
      const tx = await deployedContract.call.tier2(new SignatureTemplate(alicePriv)).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master preserved (no data NFT changes)
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
    });
  });
});
