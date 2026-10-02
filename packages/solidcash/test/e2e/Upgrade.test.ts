import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract, type FunctionArgument, HashType, SignatureAlgorithm, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { buildPushdataCommitment, parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobPriv,
  bobPub,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { assertApplicationScriptSize } from '../application-size-budgets.js';

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

// OVERFLOW_WIDE: 8 bytes32 fields in 3 data NFTs (a-c, d-f, g-h), so an upgrade from V1_OVERFLOW mints two
const OVERFLOW_WIDE = `
pragma solidcash >=0.8.0;

contract OverflowWide(pubkey admin) {
    bytes32 a;
    bytes32 b;
    bytes32 c;
    bytes32 d;
    bytes32 e;
    bytes32 f;
    bytes32 g;
    bytes32 h;

    function setH(bytes32 newH) {
        this.h = newH;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

// MULTISIG_UPGRADE: a two-of-two multisig authorizes the upgrade
const MULTISIG_UPGRADE = `
pragma solidcash >=0.8.0;

contract MultisigUpgrade(pubkey first, pubkey second) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function migrate(sig s1, sig s2) upgrade {
        require(checkMultiSig([s1, s2], [first, second]));
    }
}
`;

// HELPER_UPGRADE: the authorizing checkSig is in an internal helper that a non-upgrade entry shares
const HELPER_UPGRADE = `
pragma solidcash >=0.8.0;

contract HelperUpgrade(pubkey admin) {
    int counter;

    function authorize(sig s) internal {
        require(checkSig(s, admin));
    }

    function bump(sig s) {
        authorize(s);
        this.counter = this.counter + 1;
        require(this.counter > 0);
    }

    function migrate(sig s) upgrade {
        authorize(s);
        require(this.counter >= 0);
    }
}
`;

// EITHER_UPGRADE: either of two keys authorizes; the other signature is empty and fails its check
const EITHER_UPGRADE = `
pragma solidcash >=0.8.0;

contract EitherUpgrade(pubkey first, pubkey second) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function migrate(sig s1, sig s2) upgrade {
        require(checkSig(s1, first) || checkSig(s2, second));
    }
}
`;

// NEXT_VERSION: the replacement for the three above, with the same layout
const NEXT_VERSION = `
pragma solidcash >=0.8.0;

