import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Signer, getContractFactory, registerDeployment, takeDeploymentRegistrySnapshot, upgrades,
} from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

// OpenZeppelin's `upgrades.upgradeProxy(address, Factory)` takes the proxy's address. A deployment script that reads
// that address from another network's config names nothing on this network: the upgrade must be refused at once,
// naming the address and the network, instead of failing obscurely or leaving the script waiting.
const IMPL = `pragma solidcash >=0.8.0;
  contract UpgradeTargetImpl() {
    bigint counter;
    function increment() public { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  }`;

function freshPrivateKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  // Keep the value non-zero and below the secp256k1 group order.
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

describe('upgrades.upgradeProxy on an address with no proxy deployed', () => {
  it('rejects at once, naming the address and the network', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshPrivateKey(), provider);
    const factory = getContractFactory(compileString(IMPL), signer);
    const network = provider.network;
    const registry = takeDeploymentRegistrySnapshot(provider);
    const started = Date.now();
    try {
      // An EVM address from another network's config, a well-formed address with nothing deployed, a malformed one.
      for (const address of ['0x405AcFbD1400A168fDd4aDA2D214e8Ae5FF7a624', signer.getAddress(), 'not-an-address']) {
        await expect(upgrades.upgradeProxy(address, factory))
          .rejects.toThrow(`upgradeProxy: no proxy is deployed at ${address} on ${network}`);
      }
      // A config without the field.
      await expect(upgrades.upgradeProxy(undefined as unknown as string, factory))
        .rejects.toThrow('upgradeProxy: expected a deployed proxy or its address, got undefined');
      // Something is deployed there, but it is not a proxy.
      const plain = new Signer(freshPrivateKey(), provider).getAddress();
      registerDeployment(provider, { contractName: 'PlainCounter', address: plain, contract: { target: plain } });
      await expect(upgrades.upgradeProxy(plain, factory))
        .rejects.toThrow(`upgradeProxy: the contract deployed at ${plain} on ${network} ('PlainCounter') is not a proxy`);
    } finally {
      registry.restore();
    }
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 30_000);
});
