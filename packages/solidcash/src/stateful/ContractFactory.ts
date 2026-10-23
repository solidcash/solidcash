import { type Artifact, type FunctionSplitBundle, asmToBytecode } from '@solidcash/utils';
import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import Signer from '../Signer.js';
import type { ConstructorArgument } from '../Argument.js';
import type { Utxo, TransactionDetails, AddressType } from '../interfaces.js';
import type { StatefulContract, ConnectedStatefulContract, ContractRunner, DeployOptions } from './StatefulContract.js';
import type { PublishedRegistry } from '../bcmr/deployment.js';
import type { IdentityRecord } from '../bcmr/identity.js';
import type { SplitFacets } from './stateful-lifecycle-types.js';
import { addressToLockScript, getNetworkPrefix } from '../utils.js';

// Heavy value imports are deferred to method/helper bodies so that loading this
// module (the `@solidcash/solidcash/contract-factory` entry) does not evaluate the
// StatefulContract, TransactionBuilder, or framed-deploy graphs at import time.

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
  /** Number of validator UTXOs a framed genesis mints; defaults to the composing pool size. */
  validatorCount?: number;
  /** `split: 'func'` bundle. Genesis mints a master pool at each shard lock, and funding counts those pools. */
  functionSplit?: FunctionSplitBundle;
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
  /**
   * Internal composition: the provider the genesis is built and broadcast through, the runner's when omitted. A split
   * parent passes an overlay that holds its bundle's geneses until the root's is built.
   */
  provider?: NetworkProvider;
  /** Internal composition: a split root's facets; see `DeployOptions.splitFacets`. */
  splitFacets?: SplitFacets;
  /** How the genesis holds its BCMR identity output; see `DeployOptions.identity`. */
  identity?: DeployOptions['identity'];
  /** A BCMR registry the genesis publishes; see `DeployOptions.bcmr`. */
  bcmr?: DeployOptions['bcmr'];
  /** The ledger token's bearer category and premint; see `DeployOptions.nativeToken`. */
  nativeToken?: DeployOptions['nativeToken'];
}

/** A deployed contract with ethers-style deployment accessors. */
export type DeployedContract<T extends Artifact = Artifact> = ConnectedStatefulContract<T> & {
  deploymentTransaction(): TransactionDetails;
  waitForDeployment(): Promise<DeployedContract<T>>;
  /** The genesis's BCMR identity output. */
  deploymentIdentity(): IdentityRecord | undefined;
  /** The registry the genesis published, if it published one. */
  deploymentRegistry(): PublishedRegistry | undefined;
};

function looksLikeOverrides(x: unknown): boolean {
  return typeof x === 'object' && x !== null && !(x instanceof Uint8Array) && !Array.isArray(x);
}

async function normalizeRegisteredAddressArguments<T>(
  provider: NetworkProvider,
  inputs: readonly { type: string }[],
  args: readonly T[],
): Promise<T[]> {
  const { registeredValueAddressLockingBytecode } = await import('./deployment-registry.js');
  return args.map((arg, index) => {
    const type = inputs[index]?.type;
    if ((type !== 'address' && type !== 'address payable') || typeof arg !== 'string') return arg;
    return (registeredValueAddressLockingBytecode(provider, arg) ?? arg) as T;
  });
}

// A token genesis needs a fresh vout-0 UTXO, but each deploy strands its change at a non-zero vout - so a signer
// that deploys several contracts runs out of vout-0 coins. Since we control the signer, the deploy step fans one
// out on demand: it self-sends the signer's spendable balance into a fresh vout-0 output (a plain P2PKH tx, valid
// on any provider) and uses that. This makes sequential deploys from one account unbounded.
/**
 * Select a fresh vout-0 UTXO to fund a token genesis.
 *
 * `identityNftCount` counts the category-branded 1200-satoshi outputs a genesis mints for identity anchors and
 * message bus verifiers. `additionalSatoshis` is a satoshi floor for anything else the genesis carries that the
 * fixed per-output estimate does not name — a framed genesis's master and validator pools, for instance. Both
 * only size the coin the caller is given; the genesis itself refuses funding it cannot cover.
 */
