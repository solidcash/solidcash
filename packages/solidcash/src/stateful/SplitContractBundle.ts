import { SplitArtifactBundle } from '@solidcash/utils';
import { Contract } from '../Contract.js';
import { ConstructorArgument, FunctionArgument } from '../Argument.js';
import Signer from '../Signer.js';
import { addressToLockScript } from '../utils.js';
import { hexToBin } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  ContractFactory, DeployedContract, DeployContractOptions, selectGenesisFundingUtxo,
} from './ContractFactory.js';
import {
  ConnectedStatefulContract, ContractRunner, StatefulContract, StatefulFunctionCall,
} from './StatefulContract.js';

export interface SplitDeployOptions extends DeployContractOptions {
  facetOverrides?: Record<string, DeployContractOptions>;
}

export interface SplitDeploymentRecord {
  rootCategory: string;
  facetCategories: Record<string, string>;
}

export class SplitContract {
  readonly call: Record<string, (...args: FunctionArgument[]) => StatefulFunctionCall>;

  constructor(
    readonly bundle: SplitArtifactBundle,
    readonly root: ConnectedStatefulContract,
    readonly facets: Record<string, ConnectedStatefulContract>,
    readonly deploymentTransactions: readonly unknown[] = [],
  ) {
    this.call = new Proxy({}, {
      get: (_target, prop) => typeof prop === 'string'
        ? (...args: FunctionArgument[]) => this.getFunction(prop)(...args)
        : undefined,
    }) as Record<string, (...args: FunctionArgument[]) => StatefulFunctionCall>;
  }

  get address(): string { return this.root.address; }
  get categoryId(): string { return this.root.categoryId; }

  getFunction(name: string): (...args: FunctionArgument[]) => StatefulFunctionCall {
    const route = this.bundle.manifest.routes.find((r) => r.function === name);
    if (!route) throw new Error(`Split contract '${this.bundle.manifest.logicalContractName}' has no function '${name}'.`);
    if (route.target === 'root') {
      return (...args) => this.root.getFunction(name)(...args) as StatefulFunctionCall;
    }
    const facet = this.facets[route.target];
    if (!facet) throw new Error(`Split facet '${route.target}' is not connected.`);
    return (...args) => (this.root.getFunction(name)(...args) as StatefulFunctionCall)
      .withDelegatecall(facet as StatefulContract, name, args);
  }

  connect(runner: ContractRunner): SplitContract {
    const root = this.root.connect(runner);
    const facets = Object.fromEntries(Object.entries(this.facets).map(([name, facet]) => [name, facet.connect(runner)]));
    return new SplitContract(this.bundle, root, facets, this.deploymentTransactions);
  }

  deploymentRecord(): SplitDeploymentRecord {
    return {
      rootCategory: this.root.categoryId,
      facetCategories: Object.fromEntries(Object.entries(this.facets).map(([name, facet]) => [name, facet.categoryId])),
    };
  }
}

export class SplitContractBundle {
  constructor(readonly bundle: SplitArtifactBundle, readonly runner: ContractRunner) {
    validateSplitBundle(bundle);
  }

  static from(bundle: SplitArtifactBundle, runner: ContractRunner): SplitContractBundle {
    return new SplitContractBundle(bundle, runner);
  }

