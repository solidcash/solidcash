import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract, getTokenContainerAddress } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// CRYPTO-4 binds the token container to the master's exact lock, so an in-place upgrade would strand the foreign
// token it holds. The container is now migrated in the upgrade transaction: spent with its flag=1 master path (the
// old master is still an input), drained at its input index, and re-minted at the replacement-bound covenant with
// its foreign category, amount and value.
const TOKEN_CATEGORY = 'bb'.repeat(32);

const VAULT_V1 = `
pragma solidcash >=0.8.0;

contract VaultV1(pubkey admin) {
    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Same token-container surface, so the replacement can still pay from the migrated container.
const VAULT_V2 = `
pragma solidcash >=0.8.0;

contract VaultV2(pubkey admin) {
    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('StatefulContract.upgrade() token-container migration (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const vaultV1 = compileString(VAULT_V1, { forceStateful: true });
  const vaultV2 = compileString(VAULT_V2, { forceStateful: true });

  const deploy = async (label: string, artifact: typeof vaultV1): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
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

  const fundContainer = async (contract: Awaited<ReturnType<typeof deploy>>['contract'], categoryId: string): Promise<void> => {
    const containerUtxo: Utxo = {
      txid: 'd2cd'.repeat(16), vout: 0, satoshis: 2_000n,
      token: { category: TOKEN_CATEGORY, amount: 1_000n },
    };
    await provider.addUtxo(getTokenContainerAddress(contract.inner, categoryId, TOKEN_CATEGORY), containerUtxo);
  };

  it('re-mints the token container at the replacement lock, preserving its foreign token', async () => {
    const { contract, categoryId } = await deploy('d1cd', vaultV1);
    await fundContainer(contract, categoryId);

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vaultV2,
      newConstructorArgs: [alicePub],
      tokenContainerCategoryIds: [TOKEN_CATEGORY],
      ...(await upgradeFunding('d3cd')),
    });

    const outputs = getTxOutputs(result.tx);
    // out[0]=master, out[1]=zero-value/zero-token drain, out[2]=container re-mint, out[3]=change.
    expect(outputs[0].token?.nft?.capability).toBe('minting');
    expect(binToHex(outputs[1].to as Uint8Array)).toBe('6a');
    expect(outputs[1].amount).toBe(0n);
    expect(outputs[1].token).toBeUndefined();

    expect(outputs[2].token?.category).toBe(TOKEN_CATEGORY);
    expect(outputs[2].token?.amount).toBe(1_000n);
    expect(outputs[2].amount).toBe(2_000n);
    const lock = binToHex(result.tx.outputs[2].lockingBytecode);
    expect(lock).toBe(binToHex(addressToLockScript(
      getTokenContainerAddress(result.contract.inner, categoryId, TOKEN_CATEGORY),
    )));
    expect(lock).not.toBe(binToHex(addressToLockScript(
      getTokenContainerAddress(contract.inner, categoryId, TOKEN_CATEGORY),
    )));

    // The replacement can still pay from the migrated container.
    await result.contract.call.pay(hexToBin(TOKEN_CATEGORY), alicePkh, 250n).send();
  });

  it('refuses a token-container re-mint at the old covenant', async () => {
    const { contract, categoryId } = await deploy('e1cd', vaultV1);
    await fundContainer(contract, categoryId);

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
        tokenContainerCategoryIds: [TOKEN_CATEGORY],
        ...(await upgradeFunding('e2cd')),
      })).rejects.toThrow('kept, not broadcast');
    } finally {
      (provider as any).sendRawTransaction = send;
    }

    const stranded = addressToLockScript(getTokenContainerAddress(contract.inner, categoryId, TOKEN_CATEGORY));
    const mutated = decodeTransactionUnsafe(hexToBin(hex));
    mutated.outputs[2].lockingBytecode = stranded.slice();
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(mutated))))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
