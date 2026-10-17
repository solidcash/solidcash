import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract, getSatoshiContainerAddress } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// CRYPTO-4 binds the satoshi container to the master's exact lock, so an in-place upgrade would strand the BCH it
// holds. The container is now migrated in the upgrade transaction: spent with its flag=1 master path (the old master
// is still an input), drained at its input index, and re-minted at the replacement-bound covenant with its value.
const VAULT_V1 = `
pragma solidcash >=0.8.0;

contract VaultV1(pubkey admin) {
    function pay(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Same container surface, so the replacement can still pay.
const VAULT_V2 = `
pragma solidcash >=0.8.0;

contract VaultV2(pubkey admin) {
    function pay(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Data NFTs plus a satoshi container: the container migration must shift the data-NFT re-mint band and growth scan.
const MIXED_V1 = `
pragma solidcash >=0.8.0;

contract MixedV1(pubkey admin) {
    int counter;

    function pay(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const MIXED_V2 = `
pragma solidcash >=0.8.0;

contract MixedV2(pubkey admin) {
    int counter;

    function pay(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('StatefulContract.upgrade() satoshi-container migration (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const vaultV1 = compileString(VAULT_V1, { forceStateful: true });
  const vaultV2 = compileString(VAULT_V2, { forceStateful: true });
  const mixedV1 = compileString(MIXED_V1);
  const mixedV2 = compileString(MIXED_V2);

  const deploy = async (label: string, artifact: typeof vaultV1): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialBalance: 5_000n,
      changeAddress: p2pkh.address,
    });
  };

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

  it('re-mints the satoshi container at the replacement lock, preserving its balance', async () => {
    const { contract, categoryId } = await deploy('a1cd', vaultV1);

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vaultV2,
      newConstructorArgs: [alicePub],
      ...(await upgradeFunding('a2cd')),
    });

    const outputs = getTxOutputs(result.tx);
    // out[0]=master, out[1]=zero-value drain, out[2]=container re-mint, out[3]=change.
    expect(outputs[0].token?.nft?.capability).toBe('minting');
    expect(binToHex(outputs[1].to as Uint8Array)).toBe('6a');
    expect(outputs[1].amount).toBe(0n);
    expect(outputs[1].token).toBeUndefined();

    expect(outputs[2].token).toBeUndefined();
    expect(outputs[2].amount).toBe(5_000n);
    const lock = binToHex(result.tx.outputs[2].lockingBytecode);
    expect(lock).toBe(binToHex(addressToLockScript(getSatoshiContainerAddress(result.contract.inner, categoryId))));
    expect(lock).not.toBe(binToHex(addressToLockScript(getSatoshiContainerAddress(contract.inner, categoryId))));

    // The replacement can still pay from the migrated container.
    await result.contract.call.pay(new SignatureTemplate(alicePriv), alicePkh, 1_000n).send();
  });

  it('shifts the data-NFT re-mint band past the container drain when both migrate', async () => {
    const { contract, categoryId } = await deploy('b1cd', mixedV1);

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: mixedV2,
      newConstructorArgs: [alicePub],
      ...(await upgradeFunding('b2cd')),
    });

    const outputs = getTxOutputs(result.tx);
    // out[0]=master, out[1]=data-NFT pad, out[2]=container drain, out[3]=re-mint data NFT,
    // out[4]=container re-mint, out[5]=change.
    expect(outputs.map((output) => output.token?.nft?.capability))
      .toEqual(['minting', undefined, undefined, 'mutable', undefined, undefined]);
    expect(binToHex(outputs[1].to as Uint8Array)).toBe('6a');
    expect(binToHex(outputs[2].to as Uint8Array)).toBe('6a');
    expect(outputs[3].token?.category).toBe(categoryId);
    expect(outputs[4].amount).toBe(5_000n);
    expect(binToHex(result.tx.outputs[4].lockingBytecode))
      .toBe(binToHex(addressToLockScript(getSatoshiContainerAddress(result.contract.inner, categoryId))));
  });

  it('refuses a satoshi container re-mint at the old covenant', async () => {
    const { contract, categoryId } = await deploy('c1cd', vaultV1);

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
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: vaultV2,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('c2cd')),
      })).rejects.toThrow('kept, not broadcast');
    } finally {
      (provider as any).sendRawTransaction = send;
    }

    const stranded = addressToLockScript(getSatoshiContainerAddress(contract.inner, categoryId));
    const mutated = decodeTransactionUnsafe(hexToBin(hex));
    mutated.outputs[2].lockingBytecode = stranded.slice();
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(mutated))))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