  async deploy(
    constructorArgs: ConstructorArgument[] = [], options: SplitDeployOptions = {},
  ): Promise<SplitContract> {
    if (this.bundle.manifest.facets.length === 0) {
      const deployed = await new ContractFactory(this.bundle.root, this.runner).deploy(...constructorArgs, options);
      return new SplitContract(this.bundle, deployed, {}, [deployed.deploymentTransaction()]);
    }
    if (!(this.runner instanceof Signer) && !options.fundingUtxo) {
      throw new Error('Split deployment needs a Signer runner or an explicit reserved root fundingUtxo.');
    }
    const signer = this.runner instanceof Signer ? this.runner : undefined;
    const facetCount = this.bundle.manifest.facets.length;
    const rootConstructorCount = this.bundle.root.constructorInputs.length - facetCount;
    const rootConstructorArgs = constructorArgs.slice(0, rootConstructorCount);
    const rootInitArgs = constructorArgs.slice(rootConstructorCount);
    const rootFunding = options.fundingUtxo ?? await selectGenesisFundingUtxo(signer!, this.bundle.root);
    const rootCategory = rootFunding.txid;
    const reserved = new Set([`${rootFunding.txid}:${rootFunding.vout}`]);
    const facets: Record<string, DeployedContract> = {};
    const transactions: unknown[] = [];

    // Resolve every address and validate every constructed redeem script before broadcasting the first staged
    // genesis. If the root broadcast later has a transient failure, deployment is recoverable by retrying with
    // the same reserved root funding outpoint; facet addresses/categories remain deterministic.
    const provider: NetworkProvider = signer?.provider ?? this.runner as NetworkProvider;
    const facetPreflight = Object.fromEntries(this.bundle.manifest.facets.map((info) => {
      const artifact = this.bundle.facets[info.name];
      const override = options.facetOverrides?.[info.name];
      const funding = override?.fundingUtxo;
      return [info.name, { artifact, override, funding }];
    }));

    for (const info of this.bundle.manifest.facets) {
      const artifact = this.bundle.facets[info.name];
      if (!artifact?.delegateOnly || !artifact.brandedLibrary) {
        throw new Error(`Facet '${info.name}' is not a branded delegate-only artifact.`);
      }
      const override = { ...(options.facetOverrides?.[info.name] ?? {}) };
      if (!override.fundingUtxo) {
        if (!signer) throw new Error(`Facet '${info.name}' needs an explicit fundingUtxo.`);
        override.fundingUtxo = await selectGenesisFundingUtxo(signer, artifact, reserved);
      }
      if (signer) {
        override.funder ??= signer.unlockP2PKH();
        override.changeAddress ??= signer.getAddress();
      }
      const key = `${override.fundingUtxo.txid}:${override.fundingUtxo.vout}`;
      if (reserved.has(key)) throw new Error(`Genesis funding input '${key}' is reused by split deployment.`);
      reserved.add(key);
      const preview = new Contract(artifact, [StatefulContract.libraryBrand(rootCategory)], {
        provider, addressType: override.addressType, category: hexToBin(override.fundingUtxo.txid),
      });
      assertSplitRedeemSize(info.name, preview.bytesize);
      facetPreflight[info.name] = { artifact, override, funding: override.fundingUtxo };
    }

    const previewLinks = this.bundle.manifest.facets.map((info) => {
      const item = facetPreflight[info.name];
      const preview = new Contract(item.artifact, [StatefulContract.libraryBrand(rootCategory)], {
        provider, addressType: item.override?.addressType, category: hexToBin(item.funding!.txid),
      });
      return addressToLockScript(preview.address);
    });
    const rootPreview = new Contract(this.bundle.root, [...rootConstructorArgs, ...previewLinks] as never[], {
      provider, addressType: options.addressType, category: hexToBin(rootCategory),
    });
    assertSplitRedeemSize('root', rootPreview.bytesize);

    const nonceReservation = signer?.reserveTransactionNonce();
    try {
      for (const info of this.bundle.manifest.facets) {
        const { artifact, override } = facetPreflight[info.name];
        const facet = await new ContractFactory(artifact, this.runner)
          .deploy(StatefulContract.libraryBrand(rootCategory), { ...override!, logicalNonce: false });
        facets[info.name] = facet;
        transactions.push(facet.deploymentTransaction());
      }

      const facetLinks = this.bundle.manifest.facets.map((info) => addressToLockScript(facets[info.name].address));
      const rootOverrides = { ...options };
      delete rootOverrides.facetOverrides;
      if (signer) {
        rootOverrides.funder ??= signer.unlockP2PKH();
        rootOverrides.changeAddress ??= signer.getAddress();
      }
      const root = await new ContractFactory(this.bundle.root, this.runner)
        .deploy(...rootConstructorArgs, ...facetLinks, ...rootInitArgs, {
          ...rootOverrides, fundingUtxo: rootFunding, logicalNonce: false,
        });
      transactions.push(root.deploymentTransaction());
      nonceReservation?.commit();
      return new SplitContract(this.bundle, root, facets, transactions);
    } catch (error) {
      nonceReservation?.release();
      throw error;
    }
  }

