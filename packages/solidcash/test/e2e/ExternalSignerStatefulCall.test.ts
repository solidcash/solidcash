/**
 * `Signer.external` on the stateful paths: a wallet that holds the caller's key signs the caller's P2PKH coins over
 * `bch_signTransaction`, and every stateful broadcast carries the wallet's signatures, never the placeholder the
 * SDK composes with (src/external-signing.ts).
 *
 * The stand-in wallet below does what a wc2 wallet does: it signs the empty inputs at its own P2PKH lock and returns
 * the transaction. The mock provider verifies every input, so a broadcast that still held the placeholder is refused.
 */
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  SignatureTemplate,
  Signer,
  type ExternalTransactionSigner,
  type Utxo,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getContractFactory } from '../../src/stateful/ContractFactory.js';
import { compileString as compileDirect } from '../direct-compile.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  alicePriv, alicePub, bobPriv, bobPub,
} from '../fixture/vars.js';

// The owner authenticates by co-spending a coin of their own (tx.origin), so the wallet's coin is in the call.
const OWNED_COUNTER = `pragma solidcash ^0.52.0;
event Bumped(int count);
contract OwnedCounter(bytes20 ownerPkh) {
  int public count;
  modifier ownerCoSpends() { require(tx.origin == new LockingBytecodeP2PKH(ownerPkh), "owner coin"); _; }
  function bump() public ownerCoSpends { this.count = this.count + 1; emit Bumped(this.count); }
}`;

const SPLIT_MERGE = `pragma solidcash ^0.52.0;
contract SplitMerge(pubkey admin) {
  bigint counter;
  function fork(bigint n, sig s) split(n) { require(n >= 1); require(checkSig(s, admin)); }
  function consolidate(bigint n, sig s) merge(n) { require(n >= 1); require(checkSig(s, admin)); }
}`;

type StandInWallet = ExternalTransactionSigner & { requests: number; signed: number };

/** A wallet behind `bch_signTransaction`: it signs the empty inputs at its own P2PKH lock, and nothing else. */
function standInWallet(privateKey: Uint8Array): StandInWallet {
  const unlocker = new SignatureTemplate(privateKey).unlockP2PKH();
  const ownLock = binToHex(unlocker.generateLockingBytecode());
  const wallet: StandInWallet = {
    requests: 0,
    signed: 0,
    async signTransaction({ transaction, sourceOutputs }) {
      wallet.requests += 1;
      const inputs = transaction.inputs.map((input, inputIndex) => {
        if (input.unlockingBytecode.length !== 0) return input;
        if (binToHex(sourceOutputs[inputIndex]!.lockingBytecode) !== ownLock) return input;
        wallet.signed += 1;
        const unlockingBytecode = unlocker.generateUnlockingBytecode({ transaction, sourceOutputs, inputIndex });
        return { ...input, unlockingBytecode };
      });
      return { signedTransaction: binToHex(encodeTransaction({ ...transaction, inputs })) };
    },
  };
  return wallet;
}

/** The inputs of `transaction` that still hold the placeholder a wallet's input is composed with. */
const placeholderInputs = (transaction: { inputs: readonly { unlockingBytecode: Uint8Array }[] }): number[] =>
  transaction.inputs.flatMap(({ unlockingBytecode }, index) => (unlockingBytecode[0] === 65
    && unlockingBytecode.subarray(1, 65).every((byte) => byte === 0) ? [index] : []));

let nextOutpoint = 0;
const fund = async (
  provider: MockNetworkProvider, address: string, satoshis: bigint,
): Promise<Utxo> => {
  nextOutpoint += 1;
  const utxo: Utxo = { txid: `e5${nextOutpoint.toString(16).padStart(62, '0')}`, vout: 0, satoshis };
  await provider.addUtxo(address, utxo);
  return utxo;
};

