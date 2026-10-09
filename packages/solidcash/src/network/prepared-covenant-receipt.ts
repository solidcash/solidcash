/**
 * One-use receipts for covenant finalization.
 *
 * The SDK's exact-finalization gate and `MockNetworkProvider` run in one process. Retain a one-use receipt for a
 * transaction whose every input has already passed the provider-configured BCH-2026 VM, avoiding the identical
 * VM pass at submission. Bind the receipt to provider identity, transaction bytes, and every source output.
 * Exact transaction-object reuse is the zero-cost path; builders that deterministically reconstruct the same
 * transaction may reuse the receipt only after their reconstructed object is independently hashed. All non-VM
 * node checks still run in the verifier.
 *
 * These functions are deliberately free of the `@mem-cash/*` verification pipeline so the stateful preflight can
 * record and consume receipts without loading those packages; only the mock verifier adapter in
 * `createPreparedTxVerifier.js` pulls them in.
 */

import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction, hashTransactionUiOrder } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Output as LibauthOutput } from '@bitauth/libauth/build/lib/message/transaction-types.js';
import type NetworkProvider from './NetworkProvider.js';
import type { PreparedTransaction } from './NetworkProvider.js';

export type CovenantSourceOutput = Pick<LibauthOutput, 'lockingBytecode' | 'valueSatoshis' | 'token'>;

interface PreparedCovenantValidation {
  txid: string;
  transaction: PreparedTransaction['transaction'];
  sourceOutputs: readonly CovenantSourceOutput[];
}

interface PartialCovenantSourceIdentity {
  valueSatoshis: bigint;
  lockingBytecodeHash: string;
  tokenCategory?: string;
  tokenAmount?: bigint;
  nftCapability?: string;
  nftCommitment?: string;
}

interface PartialCovenantValidation {
  sourceOutputs: readonly PartialCovenantSourceIdentity[];
  successfulInputs: ReadonlySet<number>;
}

const preparedCovenantValidations = new WeakMap<object, Map<string, PreparedCovenantValidation>>();
const maximumPreparedCovenantValidationsPerProvider = 256;

// Convergence and exact preflight are separate phases. Keep their partial receipts separate from the all-input
// provider receipt above so no submission path can accidentally promote a subset of successful inputs into a
// complete transaction verdict. These receipts are intentionally one-use and remain inert until preflight elects
// to consume them.
const partialCovenantValidations = new WeakMap<object, Map<string, PartialCovenantValidation>>();
const maximumPartialCovenantValidationsPerProvider = 256;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => (
  left.length === right.length && left.every((byte, index) => byte === right[index])
);

const tokensEqual = (left: LibauthOutput['token'], right: LibauthOutput['token']): boolean => {
  if (left === undefined || right === undefined) return left === right;
  if (!bytesEqual(left.category, right.category) || left.amount !== right.amount) return false;
  if (left.nft === undefined || right.nft === undefined) return left.nft === right.nft;
  return left.nft.capability === right.nft.capability
    && bytesEqual(left.nft.commitment, right.nft.commitment);
};

const sourceOutputsEqual = (
  expected: readonly CovenantSourceOutput[], actual: readonly CovenantSourceOutput[],
): boolean => expected.length === actual.length && expected.every((output, index) => {
  const candidate = actual[index];
  return candidate !== undefined
    && output.valueSatoshis === candidate.valueSatoshis
    && bytesEqual(output.lockingBytecode, candidate.lockingBytecode)
    && tokensEqual(output.token, candidate.token);
});

const partialSourceOutputIdentity = (
  output: CovenantSourceOutput,
): PartialCovenantSourceIdentity => ({
  valueSatoshis: output.valueSatoshis,
  // Hash afresh rather than caching by Uint8Array identity: in-place mutation after recording must invalidate.
  lockingBytecodeHash: binToHex(hash256(output.lockingBytecode)),
  ...(output.token === undefined ? {} : {
    tokenCategory: binToHex(output.token.category),
    tokenAmount: output.token.amount,
    ...(output.token.nft === undefined ? {} : {
      nftCapability: output.token.nft.capability,
      nftCommitment: binToHex(output.token.nft.commitment),
    }),
  }),
});

const partialSourceOutputsEqual = (
  expected: readonly PartialCovenantSourceIdentity[], actual: readonly CovenantSourceOutput[],
): boolean => expected.length === actual.length && expected.every((identity, index) => {
  const candidate = actual[index];
  if (candidate === undefined) return false;
  const actualIdentity = partialSourceOutputIdentity(candidate);
  return identity.valueSatoshis === actualIdentity.valueSatoshis
    && identity.lockingBytecodeHash === actualIdentity.lockingBytecodeHash
    && identity.tokenCategory === actualIdentity.tokenCategory
    && identity.tokenAmount === actualIdentity.tokenAmount
    && identity.nftCapability === actualIdentity.nftCapability
    && identity.nftCommitment === actualIdentity.nftCommitment;
});