  attach(record: SplitDeploymentRecord, constructorArgs: ConstructorArgument[] = []): SplitContract {
    const provider = this.runner instanceof Signer ? this.runner.provider : this.runner;
    const facets: Record<string, ConnectedStatefulContract> = {};
    for (const info of this.bundle.manifest.facets) {
      const facetCategory = record.facetCategories[info.name];
      if (!/^[0-9a-f]{64}$/i.test(facetCategory ?? '')) {
        throw new Error(`Missing or invalid category for split facet '${info.name}'.`);
      }
      const contract = new Contract(
        this.bundle.facets[info.name], [StatefulContract.libraryBrand(record.rootCategory)], { provider },
      );
      const attached = StatefulContract.withCategory(contract, facetCategory);
      facets[info.name] = this.runner instanceof Signer ? attached.connect(this.runner) : attached;
    }
    const links = this.bundle.manifest.facets.map((info) => addressToLockScript(facets[info.name].address));
    const rootConstructorCount = this.bundle.root.constructorInputs.length - links.length;
    const rootContract = new Contract(
      this.bundle.root, [...constructorArgs.slice(0, rootConstructorCount), ...links] as never[], { provider },
    );
    const attachedRoot = StatefulContract.withCategory(rootContract, record.rootCategory);
    const root = this.runner instanceof Signer ? attachedRoot.connect(this.runner) : attachedRoot;
    return new SplitContract(this.bundle, root, facets);
  }
}

function validateSplitBundle(bundle: SplitArtifactBundle): void {
  if (bundle.format !== 'solidcash-split-v1') throw new Error(`Unsupported split bundle format '${bundle.format}'.`);
  const selectors = new Set<string>();
  for (const route of bundle.manifest.routes) {
    if (route.selector && selectors.has(route.selector)) throw new Error(`Duplicate split selector '${route.selector}'.`);
    if (route.selector) selectors.add(route.selector);
    if (route.target !== 'root' && !bundle.facets[route.target]) {
      throw new Error(`Route '${route.function}' targets missing facet '${route.target}'.`);
    }
  }
  for (const info of bundle.manifest.facets) {
    const artifact = bundle.facets[info.name];
    if (!artifact || !artifact.delegateOnly || !artifact.brandedLibrary) {
      throw new Error(`Invalid split facet '${info.name}': expected branded delegate-only artifact.`);
    }
    if (splitStateLayoutFingerprint(artifact.stateLayout) !== bundle.manifest.stateLayoutFingerprint) {
      throw new Error(`Invalid split facet '${info.name}': state layout differs from the logical root.`);
    }
  }
  if (splitStateLayoutFingerprint(bundle.root.stateLayout) !== bundle.manifest.stateLayoutFingerprint) {
    throw new Error('Invalid split bundle: root state layout does not match its manifest fingerprint.');
  }
}

function splitStateLayoutFingerprint(layout: SplitArtifactBundle['root']['stateLayout']): string {
  if (!layout) return '{}';
  // Solidity constructor inputs initialize root state but are not storage offsets and are intentionally absent
  // from delegate-only facets. Every variable, collection, and struct descriptor must still match exactly.
  const storageLayout = { ...layout };
  delete storageLayout.constructorInputs;
  return JSON.stringify(storageLayout);
}

function assertSplitRedeemSize(name: string, bytes: number): void {
  if (bytes > 10_000) throw new Error(`Split shard '${name}' constructed redeem script is ${bytes} bytes (limit 10000).`);
}
