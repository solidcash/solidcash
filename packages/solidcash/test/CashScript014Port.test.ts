import { describe, it, expect } from 'vitest';
import {
  HashType,
  OutputTokenCommitmentTooLongError,
  SighashType,
  SignatureAlgorithm,
  SignatureTemplate,
  TransactionBuilder,
  TransactionFeeTooHighError,
  TransactionInputsRequiredError,
  TransactionOutputsRequiredError,
  UnlockerLockingBytecodeMismatchError,
} from '../src/index.js';
import { MockNetworkProvider } from '../src/network/mock/index.js';
import { encodeFunctionArgument } from '../src/Argument.js';
import { addressToLockScript, randomUtxo } from '../src/utils.js';
import { placeholderP2PKHUnlocker } from '../src/walletconnect-utils.js';
import { aliceAddress, alicePriv, alicePub, aliceTokenAddress, bobAddress } from './fixture/vars.js';

// Behaviour ported from CashScript 0.14.0 (see docs/framed/UPSTREAM_0140_PORT.md for the upstream commits).

const alice = new SignatureTemplate(alicePriv);

const p2pkhTransaction = (provider: MockNetworkProvider): TransactionBuilder => new TransactionBuilder({ provider })
  .addInput(randomUtxo({ satoshis: 10_000n }), alice.unlockP2PKH())
  .addOutput({ to: bobAddress, amount: 9_000n });

describe('TransactionBuilder', () => {
  const provider = new MockNetworkProvider();

  it('calculateTransactionFee reports the fee and the fee per byte at the reported size', () => {
    const transaction = p2pkhTransaction(provider);
    const size = transaction.getTransactionSize();

    expect(transaction.calculateTransactionFee()).toEqual({
      feeSats: 1_000n,
      feeSatsPerByte: Number((1000 / Number(size)).toFixed(2)),
    });
  });

  it('counts a placeholder P2PKH input at its signed size', () => {
    const utxo = randomUtxo();
    const output = { to: bobAddress, amount: 1_000n };
    const signed = new TransactionBuilder({ provider }).addInput(utxo, alice.unlockP2PKH()).addOutput(output);
    const placeholder = new TransactionBuilder({ provider })
      .addInput(utxo, placeholderP2PKHUnlocker(aliceAddress)).addOutput(output);

    expect(placeholder.getTransactionSize()).toBe(signed.getTransactionSize());
  });

  it('setLocktime only accepts an unsigned 32-bit integer', () => {
    const transaction = new TransactionBuilder({ provider });
    for (const invalid of [-1, 1.5, 0x1_0000_0000, Number.NaN]) {
      expect(() => transaction.setLocktime(invalid)).toThrow('should be an integer between 0 and 4294967295');
    }
    expect(transaction.setLocktime(0).locktime).toBe(0);
    expect(transaction.setLocktime(0xffffffff).locktime).toBe(0xffffffff);
  });

  it('refuses a transaction without inputs or outputs with typed errors', () => {
    expect(() => new TransactionBuilder({ provider }).addOutput({ to: bobAddress, amount: 1_000n }).build())
      .toThrow(TransactionInputsRequiredError);
    expect(() => new TransactionBuilder({ provider }).addInput(randomUtxo(), alice.unlockP2PKH()).build())
      .toThrow(TransactionOutputsRequiredError);
  });

  it('refuses a fee over maximumFeeSatoshis with a typed error', () => {
    const transaction = new TransactionBuilder({ provider, maximumFeeSatoshis: 999n })
      .addInput(randomUtxo({ satoshis: 10_000n }), alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 9_000n });

    expect(() => transaction.build()).toThrow(TransactionFeeTooHighError);
    expect(() => transaction.build()).toThrow('Transaction fee of 1000 is higher than max fee of 999');
  });

  it('refuses an NFT commitment longer than the provider allows', () => {
    const limited = new MockNetworkProvider({ consensusLimits: { maximumNftCommitmentBytes: 128 } });
    const output = (bytes: number): Parameters<TransactionBuilder['addOutput']>[0] => ({
      to: aliceTokenAddress,
      amount: 2_000n,
      token: { category: 'ab'.repeat(32), amount: 0n, nft: { capability: 'none', commitment: 'cd'.repeat(bytes) } },
    });

    expect(() => new TransactionBuilder({ provider: limited }).addOutput(output(128))).not.toThrow();
    expect(() => new TransactionBuilder({ provider: limited }).addOutput(output(129)))
      .toThrow(OutputTokenCommitmentTooLongError);
    // The default mock publishes a relaxed commitment limit
    expect(() => new TransactionBuilder({ provider }).addOutput(output(129))).not.toThrow();
  });

  it('refuses an input whose stated locking bytecode is not the one its unlocker spends', () => {
    const build = (lockingBytecode: Uint8Array): string => new TransactionBuilder({ provider })
      .addInput(randomUtxo({ lockingBytecode }), alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 1_000n })
      .build();

    expect(() => build(addressToLockScript(bobAddress))).toThrow(UnlockerLockingBytecodeMismatchError);
    expect(() => build(addressToLockScript(bobAddress))).toThrow(`Input #0 is locked by address ${bobAddress}`);
    expect(() => build(addressToLockScript(aliceAddress))).not.toThrow();
  });
});

describe('function arguments', () => {
  it('refuses a hex string argument that is not valid hex', () => {
    expect(() => encodeFunctionArgument('0x123', 'bytes')).toThrow('should be a valid hex string');
    expect(() => encodeFunctionArgument('zz', 'bytes2')).toThrow('should be a valid hex string');
    expect(encodeFunctionArgument('0x1234', 'bytes2')).toEqual(Uint8Array.from([0x12, 0x34]));
  });

  it('refuses a pubkey that is not 33 or 65 bytes', () => {
    expect(() => encodeFunctionArgument(new Uint8Array(20), 'pubkey')).toThrow("Found type 'bytes20'");
    expect(encodeFunctionArgument(alicePub, 'pubkey')).toEqual(alicePub);
  });
});

describe('SignatureTemplate', () => {
  it('exposes its sighash type, algorithm and public key as properties, with the old getters as aliases', () => {
    const template = new SignatureTemplate(alicePriv, SighashType.SIGHASH_ALL, SignatureAlgorithm.ECDSA);

    expect(template.sighashType).toBe(SighashType.SIGHASH_ALL);
    expect(template.signatureAlgorithm).toBe(SignatureAlgorithm.ECDSA);
    expect(template.publicKey).toEqual(alicePub);
    expect(template.getHashType()).toBe(SighashType.SIGHASH_ALL | 0x40);
    expect(template.getHashType(false)).toBe(SighashType.SIGHASH_ALL);
    expect(template.getSignatureAlgorithm()).toBe(SignatureAlgorithm.ECDSA);
    expect(template.getPublicKey()).toEqual(alicePub);
    expect(HashType.SIGHASH_UTXOS).toBe(SighashType.SIGHASH_UTXOS);
  });

  it('always appends the fork id flag to the sighash type of a signature', () => {
    const signature = alice.generateSignature(new Uint8Array(32).fill(7));
    expect(signature.at(-1)).toBe(SighashType.SIGHASH_ALL | SighashType.SIGHASH_UTXOS | 0x40);
  });
});

