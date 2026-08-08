import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  Contract, HashType, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';
import {
  alicePkh, alicePriv, alicePub, bobAddress, bobPkh,
} from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `contract Lifecycle() {
  int counter;
  function fork(bigint n) split(n) { require(n >= 1); }
  function consolidate(bigint n) merge(n) { require(n >= 1); }
}`;
const CHILD = `contract Child(bytes20 owner) {
  int counter;
  function increment() {
    this.counter = this.counter + 1;
    require(owner != bytes20(0));
  }
}`;
const FACTORY = `${CHILD}
contract Factory() {
  int childCount;
  function createChild(bytes20 owner, int fundingInputIndex) {
    new Child(owner);
    require(tx.inputs[fundingInputIndex].outpointTransactionHash != 0x0000000000000000000000000000000000000000000000000000000000000000);
    this.childCount = this.childCount + 1;
  }
}`;
const DESTROYABLE = `contract Destroyable(pubkey admin) {
  int counter;
  function destroy(sig s, bytes20 recipient) {
    require(checkSig(s, admin));
    selfdestruct(new LockingBytecodeP2PKH(recipient));
  }
}`;
const UPGRADE_V1 = `contract UpgradeV1(pubkey admin) {
  int counter;
  function migrate(sig s) upgrade { require(checkSig(s, admin)); }
}`;
const UPGRADE_V2 = `contract UpgradeV2(pubkey admin) {
  int counter;
  function increment() { this.counter = this.counter + 1; }
}`;

const OP_TRUE = hexToBin('51');
const anyoneCanSpend = {
  generateLockingBytecode: (): Uint8Array => OP_TRUE,
  generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
};

