import fs from 'fs';
import path from 'path';
import {
  Contract,
  MockNetworkProvider,
  StatefulContract,
  randomUtxo,
  type Artifact,
} from 'solidcash';
import type { Utxo } from 'solidcash';
import { compileString } from 'solidc';
import type NetworkProvider from 'solidcash/dist/network/NetworkProvider.js';
import { loadConfig, type ResolvedConfig } from './config.js';
import { getSigners } from './accounts.js';

export interface ContractFactory {
  /** The compiled artifact */
  artifact: Artifact;
  /** Contract name */
  name: string;

  /**
   * Create a non-stateful contract instance (like Hardhat's ContractFactory.deploy() for view-only).
   * Attaches to the given provider, or the default mocknet provider.
   */
  createContract(constructorArgs?: any[], options?: FactoryContractOptions): Contract;

  /**
   * Deploy a stateful contract (like Hardhat's ContractFactory.deploy()).
   * Auto-creates a funding UTXO on mocknet. On real networks, fundingUtxo must be provided.
   */
  deploy(options?: FactoryDeployOptions): Promise<FactoryDeployResult>;
}

export interface FactoryContractOptions {
  provider?: NetworkProvider;
  addressType?: 'p2sh20' | 'p2sh32';
}

export interface FactoryDeployOptions {
  constructorArgs?: any[];
  provider?: NetworkProvider;
  initialState?: Record<string, any>;
  initialBalance?: bigint;
  fundingUtxo?: Utxo;
  funder?: any;  // Unlocker
  changeAddress?: string;
  addressType?: 'p2sh20' | 'p2sh32';
  fee?: bigint;
  masterAmount?: bigint;
  dataNftAmount?: bigint;
  threadCount?: number;
}

export interface FactoryDeployResult {
  contract: any;  // ConnectedStatefulContract
  tx: any;        // TransactionDetails
  categoryId: string;
}

// Cache: source path -> compiled artifact
const artifactCache = new Map<string, Artifact>();
let resolvedConfig: ResolvedConfig | undefined;

async function getConfig(): Promise<ResolvedConfig> {
  if (!resolvedConfig) {
    resolvedConfig = await loadConfig();
  }
  return resolvedConfig;
}

function findSourceFile(contractName: string, sourcesDir: string): string {
  // Try exact match first
  const exact = path.join(sourcesDir, `${contractName}.scash`);
  if (fs.existsSync(exact)) return exact;

  // Case-insensitive search
  if (fs.existsSync(sourcesDir)) {
    const files = fs.readdirSync(sourcesDir);
    const match = files.find(
      (f) => f.toLowerCase() === `${contractName.toLowerCase()}.scash`,
    );
    if (match) return path.join(sourcesDir, match);
  }

  throw new Error(
    `Contract source not found: ${contractName}.scash in ${sourcesDir}`,
  );
}

function compileOrCache(sourcePath: string): Artifact {
  const cached = artifactCache.get(sourcePath);
  if (cached) return cached;

  const source = fs.readFileSync(sourcePath, 'utf-8');
  const artifact = compileString(source);
  artifactCache.set(sourcePath, artifact);
  return artifact;
}

/**
 * Get a contract factory by name (like Hardhat's `ethers.getContractFactory("Token")`).
 *
 * Resolves the contract name to a .scash file in the configured sources directory,
 * compiles it (cached), and returns a factory for creating instances or deploying.
 *
 * Usage:
 *   const Token = await getContractFactory('Token');
 *   const contract = Token.createContract([ownerPub]);              // non-stateful
 *   const { contract, categoryId } = await Token.deploy({           // stateful
 *     constructorArgs: [ownerPub],
 *     initialState: { totalSupply: 1_000_000n },
 *   });
 */
export async function getContractFactory(
  contractName: string,
): Promise<ContractFactory> {
  const config = await getConfig();
  return getContractFactoryFromConfig(contractName, config);
}

export function getContractFactoryFromConfig(
  contractName: string,
  config: ResolvedConfig,
): ContractFactory {
  const sourcePath = findSourceFile(contractName, config.paths.sources);
  const artifact = compileOrCache(sourcePath);
  const netConfig = config.networks[config.defaultNetwork] ?? {};

  return {
    artifact,
    name: artifact.contractName,

    createContract(constructorArgs: any[] = [], options?: FactoryContractOptions): Contract {
      const provider = options?.provider ?? new MockNetworkProvider();
      const addressType = options?.addressType ?? 'p2sh32';
      return new Contract(artifact, constructorArgs, { provider, addressType });
    },

    async deploy(options: FactoryDeployOptions = {}): Promise<FactoryDeployResult> {
      if (!artifact.stateLayout) {
        throw new Error(
          `${artifact.contractName} is not a stateful contract. Use createContract() instead.`,
        );
      }

      const constructorArgs = options.constructorArgs ?? [];
      const addressType = options.addressType ?? 'p2sh32';

      // Auto-create funding on mocknet
      let provider = options.provider;
      let fundingUtxo = options.fundingUtxo;
      let funder = options.funder;
      let changeAddress = options.changeAddress;

      if (!provider || provider instanceof MockNetworkProvider) {
        provider = provider ?? new MockNetworkProvider();
        const signers = getSigners(1, netConfig.mnemonic);
        const deployer = signers[0];

        if (!fundingUtxo) {
          // Create a funding UTXO at vout 0 with enough satoshis
          fundingUtxo = randomUtxo({ satoshis: 1_000_000n, vout: 0 });
          (provider as MockNetworkProvider).addUtxo(deployer.address, fundingUtxo);
        }

        if (!funder) {
          funder = deployer.sign().unlockP2PKH();
        }

        if (!changeAddress) {
          changeAddress = deployer.address;
        }
      }

      if (!fundingUtxo) throw new Error('fundingUtxo is required on non-mock networks');
      if (!funder) throw new Error('funder is required on non-mock networks');
      if (!changeAddress) throw new Error('changeAddress is required on non-mock networks');

      const result = await StatefulContract.deploy(
        artifact,
        constructorArgs,
        {
          provider,
          fundingUtxo,
          funder,
          changeAddress,
          initialState: options.initialState,
          masterAmount: options.masterAmount,
          dataNftAmount: options.dataNftAmount,
          fee: options.fee,
          addressType,
          threadCount: options.threadCount,
          initialBalance: options.initialBalance,
        },
      );

      return {
        contract: result.contract,
        tx: result.tx,
        categoryId: result.categoryId,
      };
    },
  };
}
