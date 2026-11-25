/**
 * Runtime-only route metadata attached by the SDK to an ABI entry while a concrete call is being built.
 *
 * Nothing here is serialized into an artifact; a direct call leaves every field undefined.
 */

import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

export type GraphBlockhashSelection = {
  readKey: string;
  slotOrdinal: number;
  rowArgs: FunctionArgument[];
  handler: AbiFunction;
};

export type GraphEcrecoverCall = readonly [
  FunctionArgument | undefined, FunctionArgument | undefined,
  FunctionArgument | undefined, FunctionArgument | undefined,
];

export type RouteRuntimeAbiFunction = AbiFunction & {
  graphBlockhashSelections?: GraphBlockhashSelection[];
  graphEcrecoverCalls?: GraphEcrecoverCall[];
  /** Direct calls publish no route convention. */
  routeConvention?: never;
  routeRowArguments?: readonly any[];
  routeGraphExecution?: true;
  routeKeccakPreimages?: readonly (Uint8Array | null)[];
  routeActiveEntryOperations?: ReadonlyMap<number, readonly string[]>;
  routeActiveEntryRecipes?: ReadonlyMap<number, readonly { access: any; args: any; inputs: any }[]>;
  routeInactiveEntrySlots?: readonly number[];
  routeHandlerManagedEntrySlots?: readonly number[];
  routeActiveWriteCollections?: readonly string[];
  routeActiveSatoshiContainer?: boolean;
};

/** One prepared call's runtime-only composition metadata. Direct calls publish none. */
export interface RouteRuntimeCall {
  valueChunkProductions?: readonly any[];
  [key: string]: any;
}

/** A direct call selects no route rows, so it publishes no graph blockhash reads. */
export function selectGraphBlockhashReads(_artifact: any, _blob: Uint8Array): GraphBlockhashSelection[] {
  return [];
}
