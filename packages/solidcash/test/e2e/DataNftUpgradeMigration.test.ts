import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract, getDataNftLockingBytecode } from '../../src/stateful/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// CRYPTO-4 binds every data NFT to the master's exact lock, so the pre-migration compiler refused an upgrade entry
// beside a state variable. The bounded data-NFT migration now destroys each old data NFT (flag=2) and re-mints a copy
// at the replacement-bound covenant with the same commitment, behind a non-category pad band required by the destroy
// check (output[INPUTINDEX] must hold a DIFFERENT category).
const STATE_V1 = `
pragma solidcash >=0.8.0;

contract StateV1(pubkey admin) {
    int counter;

    function setCounter(int value) {
        this.counter = value;
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Same data-NFT count (counter + bonus still fit one commitment); the migration re-mints the old record and
// initialises the appended field to its default.
const STATE_V2 = `
pragma solidcash >=0.8.0;

contract StateV2(pubkey admin) {
    int counter;
    int bonus;

    function setBonus(int value) {
        this.bonus = value;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Longer layout: counter plus five bytes32 fields overflow into two data NFTs, so the upgrade also mints one.
const STATE_WIDE = `
pragma solidcash >=0.8.0;

contract StateWide(pubkey admin) {
    int counter;
    bytes32 a;
    bytes32 b;
    bytes32 c;
    bytes32 d;
    bytes32 e;

    function setE(bytes32 value) {
        this.e = value;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const dataNftLock = (contract: Contract, categoryId: string): string =>
  binToHex(getDataNftLockingBytecode(categoryId, hexToBin(contract.lockingBytecode)));

describe('StatefulContract.upgrade() data-NFT migration (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const v1 = compileString(STATE_V1);
  const v2 = compileString(STATE_V2);
  const wide = compileString(STATE_WIDE);

  const deploy = async (label: string): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(v1, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 42n },
      changeAddress: p2pkh.address,
    });
  };

  // An OP_TRUE funder pays the fee: send() debug-runs the upgrade entry's signature strictly when there is no
  // data-NFT input, and a P2PKH funder's `s` would collide with `migrate`'s `s`.
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

  it('re-mints the old data NFT at the replacement lock, preserving its commitment', async () => {
    const { contract, categoryId } = await deploy('a1cd');

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: v2,
      newConstructorArgs: [alicePub],
      ...(await upgradeFunding('a2cd')),
    });

    expect(result.categoryId).toBe(categoryId);

    const outputs = getTxOutputs(result.tx);
    // out[0] = new master, out[1] = non-category pad, out[2] = re-minted data NFT, out[3] = change.
    expect(outputs[0].token?.nft?.capability).toBe('minting');
    expect(outputs[0].token?.category).toBe(categoryId);
    expect(binToHex(outputs[1].to as Uint8Array)).toBe('6a');
    expect(outputs[1].amount).toBe(0n);
    expect(outputs[1].token).toBeUndefined();

    expect(outputs[2].token?.nft?.capability).toBe('mutable');
    expect(outputs[2].token?.category).toBe(categoryId);
    const parsed = parsePushdataCommitment(outputs[2].token!.nft!.commitment, v2.stateLayout!, 0);
    expect(parsed.counter).toBe(42n);
    expect(parsed.bonus).toBe(0n);

    // Re-minted at the replacement-bound covenant, not the old master's.
    const lock = binToHex(result.tx.outputs[2].lockingBytecode);
    expect(lock).toBe(dataNftLock(result.contract.inner, categoryId));
    expect(lock).not.toBe(dataNftLock(contract.inner, categoryId));

    // The V2 contract runs on the migrated state.
    const write = await result.contract.call.setBonus(7n).send();
    const written = parsePushdataCommitment(
      getTxOutputs(write)[1].token!.nft!.commitment, v2.stateLayout!, 0,
    );
    expect(written.counter).toBe(42n);
    expect(written.bonus).toBe(7n);
  });

  it('mints the extra data NFT of a longer layout after the re-mint band', async () => {
    const { contract, categoryId } = await deploy('b1cd');

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: wide,
      newConstructorArgs: [alicePub],
      ...(await upgradeFunding('b2cd')),
    });

    const outputs = getTxOutputs(result.tx);
    // out[0]=master, out[1]=pad, out[2]=re-mint, out[3]=added data NFT, out[4]=change.
    expect(outputs.map((output) => output.token?.nft?.capability))
      .toEqual(['minting', undefined, 'mutable', 'mutable', undefined]);
    expect(binToHex(outputs[1].to as Uint8Array)).toBe('6a');

    // The re-minted record carries the migrated value; the added one is default-initialised.
    const reMinted = parsePushdataCommitment(outputs[2].token!.nft!.commitment, wide.stateLayout!, 0);
    expect(reMinted.counter).toBe(42n);
    expect(reMinted.a).toEqual(new Uint8Array(32));
    expect(reMinted.b).toEqual(new Uint8Array(32));

    const lock = dataNftLock(result.contract.inner, categoryId);
    expect([2, 3].map((at) => binToHex(result.tx.outputs[at].lockingBytecode))).toEqual([lock, lock]);
  });

  // The re-mint lock check must refuse a record re-minted at the OLD master's data-NFT covenant, where no master
  // could spend it after the upgrade. The census alone cannot see the lock, so this is the migration's own pin.
  it('refuses a re-mint at the old data-NFT covenant', async () => {
    const { contract, categoryId } = await deploy('c1cd');

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
        newArtifact: v2,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('c2cd')),
      })).rejects.toThrow('kept, not broadcast');
    } finally {
      (provider as any).sendRawTransaction = send;
    }

    const stranded = hexToBin(dataNftLock(contract.inner, categoryId));
    const mutated = decodeTransactionUnsafe(hexToBin(hex));
    mutated.outputs[2].lockingBytecode = stranded.slice();
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(mutated))))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
