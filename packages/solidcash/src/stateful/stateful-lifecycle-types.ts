/**
 * phase-boundary extract: StatefulContract lifecycle / connect option types
 * (phase-boundary extract from StatefulContract.ts).
 */

import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import type { AddressType, Unlocker, Utxo, TransactionDetails } from '../interfaces.js';
import type { FunctionArgument, ConstructorArgument } from '../Argument.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StateValueType } from '../types/state-inference.js';
import type { ConnectedStatefulContract, StatefulContract } from './StatefulContract.js';

export interface DeployOptions {
  provider: NetworkProvider;
  fundingUtxo: Utxo;
  funder: Unlocker;
  initialState?: Record<string, StateValueType>;
  initArgs?: FunctionArgument[];  // arguments for constructor {} block
  changeAddress: string;
  masterAmount?: bigint;   // default 1200n
  dataNftAmount?: bigint;  // default 1200n per data NFT
  fee?: bigint;            // default 1000n
  maxFee?: bigint;         // maximum allowed fee (throws if exceeded)
  addressType?: AddressType;
  threadCount?: number;    // number of master minting NFTs (default: 1)
  /**
   * A dead `<salt> OP_DROP` push baked into the script. Beyond CREATE2 addressing this is the DENSITY RESERVE:
   * the BCH-2026 operation-cost budget is `operationCostBudgetPerByte x unlockingBytecodeLength`, and for
   * p2sh32 the redeem script counts toward that length, so each reserve byte buys 800 units of budget while
   * costing about 6 to carry - a net +794. A dense shape that a node refuses can be made valid by reserving
   * bytes for it. Costs: a larger script, a different contract address, and the 520-byte cap.
   */
  salt?: Uint8Array;
  /** Independently spendable, category-branded message bus verifier covenants minted by genesis. */
  messageBusVerificationInputCount?: number;
  initialBalance?: bigint; // initial satoshi container balance (created when > 0)
  /** Internal SDK composition: immutable category-bearing logical identity outputs minted by genesis. */
  identityAnchors?: Array<{ to: string | Uint8Array; commitment: string; amount?: bigint }>;
}

export interface DeployResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
}

export interface UpgradeOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  oldContract: ConnectedStatefulContract;
  upgradeFunctionName: string;        // must have 'upgrade' modifier in ABI
  upgradeFunctionArgs: FunctionArgument[];
  newArtifact: T;
  newConstructorArgs: ConstructorArgument[];
  addressType?: AddressType;          // default: match old contract's addressType
  fee?: bigint;                       // default: 1000n
  maxFee?: bigint;                   // maximum allowed fee (throws if exceeded)
  fundingUtxo?: Utxo;                // required when new layout needs additional data NFTs
  funder?: Unlocker;                  // required when new layout needs additional data NFTs
  changeAddress?: string;             // change address for leftover funding satoshis
}

export interface UpgradeResult<T extends Artifact = Artifact> {
  contract: ConnectedStatefulContract<T>;
  tx: TransactionDetails;
  categoryId: string;
}

export interface DestroyOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  destroyFunctionName: string;        // must have 'selfdestruct' modifier in ABI
  destroyFunctionArgs: FunctionArgument[];
  recipient: string;                  // address to send remaining funds
  fee?: bigint;                       // per-transaction fee, default 1000n
  maxFee?: bigint;                    // maximum allowed fee per tx (throws if exceeded)
  maxInputsPerTx?: number;            // conservative default ~200
  /** Token container category IDs to reclaim (satoshi containers are auto-discovered) */
  tokenContainerCategoryIds?: string[];
}

export interface DestroyResult {
  txs: TransactionDetails[];          // 1 or more transactions
  totalReclaimed: bigint;             // total satoshis sent to recipient
}

