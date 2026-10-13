import { describe, expect, it } from 'vitest';
import { HDSigner } from '../src/HDSigner.js';
import Signer from '../src/Signer.js';
import type NetworkProvider from '../src/network/NetworkProvider.js';
import { alicePriv } from './fixture/vars.js';

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const provider = { network: 'mocknet' } as NetworkProvider;

describe('signer secret redaction', () => {
  it('keeps the mnemonic readable and out of enumeration and JSON', () => {
    const signer = HDSigner.fromPhrase(PHRASE, provider);
    expect(signer.mnemonic).toBe(PHRASE);
    expect(Object.keys(signer)).not.toContain('mnemonic');
    expect(Object.keys(signer)).not.toContain('node');
    expect(Object.keys(signer)).not.toContain('privateKey');
    const json = JSON.stringify(signer);
    expect(json).not.toContain('abandon');
    expect(json).not.toContain('privateKey');
    expect(json).toContain('derivationPath');
  });

  it('omits a single-key private key from enumeration and JSON', () => {
    const signer = new Signer(alicePriv, provider);
    expect(signer.privateKey).toEqual(alicePriv);
    expect(Object.keys(signer)).not.toContain('privateKey');
    expect(JSON.stringify(signer)).not.toContain('"privateKey"');
    expect(JSON.stringify(signer)).toContain('publicKey');
  });
});
