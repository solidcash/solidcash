/**
 * The body a value send runs and the call data it carries (spec 4b): a send to a contract runs its `receive()`, else
 * its payable `fallback()`, and the call record carries the selector of `receive()` alone, the EVM's empty call data.
 */

import {
  computeFunctionSelector, computeFunctionSignature, type Artifact,
} from '@solidcash/utils';

/** The ABI name of a contract's `receive()`. */
export const RECEIVE_ENTRY = '__receive';

/** The ABI name of a contract's `fallback()`. */
export const FALLBACK_ENTRY = '__fallback';

/** A value send's call data: the selector of `receive()` alone, in the selector scheme of the compile's mode (D27). */
export const valueSendCallData = (artifact: Artifact): Uint8Array =>
  computeFunctionSelector(
    computeFunctionSignature(RECEIVE_ENTRY, []), artifact.compiler?.options?.evmCompat === true,
  );

/**
 * The body a value send runs, as the EVM picks it: `receive()`, else a payable `fallback()`; or, for a contract with
 * neither, the reason it refuses the send, naming the value as `what`.
 */
export function valueEntryOrRefusal(
  artifact: Artifact, what: string,
): { readonly entry: Artifact['abi'][number] } | { readonly refusal: string } {
  const receive = artifact.abi.find((candidate) => candidate.name === RECEIVE_ENTRY);
  if (receive !== undefined) return { entry: receive };
  const fallback = artifact.abi.find((candidate) => candidate.name === FALLBACK_ENTRY);
  if (fallback === undefined) {
    return { refusal: `contract "${artifact.contractName}" has no receive(), so ${what} has no body to run` };
  }
  if (!(fallback.modifiers ?? []).includes('payable')) {
    return {
      refusal: `contract "${artifact.contractName}" has no receive() and its fallback() is not payable, so it `
        + `refuses ${what}`,
    };
  }
  return { entry: fallback };
}
