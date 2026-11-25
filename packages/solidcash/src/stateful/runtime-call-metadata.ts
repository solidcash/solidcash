/**
 * Runtime-only metadata attached by the SDK to an ABI entry while a concrete call is being built.
 *
 * Nothing here is serialized into an artifact; a direct call publishes only the fields it uses.
 */

import type { FunctionArgument } from '../Argument.js';

export type GraphEcrecoverCall = readonly [
  FunctionArgument | undefined, FunctionArgument | undefined,
  FunctionArgument | undefined, FunctionArgument | undefined,
];

/** One prepared call's runtime-only composition metadata. */
export interface RuntimeCallMetadata {
  valueChunkProductions?: readonly any[];
  [key: string]: any;
}