export async function selectGenesisFundingUtxo(
  signer: Signer, artifact: Artifact, excludedOutpoints: ReadonlySet<string> = new Set(),
  identityNftCount = 1, additionalSatoshis = 0n,
): Promise<Utxo> {
  const dataNfts = BigInt(artifact.delegateOnly ? 0 : (artifact.stateLayout?.dataNftCount ?? 1));
  // X149: `bytecode` is an ASM LISTING, so `.length / 2` is half a CHARACTER count and this overpaid.
  const deployFee = BigInt(Math.max(5000, asmToBytecode(artifact.bytecode).length + 2000));
  // The genesis leads with its BCMR identity output, a dust output, and may carry its publication.
  const identityOutput = 1000n;
  const cost = 1200n + 1200n * dataNfts + 1200n * BigInt(identityNftCount) + deployFee + 2400n
    + identityOutput + additionalSatoshis;
  return selectGenesisFundingUtxoForCost(signer, cost, excludedOutpoints);
}

/**
 * The same selection for a caller that knows the coin's required size but not the artifact it funds.
 *
 * An address prediction derives `addrV(category)` for a coin without naming the contract that will spend it, so it
 * selects — and fans out — through this entry point with a conservative floor rather than an artifact's own cost.
 */
export async function selectGenesisFundingUtxoForCost(
  signer: Signer, cost: bigint, excludedOutpoints: ReadonlySet<string> = new Set(),
  options?: { readonly fanOut?: boolean },
): Promise<Utxo> {
  const { genesisOutpointKey, isReservedGenesisOutpoint } = await import('./genesis-reservations.js');
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  // A reserved outpoint is one a caller derived a create address from: spending it here would destroy a prediction.
  const excluded = (u: Utxo): boolean => excludedOutpoints.has(genesisOutpointKey(u.txid, u.vout))
    || isReservedGenesisOutpoint(genesisOutpointKey(u.txid, u.vout));
  const listed = await signer.getUtxos();
  const genesisCandidates = listed.filter((u) => u.vout === 0 && !u.token && u.satoshis >= cost && !excluded(u));
  const verified: Utxo[] = [];
  const rejected: { readonly coin: Utxo; readonly reason: string }[] = [];
  for (const utxo of genesisCandidates) {
    const reason = await genesisCoinRefusal(signer, utxo);
    if (reason === undefined) verified.push(utxo);
    else rejected.push({ coin: utxo, reason });
  }
  const existing = [...verified].sort(compareGenesisFundingFreshness)[0];
  if (existing) return existing;
  if (options?.fanOut === false) {
    throw new Error(
      `Signer at ${signer.getAddress()} has no existing vout-0 coin to reserve. `
      + 'A nonce read does not fan out; a deploy creates fresh coins.',
    );
  }

  // Fan out a fresh vout-0 funding coin from coins proven to pay the signer.
  const fee = 1000n;
  const spendable: Utxo[] = [];
  for (const utxo of listed.filter((u) => !u.token && !excluded(u))) {
    if (await genesisCoinRefusal(signer, utxo) === undefined) spendable.push(utxo);
  }
  spendable.sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const chosen: Utxo[] = [];
  let total = 0n;
  for (const u of spendable) {
    chosen.push(u);
    total += u.satoshis;
    if (total >= cost + fee) break;
  }
  if (total < cost + fee) {
    if (rejected.length > 0) {
      const { coin, reason } = rejected[0]!;
      throw new Error(
        `Genesis funding outpoint ${coin.txid}:${coin.vout} is not an output at the signer's lock (${reason}). `
        + 'A provider-listed coin cannot fund a token category unless its raw transaction (or a simulator\'s own '
        + `ledger) pays ${signer.getAddress()} with the stated value and no token.`,
      );
    }
    throw new Error(
      `Signer at ${signer.getAddress()} has insufficient funds (${total} sats) to fan out a genesis funding UTXO `
      + `(need >= ${cost + fee}). A token genesis requires a fresh vout-0 UTXO; fund the account before deploying.`,
    );
  }
  const tb = new TransactionBuilder({ provider: signer.provider });
  for (const u of chosen) tb.addInput(u, signer.unlockP2PKH());
  tb.addOutput({ to: signer.getAddress(), amount: total - fee }); // vout 0 = the fresh genesis funding coin
  await tb.send();

  const createdCandidates = (await signer.getUtxos())
    .filter((u) => u.vout === 0 && !u.token && u.satoshis >= cost && !excluded(u));
  for (const utxo of [...createdCandidates].sort(compareGenesisFundingFreshness)) {
    if (await genesisCoinRefusal(signer, utxo) === undefined) return utxo;
  }
  throw new Error(`Fan-out did not yield a genesis-valid vout-0 UTXO at ${signer.getAddress()}.`);
}

