import {
  Contract,
  TransactionBuilder,
  MockNetworkProvider,
  ElectrumNetworkProvider,
  randomUtxo,
  type Artifact,
} from 'solidcash';
import type NetworkProvider from 'solidcash/dist/network/NetworkProvider.js';
import { getSigners, type Signer } from './accounts.js';
import { type ResolvedConfig, type NetworkConfig, loadConfig } from './config.js';

export interface Fixture {
  /** Network provider (mock or real) */
  provider: NetworkProvider;
  /** Pre-derived test signers */
  signers: Signer[];
  /** Active network name */
  network: string;
  /** Create a non-stateful contract with the provider */
  createContract(artifact: Artifact, constructorArgs?: any[]): Contract;
  /** Create a new TransactionBuilder with the provider */
  createTx(): TransactionBuilder;
  /** Fund an address with a random UTXO (mocknet only) */
  fund(address: string, amount?: bigint): ReturnType<typeof randomUtxo>;
}

type FixtureFn<T> = (fixture: Fixture) => T | Promise<T>;

const fixtureCache = new Map<FixtureFn<unknown>, { result: unknown; snapshot: Fixture }>();

/**
 * Load a test fixture with snapshot/restore caching (like Hardhat's `loadFixture`).
 *
 * On first call, invokes the fixture function with a fresh environment and caches the result.
 * Subsequent calls with the same function reference return the cached result with a
 * fresh environment (mocknet state is reset).
 *
 * Usage:
 *   async function deployFixture(env: Fixture) {
 *     const artifact = compileContract('./contracts/Token.scash');
 *     const [deployer] = env.signers;
 *     const contract = env.createContract(artifact, [deployer.pubkey]);
 *     const utxo = env.fund(contract.address, 50_000n);
 *     return { contract, deployer, utxo };
 *   }
 *
 *   it('test', async () => {
 *     const { contract, deployer, utxo } = await loadFixture(deployFixture);
 *   });
 */
export async function loadFixture<T>(fixtureFn: FixtureFn<T>, networkName?: string): Promise<T> {
  const cached = fixtureCache.get(fixtureFn as FixtureFn<unknown>);
  if (cached) {
    return cached.result as T;
  }

  const config = await loadConfig();
  const fixture = createFixtureFromConfig(config, networkName);
  const result = await fixtureFn(fixture);

  fixtureCache.set(fixtureFn as FixtureFn<unknown>, { result, snapshot: fixture });
  return result;
}

export function createFixtureFromConfig(
  config: ResolvedConfig,
  networkName?: string,
): Fixture {
  const network = networkName ?? config.defaultNetwork;
  const netConfig: NetworkConfig = config.networks[network] ?? {};
  const accountCount = netConfig.accountCount ?? 10;
  const fundAmount = netConfig.accountBalance ?? 100_000n;
  const signers = getSigners(accountCount, netConfig.mnemonic);

  if (network === 'mocknet' || !netConfig.url) {
    const provider = new MockNetworkProvider();
    for (const signer of signers) {
      const utxo = randomUtxo({ satoshis: fundAmount });
      provider.addUtxo(signer.address, utxo);
    }

    return {
      provider,
      signers,
      network,
      createContract(artifact: Artifact, constructorArgs: any[] = []): Contract {
        return new Contract(artifact, constructorArgs, { provider, addressType: 'p2sh32' });
      },
      createTx(): TransactionBuilder {
        return new TransactionBuilder({ provider });
      },
      fund(address: string, amount?: bigint) {
        const utxo = randomUtxo({ satoshis: amount ?? fundAmount });
        provider.addUtxo(address, utxo);
        return utxo;
      },
    };
  }

  const provider = new ElectrumNetworkProvider(network as any);

  return {
    provider,
    signers,
    network,
    createContract(artifact: Artifact, constructorArgs: any[] = []): Contract {
      return new Contract(artifact, constructorArgs, { provider, addressType: 'p2sh32' });
    },
    createTx(): TransactionBuilder {
      return new TransactionBuilder({ provider });
    },
    fund(): never {
      throw new Error(`fund() is only available on mocknet. Use a faucet for ${network}.`);
    },
  };
}
