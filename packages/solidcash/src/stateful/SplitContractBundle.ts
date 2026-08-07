import { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import { Contract } from '../Contract.js';
import { ConstructorArgument, FunctionArgument } from '../Argument.js';
import Signer from '../Signer.js';
import { addressToLockScript } from '../utils.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  buildLogicalIdentityCommitment, deriveLogicalCreateAddress, encodeLogicalFacetCommitment,
  resolveSplitLogicalIdentity,
} from './logical-identity.js';
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
  logicalAddress?: string;
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
    // ethers/typechain parity: expose ABI functions directly as well as through `.call`.
    for (const route of bundle.manifest.routes) {
      if (route.function in this) continue;
      Object.defineProperty(this, route.function, {
        enumerable: true,
        value: (...args: FunctionArgument[]) => this.getFunction(route.function)(...args),
      });
    }
    for (const stateItem of [
      ...(bundle.root.stateLayout?.variables ?? []), ...(bundle.root.stateLayout?.collections ?? []),
    ]) {
      if (stateItem.name in this) continue;
      Object.defineProperty(this, stateItem.name, {
        enumerable: true,
        value: (...args: FunctionArgument[]) =>
          (this.root as unknown as Record<string, (...a: any[]) => any>)[stateItem.name](...args),
      });
    }
  }

  get artifact(): Artifact { return this.bundle.root; }
  get address(): string { return this.root.target; }
  get categoryId(): string { return this.root.categoryId; }
  getAddress(): Promise<string> { return Promise.resolve(this.address); }

  async waitForDeployment(): Promise<this> {
    for (const transaction of this.deploymentTransactions as Array<{ wait?: () => Promise<unknown> }>) {
      await transaction.wait?.();
    }
    return this;
  }

  deploymentTransaction(): unknown { return this.deploymentTransactions.at(-1); }

  getFunction(name: string): (...args: FunctionArgument[]) => StatefulFunctionCall {
    const route = this.bundle.manifest.routes.find((r) => r.function === name);
    if (!route) throw new Error(`Split contract '${this.bundle.manifest.logicalContractName}' has no function '${name}'.`);
    if (route.target === 'root') {
      return (...args) => this.root.getFunction(name)(...args) as StatefulFunctionCall;
    }
    const facet = this.facets[route.target];
    if (!facet) throw new Error(`Split facet '${route.target}' is not connected.`);
    return (...args) => {
      const call = (this.root.getFunction(name)(...args) as StatefulFunctionCall)
        .withDelegatecall(facet as StatefulContract, name, args);
      const fn = facet.inner.artifact.abi.find((entry) => entry.name === name);
      const visible = fn?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
      const byName = new Map(visible.map((input, index) => [input.name, args[index]]));
      const runner = facet.runner;
      for (const emitted of fn?.emits ?? []) {
        const event = facet.inner.artifact.events?.find((item) => item.signature === emitted.eventSignature);
        if (!event) continue;
        // The point of this loop is to supply argument VALUES the builder cannot derive on its own. A
        // zero-parameter event has none, and the builder already lays its marker output out from the facet's
        // published `emits`; adding a manual one on top emits it twice and the covenant refuses the extra
        // output. `values.every()` is vacuously true on an empty list, which is how this slipped through.
        if (event.parameters.length === 0) continue;
        const values = event.parameters.map((parameter) => {
          if (byName.has(parameter.name)) return byName.get(parameter.name)!;
          if (parameter.type === 'address' && runner instanceof Signer) return addressToLockScript(runner.getAddress());
          return undefined;
        });
        if (values.every((value) => value !== undefined)) {
          call.emitEvent(event.signature, ...values as unknown as import('../types/state-inference.js').StateValueType[]);
        }
      }
      return call;
    };
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
      logicalAddress: this.root._logicalAddress,
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
    const rootFunding = options.fundingUtxo ?? await selectGenesisFundingUtxo(
      signer!, this.bundle.root, new Set(), this.bundle.manifest.facets.length + 1,
    );
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
      assertSplitRedeemSize(info.name, preview.bytesize, provider);
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
    assertSplitRedeemSize('root', rootPreview.bytesize, provider);

    const nonceReservation = signer?.reserveTransactionNonce();
    const logicalAddress = nonceReservation
      ? deriveLogicalCreateAddress(signer!.getAddress(), nonceReservation.nonce) : undefined;
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
      if (logicalAddress) {
        rootOverrides.identityAnchors = [{
          to: addressToLockScript(logicalAddress),
          commitment: buildLogicalIdentityCommitment(
            signer!.getAddress(), nonceReservation!.nonce, rootPreview.address,
          ),
        }, ...this.bundle.manifest.facets.map((info, index) => ({
          to: addressToLockScript(logicalAddress),
          commitment: encodeLogicalFacetCommitment(index, facets[info.name].categoryId),
        }))];
      }
      const root = await new ContractFactory(this.bundle.root, this.runner)
        .deploy(...rootConstructorArgs, ...facetLinks, ...rootInitArgs, {
          ...rootOverrides, fundingUtxo: rootFunding, logicalNonce: false,
        });
      transactions.push(root.deploymentTransaction());
      if (logicalAddress) (root as StatefulContract)._logicalAddress = logicalAddress;
      // Connect the deployed pieces to the deploying signer, so `deployed.call.f()` funds like
      // `contract.connect(signer).call.f()`. A facet route is a delegatecall, and a delegated impl reading
      // msg.sender resolves it through emitTxOrigin - which needs the sender's native P2PKH input in the
      // transaction. The builder works that requirement out correctly (`delegateUsesMsgSender`) and then
      // skips provisioning it, because the whole funder block is gated on `_signer` being set. Nothing
      // errors; the transaction is simply built without that input and the facet's covenant fails at its
      // own input. See SplitFacetMsgSender.test.ts.
      //
      // Deliberately NOT fixed in ContractFactory.deploy, which is where ethers parity would put it: setting
      // `_signer` on every factory-deployed contract changes funder provisioning for all of them, and it
      // breaks 6 tests across EntryWriteBehavior and SolidityCorpusBehavior that depend on the current input
      // layout. That is a real gap worth closing on its own terms; it is not this fix's to take on.
      if (signer) {
        (root as StatefulContract)._signer = signer;
        for (const facet of Object.values(facets)) (facet as StatefulContract)._signer = signer;
      }
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
    if (record.logicalAddress) (root as StatefulContract)._logicalAddress = record.logicalAddress;
    return new SplitContract(this.bundle, root, facets);
  }

  /** Reconstruct a split deployment from its authenticated logical CREATE address without process-local state. */
  async at(logicalAddress: string, constructorArgs: ConstructorArgument[] = []): Promise<SplitContract> {
    const provider = this.runner instanceof Signer ? this.runner.provider : this.runner;
    const identity = await resolveSplitLogicalIdentity(
      provider, logicalAddress, this.bundle.manifest.facets.length,
    );
    const attached = this.attach({
      rootCategory: identity.categoryId,
      facetCategories: Object.fromEntries(this.bundle.manifest.facets.map(
        (facet, index) => [facet.name, identity.facetCategories[index]],
      )),
      logicalAddress,
    }, constructorArgs);
    // Authenticate the anchor's physical root bytecode against the exact reconstructed bundle topology.
    if (binToHex(addressToLockScript(attached.root.inner.address)) !== binToHex(identity.rootLockingBytecode)) {
      throw new Error(`Logical split identity ${logicalAddress} does not match the reconstructed root bytecode.`);
    }
    return attached;
  }
}

function validateSplitBundle(bundle: SplitArtifactBundle): void {
  if (bundle.format !== 'solidcash-split-v1') throw new Error(`Unsupported split bundle format '${bundle.format}'.`);
  if (
    bundle.manifest.identityBinding?.scheme !== 'solidcash-create-v1'
    || bundle.manifest.identityBinding.owner !== 'root'
    || bundle.manifest.identityBinding.facetIdentity !== 'physical-only'
  ) {
    throw new Error('Invalid split bundle: unsupported or missing logical identity binding metadata.');
  }
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

function assertSplitRedeemSize(name: string, bytes: number, provider: NetworkProvider): void {
  const limit = provider.consensusLimits?.maximumInputBytes ?? 10_000;
  if (bytes > limit) {
    throw new Error(`Split shard '${name}' constructed redeem script is ${bytes} bytes (limit ${limit}).`);
  }
}
