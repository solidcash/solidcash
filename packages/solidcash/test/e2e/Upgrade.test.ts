import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  type FunctionArgument,
  HashType,
  SignatureAlgorithm,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract, getDataNftLockingBytecode } from '../../src/stateful/index.js';
import { buildPushdataCommitment, parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobPriv,
  bobPub,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { assertApplicationScriptSize } from '../application-size-budgets.js';

// An in-place upgrade moves the master to the replacement's lock, and every record is bound to the master's exact
// lock (CRYPTO-4), so only a contract that keeps no record beyond its master NFT has an upgrade entry. These compile
// stateful without state variables; a replacement may add state, whose data NFTs the upgrade mints at its new lock.
const MASTER_ONLY = { forceStateful: true } as const;

// V1: no records; an upgrade entry, an ordinary entry and an unsafe one
const COUNTER_V1 = `
pragma solidcash >=0.8.0;

contract CounterV1(pubkey admin) {
    function check(int value) {
        require(value >= 1);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// V2: different logic, still no records and still upgradable
const COUNTER_V2 = `
pragma solidcash >=0.8.0;

contract CounterV2(pubkey admin) {
    function checkTwo(int value) {
        require(value >= 2);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// V3: adds state, so it keeps a data NFT and has no upgrade entry of its own
const COUNTER_V3 = `
pragma solidcash >=0.8.0;

contract CounterV3(pubkey admin) {
    int counter;
    int bonus;

    function incrementWithBonus() {
        this.counter = this.counter + 1;
        this.bonus = this.bonus + 10;
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

// OVERFLOW_V2: 5 bytes32 fields (5*33=165 bytes) in 2 data NFTs: NFT 0: a, b, c (99 bytes), NFT 1: d, e (66 bytes)
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

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// OVERFLOW_WIDE: 8 bytes32 fields in 3 data NFTs (a-c, d-f, g-h), so an upgrade from V1 mints three
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

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// MULTISIG_UPGRADE: a two-of-two multisig authorizes the upgrade
const MULTISIG_UPGRADE = `
pragma solidcash >=0.8.0;

contract MultisigUpgrade(pubkey first, pubkey second) {
    function check(int value) {
        require(value >= 1);
    }

    function migrate(sig s1, sig s2) upgrade {
        require(checkMultiSig([s1, s2], [first, second]));
    }
}
`;

// HELPER_UPGRADE: the authorizing checkSig is in an internal helper that a non-upgrade entry also calls
const HELPER_UPGRADE = `
pragma solidcash >=0.8.0;

contract HelperUpgrade(pubkey admin) {
    function authorize(sig s) internal {
        require(checkSig(s, admin));
    }

    function bump(sig s) {
        authorize(s);
        require(true);
    }

    function migrate(sig s) upgrade {
        authorize(s);
        require(true);
    }
}
`;

// EITHER_UPGRADE: either of two keys authorizes; the other signature is empty and fails its check
const EITHER_UPGRADE = `
pragma solidcash >=0.8.0;

contract EitherUpgrade(pubkey first, pubkey second) {
    function check(int value) {
        require(value >= 1);
    }

    function migrate(sig s1, sig s2) upgrade {
        require(checkSig(s1, first) || checkSig(s2, second));
    }
}
`;

// NEXT_VERSION: the replacement for the three above, with the same (empty) layout
const NEXT_VERSION = `
pragma solidcash >=0.8.0;

contract NextVersion(pubkey admin) {
    function check(int value) {
        require(value >= 1);
    }
}
`;

// Each keeps a record bound to the master's lock beside an upgrade entry, so the compiler refuses it.
const DATA_NFT_UPGRADE = `
pragma solidcash >=0.8.0;

contract DataNftUpgrade(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

const MAPPING_UPGRADE = `
pragma solidcash >=0.8.0;

contract MappingUpgrade(pubkey admin) {
    mapping(int => int) balances;

    function set(int key, int value) {
        this.balances[key] = value;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

const SATOSHI_CONTAINER_UPGRADE = `
pragma solidcash >=0.8.0;

contract SatoshiContainerUpgrade(pubkey admin) {
    function pay(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

const TOKEN_CONTAINER_UPGRADE = `
pragma solidcash >=0.8.0;

contract TokenContainerUpgrade(pubkey admin) {
    function send(sig s, bytes32 tokenCategory, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

// The data-NFT covenant bound to a contract's master lock
const dataNftLock = (contract: Contract, categoryId: string): string =>
  binToHex(getDataNftLockingBytecode(categoryId, hexToBin(contract.lockingBytecode)));

describe('StatefulContract.upgrade()', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const v1Artifact = compileString(COUNTER_V1, MASTER_ONLY);
  const v2Artifact = compileString(COUNTER_V2, MASTER_ONLY);
  const v3Artifact = compileString(COUNTER_V3);
  const noUpgradeArtifact = compileString(NO_UPGRADE);
  const overflowV2Artifact = compileString(OVERFLOW_V2);
  assertApplicationScriptSize('proxyUpgrade', v1Artifact, v2Artifact, v3Artifact, overflowV2Artifact);

  const deployV1 = async (label: string, masterAmount?: bigint): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(v1Artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
      ...(masterAmount !== undefined && { masterAmount }),
    });
  };
  // A funding coin for an upgrade that mints data NFTs. Anyone can spend it: with no data NFT input, send() runs the
  // debug template strictly, and a P2PKH funder's `s` collides there with the upgrade entry's `s`.
  const upgradeFunding = async (label: string): Promise<{
    fundingUtxo: Utxo; funder: Unlocker; changeAddress: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo('51', fundingUtxo);
    return {
      fundingUtxo,
      funder: {
        generateLockingBytecode: (): Uint8Array => hexToBin('51'),
        generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
      },
      changeAddress: p2pkh.address,
    };
  };

  describe('upgrade modifier in artifact ABI', () => {
    it('should include upgrade in ABI modifiers', () => {
      const migrateAbi = v1Artifact.abi.find((f) => f.name === 'migrate');
      expect(migrateAbi).toBeDefined();
      expect(migrateAbi!.modifiers).toContain('upgrade');
    });

    it('should not have upgrade modifier on non-upgrade functions', () => {
      const checkAbi = v1Artifact.abi.find((f) => f.name === 'check');
      expect(checkAbi).toBeDefined();
      expect(checkAbi!.modifiers ?? []).not.toContain('upgrade');
    });
  });

  describe('deploy V1 then upgrade to V2', () => {
    let v1Contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy V1', async () => {
      const result = await deployV1('a1cd');

      v1Contract = result.contract;
      categoryId = result.categoryId;

      expect(categoryId).toBe('a1cd'.repeat(16));
      expect(v1Contract.categoryId).toBe(categoryId);
      expect(v1Artifact.stateLayout!.dataNftCount).toBe(0);
    });

    it('should run a V1 entry on the master alone', async () => {
      const tx = await v1Contract.call.check(1n).send();
      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Output 0: master preserved; no record of the category beside it
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
      expect(txOutputs.filter((output) => output.token?.category === categoryId)).toHaveLength(1);
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

      // Output 0: minting NFT at the V2 lock, the only output of the category
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(categoryId);
      expect(binToHex(upgradeResult.tx.outputs[0].lockingBytecode)).toBe(upgradeResult.contract.inner.lockingBytecode);
      expect(txOutputs.filter((output) => output.token?.category === categoryId)).toHaveLength(1);

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

    it('should use V2 logic after upgrade (checkTwo)', async () => {
      // v1Contract is now a V2 ConnectedStatefulContract after upgrade
      const v2Contract = v1Contract;

      const tx = await v2Contract.call.checkTwo(2n).send();
      expect(tx.txid).toBeDefined();
      expect(getTxOutputs(tx)[0].token?.nft?.capability).toBe('minting');
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
      const v1Result = await deployV1('b2cd');

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
      const deployResult = await deployV1('c1cd');

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

  describe('master NFT survival', () => {
    it('should keep the master NFT, its commitment and its value across upgrade', async () => {
      const deployResult = await deployV1('d1cd', 5_000n);

      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      const master = getTxOutputs(upgradeResult.tx)[0];
      expect(master.amount).toBe(5_000n);
      expect(master.token).toMatchObject({
        category: deployResult.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
      });

      // V2 runs on the master it received
      const tx = await upgradeResult.contract.call.checkTwo(2n).send();
      expect(getTxOutputs(tx)[0].token?.category).toBe(deployResult.categoryId);
    });
  });

  describe('state extension (V1 -> V3 with new state variables)', () => {
    it('should upgrade from V1 to V3 and mint its data NFT with defaults at the V3 lock', async () => {
      const deployResult = await deployV1('e1cd');

      // V3 needs a data NFT, which the upgrade mints from a funding coin
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('e4cd')),
      });

      expect(upgradeResult.categoryId).toBe(deployResult.categoryId);

      // Data NFT with counter=0 and bonus=0, bound to the V3 master's lock rather than the V1 one
      const txOutputs = getTxOutputs(upgradeResult.tx);
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(0n);
      expect(parsed.bonus).toBe(0n);
      const lock = binToHex(upgradeResult.tx.outputs[1].lockingBytecode);
      expect(lock).toBe(dataNftLock(upgradeResult.contract.inner, deployResult.categoryId));
      expect(lock).not.toBe(dataNftLock(deployResult.contract.inner, deployResult.categoryId));
    });

    it('should use V3 logic after upgrade (incrementWithBonus)', async () => {
      const deployResult = await deployV1('e2cd');

      // Upgrade V1 -> V3
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('e5cd')),
      });

      const v3 = upgradeResult.contract;

      // Call incrementWithBonus: counter + 1, bonus + 10
      const tx = await v3.call.incrementWithBonus().send();
      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
      expect(parsed.bonus).toBe(10n);
    });

    it('should chain V1 -> V2 -> V3 upgrades, adding state at the last', async () => {
      const deployResult = await deployV1('e3cd');

      await deployResult.contract.call.check(1n).send();

      // Upgrade V1 -> V2
      const v2Result = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v2Artifact,
        newConstructorArgs: [alicePub],
      });

      await v2Result.contract.call.checkTwo(2n).send();

      // Upgrade V2 -> V3 (adds counter and bonus)
      const v3Result = await StatefulContract.upgrade({
        provider,
        oldContract: v2Result.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: v3Artifact,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('e6cd')),
      });

      // After V2 -> V3 upgrade: counter=0, bonus=0 (defaults)
      const upgradeOutputs = getTxOutputs(v3Result.tx);
      const upgradeParsed = parsePushdataCommitment(
        upgradeOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(upgradeParsed.counter).toBe(0n);
      expect(upgradeParsed.bonus).toBe(0n);

      // Use V3: incrementWithBonus (counter=1, bonus=10)
      const tx = await v3Result.contract.call.incrementWithBonus().send();
      const txOutputs = getTxOutputs(tx);
      const parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, v3Artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);
      expect(parsed.bonus).toBe(10n);
    });
  });

  describe('state extension minting several data NFTs', () => {
    it('should verify layout: V1 has no data NFT, V2 has 2', () => {
      expect(v1Artifact.stateLayout!.dataNftCount).toBe(0);
      expect(overflowV2Artifact.stateLayout!.dataNftCount).toBe(2);
    });

    it('should reject upgrade without funder when new NFTs are needed', async () => {
      const deployResult = await deployV1('f1cd');

      await expect(StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
      })).rejects.toThrow('Provide fundingUtxo and funder');
    });

    it('should mint both data NFTs of the new layout at the new master\'s lock', async () => {
      const deployResult = await deployV1('f2cd');

      // Upgrade to OverflowV2 (needs 2 data NFTs)
      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('f3cd')),
      });

      expect(upgradeResult.categoryId).toBe(deployResult.categoryId);

      const txOutputs = getTxOutputs(upgradeResult.tx);

      // Output 0: master NFT preserved with same satoshis
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(deployResult.categoryId);

      // Output 1: NEW data NFT (nftIndex 0) - a, b, c initialised to zero
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      const nft0Parsed = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, overflowV2Artifact.stateLayout!, 0,
      );
      expect(nft0Parsed.a).toEqual(new Uint8Array(32));
      expect(nft0Parsed.c).toEqual(new Uint8Array(32));

      // Output 2: NEW data NFT (nftIndex 1) - d, e initialised to zero
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(deployResult.categoryId);
      const nft1Parsed = parsePushdataCommitment(
        txOutputs[2].token!.nft!.commitment, overflowV2Artifact.stateLayout!, 1,
      );
      expect(nft1Parsed.d).toEqual(new Uint8Array(32));
      expect(nft1Parsed.e).toEqual(new Uint8Array(32));

      // Both at the covenant bound to the new master's lock
      const lock = dataNftLock(upgradeResult.contract.inner, deployResult.categoryId);
      expect([1, 2].map((at) => binToHex(upgradeResult.tx.outputs[at].lockingBytecode))).toEqual([lock, lock]);
    });

    it('should use V2 logic with the new data NFTs after the upgrade', async () => {
      const deployResult = await deployV1('f4cd');

      const upgradeResult = await StatefulContract.upgrade({
        provider,
        oldContract: deployResult.contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: overflowV2Artifact,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('f5cd')),
      });

      const v2 = upgradeResult.contract;

      // Call setD to write to the second data NFT (nftIndex 1)
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

  // An upgrade that adds state mints the new layout's data NFTs as a run at the canonical data-NFT covenant bound to
  // the replacement's lock, right after the old data NFTs (none here). The census pins the run's SHAPE (exactly the
  // old data NFTs in; out the same plus a contiguous run at that covenant). A direct upgrade's authorizing signature
  // must sign all outputs (base sighash type ALL), which binds the run's CONTENTS: the replacement bytecode, the run
  // length and the new commitments cannot be rebound under a NONE/SINGLE signature (kernel lane 4b89cce8e signature
  // fence; ledger D10, R1-R3).
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
    const zero = new Uint8Array(32);
    type Tx = ReturnType<typeof decodeTransactionUnsafe>;

    // Deploys V1 and signs its upgrade to OverflowWide under `hashType`, which the provider keeps instead of
    // broadcasting. Inputs: the master, the funding coin. Outputs: the master at its new covenant, the three new data
    // NFTs, change.
    const prepare = async (
      label: string, hashType: number = defaultHashType,
    ): Promise<{ hex: string; wide: Contract; old: Contract; categoryId: string }> => {
      const deployFunding = coin(`${label} deploy`);
      await provider.addUtxo(p2pkh.address, deployFunding);
      const { contract, categoryId } = await StatefulContract.deploy(v1Artifact, [alicePub], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
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
      return { hex, wide, old: contract.inner, categoryId };
    };
    const submit = (hex: string, mutate: (tx: Tx) => void = () => {}): Promise<string> => {
      const tx = decodeTransactionUnsafe(hexToBin(hex));
      mutate(tx);
      return provider.sendRawTransaction(binToHex(encodeTransaction(tx)));
    };
    // A further data NFT at output `at`, a copy of a new one with its own commitment, paid for (with its bytes) out
    // of the change output.
    const addDataNft = (tx: Tx, at: number, commitment: Uint8Array): void => {
      const template = tx.outputs[2];
      tx.outputs[tx.outputs.length - 1].valueSatoshis -= template.valueSatoshis + 1_000n;
      tx.outputs.splice(at, 0, {
        ...template,
        lockingBytecode: template.lockingBytecode.slice(),
        token: { ...template.token!, nft: { ...template.token!.nft!, commitment } },
      });
    };

    it('settles under SIGHASH_ALL, and refuses a new data NFT off the covenant, a gap, a detached extra, or a run '
      + 'at the old master\'s covenant', async () => {
      const { hex, wide, old, categoryId } = await prepare('wide run');
      const honest = decodeTransactionUnsafe(hexToBin(hex));
      expect(honest.outputs.map((output) => output.token?.nft?.capability))
        .toEqual(['minting', 'mutable', 'mutable', 'mutable', undefined]);
      // The run sits at the data-NFT covenant bound to the new master's lock
      const dataLock = dataNftLock(wide, categoryId);
      expect(honest.outputs.slice(1, 4).map((output) => binToHex(output.lockingBytecode)))
        .toEqual([dataLock, dataLock, dataLock]);

      // Each tamper changes outputs, which the output signature no longer covers, and also breaks the census shape;
      // both refuse it. The third new data NFT at a key's locking bytecode.
      await expect(submit(hex, (tx) => { tx.outputs[3].lockingBytecode = keyLock; })).rejects.toThrow(refused);
      // A gap in the run: the third new data NFT after the change output.
      await expect(submit(hex, (tx) => { [tx.outputs[3], tx.outputs[4]] = [tx.outputs[4], tx.outputs[3]]; }))
        .rejects.toThrow(refused);
      // An extra data NFT detached from the run, after the change output.
      await expect(submit(hex, (tx) => { addDataNft(tx, tx.outputs.length, field('detached')); }))
        .rejects.toThrow(refused);
      // The run at the old master's data-NFT covenant, where no master could spend it after the upgrade.
      const stranded = hexToBin(dataNftLock(old, categoryId));
      await expect(submit(hex, (tx) => {
        for (const at of [1, 2, 3]) tx.outputs[at].lockingBytecode = stranded.slice();
      })).rejects.toThrow(refused);

      await expect(submit(hex)).resolves.toBeTypeOf('string');
      const settled = StatefulContract.withCategory(wide, categoryId);
      await settled.call.setH(field('h')).send();
      const state = await settled.getState();
      expect([state.a, state.c, state.g, state.h]).toEqual([zero, zero, zero, field('h')]);
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
  // a checkSig in an internal helper the upgrade calls, which is inlined into it. An empty signature is not fenced:
  // it can only fail.
  describe('upgrade authorizations beyond a direct checkSig', () => {
    const artifacts = {
      multisig: compileString(MULTISIG_UPGRADE, MASTER_ONLY),
      helper: compileString(HELPER_UPGRADE, MASTER_ONLY),
      either: compileString(EITHER_UPGRADE, MASTER_ONLY),
      next: compileString(NEXT_VERSION, MASTER_ONLY),
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

    // A signature-checking helper is inlined into each caller, so its check runs in that entry's own body, which is
    // the body an SDK signature covers. The upgrade's copy is fenced; the non-upgrade entry's copy is its own and is
    // not, so a NONE signature settles there.
    it('fences the upgrade\'s inlined copy of a checkSig helper, and settles both callers with an SDK signature',
      async () => {
        const contract = await deploy('helper', artifacts.helper, [alicePub]);
        await expect(contract.call.bump(new SignatureTemplate(alicePriv)).send()).resolves.toBeDefined();
        await expect(contract.call.bump(new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)).send())
          .resolves.toBeDefined();

        const none = await capture('helper none', contract,
          [new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)]);
        await expect(provider.sendRawTransaction(none)).rejects.toThrow(fenced);
        const all = await capture('helper all', contract, [new SignatureTemplate(alicePriv)]);
        await expect(provider.sendRawTransaction(all)).resolves.toBeTypeOf('string');
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

  // Every record a contract keeps is bound to its master's exact lock (CRYPTO-4). An in-place upgrade moves the master
  // to the replacement's lock. Data NFTs, containers and mapping/array entries now migrate, so the upgrade is
  // admitted and the SDK drains the records before it moves the master.
  describe('admits an in-place upgrade that migrates lock-bound records', () => {

    it('admits a contract with data NFTs (they re-mint at the replacement lock)', () => {
      const artifact = compileString(DATA_NFT_UPGRADE);
      expect(artifact.stateLayout!.dataNftCount).toBe(1);
      expect(artifact.abi.find((f) => f.name === 'migrate')!.requiredNftIndices).toEqual([0]);
    });

    it('admits a contract with a mapping (its entries migrate via the migrateRecords entry)', () => {
      const artifact = compileString(MAPPING_UPGRADE);
      expect(artifact.abi.find((f) => f.name === 'migrate')!.modifiers).toContain('upgrade');
    });

    it('admits a satoshi container and a token container (both re-mint at the replacement lock)', () => {
      const satoshiArtifact = compileString(SATOSHI_CONTAINER_UPGRADE, MASTER_ONLY);
      expect(satoshiArtifact.stateLayout!.dataNftCount).toBe(0);
      const tokenArtifact = compileString(TOKEN_CONTAINER_UPGRADE, MASTER_ONLY);
      expect(tokenArtifact.stateLayout!.dataNftCount).toBe(0);
    });

    // The kernel message-bus lane never synthesizes its in-place-append upgrade route for a participant that keeps
    // records (there is no data NFT to append into), so a record-keeping participant still compiles: its direct
    // entry migrates the data NFTs and the message-bus route simply offers no upgrade for it.
    it('admits the kernel lane\'s compile of a contract with data NFTs', () => {
      const artifact = compileString(DATA_NFT_UPGRADE, {
        forceStateful: true, messageBus: true, messageBusKernel: true,
      });
      expect(artifact.stateLayout!.dataNftCount).toBe(1);
    });
  });
});
