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
const TOKEN_CATEGORY = 'bb'.repeat(31) + '44';

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

  it('re-mints every coin a reserve is spread over, so none is left at the old lock', async () => {
    const { contract, categoryId } = await deploy('f1cd', vaultV1);
    const oldAddress = getTokenContainerAddress(contract.inner, categoryId, TOKEN_CATEGORY);
    // A second coin at the container lock: tokens paid there outside a call, which a later call may merge into.
    for (const [label, amount] of [['f2cd', 1_000n], ['f3cd', 7n]] as const) {
      await provider.addUtxo(oldAddress, {
        txid: label.repeat(16), vout: 0, satoshis: 2_000n, token: { category: TOKEN_CATEGORY, amount },
      });
    }

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vaultV2,
      newConstructorArgs: [alicePub],
      tokenContainerCategoryIds: [TOKEN_CATEGORY],
      ...(await upgradeFunding('f4cd')),
    });

    // out[0]=master, out[1..2]=drains, out[3..4]=re-mints, out[5]=change.
    const outputs = getTxOutputs(result.tx);
    for (const drain of outputs.slice(1, 3)) {
      expect(drain.amount).toBe(0n);
      expect(drain.token).toBeUndefined();
    }
    const newLock = binToHex(addressToLockScript(
      getTokenContainerAddress(result.contract.inner, categoryId, TOKEN_CATEGORY),
    ));
    const reMints = result.tx.outputs.slice(3, 5);
    expect(reMints.map((output) => binToHex(output.lockingBytecode))).toEqual([newLock, newLock]);
    expect(reMints.reduce((sum, output) => sum + output.token!.amount, 0n)).toBe(1_007n);
    expect(await provider.getUtxos(oldAddress)).toEqual([]);
  });

  it('upgrades before any container coin exists', async () => {
    const { contract } = await deploy('f5cd', vaultV1);
    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vaultV2,
      newConstructorArgs: [alicePub],
      tokenContainerCategoryIds: [TOKEN_CATEGORY],
      ...(await upgradeFunding('f6cd')),
    });
    expect(getTxOutputs(result.tx).some((output) => output.token?.category === TOKEN_CATEGORY)).toBe(false);
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

// Two token-container access sites: the upgrade migrates both foreign categories in the one transaction.
const TOKEN_A = 'aa'.repeat(32);
const TOKEN_B = 'cc'.repeat(32);

const MULTI_TC_V1 = `
pragma solidcash >=0.8.0;

contract MultiTokenV1(pubkey admin) {
    function payA(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function payB(bytes32 tokenCategory, bytes20 recipient, int amount) {
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

const MULTI_TC_V2 = `
pragma solidcash >=0.8.0;

contract MultiTokenV2(pubkey admin) {
    function payA(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function payB(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('StatefulContract.upgrade() multi-token-container migration (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const v1 = compileString(MULTI_TC_V1, { forceStateful: true });
  const v2 = compileString(MULTI_TC_V2, { forceStateful: true });

  it('re-mints both token containers at the replacement lock', async () => {
    const fundingUtxo: Utxo = { txid: 'b1cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const deployed = await StatefulContract.deploy(v1, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    const { contract, categoryId } = deployed;

    const fund = async (category: string, label: string): Promise<void> => {
      const containerUtxo: Utxo = {
        txid: label.repeat(16), vout: 0, satoshis: 2_000n,
        token: { category, amount: 1_000n },
      };
      await provider.addUtxo(getTokenContainerAddress(contract.inner, categoryId, category), containerUtxo);
    };
    await fund(TOKEN_A, 'aacd');
    await fund(TOKEN_B, 'bbcd');

    const upgradeFunding: Utxo = { txid: 'b2cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo('51', upgradeFunding);
    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: v2,
      newConstructorArgs: [alicePub],
      tokenContainerCategoryIds: [TOKEN_A, TOKEN_B],
      fundingUtxo: upgradeFunding,
      funder: { generateLockingBytecode: (): Uint8Array => hexToBin('51'), generateUnlockingBytecode: (): Uint8Array => new Uint8Array() },
      changeAddress: p2pkh.address,
    });

    const outputs = getTxOutputs(result.tx);
    const reMintedForeign = outputs.filter((output) => output.token !== undefined && output.token.nft === undefined);
    expect(reMintedForeign.map((output) => output.token!.category).sort()).toEqual([TOKEN_A, TOKEN_B].sort());

    const newLocks = [TOKEN_A, TOKEN_B].map((category) =>
      binToHex(addressToLockScript(getTokenContainerAddress(result.contract.inner, categoryId, category))));
    const outputLocks = result.tx.outputs.map((output) => binToHex(output.lockingBytecode));
    expect(newLocks.every((lock) => outputLocks.includes(lock))).toBe(true);

    // The replacement can still pay from each migrated container.
    await result.contract.call.payA(hexToBin(TOKEN_A), alicePkh, 250n).send();
    await result.contract.call.payB(hexToBin(TOKEN_B), alicePkh, 250n).send();
  });
});

// BchNative's shape: two access sites, wrap and unwrap, read one container keyed by an immutable state variable.
const RESERVE = 'dd'.repeat(32);
const reserveSource = (name: string, upgrade: string): string => `
pragma solidcash >=0.8.0;

contract ${name}(pubkey admin) {
    bytes32 immutable reserveCategory;
    int credited;

    constructor(bytes32 category_) { this.reserveCategory = category_; }

    function deposit(int amount) {
        bytes32 category = this.reserveCategory;
        require(this.outState.tokens[category].tokenAmount == this.tokens[category].tokenAmount + amount);
        this.credited = this.credited + amount;
    }

    function pay(bytes20 recipient, int amount) {
        bytes32 category = this.reserveCategory;
        require(amount > 0);
        this.tokens[category].transfer(recipient, amount);
    }
${upgrade}}
`;

describe('StatefulContract.upgrade() of a state-keyed reserve (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const v1 = compileString(reserveSource('ReserveV1', `
    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
        require(this.credited >= 0);
    }
`), { forceStateful: true });
  const v2 = compileString(reserveSource('ReserveV2', ''), { forceStateful: true });

  it('names the reserve from state and re-mints each of its coins with the records', async () => {
    const fundingUtxo: Utxo = { txid: 'c1cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const { contract, categoryId } = await StatefulContract.deploy(v1, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
      initArgs: [hexToBin(RESERVE)],
    });
    const oldAddress = getTokenContainerAddress(contract.inner, categoryId, RESERVE);
    for (const [label, amount] of [['c2cd', 600n], ['c3cd', 40n]] as const) {
      await provider.addUtxo(oldAddress, {
        txid: label.repeat(16), vout: 0, satoshis: 2_000n, token: { category: RESERVE, amount },
      });
    }

    const upgradeFunding: Utxo = { txid: 'c4cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo('51', upgradeFunding);
    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: v2,
      newConstructorArgs: [alicePub],
      fundingUtxo: upgradeFunding,
      funder: {
        generateLockingBytecode: (): Uint8Array => hexToBin('51'),
        generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
      },
      changeAddress: p2pkh.address,
    });

    const newAddress = getTokenContainerAddress(result.contract.inner, categoryId, RESERVE);
    expect(await provider.getUtxos(oldAddress)).toEqual([]);
    const moved = await provider.getUtxos(newAddress);
    expect(moved.reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n)).toBe(640n);
    expect(moved).toHaveLength(2);
    expect(binToHex((await result.contract.getState()).reserveCategory as Uint8Array)).toBe(RESERVE);

    // The replacement pays from a migrated coin.
    await result.contract.call.pay(alicePkh, 25n).send();
  });
});
