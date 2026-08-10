import { Artifact, asmToBytecode } from '@solidcash/utils';
import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import Signer from '../Signer.js';
import { Contract } from '../Contract.js';
import { ConstructorArgument } from '../Argument.js';
import { Utxo, TransactionDetails, AddressType } from '../interfaces.js';
import {
  StatefulContract, ConnectedStatefulContract, ContractRunner, DeployOptions,
} from './StatefulContract.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, getNetworkPrefix } from '../utils.js';
import { buildLogicalIdentityCommitment, deriveLogicalCreateAddress } from './logical-identity.js';
import { registerDeployment } from './deployment-registry.js';

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
  /**
   * A dead `<salt> OP_DROP` push baked into the script - CREATE2 addressing, and the DENSITY RESERVE. The
   * BCH-2026 budget is `operationCostBudgetPerByte x unlockingBytecodeLength` and for p2sh32 the redeem script
   * counts toward it, so each reserve byte buys 800 units of budget and costs about 6 to carry. See
   * `DeployOptions.salt`.
   */
  salt?: Uint8Array;
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
  const findGenesisUtxo = (us: Utxo[]): Utxo | undefined => us
    .filter((u) => u.vout === 0 && !u.token && u.satoshis >= cost && !excluded(u))
    .sort(compareGenesisFundingFreshness)[0];

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

/** Prefer the coin most recently funded for this deployment, independent of provider UTXO ordering. */
export function compareGenesisFundingFreshness(a: Utxo, b: Utxo): number {
  if (a.confirmations !== undefined && b.confirmations !== undefined
    && a.confirmations !== b.confirmations) return a.confirmations - b.confirmations;
  if (a.blockHeight !== undefined && b.blockHeight !== undefined
    && a.blockHeight !== b.blockHeight) {
    if (a.blockHeight === 0) return -1;
    if (b.blockHeight === 0) return 1;
    return b.blockHeight - a.blockHeight;
  }
  return 0;
}

/**
 * Split one of the signer's coins so it holds at least `needed` plain (token-free) UTXOs.
 *
 * A call's funder slots each want their own outpoint, but a wallet accumulates VALUE, not COUNT: a signer that
 * has deployed a few contracts is left with one large change coin and cannot fund a two-funder call, even
 * though it is nowhere near broke. `selectGenesisFundingUtxo` already fans out for the genesis case; this is
 * the same move for ordinary calls. Returns the plain UTXOs afterwards, or undefined if the signer genuinely
 * cannot cover it (the caller then raises its own, more specific error).
 */
