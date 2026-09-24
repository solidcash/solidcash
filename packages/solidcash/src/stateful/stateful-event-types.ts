/**
 * phase-boundary extract: Lean-connect + ethers-v6 event facade types.
 * (phase-boundary extract from StatefulContract.ts).
 */

import type { EventDefinitionAbi } from '@solidcash/utils';
import type { AddressType } from '../interfaces.js';
import type { ConstructorArgument } from '../Argument.js';
import type { StateValueType } from '../types/state-inference.js';
import type { EventFilter } from './StateReader.js';

/** Options for the lean StatefulContract constructor / StatefulContract.at(). */
export interface LeanContractOptions {
  // Constructor args baked into the p2sh redeem script - required to SPEND (a p2sh address hashes the script,
  // so they cannot be recovered from it); omit for a no-arg contract. Reads that only need the category work
  // without them.
  constructorArgs?: ConstructorArgument[];
  addressType?: AddressType;
}


// ---- ethers-v6 events facade types ----

/**
 * A decoded contract event, ethers-`EventLog`-flavored. `args` are the decoded parameters. A Bitcoin Cash event
 * lives in an NFT UTXO (txid/vout) rather than a block-indexed log, so those replace blockNumber/logIndex.
 */
export interface EventLog {
  eventName: string;
  eventSignature: string;
  args: Record<string, StateValueType>;
  txid: string;
  vout: number;
}

/** The bound filter produced by `contract.filters.EventName(...indexedArgs)` (ethers `DeferredTopicFilter`). */
export interface DeferredEventFilter {
  eventDef: EventDefinitionAbi;
  filter: EventFilter;
}

/**
 * A callable event handle (ethers `ContractEvent`), from `contract.filters.EventName` / `contract.getEvent(name)`.
 * Call it with indexed argument values (null/undefined = match any) to build a DeferredEventFilter.
 */
export interface StatefulContractEvent {
  (...indexedArgs: Array<StateValueType | null | undefined>): DeferredEventFilter;
  eventName: string;
  signature: string;
  eventDef: EventDefinitionAbi;
}

/** An accepted event argument for queryFilter/on/off (ethers `ContractEventName`). */
export type ContractEventName = string | StatefulContractEvent | DeferredEventFilter;

/** An event listener (ethers `Listener`): decoded positional values followed by the EventLog. */
export type EventListener = (...args: any[]) => void;

