import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import MockNetworkProvider from '@solidcash/solidcash/dist/network/MockNetworkProvider.js';
import { addressToLockScript } from '@solidcash/solidcash/dist/utils.js';
import { createLookaheadForAddress } from '@solidcash/solidcash/dist/framed/deploy/create-lookahead-session.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';
import { getCreateAddress } from '../src/ethers-shim.js';

const providers: MockNetworkProvider[] = [];
const runtime = globalThis as typeof globalThis & { __solidcashActiveHre?: unknown };
const previousRuntime = runtime.__solidcashActiveHre;
afterEach(() => {
  for (const provider of providers.splice(0)) provider.reset();
  if (previousRuntime === undefined) delete runtime.__solidcashActiveHre;
  else runtime.__solidcashActiveHre = previousRuntime;
});
const lockHex = (address: string): string => address.includes(':')
  ? binToHex(addressToLockScript(address)) : address.replace(/^0x/u, '');

describe('CREATE prediction follows the deployment convention', () => {
  it.each(['direct', 'framed'] as const)(
    'matches two deployed %s contracts after a nonce read reserves framed funding',
    async (composition) => {
      const hre = createHardhatRuntimeEnvironment(resolveConfig({
        composition, defaultNetwork: 'mock', networks: { mock: { type: 'mock' } },
      }));
      runtime.__solidcashActiveHre = hre;
      const [signer] = await hre.ethers.getSigners(1);
      providers.push(hre.ethers.provider as MockNetworkProvider);
      const nonce = await signer.getNonce();
      expect(createLookaheadForAddress(signer.address)?.getReservedCount()).toBe(4);
      const predicted = [0, 1].map((offset) => {
        const tx = { from: signer.address, nonce: nonce + offset };
        expect(getCreateAddress(tx)).toBe(hre.ethers.getCreateAddress(tx));
        return hre.ethers.getCreateAddress(tx);
      });
      if (composition === 'direct') {
        const defaults = createHardhatRuntimeEnvironment(resolveConfig({
          defaultNetwork: 'mock', networks: { mock: { type: 'mock' } },
        }));
        runtime.__solidcashActiveHre = defaults;
        const tx = { from: signer.address, nonce };
        expect(defaults.ethers.getCreateAddress(tx)).toBe(predicted[0]);
        expect(getCreateAddress(tx)).toBe(predicted[0]);
        providers.push(defaults.ethers.provider as MockNetworkProvider);
        runtime.__solidcashActiveHre = hre;
      }
      const artifact = compileString(`contract PredictedCreate() {
        int public counter;
        function increment() { this.counter = this.counter + 1; require(true); }
      }`, { composition });
      for (const prediction of predicted) {
        const deployed = await hre.ethers.getContractFactory(artifact, signer).deploy();
        expect(lockHex(await deployed.getAddress())).toBe(lockHex(prediction));
      }
    },
    120_000,
  );
});
