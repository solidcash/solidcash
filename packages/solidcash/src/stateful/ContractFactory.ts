import { Artifact } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import Signer from '../Signer.js';
import { ConstructorArgument } from '../Argument.js';
import { Utxo, TransactionDetails, AddressType } from '../interfaces.js';
import {
  StatefulContract, ConnectedStatefulContract, ContractRunner, DeployOptions,
} from './StatefulContract.js';

/** Deploy overrides (a trailing object on `factory.deploy(...)` / the 3rd arg of `deployContract`). */
export interface DeployContractOptions {
  // BCH state lives in the data NFT, so `initialState` stands in for a Solidity constructor's state writes.
  initialState?: Record<string, any>;
  // Funding: omit to auto-select a genesis-valid UTXO from the Signer runner (funder + changeAddress default to
  // the signer too). Provide these to fund from something other than the runner.
  fundingUtxo?: Utxo;
  funder?: DeployOptions['funder'];
  changeAddress?: string;
  fee?: bigint;
  addressType?: AddressType;
  threadCount?: number;
  initialBalance?: bigint;
}

/** A deployed contract with ethers-style deployment accessors. */
export type DeployedContract<T extends Artifact = Artifact> = ConnectedStatefulContract<T> & {
  deploymentTransaction(): TransactionDetails;
  waitForDeployment(): Promise<DeployedContract<T>>;
};

function looksLikeOverrides(x: unknown): boolean {
  return typeof x === 'object' && x !== null && !(x instanceof Uint8Array) && !Array.isArray(x);
}

async function selectGenesisFundingUtxo(signer: Signer, artifact: Artifact): Promise<Utxo> {
  const utxos = await signer.getUtxos();
  const dataNfts = BigInt(artifact.stateLayout?.dataNftCount ?? 1);
  const cost = 1200n + 1200n * dataNfts + 5000n + 2400n; // master + data NFTs + fee + entry buffer
  const utxo = utxos.find((u) => u.vout === 0 && !u.token && u.satoshis >= cost);
  if (!utxo) {
    throw new Error(
      `Signer has no genesis-valid funding UTXO (vout 0, token-free, >= ${cost} sats) at ${signer.getAddress()} `
      + 'to deploy. A token genesis requires a fresh vout-0 UTXO.',
    );
  }
  return utxo;
}

/**
 * ethers-style contract factory for stateful contracts. `new ContractFactory(artifact, runner).deploy(...args)`
 * runs a real genesis deploy (like ethers `ContractFactory.deploy`): a Signer runner auto-selects a genesis
 * funding UTXO and funds+signs; a NetworkProvider runner needs an explicit `{ fundingUtxo, funder, changeAddress }`
 * override. The returned contract is ready to call and carries `deploymentTransaction()` + `waitForDeployment()`.
 */
export class ContractFactory<T extends Artifact = Artifact> {
  constructor(readonly artifact: T, readonly runner: ContractRunner) {}

  /** Return a new factory bound to a different runner (ethers `factory.connect`). */
  connect(runner: ContractRunner): ContractFactory<T> {
    return new ContractFactory(this.artifact, runner);
  }

  /**
   * Deploy the contract. Positional constructor args, with an optional trailing overrides object (ethers
   * `factory.deploy(...args, overrides?)`).
   */
  async deploy(...args: Array<ConstructorArgument | DeployContractOptions>): Promise<DeployedContract<T>> {
    const ctorCount = this.artifact.constructorInputs.length;
    let overrides: DeployContractOptions = {};
    if (args.length === ctorCount + 1 && looksLikeOverrides(args[args.length - 1])) {
      overrides = args.pop() as DeployContractOptions;
    }
    const constructorArgs = args as ConstructorArgument[];

    const signer = this.runner instanceof Signer ? this.runner : undefined;
    const provider: NetworkProvider = signer ? signer.provider : (this.runner as NetworkProvider);

    let { fundingUtxo, funder, changeAddress } = overrides;
    if (!fundingUtxo) {
      if (!signer) {
        throw new Error(
          'ContractFactory.deploy needs a Signer runner (to fund the genesis), or an explicit '
          + '{ fundingUtxo, funder, changeAddress } override with a NetworkProvider runner.',
        );
      }
      fundingUtxo = await selectGenesisFundingUtxo(signer, this.artifact);
      funder = funder ?? signer.unlockP2PKH();
      changeAddress = changeAddress ?? signer.getAddress();
    }
    if (!funder || !changeAddress) {
      throw new Error('ContractFactory.deploy needs a funder + changeAddress (from a Signer runner or overrides).');
    }

    const result = await StatefulContract.deploy<T>(this.artifact, constructorArgs, {
      provider,
      fundingUtxo,
      funder,
      changeAddress,
      initialState: overrides.initialState as DeployOptions['initialState'],
      fee: overrides.fee,
      addressType: overrides.addressType,
      threadCount: overrides.threadCount,
      initialBalance: overrides.initialBalance,
    });

    const contract = result.contract as DeployedContract<T>;
    // ethers-style deployment accessors (attach to the instance; the dispatch proxy passes them through).
    (contract as { deploymentTransaction: () => TransactionDetails }).deploymentTransaction = () => result.tx;
    (contract as { waitForDeployment: () => Promise<DeployedContract<T>> }).waitForDeployment = async () => {
      await result.tx.wait?.();
      return contract;
    };
    return contract;
  }
}

/** ethers/hardhat `getContractFactory` - build a ContractFactory from an artifact + runner. */
export function getContractFactory<T extends Artifact>(artifact: T, runner: ContractRunner): ContractFactory<T> {
  return new ContractFactory(artifact, runner);
}

/**
 * hardhat-ethers `deployContract(name, args?, signerOrOptions?)` shortcut: build a factory and deploy in one
 * call. `runner` is the Signer (or NetworkProvider) to deploy with; deploy overrides go in `overrides`.
 */
export async function deployContract<T extends Artifact>(
  artifact: T,
  args: ConstructorArgument[] = [],
  runner?: ContractRunner,
  overrides?: DeployContractOptions,
): Promise<DeployedContract<T>> {
  if (!runner) throw new Error('deployContract needs a runner (Signer or NetworkProvider) to deploy with.');
  const factory = new ContractFactory(artifact, runner);
  return overrides ? factory.deploy(...args, overrides) : factory.deploy(...args);
}
