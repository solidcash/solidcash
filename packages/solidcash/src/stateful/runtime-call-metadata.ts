/**
 * Runtime-only metadata attached by the SDK to an ABI entry while a concrete call is being built.
 *
 * Nothing here is serialized into an artifact; a direct call publishes only the fields it uses.
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

export type RuntimeCallAbiFunction = AbiFunction & {
  graphBlockhashSelections?: GraphBlockhashSelection[];
  graphEcrecoverCalls?: GraphEcrecoverCall[];
};

/** One prepared call's runtime-only composition metadata. */
export interface RuntimeCallMetadata {
  valueChunkProductions?: readonly any[];
  [key: string]: any;
}

/** A direct call publishes no graph blockhash reads. */
export function selectGraphBlockhashReads(_artifact: any, _blob: Uint8Array): GraphBlockhashSelection[] {
  return [];
}