/**
 * Why `utxo` cannot fund a genesis for `signer`, or undefined once it is proven a plain payment of the stated value
 * to the signer's lock (SDKFRAMED-1): from the raw transaction that hashes to its txid, or a simulator's own ledger.
 * The deployment proves its coin with the same check, so selection and deployment refuse the same coins.
 */
async function genesisCoinRefusal(signer: Signer, utxo: Utxo): Promise<string | undefined> {
  const { ownCoinRefusal } = await import('../framed/deploy/own-coin.js');
  return ownCoinRefusal(signer.provider, utxo, signer.getLockingBytecode(), { role: 'funder', tokenFree: true });
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
  const { genesisOutpointKey } = await import('./genesis-reservations.js');
  const { signerFundingCoins } = await import('../framed/deploy/own-coin.js');
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  // Neither a reserved genesis coin nor a BCMR identity output is split (docs/bcmr/DESIGN.md 4.4).
  const plain = (us: Utxo[]): Utxo[] => us
    .filter((u) => !u.token && !excludedOutpoints.has(genesisOutpointKey(u.txid, u.vout)));
  const current = plain(await signerFundingCoins(signer));
  if (current.length >= needed) return current;

  const perOutput = 5000n;
  const missing = needed - current.length;
  // One P2PKH input is ~148 bytes and each P2PKH output is ~34 bytes. A fixed 1000-satoshi fee stops meeting
  // the 1 sat/byte relay floor once a wide compiler-authored block needs a few dozen positional funders. Keep a
  // conservative linear margin (including compact-size growth and signature variance) without tying this helper
  // to mock-provider internals.
  const fee = BigInt(Math.max(1000, 250 + 40 * (missing + 1)));
  // Spend the largest coin only; splitting several would consume the very outpoints the caller still needs.
  const [largest] = [...current].sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  if (!largest || largest.satoshis < perOutput * BigInt(missing + 1) + fee) return undefined;

  const tb = new TransactionBuilder({ provider: signer.provider });
  tb.addInput(largest, signer.unlockP2PKH());
  for (let i = 0; i < missing; i++) tb.addOutput({ to: signer.getAddress(), amount: perOutput });
  tb.addOutput({ to: signer.getAddress(), amount: largest.satoshis - perOutput * BigInt(missing) - fee });
  await tb.send();

  const after = plain(await signerFundingCoins(signer));
  return after.length >= needed ? after : undefined;
}

/**
 * ethers-style contract factory for stateful contracts. `new ContractFactory(artifact, runner).deploy(...args)`
 * runs a real genesis deploy (like ethers `ContractFactory.deploy`): a Signer runner auto-selects a genesis
 * funding UTXO and funds+signs; a NetworkProvider runner needs an explicit `{ fundingUtxo, funder, changeAddress }`
 * override. The returned contract is ready to call and carries `deploymentTransaction()` + `waitForDeployment()`.
 */
export class ContractFactory<T extends Artifact = Artifact> {
  constructor(
    readonly artifact: T,
    readonly runner: ContractRunner,
    /**
     * Deploy overrides every `deploy` call starts from, which the call's own trailing overrides then refine.
     *
     * A host that binds a project-wide deployment convention - the identity a deployment is addressed by, say -
     * states it once here rather than at every call site.
     */
    private readonly defaultDeployOptions: DeployContractOptions = {},
  ) {}

  /** Return a new factory bound to a different runner (ethers `factory.connect`). */
  connect(runner: ContractRunner): ContractFactory<T> {
    return new ContractFactory(this.artifact, runner, this.defaultDeployOptions);
  }