describe('lifecycle auxiliary-input adversarial soundness', () => {
  it('split rejects missing, duplicated, redirected, and reordered lifecycle outputs', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);
    const funding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo('51', funding);

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await StatefulContract.split({
        provider,
        contract: connected,
        splitFunctionName: 'fork',
        splitFunctionArgs: [2n],
        funder: anyoneCanSpend,
        fundingUtxos: [funding],
        changeAddress: contract.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    // The mock names the failing input; BCHN's short form names only what failed, and that can be any of
    // OP_EQUALVERIFY, OP_VERIFY or a range error such as `Invalid OP_SPLIT range`. Enumerating opcodes is
    // fragile, so require the script-verify refusal itself - which is what these tampers must provoke.
    const covenantFailure = /mandatory-script-verify-flag-failed/;

    // Output 0 is the preserved master; outputs 1 and 2 are the newly minted masters; output 3 is change.
    await expect(rejectMutation((tx) => { tx.outputs.splice(2, 1); })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      const minted = tx.outputs[2];
      tx.outputs.splice(3, 0, {
        ...minted,
        lockingBytecode: minted.lockingBytecode.slice(),
        token: { ...minted.token!, nft: { ...minted.token!.nft! } },
      });
      // Preserve value balance and add ample fee for the larger serialized transaction, so relay policy cannot
      // mask the lifecycle covenant's exact-output-count rejection.
      tx.outputs.at(-1)!.valueSatoshis -= minted.valueSatoshis + 1_000n;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      tx.outputs[1].lockingBytecode = OP_TRUE;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      [tx.outputs[0], tx.outputs[3]] = [tx.outputs[3], tx.outputs[0]];
    })).rejects.toThrow(covenantFailure);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });

  it('merge rejects missing, duplicated, reordered, and redirected lifecycle inputs/outputs', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);

    const splitFunding: Utxo = { txid: 'f2'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo('51', splitFunding);
    await StatefulContract.split({
      provider,
      contract: connected,
      splitFunctionName: 'fork',
      splitFunctionArgs: [2n],
      funder: anyoneCanSpend,
      fundingUtxos: [splitFunding],
      changeAddress: contract.address,
    });

    const masters = (await provider.getUtxos(connected.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting',
    );
    expect(masters).toHaveLength(3);
    const mergeFunding: Utxo = { txid: 'f3'.repeat(32), vout: 0, satoshis: 10_000n };
    await provider.addUtxo('51', mergeFunding);

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await StatefulContract.merge({
        provider,
        contract: connected,
        mergeFunctionName: 'consolidate',
        mergeFunctionArgs: [2n],
        funder: anyoneCanSpend,
        consumedMasterUtxos: masters.slice(1),
        fundingUtxos: [mergeFunding],
        changeAddress: contract.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const rejection = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    // Inputs 0..2 are the surviving + two consumed masters; input 3 is ordinary OP_TRUE funding.
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 1);
      tx.outputs.at(-1)!.valueSatoshis -= 1_200n;
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 0, {
        ...tx.inputs[1],
        outpointTransactionHash: tx.inputs[1].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[1].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.inputs[1], tx.inputs[3]] = [tx.inputs[3], tx.inputs[1]];
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.outputs[0].lockingBytecode = OP_TRUE;
    })).rejects.toThrow(rejection);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });

  // Mock-only: this case rewinds with `provider.takeSnapshot()`, which `RegtestNetworkProvider` does not
  // implement and a real chain cannot offer. Skipped on live regtest rather than failing there.
  it.skipIf(process.env.TESTS_USE_REGTEST)('deployFrom rejects missing, duplicated, reordered, and redirected child outputs', async () => {
    const provider = createTestProvider();
    const factoryArtifact = compileString(FACTORY);
    const childArtifact = compileString(CHILD);
    const baseFactory = new Contract(factoryArtifact, [], { provider });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const factoryFunding: Utxo = { txid: 'f4'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo('51', factoryFunding);
    const { contract: factory } = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: factoryFunding,
      funder: anyoneCanSpend,
      initialState: { childCount: 0n },
      changeAddress: baseFactory.address,
    });

    const childFunding: Utxo = { txid: 'f5'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, childFunding);
    const createAbi = factoryArtifact.abi.find((entry) => entry.name === 'createChild')!;
    const requiredNfts = createAbi.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
    const fundingInputIndex = 1 + requiredNfts;

    const beforeDeploy = await provider.takeSnapshot();
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return send(hex);
    };
    try {
      await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'createChild',
        deployFunctionArgs: [alicePkh, BigInt(fundingInputIndex)],
        childArtifact,
        childConstructorArgs: [alicePkh],
        childInitialState: { counter: 0n },
        fundingUtxo: childFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)),
        changeAddress: p2pkh.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');
    await beforeDeploy.restore();

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      await beforeDeploy.restore();
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    // The mock names the failing input; BCHN's short form names only what failed, and that can be any of
    // OP_EQUALVERIFY, OP_VERIFY or a range error such as `Invalid OP_SPLIT range`. Enumerating opcodes is
    // fragile, so require the script-verify refusal itself - which is what these tampers must provoke.
    const covenantFailure = /mandatory-script-verify-flag-failed/;

    // Outputs 0/1 preserve the factory; outputs 2/3 are the child's master and data NFT; change follows.
    await expect(rejectMutation((tx) => { tx.outputs.splice(3, 1); })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      const childMaster = tx.outputs[2];
      tx.outputs.splice(4, 0, {
        ...childMaster,
        lockingBytecode: childMaster.lockingBytecode.slice(),
        token: { ...childMaster.token!, nft: { ...childMaster.token!.nft! } },
      });
      tx.outputs.at(-1)!.valueSatoshis -= childMaster.valueSatoshis + 1_000n;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      [tx.outputs[2], tx.outputs[3]] = [tx.outputs[3], tx.outputs[2]];
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => { tx.outputs[2].lockingBytecode = OP_TRUE; }))
      .rejects.toThrow(covenantFailure);

    await beforeDeploy.restore();
    await expect(send(captured)).resolves.toBeTypeOf('string');
  });

  it('selfdestruct rejects missing, duplicated, reordered, and redirected lifecycle elements', async () => {
    const provider = createTestProvider();
    const artifact = compileString(DESTROYABLE);
    const contract = new Contract(artifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const connected = StatefulContract.withCategory(contract, categoryId);

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    try {
      await StatefulContract.destroy({
        provider,
        contract: connected,
        destroyFunctionName: 'destroy',
        destroyFunctionArgs: [
          new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE), bobPkh,
        ],
        recipient: bobAddress,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    const rejection = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    // Inputs 0/1 are the master and data NFT; the sole output is the authenticated recipient.
    await expect(rejectMutation((tx) => { tx.inputs.splice(1, 1); })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.inputs.splice(2, 0, {
        ...tx.inputs[1],
        outpointTransactionHash: tx.inputs[1].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[1].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      [tx.inputs[0], tx.inputs[1]] = [tx.inputs[1], tx.inputs[0]];
    })).rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => { tx.outputs[0].lockingBytecode = OP_TRUE; }))
      .rejects.toThrow(rejection);
    await expect(rejectMutation((tx) => {
      tx.outputs.push({ ...tx.outputs[0], lockingBytecode: tx.outputs[0].lockingBytecode.slice() });
      tx.outputs[0].valueSatoshis /= 2n;
      tx.outputs[1].valueSatoshis -= tx.outputs[0].valueSatoshis + 1_000n;
    })).rejects.toThrow(rejection);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });

  // Mock-only: this case rewinds with `provider.takeSnapshot()`, which `RegtestNetworkProvider` does not
  // implement and a real chain cannot offer. Skipped on live regtest rather than failing there.
  it.skipIf(process.env.TESTS_USE_REGTEST)('upgrade rejects missing, duplicated, reordered, and redirected lifecycle outputs', async () => {
    const provider = createTestProvider();
    const oldArtifact = compileString(UPGRADE_V1);
    const newArtifact = compileString(UPGRADE_V2);
    const oldBase = new Contract(oldArtifact, [alicePub], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, oldBase, oldArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const oldContract = StatefulContract.withCategory(oldBase, categoryId);
    const funding: Utxo = { txid: 'f6'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo('51', funding);

    const beforeUpgrade = await provider.takeSnapshot();
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      return send(hex);
    };
    try {
      await StatefulContract.upgrade({
        provider,
        oldContract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)],
        newArtifact,
        newConstructorArgs: [alicePub],
        fundingUtxo: funding,
        funder: anyoneCanSpend,
        changeAddress: oldBase.address,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');
    await beforeUpgrade.restore();

    const rejectMutation = async (
      mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      await beforeUpgrade.restore();
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      mutate(tx);
      await send(binToHex(encodeTransaction(tx)));
    };
    // The mock names the failing input; BCHN's short form names only what failed, and that can be any of
    // OP_EQUALVERIFY, OP_VERIFY or a range error such as `Invalid OP_SPLIT range`. Enumerating opcodes is
    // fragile, so require the script-verify refusal itself - which is what these tampers must provoke.
    const covenantFailure = /mandatory-script-verify-flag-failed/;

    // Outputs 0/1 are the upgraded master and data NFT; ordinary change follows.
    await expect(rejectMutation((tx) => { tx.outputs.splice(1, 1); }))
      .rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      const master = tx.outputs[0];
      tx.outputs.splice(2, 0, {
        ...master,
        lockingBytecode: master.lockingBytecode.slice(),
        token: { ...master.token!, nft: { ...master.token!.nft! } },
      });
      tx.outputs.at(-1)!.valueSatoshis -= master.valueSatoshis + 1_000n;
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => {
      [tx.outputs[0], tx.outputs[1]] = [tx.outputs[1], tx.outputs[0]];
    })).rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => { tx.outputs[1].lockingBytecode = OP_TRUE; }))
      .rejects.toThrow(covenantFailure);
    await expect(rejectMutation((tx) => { tx.outputs[0].lockingBytecode = OP_TRUE; }))
      .rejects.toThrow(covenantFailure);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
