/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer, getContractFactory, upgrades } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Blocker A repro: MarketplaceDataV1.initialize fails BCH-2026 preflight at its own input when it writes even a
// SINGLE mapping entry (verified against the real project: 8 writes fail, 1 write fails, 0 writes succeed and
// the suite advances ~530 lines). MarketplaceV1, same OZ initializer/proxy machinery but scalar writes only,
// deploys fine. A non-proxy contract doing the same entry write passes (InitFlagEntryWriteRepro), so the
// delegate/proxy frame is the remaining ingredient. These pin that frame directly.

const SCALAR_ONLY = `pragma solidcash >=0.8.0;
  contract ScalarImpl() {
    bigint counter;
    function bump() public { this.counter = this.counter + 1; }
  }`;

const ENTRY_WRITE = `pragma solidcash >=0.8.0;
  contract EntryImpl() {
    bigint counter;
    mapping(int => bigint) tags;
    function bump() public { this.counter = this.counter + 1; this.tags[1] = 11; }
  }`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  await provider.addUtxo(signer.getAddress(), { txid: 'a1'.repeat(32), vout: 0, satoshis: 1_000_000n });
  await provider.addUtxo(signer.getAddress(), { txid: 'b2'.repeat(32), vout: 0, satoshis: 1_000_000n });
  await provider.addUtxo(signer.getAddress(), { txid: 'c3'.repeat(32), vout: 0, satoshis: 1_000_000n });
  return signer;
}

describe('writing a mapping entry through a proxy delegate frame', () => {
  it('forwards a scalar-only state write through the proxy', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(SCALAR_ONLY), signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 0n });
    await proxy.waitForDeployment();
    await expect(proxy.bump().send()).resolves.toBeDefined();
  });

  it('forwards a state write that ALSO writes a mapping entry through the proxy', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(ENTRY_WRITE), signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 0n });
    await proxy.waitForDeployment();
    await expect(proxy.bump().send()).resolves.toBeDefined();
  });
});
