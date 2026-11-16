/**
 * A payable entry that adds `msg.value` to state and returns the sum, called as an ordinary call, with and without
 * value, with `genesisCalls` on and off.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.51.0;';
const SOURCE = `${P} contract Pay { int paid;
  function pay() public payable returns (int) { paid = paid + msg.value; return paid; } }`;

describe('a payable entry that returns the value it accumulated', () => {
  it.each([
    ['genesisCalls on', { genesisCalls: true }],
    ['genesisCalls off', { genesisCalls: false }],
  ] as const)('is called with and without value (%s)', async (_name, options) => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: '7c'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    const artifact = compileString(SOURCE, {
      deployer: true, messageBus: false, primaryContractName: 'Pay', ...options,
    } as never);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xa0 + index).toString(16)}`.repeat(32), vout: 0, satoshis: 200_000n,
      });
    }
    const wallet = contract.connect(signer) as any;
    await wallet.call.pay().withValue(1500n).send();
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(1500n);
    await wallet.call.pay().withValue(2000n).send();
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(3500n);
    await wallet.call.pay().send();
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(3500n);
  }, 300_000);
});
