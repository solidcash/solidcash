/**
 * B9.11: A12's path table and its refusals, under the production profile.
 */
import { describe, expect, it, vi } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { DeployerPathError } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const C = `${P} contract C { int n; constructor() { n = 1; } function read() { require(n == 1); } }`;

const authorLock = (): Uint8Array => encodeLockingBytecodeP2pkh(alicePkh);
const changeAddress = (): string => {
  const address = lockingBytecodeToCashAddress({ bytecode: authorLock(), prefix: 'bchtest' });
  if (typeof address === 'string') throw new Error(address);
  return address.address;
};

async function funded(): Promise<{ provider: MockNetworkProvider; fundingUtxo: Utxo }> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const fundingUtxo: Utxo = { txid: '33'.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.seedUtxo(Buffer.from(authorLock()).toString('hex'), fundingUtxo);
  return { provider, fundingUtxo };
}

const deploy = (
  provider: MockNetworkProvider, artifact: ReturnType<typeof compileString>, fundingUtxo: Utxo,
  extra: Record<string, unknown> = {},
): ReturnType<typeof StatefulContract.deploy> => StatefulContract.deploy(artifact, [], {
  provider,
  fundingUtxo,
  funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
  changeAddress: changeAddress(),
  senderLockingBytecode: authorLock(),
  ...extra,
});

describe('A12: paths and refusals', () => {
  it('an artifact without a deployer refuses viaDeployer', async () => {
    const { provider, fundingUtxo } = await funded();
    const artifact = compileString(C, { messageBus: false });
    await expect(deploy(provider, artifact, fundingUtxo, { viaDeployer: true }))
      .rejects.toBeInstanceOf(DeployerPathError);
  });

  it('an unsupported deployer refuses viaDeployer and names the reason', async () => {
    const { provider, fundingUtxo } = await funded();
    const artifact = compileString(C, { deployer: true, messageBus: true });
    expect(artifact.deployerUnsupported).toBeDefined();
    await expect(deploy(provider, artifact, fundingUtxo, { viaDeployer: true }))
      .rejects.toThrow(new RegExp(artifact.deployerUnsupported!));
  });

  it('a fallback case falls back to today\'s genesis with one warning', async () => {
    const { provider, fundingUtxo } = await funded();
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await deploy(provider, artifact, fundingUtxo, { salt: Uint8Array.of(1, 2, 3) });
      expect(result.categoryId).toBe(fundingUtxo.txid);
      expect(warn.mock.calls.some(([message]) => String(message).includes('salt'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('an explicit viaDeployer turns a fallback into DeployerPathError', async () => {
    const { provider, fundingUtxo } = await funded();
    const artifact = compileString(C, { deployer: true, messageBus: false });
    await expect(deploy(provider, artifact, fundingUtxo, {
      salt: Uint8Array.of(1, 2, 3), viaDeployer: true,
    })).rejects.toThrow(/salt/);
  });

  it('a constructor that writes a collection never takes today\'s genesis', async () => {
    const source = `${P} contract C { mapping(int => int) m; constructor() { m[1] = 2; } function bump() { m[1] = 3; } }`;
    const artifact = compileString(source, { deployer: true, messageBus: false });
    expect(artifact.constructorWritesCollections).toBe(true);
    const { provider, fundingUtxo } = await funded();
    await expect(deploy(provider, artifact, fundingUtxo, { viaDeployer: true }))
      .rejects.toBeInstanceOf(DeployerPathError);
  });

  it('a requested BCMR identity is refused until Deploy<C> pins it', async () => {
    const { provider, fundingUtxo } = await funded();
    const artifact = compileString(C, { deployer: true, messageBus: false });
    await expect(deploy(provider, artifact, fundingUtxo, { identity: { owner: authorLock() } }))
      .rejects.toThrow(/identity output/);
  });
});
