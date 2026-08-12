import { expect } from 'chai';
import { config, ethers } from 'hardhat';
import type { HardhatNetworkHDAccountsConfig } from 'hardhat/types';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { utf8ToBytes } from '@noble/ciphers/utils';
import { randomBytes } from '@noble/ciphers/webcrypto';

// Cold extraction of EffectiveAcceleration's "EOA, private key available" communication test. The upstream
// describe has an outer beforeEach which deploys Marketplace and MarketplaceData, though this test uses neither.
describe('EOA encrypted communication without deployment', () => {
  it('Should be able to send an encrypted message, signature workflow', async () => {
    const accounts = config.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig;
    const index = 1;
    const alice = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(accounts.mnemonic), `${accounts.path}/${index}`,
    );
    const bob = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(accounts.mnemonic), `${accounts.path}/${index + 1}`,
    );
    const arbitrator = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(accounts.mnemonic), `${accounts.path}/${index + 2}`,
    );

    const handshakeMessage = 'handshake';
    const handshakeDigest = ethers.hashMessage(handshakeMessage);
    const aliceSignature = await alice.signMessage(handshakeMessage);
    const aliceAddress = ethers.verifyMessage(handshakeMessage, aliceSignature);
    expect(aliceAddress).to.equal(alice.address);
    const alicePublicKeyCompressed = ethers.SigningKey.computePublicKey(
      ethers.SigningKey.recoverPublicKey(handshakeDigest, aliceSignature), true,
    );
    expect(alicePublicKeyCompressed).to.equal(alice.publicKey);

    const bobSignature = await bob.signMessage(handshakeMessage);
    const bobAddress = ethers.verifyMessage(handshakeMessage, bobSignature);
    expect(bobAddress).to.equal(bob.address);
    const bobPublicKeyCompressed = ethers.SigningKey.computePublicKey(
      ethers.SigningKey.recoverPublicKey(handshakeDigest, bobSignature), true,
    );
    expect(bobPublicKeyCompressed).to.equal(bob.publicKey);

    const sharedAB = alice.signingKey.computeSharedSecret(bobPublicKeyCompressed);
    const sharedBA = bob.signingKey.computeSharedSecret(alicePublicKeyCompressed);
    expect(sharedAB).to.equal(sharedBA);

    const hashedSharedSecret = ethers.keccak256(sharedAB);
    const threadId = ethers.randomBytes(32);
    const sessionKey = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32'], [hashedSharedSecret, threadId],
    ));

    const nonce = randomBytes(24);
    const chacha = xchacha20poly1305(ethers.getBytes(sessionKey), nonce);
    const data = utf8ToBytes('hello, noble');
    const ciphertext = Uint8Array.from([...nonce, ...chacha.encrypt(data)]);
    const ciphertextNonce = ciphertext.slice(0, 24);
    const decryptedData = xchacha20poly1305(
      ethers.getBytes(sessionKey), ciphertextNonce,
    ).decrypt(ciphertext.slice(24));
    expect(decryptedData).to.deep.equal(data);

    const arbitratorMessage = 'arbitrator';
    const arbitratorDigest = ethers.hashMessage(arbitratorMessage);
    const arbitratorSignature = await arbitrator.signMessage(arbitratorMessage);
    const arbitratorAddress = ethers.verifyMessage(arbitratorMessage, arbitratorSignature);
    expect(arbitratorAddress).to.equal(arbitrator.address);
    const arbitratorPublicKeyCompressed = ethers.SigningKey.computePublicKey(
      ethers.SigningKey.recoverPublicKey(arbitratorDigest, arbitratorSignature), true,
    );
    expect(arbitratorPublicKeyCompressed).to.equal(arbitrator.publicKey);

    const sharedAA = alice.signingKey.computeSharedSecret(arbitratorPublicKeyCompressed);
    const arbitrationSessionKey = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32'], [ethers.keccak256(sharedAA), threadId],
    ));
    const arbitrationNonce = randomBytes(24);
    const arbitrationCipher = xchacha20poly1305(ethers.getBytes(arbitrationSessionKey), arbitrationNonce);
    const encodedSessionKey = ethers.getBytes(sessionKey);
    const encryptedSessionKey = Uint8Array.from([
      ...arbitrationNonce, ...arbitrationCipher.encrypt(encodedSessionKey),
    ]);
    const decryptedSessionKey = xchacha20poly1305(
      ethers.getBytes(arbitrationSessionKey), encryptedSessionKey.slice(0, 24),
    ).decrypt(encryptedSessionKey.slice(24));
    expect(decryptedSessionKey).to.deep.equal(encodedSessionKey);

    const arbitratorDecryptedData = xchacha20poly1305(
      decryptedSessionKey, ciphertextNonce,
    ).decrypt(ciphertext.slice(24));
    expect(arbitratorDecryptedData).to.deep.equal(data);
  });
});