export interface DeployFromOptions<T extends Artifact = Artifact> {
  provider: NetworkProvider;
  factory: ConnectedStatefulContract;        // the factory contract
  deployFunctionName: string;                // must have 'deploy' modifier
  deployFunctionArgs: FunctionArgument[];    // user args to the factory's deploy function
  childArtifact?: T;                         // child artifact; else resolved via factory.registerChild()
  childConstructorArgs?: ConstructorArgument[]; // else derived from the deploy args (new C(param) mapping)
  childSalt?: Uint8Array;                    // create2 salt; else derived from the recorded new C{salt}() mapping
  /** Optional initial values for fields the constructor descriptor does not authenticate. Attempts to override
   * authenticated constructor fields are rejected; non-default values for other fields must still satisfy the
   * factory's on-chain genesis covenant. */
  childInitialState?: Record<string, StateValueType>;
  // `new Child{value: x}()` transfers x sats from the factory's OWN satoshi container (the value source, like any
  // scash value transfer - EVM-faithful "from the deployer's balance") to the child's address. deployFrom then
  // co-spends the factory container (input) + recreates it (output, minus x) + adds the x-sat transfer output.
  // The factory must have been deployed with an initialBalance >= x. Supply the transferred amount here.
  childValue?: bigint;
  // A deploy function that transfers CashTokens from the factory's token container - e.g. to the freshly-created
  // child (`Child ch = new Child(...); this.tokens[cat].transfer(<addr>, amt)`). Supply each FT transfer the deploy
  // performs; deployFrom co-spends the factory's token container, recreates it (amount minus the transfers), and
  // adds each tcTransfer output. `to` is the recipient locking bytecode/address (pass the child's address to fund
  // the new contract). Multiple categories are co-spent + recreated in one deploy. NFT (transferNft) transfers on
  // deploy are not yet supported. See docs/contract-creation.md.
  childTokenTransfers?: Array<{ categoryId: string; to: string | Uint8Array; amount: bigint }>;
  fundingUtxo: Utxo;                         // must be at vout 0 for token genesis (becomes child category)
  // A LOOP deploy (`for (i<n) new C()`) mints N children - a balanced contract block needs N funding inputs
  // (any value, each vout 0), one per child; child i's category = fundingUtxos[i].txid. When set, this supersedes
  // the single fundingUtxo (which stays fundingUtxos[0] for a 1-child deploy). See docs/contract-creation.md.
  fundingUtxos?: Utxo[];
  funder?: Unlocker;                         // unlocker for funding UTXO(s); else factory.setDeployDefaults()
  addressType?: AddressType;
  fee?: bigint;                              // default: 1000n
  maxFee?: bigint;                           // maximum allowed fee (throws if exceeded)
  changeAddress?: string;
  masterAmount?: bigint;                     // default: 1200n
  dataNftAmount?: bigint;                    // default: 1200n per data NFT
}

// Options for the `factory.deployFn(...args).deploy({...})` sugar: the provider, factory, deploy-function
// name and args are taken from the call itself, leaving only the child + funding details.
export type DeployFromCallOptions<T extends Artifact = Artifact> =
  Omit<DeployFromOptions<T>, 'provider' | 'factory' | 'deployFunctionName' | 'deployFunctionArgs'>;

export interface DeployFromResult<T extends Artifact = Artifact> {
  factory: ConnectedStatefulContract;        // factory with updated state
  child: ConnectedStatefulContract<T>;       // newly deployed child contract
  tx: TransactionDetails;
  childCategoryId: string;
}

export interface SplitOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  splitFunctionName: string;             // must have 'split' modifier in ABI
  splitFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  fundingUtxos: Utxo[];                  // funding UTXOs for fees + new NFT dust
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
  newMintingAmount?: bigint;             // satoshis per new minting NFT, default: 1200n
}

export interface SplitResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface MergeOptions {
  provider: NetworkProvider;
  contract: ConnectedStatefulContract;
  mergeFunctionName: string;             // must have 'merge' modifier in ABI
  mergeFunctionArgs: FunctionArgument[]; // includes the count N
  funder: Unlocker;                      // unlocker for funding UTXO(s)
  consumedMasterUtxos: Utxo[];           // minting NFT UTXOs to consume
  fundingUtxos: Utxo[];                  // funding UTXOs for fees
  changeAddress: string;
  fee?: bigint;                          // default: 1000n
  maxFee?: bigint;                       // maximum allowed fee (throws if exceeded)
}

export interface MergeResult {
  tx: TransactionDetails;
  categoryId: string;
}

export interface ExternalCallInfo {
  externalContract: StatefulContract;
  functionName: string;
  args: FunctionArgument[];
  stateOverrides?: Record<string, StateValueType>;
}

/**
 * Specification for an external contract in a flat map.
 * Used by `externalContracts` option in `connect()` / `from()` to auto-wire the graph.
 */
export interface ExternalContractSpec {
  artifact: Artifact;
  categoryId: string;
  /** Explicit constructor args override. When omitted, inferred from ABI metadata. */
  constructorArgs?: ConstructorArgument[];
}

/** Options for `StatefulContract.withCategory()` and `StatefulContract.from()`. */
export interface StatefulConnectOptions {
  /** Pre-built external contracts, manually wired. */
  externals?: Record<string, ConnectedStatefulContract>;
  /**
   * Flat map of interface name -> external contract spec.
   * SDK auto-creates Contract + StatefulContract objects, infers constructor args
   * from ABI metadata (categoryParam -> category ID), and wires the externals graph.
   *
   * Covers the full chain: if A references IB and B references IC, provide both
   * `{ IB: ..., IC: ... }` and the SDK wires B->IC automatically.
   */
  externalContracts?: Record<string, ExternalContractSpec>;
}

/** Metadata for each group in the external call UTXO list (direct + transitive). */
export interface ExternalGroupMeta {
  /** The ABI slot governing this call (from the caller's ABI). */
  ecSlot: ExternalCallAbi;
  /** Category ID of the contract making this call (A's cat for direct, B's cat for B->C). */
  callerCategoryId: string;
  /** Index of the parent group for transitive calls (-1 for direct). */
  parentGroupIndex: number;
}

