/**
 * B9.11: a top-level deployment through Deploy<C>, on the production profile.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { verifyBirth } from '../../src/stateful/deployer.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const C = `${P} contract C { int n; constructor() { n = 1; } function read() { require(n == 1); } }`;

describe('a top-level deployment through Deploy<C>', () => {
  it('creates the contract from its prep coin and mints it at the prep category', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    expect(artifact.deployer).toBeDefined();
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = {
      txid: '11'.repeat(32), vout: 0, satoshis: 500_000n,
    };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);

    const result = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
    });

    expect(result.categoryId).not.toBe(fundingUtxo.txid);
    expect(result.prepTransactions).toHaveLength(1);
    expect(await verifyBirth(provider, result.categoryId, [artifact.deployer!])).toBe(true);
    expect(result.contract.categoryId).toBe(result.categoryId);
  });

  it('ContractFactory.deploy takes the deployer path and the born contract is callable', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const signer = await provider.getSigner(0);
    await provider.seedUtxo(signer.getAddress(), {
      txid: '22'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const contract = await new ContractFactory(artifact, signer).deploy();
    expect(contract.categoryId).not.toBe('22'.repeat(32));
    expect(await verifyBirth(provider, contract.categoryId, [artifact.deployer!])).toBe(true);
    await contract.read().send();
  });
});
