import { Artifact, asmToBytecode } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import Signer from '../Signer.js';
import { Contract } from '../Contract.js';
import { ConstructorArgument } from '../Argument.js';
import { Utxo, TransactionDetails, AddressType } from '../interfaces.js';
import {
  StatefulContract, ConnectedStatefulContract, ContractRunner, DeployOptions,
} from './StatefulContract.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { buildLogicalIdentityCommitment, deriveLogicalCreateAddress } from './logical-identity.js';

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
  /** Number of self-preserved message bus verifier instances created in the genesis transaction. */
  messageBusVerificationInputCount?: number;
  initialBalance?: bigint;
  initArgs?: DeployOptions['initArgs'];
  /** Internal composition escape: a split/proxy parent owns the one logical transaction nonce. */
  logicalNonce?: false;
  /** Internal composition: anchors supplied by a split/proxy parent that owns logical nonce reservation. */
  identityAnchors?: DeployOptions['identityAnchors'];
  /** Internal composition: parent-owned logical CREATE identity for the contract deployed by this factory. */
  logicalIdentity?: { deployer: string; nonce: bigint; address: string };
}

/** A deployed contract with ethers-style deployment accessors. */
export type DeployedContract<T extends Artifact = Artifact> = ConnectedStatefulContract<T> & {
  deploymentTransaction(): TransactionDetails;
  waitForDeployment(): Promise<DeployedContract<T>>;
};

function looksLikeOverrides(x: unknown): boolean {
  return typeof x === 'object' && x !== null && !(x instanceof Uint8Array) && !Array.isArray(x);
}

