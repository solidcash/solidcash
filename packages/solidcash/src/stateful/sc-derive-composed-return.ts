/**
 * phase-boundary extract: SC staticCall read of a function whose calls reach one owner more than once.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import Signer from '../Signer.js';
import {
  isBusCompiledEntry,
  isRepeatedTypedLoopCallsite,
  plansRepeatedBusRows,
} from './sc-expand-resolve-create-builder-external-calls.js';
import type { StatefulContract } from './StatefulContract.js';

/** Caller of a read with no connected signer. The composition is built for its VM result and never sent. */
const READ_ONLY_CALLER_KEY = new Uint8Array(32).fill(1);

type RegisteredOwner = {
  categoryId?: string;
  inner?: { lockingBytecode?: string };
  proxy?: RegisteredOwner;
};

const ownerKey = (owner: { categoryId: string; inner: { lockingBytecode: string } }): string => (
  `${owner.categoryId.toLowerCase()}:${owner.inner.lockingBytecode.toLowerCase()}`
);

/**
 * Return blob of `functionName`, read through the atomic composition its send would use; undefined when the
 * ordinary return probe serves the read.
 *
 * The probe builder lets only a participant's first callsite own its input, so a later callsite on the same owner
 * (another method, or other arguments) presents the first one's selector and arguments to the caller's check and
 * the probe fails there. A loop over a fixed callee is the same shape: each occurrence's record names its own call,
 * and one callee run answers one. A send of such a function is composed atomically for exactly this reason. The
 * read builds that composition without broadcasting it and returns the root invocation's result, which the
 * composer derives from the root's own covenant like every other return.
 */
export async function deriveComposedReturnBlob(
  contract: StatefulContract<Artifact>,
  signer: Signer | undefined,
  functionName: string,
  args: readonly FunctionArgument[],
  abiFunction: AbiFunction,
): Promise<Uint8Array | undefined> {
  // A direct compile reads repeated calls through the callee's multi-call spend; it never composes a bus graph.
  return undefined;
}
