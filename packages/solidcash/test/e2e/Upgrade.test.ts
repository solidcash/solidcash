import { compileString } from '../direct-compile.js';
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// V1: simple counter with upgrade and unsafe functions
const COUNTER_V1 = `
pragma solidcash >=0.8.0;

contract CounterV1(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// V2: counter that increments by 2 instead of 1
const COUNTER_V2 = `
pragma solidcash >=0.8.0;

contract CounterV2(pubkey admin) {
    int counter;

    function incrementByTwo() {
        this.counter = this.counter + 2;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// V3: extended state layout (counter + extra field) - append-only extension
const COUNTER_V3 = `
pragma solidcash >=0.8.0;

contract CounterV3(pubkey admin) {
    int counter;
    int bonus;

    function incrementWithBonus() {
        this.counter = this.counter + 1;
        this.bonus = this.bonus + 10;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Contract WITHOUT upgrade modifier (for negative tests)
const NO_UPGRADE = `
pragma solidcash >=0.8.0;

contract NoUpgrade(pubkey admin) {
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

// V1_OVERFLOW: 3 bytes32 fields (3*33=99 bytes, fits in 1 data NFT)
const OVERFLOW_V1 = `
pragma solidcash >=0.8.0;

contract OverflowV1(pubkey admin) {
    bytes32 a;
    bytes32 b;
    bytes32 c;

    function setA(bytes32 newA) {
        this.a = newA;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// V2_OVERFLOW: 5 bytes32 fields (5*33=165 bytes, needs 2 data NFTs)
// NFT 0: a, b, c (99 bytes), NFT 1: d, e (66 bytes)
const OVERFLOW_V2 = `
pragma solidcash >=0.8.0;

contract OverflowV2(pubkey admin) {
    bytes32 a;
    bytes32 b;
    bytes32 c;
    bytes32 d;
    bytes32 e;

    function setD(bytes32 newD) {
        this.d = newD;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('StatefulContract.upgrade()', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const v1Artifact = compileString(COUNTER_V1);
  const v2Artifact = compileString(COUNTER_V2);
  const v3Artifact = compileString(COUNTER_V3);
  const noUpgradeArtifact = compileString(NO_UPGRADE);
  const overflowV1Artifact = compileString(OVERFLOW_V1);
  const overflowV2Artifact = compileString(OVERFLOW_V2);

  describe('upgrade modifier in artifact ABI', () => {
    it('should include upgrade in ABI modifiers', () => {
      const migrateAbi = v1Artifact.abi.find((f) => f.name === 'migrate');
      expect(migrateAbi).toBeDefined();
      expect(migrateAbi!.modifiers).toContain('upgrade');
    });

    it('should not have upgrade modifier on non-upgrade functions', () => {
      const incrementAbi = v1Artifact.abi.find((f) => f.name === 'increment');
      expect(incrementAbi).toBeDefined();
      expect(incrementAbi!.modifiers ?? []).not.toContain('upgrade');
    });
  });

  describe('deploy V1 then upgrade to V2', () => {
    let v1Contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy V1', async () => {
      const fundingUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      v1Contract = result.contract;
      categoryId = result.categoryId;

      expect(categoryId).toBe(fundingUtxo.txid);
      expect(v1Contract.categoryId).toBe(categoryId);
    });

    it('should increment V1 counter', async () => {
      const tx = await v1Contract.call.increment().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master preserved
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
      // Output 1: data NFT with counter=1
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v1Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
    });

    it('should upgrade from V1 to V2', async () => {
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: v1Contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      expect(upgradeResult.categoryId).toBe(categoryId);
      expect(upgradeResult.tx.txid).toBeDefined();
      expect(upgradeResult.contract.categoryId).toBe(categoryId);

      const txOutputs = getTxOutputs(upgradeResult.tx);

      // Output 0: minting NFT at NEW address
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);

      // Output 1: data NFT preserved with current state (counter=1)
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(categoryId);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v2Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);

      // Update reference for subsequent tests
      v1Contract = upgradeResult.contract;
    });

    it('should have different address after upgrade (bytecode changed)', () => {
      const v1Instance = new Contract(v1Artifact, [alicePub], { provider });
      const v2Instance = new Contract(v2Artifact, [alicePub], { provider });

      // V1 and V2 have different bytecode -> different addresses
      expect(v1Instance.address).not.toBe(v2Instance.address);
      expect(v1Instance.tokenAddress).not.toBe(v2Instance.tokenAddress);
    });

    it('should use V2 logic after upgrade (incrementByTwo)', async () => {
      // v1Contract is now a V2 ConnectedStatefulContract after upgrade
      const v2Contract = v1Contract;

      const tx = await v2Contract.call.incrementByTwo().send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v2Artifact.stateLayout!, 0,
      );
      // Was 1 from V1 increment, now +2 from V2 incrementByTwo = 3
      expect(parsed.counter).toBe(3n);
    });
  });

  describe('error cases', () => {
    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

    beforeAll(async () => {
      const fundingUtxo: Utxo = {
        txid: 'b1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(noUpgradeArtifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
    });

    it('should reject upgrade if function lacks upgrade modifier', async () => {
      await expect(StatefulContract.upgrade({
        provider,
        oldContract: deployedContract,
        upgradeFunctionName: 'regularFunc',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      })).rejects.toThrow('does not have the \'upgrade\' modifier');
    });

    it('should reject upgrade if function does not exist', async () => {
      await expect(StatefulContract.upgrade({
        provider,
        oldContract: deployedContract,
        upgradeFunctionName: 'nonexistent',
        upgradeFunctionArgs: [],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      })).rejects.toThrow('not found in contract');
    });

    it('should reject upgrade to non-stateful artifact', async () => {
      // Deploy a V1 contract (which has the upgrade modifier) for this test
      const fundingUtxo: Utxo = {
        txid: 'b2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const v1Result = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      await expect(StatefulContract.upgrade({
        provider,
        oldContract: v1Result.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: p2pkhArtifact,
        newConstructorArgs: [alicePkh],
      })).rejects.toThrow('not a stateful contract');
    });
  });

  describe('categoryId preservation', () => {
    it('should preserve categoryId across upgrade', async () => {
      const fundingUtxo: Utxo = {
        txid: 'c1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const deployResult = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 42n },
        changeAddress: p2pkh.address,
      });

      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      // CategoryId must be identical
      expect(upgradeResult.categoryId).toBe(deployResult.categoryId);

      // The minting NFT must have the same category
      const txOutputs = getTxOutputs(upgradeResult.tx);
      expect(txOutputs[0].token?.category).toBe(deployResult.categoryId);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
    });
  });

  describe('data NFT state survival', () => {
    it('should preserve state across upgrade', async () => {
      const fundingUtxo: Utxo = {
        txid: 'd1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      // Deploy V1 with counter=100
      const deployResult = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 100n },
        changeAddress: p2pkh.address,
      });

      // Upgrade to V2
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      // Data NFT state should be preserved with counter=100
      const txOutputs = getTxOutputs(upgradeResult.tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v2Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(100n);

      // Use V2 to mutate state
      const v2 = upgradeResult.contract;
      const tx = await v2.call.incrementByTwo().send();
      const v2Outputs = getTxOutputs(tx);
      const v2Parsed = parsePushdataCommitment(
        v2Outputs[1].token!.nft!.commitment, v2Artifact.stateLayout!, 0,
      );
      expect(v2Parsed.counter).toBe(102n);
    });
  });

  describe('state extension (V1 -> V3 with new state variable)', () => {
    it('should upgrade from V1 to V3 and initialise new field with default', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      // Deploy V1 with counter=5
      const deployResult = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 5n },
        changeAddress: p2pkh.address,
      });

      // Upgrade directly from V1 to V3 (counter -> counter + bonus)
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
      });

      expect(upgradeResult.categoryId).toBe(deployResult.categoryId);

      // Data NFT should have counter=5 preserved and bonus=0 (default)
      const txOutputs = getTxOutputs(upgradeResult.tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(5n);
      expect(parsed.bonus).toBe(0n);
    });

    it('should use V3 logic after upgrade (incrementWithBonus)', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      // Deploy V1 with counter=10
      const deployResult = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 10n },
        changeAddress: p2pkh.address,
      });

      // Upgrade V1 -> V3
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
      });

      const v3 = upgradeResult.contract;

      // Call incrementWithBonus: counter + 1, bonus + 10
      const tx = await v3.call.incrementWithBonus().send();
      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(11n);
      expect(parsed.bonus).toBe(10n);
    });

    it('should chain V1 -> V2 -> V3 upgrade preserving state throughout', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e3cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      // Deploy V1 with counter=0
      const deployResult = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      // Increment once on V1 (counter=1)
      await deployResult.contract.call.increment().send();

      // Upgrade V1 -> V2
      const v2Result = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      // IncrementByTwo on V2 (counter=3)
      await v2Result.contract.call.incrementByTwo().send();

      // Upgrade V2 -> V3 (extends state with bonus)
      const v3Result = await StatefulContract.upgrade({
        provider,
        oldContract: v2Result.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
      });

      // After V2 -> V3 upgrade: counter=3, bonus=0 (default)
      const upgradeOutputs = getTxOutputs(v3Result.tx);
      const upgradeParsed = parsePushdataCommitment(
        upgradeOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(upgradeParsed.counter).toBe(3n);
      expect(upgradeParsed.bonus).toBe(0n);

      // Use V3: incrementWithBonus (counter=4, bonus=10)
      const tx = await v3Result.contract.call.incrementWithBonus().send();
      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(4n);
      expect(parsed.bonus).toBe(10n);
    });
  });

  describe('state extension overflowing into new data NFT', () => {
    it('should verify layout: V1 has 1 data NFT, V2 has 2', () => {
      expect(overflowV1Artifact.stateLayout!.dataNftCount).toBe(1);
      expect(overflowV2Artifact.stateLayout!.dataNftCount).toBe(2);
    });

    it('should reject upgrade without funder when new NFTs are needed', async () => {
      const fundingUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const zeroBytes32 = new Uint8Array(32);
      const deployResult = await StatefulContract.deploy(overflowV1Artifact, [alicePub], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { a: zeroBytes32, b: zeroBytes32, c: zeroBytes32 },
        changeAddress: p2pkh.address,
      });

      await expect(StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
      })).rejects.toThrow('Provide fundingUtxo and funder');
    });

    it('should mint new data NFT when state overflows to second NFT', async () => {
      const deployFunding: Utxo = {
        txid: 'f2cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, deployFunding);

      const aVal = new Uint8Array(32);
      aVal[0] = 0xAA;
      const bVal = new Uint8Array(32);
      bVal[0] = 0xBB;
      const cVal = new Uint8Array(32);
      cVal[0] = 0xCC;

      // Deploy OverflowV1 with 1 data NFT
      const deployResult = await StatefulContract.deploy(overflowV1Artifact, [alicePub], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { a: aVal, b: bVal, c: cVal },
        changeAddress: p2pkh.address,
      });

      // Provide a separate funding UTXO for the upgrade
      const upgradeFunding: Utxo = {
        txid: 'f3cd'.repeat(16),
        vout: 0,
        satoshis: 10000n,
      };
      await provider.addUtxo(p2pkh.address, upgradeFunding);

      // Upgrade to OverflowV2 (needs 2 data NFTs)
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
        fundingUtxo: upgradeFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      expect(upgradeResult.categoryId).toBe(deployResult.categoryId);

      const txOutputs = getTxOutputs(upgradeResult.tx);

      // Output 0: master NFT preserved with same satoshis
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(deployResult.categoryId);

      // Output 1: existing data NFT (nftIndex 0) - a, b, c preserved
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      const nft0Parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, overflowV2Artifact.stateLayout!, 0,
      );
      expect(nft0Parsed.a).toEqual(aVal);
      expect(nft0Parsed.b).toEqual(bVal);
      expect(nft0Parsed.c).toEqual(cVal);

      // Output 2: NEW data NFT (nftIndex 1) - d, e initialised to zero
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(deployResult.categoryId);
      const nft1Parsed = parsePushdataCommitment(
        txOutputs[2].token!.nft!.commitment, overflowV2Artifact.stateLayout!, 1,
      );
      expect(nft1Parsed.d).toEqual(new Uint8Array(32));
      expect(nft1Parsed.e).toEqual(new Uint8Array(32));
    });

    it('should use V2 logic with new data NFT after overflow upgrade', async () => {
      const deployFunding: Utxo = {
        txid: 'f4cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await provider.addUtxo(p2pkh.address, deployFunding);

      const zeroBytes32 = new Uint8Array(32);

      const deployResult = await StatefulContract.deploy(overflowV1Artifact, [alicePub], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { a: zeroBytes32, b: zeroBytes32, c: zeroBytes32 },
        changeAddress: p2pkh.address,
      });

      const upgradeFunding: Utxo = {
        txid: 'f5cd'.repeat(16),
        vout: 0,
        satoshis: 10000n,
      };
      await provider.addUtxo(p2pkh.address, upgradeFunding);

      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
        fundingUtxo: upgradeFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });

      const v2 = upgradeResult.contract;

      // Call setD to write to the new data NFT (nftIndex 1)
      const dVal = new Uint8Array(32);
      dVal[0] = 0xDD;
      const tx = await v2.call.setD(dVal).send();
      const txOutputs = getTxOutputs(tx);

      // Verify d was written to nftIndex 1
      const nft1Parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, overflowV2Artifact.stateLayout!, 1,
      );
      expect(nft1Parsed.d).toEqual(dVal);
    });
  });
});