// A token genesis needs a fresh vout-0 UTXO, but each deploy strands its change at a non-zero vout - so a signer
// that deploys several contracts runs out of vout-0 coins. Since we control the signer, the deploy step fans one
// out on demand: it self-sends the signer's spendable balance into a fresh vout-0 output (a plain P2PKH tx, valid
// on any provider) and uses that. This makes sequential deploys from one account unbounded.
export async function selectGenesisFundingUtxo(
  signer: Signer, artifact: Artifact, excludedOutpoints: ReadonlySet<string> = new Set(),
  identityNftCount = 1,
): Promise<Utxo> {
  const dataNfts = BigInt(artifact.delegateOnly ? 0 : (artifact.stateLayout?.dataNftCount ?? 1));
  // X149: `bytecode` is an ASM LISTING, so `.length / 2` is half a CHARACTER count and this overpaid.
  const deployFee = BigInt(Math.max(5000, asmToBytecode(artifact.bytecode).length + 2000));
  const cost = 1200n + 1200n * dataNfts + 1200n * BigInt(identityNftCount) + deployFee + 2400n;
  const excluded = (u: Utxo): boolean => excludedOutpoints.has(`${u.txid}:${u.vout}`);
  const findGenesisUtxo = (us: Utxo[]): Utxo | undefined => us.find(
    (u) => u.vout === 0 && !u.token && u.satoshis >= cost && !excluded(u),
  );

  const existing = findGenesisUtxo(await signer.getUtxos());
  if (existing) return existing;

  // Fan out a fresh vout-0 funding coin from the signer's spendable (token-free) UTXOs.
  const fee = 1000n;
  const spendable = (await signer.getUtxos())
    .filter((u) => !u.token && !excluded(u))
    .sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const chosen: Utxo[] = [];
  let total = 0n;
  for (const u of spendable) {
    chosen.push(u);
    total += u.satoshis;
    if (total >= cost + fee) break;
  }
  if (total < cost + fee) {
    throw new Error(
      `Signer at ${signer.getAddress()} has insufficient funds (${total} sats) to fan out a genesis funding UTXO `
      + `(need >= ${cost + fee}). A token genesis requires a fresh vout-0 UTXO; fund the account before deploying.`,
    );
  }
  const tb = new TransactionBuilder({ provider: signer.provider });
  for (const u of chosen) tb.addInput(u, signer.unlockP2PKH());
  tb.addOutput({ to: signer.getAddress(), amount: total - fee }); // vout 0 = the fresh genesis funding coin
  await tb.send();

  const created = findGenesisUtxo(await signer.getUtxos());
  if (!created) {
    throw new Error(`Fan-out did not yield a genesis-valid vout-0 UTXO at ${signer.getAddress()}.`);
  }
  return created;
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
    // Positional args beyond the contract-level params feed the explicit `constructor(...) {}` block
    // (ethers passes all deploy args to the constructor; here they split across the two layers).
    const initCount = this.artifact.abi.find((f) => f.name === '__construct')?.inputs.length ?? 0;
    const expected = ctorCount + initCount;
    let overrides: DeployContractOptions = {};
    if ((args.length === expected + 1 || args.length === ctorCount + 1)
        && looksLikeOverrides(args[args.length - 1])) {
      overrides = args.pop() as DeployContractOptions;
    }
    const constructorArgs = args.slice(0, ctorCount) as ConstructorArgument[];
    const positionalInitArgs = args.slice(ctorCount) as NonNullable<DeployOptions['initArgs']>;

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
      const verifierCount = overrides.messageBusVerificationInputCount
        ?? (this.artifact.messageBus?.verifierProgram ? 1 : 0);
      fundingUtxo = await selectGenesisFundingUtxo(signer, this.artifact, new Set(), 1 + verifierCount);
      funder = funder ?? signer.unlockP2PKH();
      changeAddress = changeAddress ?? signer.getAddress();
    }
    if (!funder || !changeAddress) {
      throw new Error('ContractFactory.deploy needs a funder + changeAddress (from a Signer runner or overrides).');
    }

    const nonceReservation = signer && overrides.logicalNonce !== false
      ? signer.reserveTransactionNonce() : undefined;
    const logicalIdentity = nonceReservation ? {
      deployer: signer!.getAddress(), nonce: nonceReservation.nonce,
      address: deriveLogicalCreateAddress(signer!.getAddress(), nonceReservation.nonce),
    } : overrides.logicalIdentity;
    const logicalAddress = logicalIdentity?.address;
    let result: Awaited<ReturnType<typeof StatefulContract.deploy<T>>>;
    try {
      const identityAnchors = overrides.identityAnchors ?? (logicalAddress ? [{
        to: addressToLockScript(logicalAddress),
        commitment: buildLogicalIdentityCommitment(
          logicalIdentity!.deployer, logicalIdentity!.nonce,
          new Contract(this.artifact, constructorArgs as never, {
            provider, addressType: overrides.addressType, category: hexToBin(fundingUtxo.txid),
          }).address,
        ),
      }] : undefined);
      result = await StatefulContract.deploy<T>(this.artifact, constructorArgs, {
        provider,
        fundingUtxo,
        funder,
        changeAddress,
        initialState: overrides.initialState as DeployOptions['initialState'],
        fee: overrides.fee,
        addressType: overrides.addressType,
        threadCount: overrides.threadCount,
        messageBusVerificationInputCount: overrides.messageBusVerificationInputCount,
        initialBalance: overrides.initialBalance,
        initArgs: overrides.initArgs ?? (positionalInitArgs.length > 0 ? positionalInitArgs : undefined),
        identityAnchors,
      });
      nonceReservation?.commit();
    } catch (error) {
      nonceReservation?.release();
      throw error;
    }

    const contract = result.contract as DeployedContract<T>;
    if (logicalAddress) (contract as StatefulContract)._logicalAddress = logicalAddress;
    if (signer) (contract as StatefulContract)._logicalNonceSigner = signer;
    // ethers-style deployment accessors (attach to the instance; the dispatch proxy passes them through).
    (contract as { deploymentTransaction: () => TransactionDetails }).deploymentTransaction = () => result.tx;
    const awaitDeployed = async (): Promise<DeployedContract<T>> => {
      await result.tx.wait?.();
      return contract;
    };
    (contract as { waitForDeployment: () => Promise<DeployedContract<T>> }).waitForDeployment = awaitDeployed;
    // ethers v5 `.deployed()` alias (MistSwap uses it 38x): resolves to the deployed contract, like waitForDeployment.
    // `deployed` is not on DeployedContract<T>, so cast through unknown (TS2352) to attach the extra accessor.
    (contract as unknown as { deployed: () => Promise<DeployedContract<T>> }).deployed = awaitDeployed;
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