export async function fanOutPlainUtxos(
  signer: Signer, needed: number, excludedOutpoints: ReadonlySet<string> = new Set(),
): Promise<Utxo[] | undefined> {
  const plain = (us: Utxo[]): Utxo[] => us
    .filter((u) => !u.token && !excludedOutpoints.has(`${u.txid}:${u.vout}`));
  const current = plain(await signer.getUtxos());
  if (current.length >= needed) return current;

  const fee = 1000n;
  const perOutput = 5000n;
  const missing = needed - current.length;
  // Spend the largest coin only; splitting several would consume the very outpoints the caller still needs.
  const [largest] = [...current].sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  if (!largest || largest.satoshis < perOutput * BigInt(missing + 1) + fee) return undefined;

  const tb = new TransactionBuilder({ provider: signer.provider });
  tb.addInput(largest, signer.unlockP2PKH());
  for (let i = 0; i < missing; i++) tb.addOutput({ to: signer.getAddress(), amount: perOutput });
  tb.addOutput({ to: signer.getAddress(), amount: largest.satoshis - perOutput * BigInt(missing) - fee });
  await tb.send();

  const after = plain(await signer.getUtxos());
  return after.length >= needed ? after : undefined;
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
   * ethers `factory.attach(address)` — connect to an already-deployed instance. For stateful contracts the
   * "address" may be a CashAddress, locking-bytecode hex, raw locking bytecode bytes (event args), or a
   * category id (txid of the genesis funder). MistSwap does
   * `UniswapV2Pair.attach((await createPairTx.wait()).events[0].args.pair)`.
   */
  attach(addressOrCategory: string | Uint8Array): Promise<ConnectedStatefulContract<T>> {
    let id: string;
    if (typeof addressOrCategory === 'string') {
      id = addressOrCategory;
    } else if (addressOrCategory instanceof Uint8Array) {
      // Event-decoded address params are locking-bytecode bytes; encode as CashAddress for at().
      const provider = this.runner instanceof Signer ? this.runner.provider : (this.runner as NetworkProvider);
      const prefix = getNetworkPrefix(provider.network);
      const encoded = lockingBytecodeToCashAddress({
        bytecode: addressOrCategory, prefix, tokenSupport: true,
      });
      if (typeof encoded === 'string') {
        throw new Error(`ContractFactory.attach: invalid locking bytecode (${encoded})`);
      }
      id = encoded.address;
    } else {
      throw new Error('ContractFactory.attach: address must be a string or Uint8Array locking bytecode');
    }
    return StatefulContract.at(id, this.artifact, this.runner);
  }

  /**
   * Deploy the contract. Positional constructor args, with an optional trailing overrides object (ethers
   * `factory.deploy(...args, overrides?)`).
   */
  async deploy(...args: Array<ConstructorArgument | DeployContractOptions>): Promise<DeployedContract<T>> {
    // ethers parity: a deploy argument may be a PROMISE. `resolveProperties` awaits them before encoding, so
    // suites routinely pass a read straight through - MistSwap's SushiMakerKashi deploys with
    // `factory.pairCodeHash()` un-awaited. Without this the encoder sees a Promise and refuses the bytes32.
    // eslint-disable-next-line no-param-reassign
    args = await Promise.all(args);
    const ctorCount = this.artifact.constructorInputs.length;
    // Positional args beyond the contract-level params feed the explicit `constructor(...) {}` block
    // (ethers passes all deploy args to the constructor; here they split across the two layers).
    // Count only the inputs a CALLER supplies. `__internal__` params (the msg.sender category, vmap slot/proof
    // operands) are SDK-filled, so counting them made `expected` too large and the trailing-overrides check
    // below never matched: the overrides object was then taken as a constructor argument and forwarded to
    // __construct, which failed with an off-by-one argument count.
    const initCount = this.artifact.abi.find((f) => f.name === '__construct')?.inputs
      .filter((input) => !input.name.startsWith('__internal__')).length ?? 0;
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

    // Pure / library contracts (no CashToken state): inject a zero-width stateLayout so they can still
    // go through StatefulContract.deploy + the dispatch Proxy (MistSwap ChainlinkOracleV2 / RewarderBrokenMock
    // call pure/view methods as `oracle.getDataParameter(...)` / `peek(...)`).
    const dataNftCount = this.artifact.stateLayout?.dataNftCount ?? 0;
    const deployArtifact = (!this.artifact.stateLayout || dataNftCount === 0)
      ? {
        ...this.artifact,
        stateLayout: this.artifact.stateLayout ?? {
          variables: [],
          dataNftCount: 0,
          commitmentLimit: 128,
          collections: [],
        },
      } as T
      : this.artifact;

    let { fundingUtxo, funder, changeAddress } = overrides;
    if (!fundingUtxo) {
      if (!signer) {
        throw new Error(
          'ContractFactory.deploy needs a Signer runner (to fund the genesis), or an explicit '
          + '{ fundingUtxo, funder, changeAddress } override with a NetworkProvider runner.',
        );
      }
      const verifierCount = overrides.messageBusVerificationInputCount
        ?? (deployArtifact.messageBus?.verifierProgram ? 1 : 0);
      fundingUtxo = await selectGenesisFundingUtxo(signer, deployArtifact, new Set(), 1 + verifierCount);
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
          // Must mirror the DEPLOYED contract's options exactly, `salt` included: the anchor commits to an
          // address, and a salt changes it.
          new Contract(this.artifact, constructorArgs as never, {
            provider, addressType: overrides.addressType, category: hexToBin(fundingUtxo.txid),
            salt: overrides.salt,
          }).address,
        ),
      }] : undefined);
      result = await StatefulContract.deploy<T>(deployArtifact, constructorArgs, {
        provider,
        fundingUtxo,
        funder,
        changeAddress,
        initialState: overrides.initialState as DeployOptions['initialState'],
        fee: overrides.fee,
        addressType: overrides.addressType,
        salt: overrides.salt,
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
    // ethers parity: `factory.deploy()` returns a contract CONNECTED to the factory's signer, so a call on it
    // needs no explicit `.connect(signer)`. Without `_signer` the builder computed `neededFunders` correctly and
    // then skipped provisioning them, because that whole block is gated on a signer being present. Nothing
    // errored: the transaction was simply built without the sender's native P2PKH input (it falls back to P2SH32
    // OP_TRUE dummy funders), so any covenant reading msg.sender / tx.origin - emitTxOrigin scans for exactly
    // that input - OP_VERIFYs an empty origin. It bit SplitContractBundle hardest, whose `deployed.call.f()`
    // never connects explicitly (SplitFacetMsgSender.test.ts), and every MistSwap SushiToken
    // mint/approve/renounceOwnership route.
    if (signer) {
      (contract as StatefulContract)._signer = signer;
      (contract as StatefulContract)._logicalNonceSigner = signer;
    }
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
    registerDeployment(provider, {
      contractName: this.artifact.contractName,
      address: contract.target,
      lockingBytecode: contract.inner.lockingBytecode,
      contract,
    });
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