/** Record successful input evaluations without granting an all-input provider validation receipt. */
export function rememberPartialCovenantValidation(
  provider: NetworkProvider,
  transaction: PreparedTransaction['transaction'],
  sourceOutputs: readonly CovenantSourceOutput[],
  successfulInputs: readonly number[],
): void {
  if (successfulInputs.some((index) => !Number.isSafeInteger(index)
    || index < 0 || index >= transaction.inputs.length)) {
    throw new Error('Partial covenant validation input indices must identify transaction inputs.');
  }
  const txid = binToHex(hashTransactionUiOrder(encodeTransaction(transaction)));
  let byTxid = partialCovenantValidations.get(provider as object);
  if (!byTxid) {
    byTxid = new Map();
    partialCovenantValidations.set(provider as object, byTxid);
  }
  const sourceIdentity = sourceOutputs.map(partialSourceOutputIdentity);
  const existing = byTxid.get(txid);
  const merged = existing !== undefined && partialSourceOutputsEqual(existing.sourceOutputs, sourceOutputs)
    ? new Set([...existing.successfulInputs, ...successfulInputs])
    : new Set(successfulInputs);
  byTxid.delete(txid);
  byTxid.set(txid, { sourceOutputs: sourceIdentity, successfulInputs: merged });
  if (byTxid.size > maximumPartialCovenantValidationsPerProvider) {
    const oldestTxid = byTxid.keys().next().value;
    if (oldestTxid !== undefined) byTxid.delete(oldestTxid);
  }
}

/** Take a matching one-use partial receipt. Any transaction/source mismatch yields no reusable inputs. */
export function takePartialCovenantValidation(
  provider: NetworkProvider,
  transaction: PreparedTransaction['transaction'],
  sourceOutputs: readonly CovenantSourceOutput[],
): ReadonlySet<number> {
  const txid = binToHex(hashTransactionUiOrder(encodeTransaction(transaction)));
  const byTxid = partialCovenantValidations.get(provider as object);
  const receipt = byTxid?.get(txid);
  if (receipt === undefined) return new Set();
  // Delete before comparing or returning: failures and interruptions cannot leave reusable authority behind.
  byTxid!.delete(txid);
  return partialSourceOutputsEqual(receipt.sourceOutputs, sourceOutputs)
    ? receipt.successfulInputs : new Set();
}

/** Record that every covenant accepted this exact transaction and source-output population. */
export function rememberPreparedCovenantValidation(
  provider: NetworkProvider,
  transaction: PreparedTransaction['transaction'],
  sourceOutputs: readonly CovenantSourceOutput[],
): void {
  let byTxid = preparedCovenantValidations.get(provider as object);
  if (!byTxid) {
    byTxid = new Map();
    preparedCovenantValidations.set(provider as object, byTxid);
  }
  const txid = binToHex(hashTransactionUiOrder(encodeTransaction(transaction)));
  byTxid.delete(txid);
  byTxid.set(txid, {
    txid,
    transaction,
    sourceOutputs,
  });
  if (byTxid.size > maximumPreparedCovenantValidationsPerProvider) {
    const oldestTxid = byTxid.keys().next().value;
    if (oldestTxid !== undefined) byTxid.delete(oldestTxid);
  }
}

/** Consume a matching receipt. Any byte/source mismatch falls back to full provider VM validation. */
export function consumePreparedCovenantValidation(
  provider: NetworkProvider,
  prepared: PreparedTransaction,
  sourceOutputs: readonly CovenantSourceOutput[],
  txid: string,
): boolean {
  const debugTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
  const byTxid = preparedCovenantValidations.get(provider as object);
  const receipt = byTxid?.get(txid);
  if (!receipt) {
    if (debugTiming) console.error('prepared-covenant-receipt', { result: 'miss', reason: 'transaction-bytes' });
    return false;
  }
  const preparedTransactionTxid = receipt.transaction === prepared.transaction
    ? receipt.txid
    : binToHex(hashTransactionUiOrder(encodeTransaction(prepared.transaction)));
  if (preparedTransactionTxid !== txid) {
    if (debugTiming) console.error('prepared-covenant-receipt', {
      result: 'miss', reason: 'prepared-transaction-bytes',
      expected: receipt.txid, actual: preparedTransactionTxid,
    });
    return false;
  }
  if (!sourceOutputsEqual(receipt.sourceOutputs, sourceOutputs)) {
    if (debugTiming) console.error('prepared-covenant-receipt', {
      result: 'miss', reason: 'source-outputs',
      expectedCount: receipt.sourceOutputs.length, actualCount: sourceOutputs.length,
    });
    return false;
  }
  byTxid!.delete(txid);
  if (debugTiming) console.error('prepared-covenant-receipt', { result: 'hit' });
  return true;
}