contract NextVersion(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
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
  assertApplicationScriptSize(
    'proxyUpgrade', v1Artifact, v2Artifact, v3Artifact, overflowV1Artifact, overflowV2Artifact,
  );

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

  // An overflow upgrade mints the new layout's data NFTs as a run at the canonical data-NFT covenant, right after the
  // old data NFTs. The census pins the run's SHAPE (exactly the old data NFTs in; out the same plus a contiguous run
  // at the covenant). A direct upgrade's authorizing signature must sign all outputs (base sighash type ALL), which
  // binds the run's CONTENTS: the replacement bytecode, the run length and the new commitments cannot be rebound
  // under a NONE/SINGLE signature (kernel lane 4b89cce8e signature fence; ledger D10, R1-R3).
  describe('overflow data NFT run under a signature over all outputs', () => {
    const wideArtifact = compileString(OVERFLOW_WIDE);
    const OP_TRUE = hexToBin('51');
    const anyoneCanSpend = {
      generateLockingBytecode: (): Uint8Array => OP_TRUE,
      generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
    };
    const field = (label: string): Uint8Array => sha256.hash(utf8ToBin(label));
    const coin = (label: string): Utxo => ({ txid: binToHex(field(label)), vout: 0, satoshis: 100_000n });
    const keyLock = encodeLockingBytecodeP2pkh(alicePkh);
    const refused = /mandatory-script-verify-flag-failed/;
    const defaultHashType = HashType.SIGHASH_ALL | HashType.SIGHASH_UTXOS;
    type Tx = ReturnType<typeof decodeTransactionUnsafe>;

    // Deploys OverflowV1 and signs its upgrade to OverflowWide under `hashType`, which the provider keeps instead of
    // broadcasting. Inputs: the master, the old data NFT, the funding coin. Outputs: the master at its new covenant,
    // the old data NFT, the two new data NFTs, change.
    const prepare = async (
      label: string, hashType: number = defaultHashType,
    ): Promise<{ hex: string; wide: Contract; categoryId: string }> => {
      const deployFunding = coin(`${label} deploy`);
      await provider.addUtxo(p2pkh.address, deployFunding);
      const { contract, categoryId } = await StatefulContract.deploy(overflowV1Artifact, [alicePub], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { a: field('a'), b: field('b'), c: field('c') },
        changeAddress: p2pkh.address,
      });
      const funding = coin(`${label} upgrade`);
      await provider.addUtxo('51', funding);
      let hex = '';
      const send = provider.sendRawTransaction.bind(provider);
      (provider as any).sendRawTransaction = async (raw: string): Promise<string> => {
        hex = raw;
        throw new Error('kept, not broadcast');
      };
      try {
        await expect(StatefulContract.upgrade({
          provider,
          oldContract: contract,
          upgradeFunctionName: 'migrate',
          upgradeFunctionArgs: [new SignatureTemplate(alicePriv, hashType)],
          newArtifact: wideArtifact,
          newConstructorArgs: [alicePub],
          fundingUtxo: funding,
          funder: anyoneCanSpend,
          changeAddress: p2pkh.address,
        })).rejects.toThrow('kept, not broadcast');
      } finally {
        (provider as any).sendRawTransaction = send;
      }
      const wide = new Contract(wideArtifact, [alicePub], { provider, category: hexToBin(categoryId) });
      return { hex, wide, categoryId };
    };
    const submit = (hex: string, mutate: (tx: Tx) => void = () => {}): Promise<string> => {
      const tx = decodeTransactionUnsafe(hexToBin(hex));
      mutate(tx);
      return provider.sendRawTransaction(binToHex(encodeTransaction(tx)));
    };
    // A further data NFT at output `at`, a copy of the first new one with its own commitment, paid for (with its
    // bytes) out of the change output.
    const addDataNft = (tx: Tx, at: number, commitment: Uint8Array): void => {
      const template = tx.outputs[2];
      tx.outputs[tx.outputs.length - 1].valueSatoshis -= template.valueSatoshis + 1_000n;
      tx.outputs.splice(at, 0, {
        ...template,
        lockingBytecode: template.lockingBytecode.slice(),
        token: { ...template.token!, nft: { ...template.token!.nft!, commitment } },
      });
    };

    it('settles under SIGHASH_ALL, and refuses a new data NFT off the covenant, a gap, a detached extra, or an old '
      + 'one left unspent', async () => {
      const { hex, wide, categoryId } = await prepare('wide run');
      const honest = decodeTransactionUnsafe(hexToBin(hex));
      expect(honest.outputs.map((output) => output.token?.nft?.capability))
        .toEqual(['minting', 'mutable', 'mutable', 'mutable', undefined]);
      const dataLock = binToHex(honest.outputs[1].lockingBytecode);
      expect(honest.outputs.slice(2, 4).map((output) => binToHex(output.lockingBytecode)))
        .toEqual([dataLock, dataLock]);

      // Each tamper changes outputs (or inputs), which the output signature no longer covers, and also breaks the
      // census shape; both refuse it. The second new data NFT at a key's locking bytecode.
      await expect(submit(hex, (tx) => { tx.outputs[3].lockingBytecode = keyLock; })).rejects.toThrow(refused);
      // A gap in the run: the second new data NFT after the change output.
      await expect(submit(hex, (tx) => { [tx.outputs[3], tx.outputs[4]] = [tx.outputs[4], tx.outputs[3]]; }))
        .rejects.toThrow(refused);
      // An extra data NFT detached from the run, after the change output.
      await expect(submit(hex, (tx) => { addDataNft(tx, tx.outputs.length, field('detached')); }))
        .rejects.toThrow(refused);
      // The old data NFT left unspent and a replacement minted into the run.
      await expect(submit(hex, (tx) => {
        const old = tx.outputs[1];
        tx.inputs.splice(1, 1);
        tx.outputs[1] = { lockingBytecode: keyLock, valueSatoshis: 1_000n };
        tx.outputs[tx.outputs.length - 1].valueSatoshis -= old.valueSatoshis + 1_000n;
        addDataNft(tx, 4, field('replacement'));
      })).rejects.toThrow(refused);

      await expect(submit(hex)).resolves.toBeTypeOf('string');
      const settled = StatefulContract.withCategory(wide, categoryId);
      await settled.call.setH(field('h')).send();
      const state = await settled.getState();
      expect([state.a, state.c, state.g, state.h]).toEqual([field('a'), field('c'), new Uint8Array(32), field('h')]);
    });

    // The fence refuses an authorization that does not sign all outputs. This closes the rebind the census alone did
    // not: once the replacement bytecode, the run length and the new commitments are signed, none can be swapped
    // without the signer's key. Formerly a documented residual (kernel lane 4b89cce8e; ledger D10, R1-R3).
    it('refuses a NONE or SINGLE authorization, so the replacement, run length and commitments cannot be rebound',
      async () => {
        // The honest run shape, authorized under each output-free base type, is refused at the covenant.
        for (const [tag, hashType] of [['none', HashType.SIGHASH_NONE], ['single', HashType.SIGHASH_SINGLE]] as const) {
          const { hex } = await prepare(`wide ${tag}`, hashType);
          await expect(submit(hex)).rejects.toThrow(refused);
        }
        // The exact rebind that a NONE signature used to admit - a run one longer than the layout, with a rewritten
        // new commitment - is refused now that the authorization must sign the outputs it changes.
        const { hex } = await prepare('wide rebind', HashType.SIGHASH_NONE);
        await expect(submit(hex, (tx) => {
          tx.outputs[2].token!.nft!.commitment = hexToBin(buildPushdataCommitment(wideArtifact.stateLayout!, {
            d: field('rewritten d'), e: field('rewritten e'), f: field('rewritten f'),
          }, 1));
          addDataNft(tx, 4, field('appended'));
        })).rejects.toThrow(refused);
      });
  });

  // The fence covers every transaction signature an upgrade's authorization checks: each signature of a multisig, and
  // a checkSig in an internal helper the upgrade invokes. The helper's OP_DEFINE body is shared by all its callers, so
  // a non-upgrade entry calling it is held to the same rule. An empty signature is not fenced: it can only fail.
  describe('upgrade authorizations beyond a direct checkSig', () => {
    const artifacts = {
      multisig: compileString(MULTISIG_UPGRADE),
      helper: compileString(HELPER_UPGRADE),
      either: compileString(EITHER_UPGRADE),
      next: compileString(NEXT_VERSION),
    };
    const OP_TRUE = hexToBin('51');
    const anyoneCanSpend = {
      generateLockingBytecode: (): Uint8Array => OP_TRUE,
      generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
    };
    const coin = (label: string): Utxo => ({
      txid: binToHex(sha256.hash(utf8ToBin(label))), vout: 0, satoshis: 100_000n,
    });
    // The fence fails its base-type check (an OP_EQUALVERIFY) before the signature is ever checked.
    const fenced = /Program failed an OP_VERIFY operation/;
    // checkMultiSig's legacy mode takes ECDSA signatures.
    const ecdsa = (key: Uint8Array, hashType = HashType.SIGHASH_ALL | HashType.SIGHASH_UTXOS): SignatureTemplate =>
      new SignatureTemplate(key, hashType, SignatureAlgorithm.ECDSA);

    const deploy = async (label: string, artifact: typeof artifacts.next, keys: Uint8Array[]): Promise<StatefulContract> => {
      const funding = coin(`${label} deploy`);
      await provider.addUtxo(p2pkh.address, funding);
      const { contract } = await StatefulContract.deploy(artifact, keys, {
        provider,
        fundingUtxo: funding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });
      return contract;
    };
    // Signs the upgrade to NextVersion under `args`, which the provider keeps instead of broadcasting.
    const capture = async (label: string, contract: StatefulContract, args: FunctionArgument[]): Promise<string> => {
      const funding = coin(`${label} upgrade`);
      await provider.addUtxo('51', funding);
      let hex = '';
      const send = provider.sendRawTransaction.bind(provider);
      (provider as any).sendRawTransaction = async (raw: string): Promise<string> => {
        hex = raw;
        throw new Error('kept, not broadcast');
      };
      try {
        await expect(StatefulContract.upgrade({
          provider,
          oldContract: contract,
          upgradeFunctionName: 'migrate',
          upgradeFunctionArgs: args,
          newArtifact: artifacts.next,
          newConstructorArgs: [alicePub],
          fundingUtxo: funding,
          funder: anyoneCanSpend,
          changeAddress: p2pkh.address,
          // ECDSA signatures outgrow the fee estimate's placeholders.
          fee: 3_000n,
        })).rejects.toThrow('kept, not broadcast');
      } finally {
        (provider as any).sendRawTransaction = send;
      }
      return hex;
    };

    it('refuses a multisig with a NONE or a SINGLE signature, and settles one whose signatures are all ALL',
      async () => {
        const contract = await deploy('multisig', artifacts.multisig, [alicePub, bobPub]);
        const none = await capture('multisig none', contract,
          [ecdsa(alicePriv), ecdsa(bobPriv, HashType.SIGHASH_NONE)]);
        await expect(provider.sendRawTransaction(none)).rejects.toThrow(fenced);
        const single = await capture('multisig single', contract,
          [ecdsa(alicePriv, HashType.SIGHASH_SINGLE), ecdsa(bobPriv)]);
        await expect(provider.sendRawTransaction(single)).rejects.toThrow(fenced);
        const all = await capture('multisig all', contract, [ecdsa(alicePriv), ecdsa(bobPriv)]);
        await expect(provider.sendRawTransaction(all)).resolves.toBeTypeOf('string');
      });

    // A checkSig in an invoked body covers that body (OP_INVOKE swaps the active bytecode), while the SDK signs over
    // the redeem script, so no SDK signature verifies there yet: an ALL one passes the fence and is refused by
    // NULLFAIL, a pre-existing limitation pinned here. A NONE one is refused by the fence first, on either entry.
    it('fences a checkSig in the helper the upgrade invokes, and so in the non-upgrade entry sharing it', async () => {
      const contract = await deploy('helper', artifacts.helper, [alicePub]);
      const nullfail = /NULLFAIL/;
      await expect(contract.call.bump(new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)).send())
        .rejects.toThrow(fenced);
      await expect(contract.call.bump(new SignatureTemplate(alicePriv)).send()).rejects.toThrow(nullfail);

      const none = await capture('helper none', contract, [new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)]);
      await expect(provider.sendRawTransaction(none)).rejects.toThrow(fenced);
      const all = await capture('helper all', contract, [new SignatureTemplate(alicePriv)]);
      await expect(provider.sendRawTransaction(all)).rejects.toThrow(nullfail);
    });

    // The second key authorizes, so the first, empty, signature is checked first and must pass the fence.
    it('settles an either-key upgrade whose unused signature is empty, and refuses a NONE one', async () => {
      const contract = await deploy('either', artifacts.either, [alicePub, bobPub]);
      const none = await capture('either none', contract,
        [new Uint8Array(), new SignatureTemplate(bobPriv, HashType.SIGHASH_NONE)]);
      await expect(provider.sendRawTransaction(none)).rejects.toThrow(fenced);
      const all = await capture('either all', contract, [new Uint8Array(), new SignatureTemplate(bobPriv)]);
      await expect(provider.sendRawTransaction(all)).resolves.toBeTypeOf('string');
    });
  });
});
