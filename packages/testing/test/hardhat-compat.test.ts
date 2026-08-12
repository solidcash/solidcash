import {
  SigningKey, Wallet as EvmWallet, getBytes, hashMessage, verifyMessage,
} from 'ethers';
import { hash160 } from '@bitauth/libauth';
import { describe, expect as vitestExpect, it } from 'vitest';
import { expect as chaiExpect } from '../src/chai.js';
import { resolveConfig } from '../src/config.js';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';

describe('Hardhat compatibility helpers', () => {
  it('supports callable Chai type and throw assertions', () => {
    chaiExpect({ value: 1 }).to.be.an('object');
    chaiExpect([1]).to.be.an('array');
    chaiExpect('value').to.be.a('string');
    chaiExpect(() => { throw new Error('invalid hash'); }).to.throw('invalid hash');
    chaiExpect(() => undefined).to.not.throw();

    vitestExpect(() => chaiExpect(1).to.be.an('object')).toThrow();
    vitestExpect(() => chaiExpect(() => undefined).to.throw()).toThrow();
  });

  it('uses EIP-191 signatures and the configured P2PKH recovery projection', async () => {
    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      networks: { mock: { type: 'mock' } },
      defaultNetwork: 'mock',
      accounts: { count: 1 },
      compiler: { ecrecover: 'p2pkh' },
    }));
    const [signer] = await hre.ethers.getSigners(1);
    const message = 'effective acceleration encryption key';
    const signature = await signer.signMessage(message);
    const expectedAddress = new EvmWallet(`0x${Buffer.from(signer.privateKey).toString('hex')}`).address;
    const recoveredPublicKey = getBytes(SigningKey.computePublicKey(
      SigningKey.recoverPublicKey(hashMessage(message), signature), true,
    ));

    vitestExpect(verifyMessage(message, signature)).toBe(expectedAddress);
    vitestExpect(hre.ethers.verifyMessageEvm(message, signature)).toBe(expectedAddress);
    vitestExpect(hre.ethers.verifyMessageP2pkh(message, signature)).toBe(signer.address);
    vitestExpect(hre.ethers.verifyMessage(message, signature)).toBe(signer.address);
    vitestExpect(recoveredPublicKey).toEqual(signer.publicKey);
    // `ecrecover: 'p2pkh'` projects this recovered compressed key to
    // 0x76a914 || hash160(key) || 0x88ac, exactly the signer's BCH locking bytecode.
    const recoveredP2pkh = Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(recoveredPublicKey), 0x88, 0xac]);
    vitestExpect(recoveredP2pkh).toEqual(signer.getLockingBytecode());

    const indexedSigner = await hre.ethers.getSigner(0);
    vitestExpect(verifyMessage(message, await indexedSigner.signMessage(message))).toBe(expectedAddress);
    const reconnected = signer.connect(hre.ethers.provider);
    vitestExpect(verifyMessage(message, await reconnected.signMessage(message))).toBe(expectedAddress);
  });

  it('retains conventional verifyMessage results in EVM recovery mode', async () => {
    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      networks: { mock: { type: 'mock' } },
      defaultNetwork: 'mock',
      accounts: { count: 1 },
      compiler: { ecrecover: 'evm' },
    }));
    const [signer] = await hre.ethers.getSigners(1);
    const message = 'marketplace evm recovery';
    const signature = await signer.signMessage(message);

    vitestExpect(hre.ethers.verifyMessage(message, signature)).toBe(verifyMessage(message, signature));
    vitestExpect(hre.ethers.verifyMessageP2pkh(message, signature)).toBe(signer.address);
  });
});
