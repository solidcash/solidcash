// The stateless SDK surface. Stateful contracts, the message bus, framed composition, HD signers, block oracles,
// loop-call helpers and walletconnect live on subpaths (solidcash/stateful, solidcash/message-bus, solidcash/framed,
// solidcash/hdsigner, solidcash/oracle, solidcash/loop-call, solidcash/walletconnect) so importing the package root
// does not evaluate those graphs.

export { default as SignatureTemplate } from './SignatureTemplate.js';
export { default as Signer } from './Signer.js';
export { Contract } from './Contract.js';
export { TransactionBuilder } from './TransactionBuilder.js';

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
export * from './interfaces.js';
export * from './Errors.js';
export {
  type NetworkProvider,
  BitcoinRpcNetworkProvider,
  FullStackNetworkProvider,
  RegtestNetworkProvider,
  type ConsensusLimits,
} from './network/index.js';
export { randomUtxo, randomToken, randomNFT } from './utils.js';
export { gatherBchUtxos, gatherFungibleTokenUtxos, type GatherUtxosResult } from './transaction-utils.js';
export type { ExtractEventNames, EventMatcherArgs, EmittingContract } from './types/event-inference.js';