describe('Signer.external on the stateful paths', () => {
  it.each([
    ['with its public key', { publicKey: bobPub }],
    ['named by its public key hash only', {}],
  ])('a stateful call by a wallet signer (%s) carries the wallet\'s signature', async (_name, identity) => {
    const provider = new MockNetworkProvider();
    const owner = new Signer(bobPriv, provider);
    const deployer = new Signer(alicePriv, provider);
    await fund(provider, deployer.getAddress(), 1_000_000n);
    const counter = await getContractFactory(compileString(OWNED_COUNTER, { evmCompat: true }), deployer)
      .deploy(owner.pkh);
    await counter.waitForDeployment();

    const wallet = standInWallet(bobPriv);
    const walletSigner = Signer.external({ wallet, pkh: owner.pkh, ...identity }, provider);
    await fund(provider, walletSigner.getAddress(), 1_000_000n);

    const tx = await counter.connect(walletSigner).call.bump().send();

    expect(wallet.requests).toBe(1);
    expect(wallet.signed).toBeGreaterThan(0);
    expect(placeholderInputs(tx)).toEqual([]);
    expect(await counter.getState()).toEqual({ count: 1n });
  });

  it.each([true, false])('StatefulContract split/merge sign external funding (wallet-funded split: %s)', async (walletFundsSplit) => {
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = await fund(provider, alice.getAddress(), 200_000n);
    const { contract } = await StatefulContract.deploy(compileDirect(SPLIT_MERGE), [alicePub], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), initialState: { counter: 0n }, changeAddress: alice.getAddress(),
    });
    const wallet = standInWallet(bobPriv);
    const walletSigner = Signer.external({ wallet, publicKey: bobPub }, provider);
    // A local split isolates the merge regression: it must ask the wallet even when split did not need it.
    const splitFunder = walletFundsSplit ? walletSigner : alice;

    const split = await StatefulContract.split({
      provider,
      contract,
      splitFunctionName: 'fork',
      splitFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
      funder: splitFunder.unlockP2PKH(),
      fundingUtxos: [await fund(provider, splitFunder.getAddress(), 50_000n)],
      changeAddress: splitFunder.getAddress(),
      newMintingAmount: 1200n,
    });
    expect(placeholderInputs(split.tx)).toEqual([]);

    const masters = (await provider.getUtxos(contract.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === contract.categoryId && utxo.token?.nft?.capability === 'minting',
    );
    expect(masters).toHaveLength(3);
    const merge = await StatefulContract.merge({
      provider,
      contract,
      mergeFunctionName: 'consolidate',
      mergeFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
      consumedMasterUtxos: masters.slice(1),
      funder: walletSigner.unlockP2PKH(),
      fundingUtxos: [await fund(provider, walletSigner.getAddress(), 10_000n)],
      changeAddress: walletSigner.getAddress(),
    });
    expect(placeholderInputs(merge.tx)).toEqual([]);
    expect(wallet.requests).toBe(walletFundsSplit ? 2 : 1);
    expect((await provider.getUtxos(contract.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === contract.categoryId && utxo.token?.nft?.capability === 'minting',
    )).toHaveLength(1);
  });

  it.each([true, false])('sc.call split/merge sign external funding (wallet-funded split: %s)', async (walletFundsSplit) => {
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = await fund(provider, alice.getAddress(), 200_000n);
    const { contract } = await StatefulContract.deploy(compileDirect(SPLIT_MERGE), [alicePub], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), initialState: { counter: 0n }, changeAddress: alice.getAddress(),
    });
    const wallet = standInWallet(bobPriv);
    const walletSigner = Signer.external({ wallet, publicKey: bobPub }, provider);
    const splitFunder = walletFundsSplit ? walletSigner : alice;

    const split = await contract.call
      .fork(2n, new SignatureTemplate(alicePriv))
      .withSplitFunding(
        [await fund(provider, splitFunder.getAddress(), 50_000n)], splitFunder.unlockP2PKH(), splitFunder.getAddress(),
      )
      .withNewMintingAmount(1200n)
      .send();
    expect(placeholderInputs(split)).toEqual([]);

    const masters = (await provider.getUtxos(contract.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === contract.categoryId && utxo.token?.nft?.capability === 'minting',
    );
    expect(masters).toHaveLength(3);
    const merge = await contract.call
      .consolidate(2n, new SignatureTemplate(alicePriv))
      .withConsumedMasters(masters.slice(1), walletSigner.getAddress())
      .withMergeFunding([await fund(provider, walletSigner.getAddress(), 10_000n)], walletSigner.unlockP2PKH())
      .send();
    expect(placeholderInputs(merge)).toEqual([]);
    expect(wallet.requests).toBe(walletFundsSplit ? 2 : 1);
    expect((await provider.getUtxos(contract.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === contract.categoryId && utxo.token?.nft?.capability === 'minting',
    )).toHaveLength(1);
  });
});
