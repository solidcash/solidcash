export { default as SignatureTemplate } from './SignatureTemplate.js';
export { default as Signer } from './Signer.js';
export {
  HDSigner, HDPublicSigner, signersFromMnemonic, BCH_DEFAULT_HD_PATH, BCH_ACCOUNT_BRANCH,
} from './HDSigner.js';
export { Contract } from './Contract.js';
export { TransactionBuilder } from './TransactionBuilder.js';
export {
  buildOpaqueLoopCallTransaction, deriveOpaqueLoopCoSpends, buildTypedLoopCallTransaction,
  deriveTypedLoopCoSpends,
} from './loop-call.js';
export type {
  OpaqueLoopCoSpend, OpaqueLoopCallContext, BuildOpaqueLoopCallOptions,
  CoSpendableContract, OpaqueLoopContractCall,
  TypedLoopCoSpend, BuildTypedLoopCallOptions,
} from './loop-call.js';
export * from './stateful/index.js';
export * from './oracle/blockOracleUpdater.js';
export * from './oracle/blockhashCoSpend.js';
export {
  type ConstructorArgument,
  type FunctionArgument,
  type EncodedConstructorArgument,
  type EncodedFunctionArgument,
  encodeFunctionArgument,
} from './Argument.js';
export type {
  Artifact, AbiFunction, AbiInput, StateLayout, StateVariableInfo, StateValue, PrimitiveStateValue, StateRecord,
  SplitArtifactBundle, SplitManifest, SplitRoute, SplitFacetInfo, SplitStateFootprint,
} from '@solidcash/utils';
export * as utils from '@solidcash/utils';
export * as messageBus from './message-bus/index.js';
export * from './interfaces.js';
export * from './Errors.js';
export {
  type NetworkProvider,
  BitcoinRpcNetworkProvider,
  ElectrumNetworkProvider,
  FullStackNetworkProvider,
  MockNetworkProvider,
  FailingMockNetworkProvider,
  RegtestNetworkProvider,
  type SnapshotRestorer,
  type ConsensusLimits,
  MOCK_DEFAULT_BLOCK_TIME,
  MOCK_CONSENSUS_LIMITS,
  MOCK_RELAXED_OPERATION_COST,
} from './network/index.js';
export { randomUtxo, randomToken, randomNFT } from './utils.js';
export { gatherBchUtxos, gatherFungibleTokenUtxos, type GatherUtxosResult } from './transaction-utils.js';
export * from './walletconnect-utils.js';
export type { ExtractEventNames, EventMatcherArgs, EmittingContract } from './types/event-inference.js';

// The composition composer: derivation, pool selection, block layout and witness assembly.
export * as framedComposer from './framed/composer/index.js';
// The independent reference model the validator derivation is compared against.
export * as framedReference from './framed/validator/reference/index.js';
// Deployment of a compiled master: filling its reserved slots and deriving its address.
export * as framedDeploy from './framed/deploy/index.js';
// Reading a deployed contract off chain: a `STATIC` frame derived and evaluated locally, never broadcast.
export * as framedRead from './framed/read/index.js';
// Calling a deployed contract: a `ROOT` frame entered by a real caller, signed and broadcast.
export * as framedCall from './framed/call/index.js';
// Reading an accepted composition's declared event outputs back into decoded logs, and delivering them.
export * as framedReceipt from './framed/receipt/index.js';
// Serializing sends whose compositions could touch the same masters, validators or records.
export * as framedQueue from './framed/queue/index.js';

// Deprecated aliases of the namespaces above, kept for one release under their previous `perCall` names.
/** @deprecated use {@link framedComposer} */
export * as perCallComposer from './framed/composer/index.js';
/** @deprecated use {@link framedReference} */
export * as perCallReference from './framed/validator/reference/index.js';
/** @deprecated use {@link framedDeploy} */
export * as perCallDeploy from './framed/deploy/index.js';
/** @deprecated use {@link framedRead} */
export * as perCallRead from './framed/read/index.js';
/** @deprecated use {@link framedCall} */
export * as perCallCall from './framed/call/index.js';
/** @deprecated use {@link framedReceipt} */
export * as perCallReceipt from './framed/receipt/index.js';
/** @deprecated use {@link framedQueue} */
export * as perCallQueue from './framed/queue/index.js';
