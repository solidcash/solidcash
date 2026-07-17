import { Artifact } from '@solidcash/utils';
import { Contract } from '../Contract.js';
import {
  StatefulContract as StatefulContractClass,
  type ConnectedStatefulContract as ConnectedStatefulContractType,
  type ContractRunner as ContractRunnerType,
  type LeanContractOptions as LeanContractOptionsType,
} from './StatefulContract.js';

// `new StatefulContract(...)` returns the ABI-typed connected instance (the runtime is a Proxy providing exactly
// that surface). A class constructor otherwise yields the bare class type, so strip the generated construct
// signatures (mapped type over the statics) and re-declare the lean + legacy forms as returning the connected
// type. See docs/stateful-contract-sdk.md.
type StatefulContractCtor =
  { [K in keyof typeof StatefulContractClass]: (typeof StatefulContractClass)[K] }
  & {
    new <T extends Artifact>(
      categoryId: string, artifact: T, runner: ContractRunnerType, options?: LeanContractOptionsType,
    ): ConnectedStatefulContractType<T>;
    new <T extends Artifact>(contract: Contract<T>, categoryId: string): ConnectedStatefulContractType<T>;
  };
export const StatefulContract = StatefulContractClass as unknown as StatefulContractCtor;
export type StatefulContract<T extends Artifact = Artifact> = ConnectedStatefulContractType<T>;

export {
  StatefulTransactionBuilder,
  type EntryNftInfo,
  type TransferData,
  type EventEmitData,
  type TokenContainerInfo,
  type TokenContainerTransferData,
  type TokenContainerTransferNftData,
  type ExternalCallUtxoGroup,
  type StatefulTransactionOptions,
} from './StatefulTransactionBuilder.js';
export {
  ContractBundle, resolveCategoryFromAddress, resolveCategoryFromLockingBytecode, type ContractBundleOptions,
} from './ContractBundle.js';
export {
  ContractFactory, getContractFactory, deployContract,
  type DeployContractOptions, type DeployedContract,
} from './ContractFactory.js';
export {
  upgrades, deployProxy, ProxyContract,
  type DeployProxyOptions, type ProxyInitialState,
} from './upgrades.js';
export {
  StatefulFunctionCall,
  DeployFunctionCall,
  TokenContainerAccessor,
  type ConnectedStatefulContract,
  type DeployOptions,
  type DeployResult,
  type UpgradeOptions,
  type UpgradeResult,
  type DeployFromOptions,
  type DeployFromResult,
  type DestroyOptions,
  type DestroyResult,
  type ExternalCallInfo,
  type ExternalContractSpec,
  type StatefulConnectOptions,
  type CallInfo,
  type ContractRunner,
  type LeanContractOptions,
  type EventLog,
  type DeferredEventFilter,
  type StatefulContractEvent,
  type ContractEventName,
  type EventListener,
} from './StatefulContract.js';
export {
  StateReader, type OnChainState, type ParsedEvent, type EventFilter,
  parseEventCommitment, tryParseEventCommitment,
  readEventsFromChain, readEventsFiltered,
  readAnonymousEventsFromChain, valuesEqual,
} from './StateReader.js';
export { ThreadManager, ThreadHandle, type SplitOptions, type MergeOptions } from './ThreadManager.js';
export { resolveDeployReads, type DeployReadResolveOptions } from './resolveDeployReads.js';
export {
  SortedList, keyToSlot, keyToSlotMulti, keyToSlotValue, slotValueToBytes, bytesToSlotValue,
  encodeEntryCommitment, decodeEntryCommitment, headSentinelCommitment,
  type SortedEntry, type NonMembershipPlan, type MembershipPlan, type InsertPlan, type DeletePlan, type UpdatePlan,
} from './SortedList.js';
export {
  getDataNftAddress,
  getDataNftLockingBytecode,
  getEntryNftLockingBytecode,
  getEntryNftAddress,
  getValueChunkAddress,
  getValueChunkLockingBytecode,
  getEventNftAddress,
  getAnonymousEventNftAddress,
  getTokenContainerAddress,
  getSatoshiContainerAddress,
  getContractState,
  createDataNftUnlocker,
  createDestroyDataNftUnlocker,
  createReadOnlyDataNftUnlocker,
  createEntryNftUnlocker,
  createReadOnlyEntryNftUnlocker,
  createValueChunkUnlocker,
  createEventNftUnlocker,
  createAnonymousEventNftUnlocker,
  createTokenContainerUnlocker,
  createSatoshiContainerUnlocker,
  createCovenantContractUnlocker,
  validateCategoryId,
  resolveCollectionSignature,
  resolveEventSignature,
} from './covenant-helpers.js';