  /**
   * ethers `factory.attach(address)` — connect to an already-deployed instance. For stateful contracts the
   * "address" may be a CashAddress, locking-bytecode hex, raw locking bytecode bytes (event args), or a
   * category id (txid of the genesis funder). MistSwap does
   * `UniswapV2Pair.attach((await createPairTx.wait()).events[0].args.pair)`.
   */
  async attach(addressOrCategory: string | Uint8Array): Promise<ConnectedStatefulContract<T>> {
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
    const { StatefulContract: SC } = await import('./StatefulContract.js');
    return SC.at(id, this.artifact, this.runner);
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
    const { StatefulContract: SC } = await import('./StatefulContract.js');
    const { Contract } = await import('../Contract.js');
    const { resolveMasterPoolSize, poolGenesisSatoshis } = await import('../framed/deploy/pool.js');
    const { buildLogicalIdentityCommitment, deriveLogicalCreateAddress, resolveLogicalIdentity } = await import('./logical-identity.js');
    const { registerDeployment } = await import('./deployment-registry.js');
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
    overrides = { ...this.defaultDeployOptions, ...overrides };
    const signer = this.runner instanceof Signer ? this.runner : undefined;
    const provider: NetworkProvider = overrides.provider
      ?? (signer ? signer.provider : (this.runner as NetworkProvider));
    const constructorArgs = await normalizeRegisteredAddressArguments(
      provider,
      this.artifact.constructorInputs,
      args.slice(0, ctorCount) as ConstructorArgument[],
    );
    const publicInitInputs = this.artifact.abi.find((f) => f.name === '__construct')?.inputs
      .filter((input) => !input.name.startsWith('__internal__')) ?? [];
    const positionalInitArgs = await normalizeRegisteredAddressArguments(
      provider,
      publicInitInputs,
      args.slice(ctorCount) as NonNullable<DeployOptions['initArgs']>,
    );
    const overrideInitArgs = overrides.initArgs
      ? await normalizeRegisteredAddressArguments(provider, publicInitInputs, overrides.initArgs)
      : undefined;

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
      // A create address is predicted from the genesis-eligible coin the deployment will spend: the coin's txid
      // becomes the child's category, and the address is derived from that category. So a deployment whose address
      // was predicted ahead spends the coin the prediction named, rather than selecting another one.
      const { takeReservedGenesisFunding } = await import('../framed/deploy/create-lookahead-session.js');
      fundingUtxo = takeReservedGenesisFunding(signer);
      if (!fundingUtxo) {
        const verifierCount = overrides.messageBusVerificationInputCount
          ?? (deployArtifact.messageBus?.verifierProgram ? 1 : 0);
        // A framed genesis mints its whole master and validator pool, so the funding selection holds the pool's
        // outputs (and the validator facets) as a satoshi floor on top of the records and anchors it already counts.
        let poolSatoshis = 0n;
        if (deployArtifact.composition?.convention === 'framed') {
          const pool = resolveMasterPoolSize({ masters: overrides.threadCount, validators: overrides.validatorCount });
          poolSatoshis = poolGenesisSatoshis(pool, 1200n, overrides.functionSplit?.shards.length ?? 1);
        }
        // A coin the deployment names for the token's category is not its genesis coin.
        const { genesisOutpointKey } = await import('./genesis-reservations.js');
        const named = [overrides.nativeToken?.funding]
          .flatMap((coin) => (coin === undefined ? [] : [genesisOutpointKey(coin.txid, coin.vout)]));
        fundingUtxo = await selectGenesisFundingUtxo(
          signer, deployArtifact, new Set(named), 1 + verifierCount, poolSatoshis,
        );
      }
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
    let result: Awaited<ReturnType<typeof SC.deploy<T>>>;
    try {
      const identityAnchors = overrides.identityAnchors ?? (logicalAddress ? [{
        to: logicalAddress,
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
      result = await SC.deploy<T>(deployArtifact, constructorArgs, {
        provider,
        fundingUtxo,
        funder,
        changeAddress,
        // The deployer is the runner: its constructor reads the Signer's own lock as `msg.sender`, the lock every call
        // it makes carries, whichever coin or funder pays for the genesis.
        ...(signer === undefined ? {} : { senderLockingBytecode: signer.getLockingBytecode() }),
        initialState: overrides.initialState as DeployOptions['initialState'],
        fee: overrides.fee,
        addressType: overrides.addressType,
        salt: overrides.salt,
        threadCount: overrides.threadCount,
        validatorCount: overrides.validatorCount,
        ...(overrides.functionSplit === undefined ? {} : { functionSplit: overrides.functionSplit }),
        messageBusVerificationInputCount: overrides.messageBusVerificationInputCount,
        initialBalance: overrides.initialBalance,
        initArgs: overrideInitArgs ?? (positionalInitArgs.length > 0 ? positionalInitArgs : undefined),
        identityAnchors,
        ...(overrides.identity === undefined ? {} : { identity: overrides.identity }),
        ...(overrides.bcmr === undefined ? {} : { bcmr: overrides.bcmr }),
        ...(overrides.nativeToken === undefined ? {} : { nativeToken: overrides.nativeToken }),
        ...(overrides.splitFacets === undefined ? {} : { splitFacets: overrides.splitFacets }),
      });
      nonceReservation?.commit();
    } catch (error) {
      nonceReservation?.release();
      throw error;
    }

    const contract = result.contract as DeployedContract<T>;
    if (logicalAddress) {
      (contract as StatefulContract)._logicalAddress = logicalAddress;
      try {
        const identity = await resolveLogicalIdentity(provider, logicalAddress);
        if (identity.categoryId !== contract.categoryId) {
          throw new Error(
            `Logical identity at ${logicalAddress} binds category ${identity.categoryId}, `
            + `not the deployed category ${contract.categoryId}.`,
          );
        }
      } catch (error) {
        const utxos = await provider.getUtxos(logicalAddress);
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `ContractFactory.deploy(${this.artifact.contractName}) did not leave exactly one authenticated `
          + `SCID identity UTXO at getAddress() ${logicalAddress}: ${detail} `
          + `(found ${utxos.length} UTXO(s): `
          + `${utxos.map((utxo) => `${utxo.token?.nft?.capability ?? 'none'}:${(utxo.token?.nft?.commitment ?? '').slice(0, 16)}`).join(',') || 'none'})`,
        );
      }
    }
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
    (contract as { deploymentIdentity: () => IdentityRecord | undefined }).deploymentIdentity = () => result.identity;
    (contract as { deploymentRegistry: () => PublishedRegistry | undefined }).deploymentRegistry = () => result.registry;
    const awaitDeployed = async (): Promise<DeployedContract<T>> => {
      await result.tx.wait?.();
      return contract;
    };
    (contract as { waitForDeployment: () => Promise<DeployedContract<T>> }).waitForDeployment = awaitDeployed;
    // ethers v5 `.deployed()` alias (MistSwap uses it 38x): resolves to the deployed contract, like waitForDeployment.
    // `deployed` is not on DeployedContract<T>, so cast through unknown (TS2352) to attach the extra accessor.
    (contract as unknown as { deployed: () => Promise<DeployedContract<T>> }).deployed = awaitDeployed;
    // The registered lock is what an address argument naming this deployment is stored as (a constructor's or an
    // entry's), so it must be the lock the deployment's frames present as `msg.sender` and `address(this)`. A
    // framed contract presents its own address, `addrV(category)`, which `target` carries: its handle's lock is
    // the unfilled artifact's, which no frame presents, so a stored copy of it would never equal the caller.
    const framedAddress = (contract as StatefulContract)._framedAddress;
    // Frames present `addrV(category)`. Register that lock even though `target` is the logical CREATE address.
    const executionLock = framedAddress === undefined
      ? contract.inner.lockingBytecode : binToHex(addressToLockScript(framedAddress));
    const executionAddress = framedAddress ?? contract.target;
    registerDeployment(provider, {
      contractName: this.artifact.contractName,
      address: executionAddress,
      lockingBytecode: executionLock,
      contract,
    });
    if (logicalAddress !== undefined && logicalAddress !== executionAddress) {
      registerDeployment(provider, {
        contractName: this.artifact.contractName,
        address: logicalAddress,
        lockingBytecode: executionLock,
        contract,
      });
    }
    return contract;
  }
}

/** ethers/hardhat `getContractFactory` - build a ContractFactory from an artifact + runner. */
export function getContractFactory<T extends Artifact>(
  artifact: T, runner: ContractRunner, defaultDeployOptions?: DeployContractOptions,
): ContractFactory<T> {
  return new ContractFactory(artifact, runner, defaultDeployOptions);
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
