import { Artifact, ArtifactMap } from '@solidcash/utils';
import { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { AddressType, Utxo } from '../interfaces.js';
import { ConstructorArgument } from '../Argument.js';
import {
  StatefulContract, ConnectedStatefulContract, DeployOptions, DeployResult,
} from './StatefulContract.js';
import type Signer from '../Signer.js';

export interface ContractBundleOptions {
  provider: NetworkProvider;
  addressType?: AddressType;
  signer?: Signer; // if set, deployed/attached instances are connected to it (funds + signs subsequent calls)
}

/**
 * A deploy-capable wrapper around an ArtifactMap (from `compileStringMulti` / `compileFileMulti`). It holds the
 * artifacts + provider (+ optional signer) as IMPLICIT context, so deploying or attaching a contract auto-
 * registers the whole map - the dependency graph resolves without a manual `registerArtifacts`. See
 * docs/multi-contract-artifacts.md.
 *
 * ```ts
 * const bundle = ContractBundle.from(compileStringMulti(source), { provider });
 * const factory = await bundle.deploy('MultiFactory', [owner], { fundingUtxo, funder, changeAddress });
 * await factory.deployChild(...); // the child artifact is resolved from the bundle, implicitly
 * ```
 */
export class ContractBundle {
  constructor(
    readonly artifacts: ArtifactMap,
    private bundleOptions: ContractBundleOptions,
  ) {}

  static from(artifacts: ArtifactMap, options: ContractBundleOptions): ContractBundle {
    return new ContractBundle(artifacts, options);
  }

  /** The artifact for a named contract (throws if absent). */
  get(name: string): Artifact {
    const artifact = this.artifacts[name];
    if (!artifact) {
      throw new Error(
        `Contract '${name}' is not in this bundle. Available: ${Object.keys(this.artifacts).join(', ')}.`,
      );
    }
    return artifact;
  }

  /** Deploy a named contract; the result is pre-registered with the whole bundle (deps resolve implicitly). */
  async deploy<T extends Artifact = Artifact>(
    name: string,
    constructorArgs: ConstructorArgument[],
    deployOptions: Omit<DeployOptions, 'provider'>,
  ): Promise<DeployResult<T>> {
    const result = await StatefulContract.deploy<T>(this.get(name) as T, constructorArgs, {
      provider: this.bundleOptions.provider,
      addressType: this.bundleOptions.addressType,
      ...deployOptions,
    });
    return {
      ...result,
      contract: this.register(result.contract as ConnectedStatefulContract) as ConnectedStatefulContract<T>,
    };
  }

  /** Attach to an already-deployed instance by category, pre-registered with the bundle. */
  withCategory(name: string, categoryId: string, constructorArgs: ConstructorArgument[] = []): ConnectedStatefulContract {
    const contract = new Contract(this.get(name), constructorArgs as never[], {
      provider: this.bundleOptions.provider,
      addressType: this.bundleOptions.addressType ?? 'p2sh32',
    });
    return this.register(StatefulContract.withCategory(contract, categoryId));
  }

  /**
   * Attach by ADDRESS: query the indexer for the contract's token category (no registration needed - the
   * token UTXO carries it), then attach by that category, pre-registered with the bundle. The constructor args
   * are still required (a p2sh address hashes the redeem script, so they can't be recovered from the address).
   */
  async attach(
    name: string, address: string, constructorArgs: ConstructorArgument[] = [],
  ): Promise<ConnectedStatefulContract> {
    const categoryId = await resolveCategoryFromAddress(this.bundleOptions.provider, address);
    return this.withCategory(name, categoryId, constructorArgs);
  }

  // Register the bundle's artifacts on an instance + connect the bundle's signer (if any) for subsequent calls.
  private register(contract: ConnectedStatefulContract): ConnectedStatefulContract {
    (contract as StatefulContract).registerArtifacts(this.artifacts);
    return this.bundleOptions.signer ? contract.connect(this.bundleOptions.signer) : contract;
  }
}

/**
 * Resolve a stateful contract's token category from its p2sh address via the indexer - the UTXOs at the
 * address carry `token: { category }`, so no registry of the deployed instance is needed (see
 * docs/multi-contract-artifacts.md s13). Throws if the address has no token UTXO (not deployed / fully spent).
 */
export async function resolveCategoryFromAddress(provider: NetworkProvider, address: string): Promise<string> {
  const utxos: Utxo[] = await provider.getUtxos(address);
  const tokenUtxo = utxos.find((u) => u.token?.category);
  if (!tokenUtxo) {
    throw new Error(`No token UTXO at ${address} - cannot resolve the contract category (is it deployed?).`);
  }
  return tokenUtxo.token!.category;
}
