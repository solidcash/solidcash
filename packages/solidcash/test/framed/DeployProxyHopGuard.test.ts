import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { ContractFactory } from '../../src/stateful/ContractFactory.js';
import { deployProxy } from '../../src/stateful/upgrades.js';
import { buildProxyArtifact } from '../../src/framed/proxy/index.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';

/**
 * A separate initialize hop (`initializeAs: 'hop'`) leaves a framed proxy uninitialized on chain until the hop
 * confirms. deployProxy must then deploy a proxy whose fallback admits only the hop's caller, or anyone could
 * initialize it first. The framed route builds the proxy and hands it to deployFramedProxy; capture that hand-off.
 */

interface HandOff { readonly proxyArtifact: Artifact; readonly callerLockingBytecode: Uint8Array }

const handedOver = vi.hoisted((): HandOff[] => []);
vi.mock('../../src/framed/proxy/index.js', async (importOriginal): Promise<Record<string, unknown>> => ({
  ...await importOriginal<Record<string, unknown>>(),
  deployFramedProxy: async (options: HandOff): Promise<never> => {
    handedOver.push(options);
    throw new Error('handed over');
  },
}));

const SOURCE = 'pragma solidcash ^0.14.0; contract Impl { address public implementation; uint public initialized;'
  + ' function initialize(address expected) { require(msg.sender == expected);'
  + ' require(this.initialized == 0, "already initialized"); this.initialized = 1; } }';
const impl = compileStringMulti(SOURCE, { composition: 'framed' }).Impl!;
const signer = new Signer(alicePriv, new MockNetworkProvider());
const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
const coin = (byte: string): Utxo => ({ txid: byte.repeat(32), vout: 0, satoshis: 10_000_000n });
const geneses = { implementationOverrides: { fundingUtxo: coin('a1') }, proxyOverrides: { fundingUtxo: coin('a2') } };
const callerFunding = { utxo: coin('a3'), funder: new SignatureTemplate(alicePriv).unlockP2PKH() };

async function handOff(options: Parameters<typeof deployProxy>[2]): Promise<HandOff> {
  await expect(deployProxy(new ContractFactory(impl, signer), [deployerLock], options)).rejects.toThrow('handed over');
  return handedOver.at(-1)!;
}

describe('deployProxy guards a framed proxy that a separate hop initializes', () => {
  it('generates the proxy with the hop caller as its guard', async () => {
    const hop = await handOff({ ...geneses, initializeAs: 'hop', callerFunding });
    expect(binToHex(hop.callerLockingBytecode)).toBe(binToHex(deployerLock));
    expect(hop.proxyArtifact.source).toContain(`require(msg.sender == address(hex"${binToHex(deployerLock)}"))`);
  });

  it('leaves a proxy that the genesis initializes unguarded', async () => {
    const atGenesis = await handOff(geneses);
    expect(atGenesis.proxyArtifact.source).not.toContain('require(msg.sender == address(hex"');
  });

  it('deploys a caller-supplied proxy as given', async () => {
    const own = buildProxyArtifact(impl);
    const hop = await handOff({ ...geneses, proxy: own, initializeAs: 'hop', callerFunding });
    expect(hop.proxyArtifact).toBe(own);
  });
});
