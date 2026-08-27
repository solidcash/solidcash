import {
  binToHex, encodeTransaction, hashTransactionUiOrder,
  type Output as LibauthOutput,
} from '@bitauth/libauth';
import {
  checkAbsurdFee, checkCoinbaseMaturity, checkDustOutputs, checkInputValueRanges,
  checkLocktimeFinality, checkMinRelayFee, checkNullPrevout, checkSequenceLocks,
  checkUnspendableInputs, DEFAULT_MAX_FEE, DEFAULT_MIN_RELAY_FEE_PER_KB,
  DUST_RELAY_FEE_PER_KB, MAX_MONEY,
  type ChainState, type SourceOutput, type Transaction, type TxVerifier, type TxVerifierConfig,
  type VerifyFailure,
} from '@mem-cash/validation';
import { REJECT_INVALID, REJECT_NONSTANDARD } from '@mem-cash/types';
import type NetworkProvider from './NetworkProvider.js';
import type { PreparedTransaction } from './NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from './createVirtualMachine.js';

type PipelineSuccess = {
  ok: true;
  decoded: Transaction;
  encodedBytes: Uint8Array;
  fee: bigint;
  txid: string;
};
type PipelineResult = PipelineSuccess | ({ ok: false } & VerifyFailure);

type CovenantSourceOutput = Pick<LibauthOutput, 'lockingBytecode' | 'valueSatoshis' | 'token'>;

interface PreparedCovenantValidation {
  txid: string;
  transaction: PreparedTransaction['transaction'];
  sourceOutputs: readonly CovenantSourceOutput[];
}

// The SDK's exact-finalization gate and MockNetworkProvider run in one process. Retain a one-use receipt for a
// transaction whose every input has already passed the provider-configured BCH-2026 VM, avoiding the identical
// VM pass at submission. Bind the receipt to provider identity, transaction bytes, and every source output.
// Exact transaction-object reuse is the zero-cost path; builders that deterministically reconstruct the same
// transaction may reuse the receipt only after their reconstructed object is independently hashed. All non-VM
// node checks still run in the verifier below.
const preparedCovenantValidations = new WeakMap<object, Map<string, PreparedCovenantValidation>>();
const maximumPreparedCovenantValidationsPerProvider = 256;

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

const toFailure = (failure: Exclude<PipelineResult, PipelineSuccess>): VerifyFailure => ({
  success: false,
  code: failure.code,
  error: failure.error,
  ...(failure.debugMessage === undefined ? {} : { debugMessage: failure.debugMessage }),
});

const toVmOutputs = (sourceOutputs: readonly SourceOutput[]): LibauthOutput[] => sourceOutputs.map((output) => ({
  lockingBytecode: output.lockingBytecode,
  valueSatoshis: output.valueSatoshis,
  ...(output.token === undefined ? {} : { token: output.token }),
}));

/**
 * Prepared-transaction adapter for mem-cash 0.0.8's verification pipeline.
 *
 * The core node has already decoded the raw transaction once to resolve its source outputs. SDK builders can
 * additionally provide that same decoded transaction, avoiding the verifier's second decode/re-encode cycle.
 * Every pre-VM check and its ordering mirrors mem-cash 0.0.8; calls without an exact prepared match delegate to
 * the stock verifier. This adapter is only selected for oversized BCH-2026 mock profiles at its call site.
 */
export function createPreparedBch2026TxVerifier(
  provider: NetworkProvider,
  config: TxVerifierConfig,
  getPrepared: () => PreparedTransaction | undefined,
  fallback: TxVerifier,
): TxVerifier {
  const standard = config.standard ?? true;
  const minRelayFeePerKb = config.minRelayFeePerKb ?? DEFAULT_MIN_RELAY_FEE_PER_KB;
  const maxFee = config.maxFee ?? DEFAULT_MAX_FEE;
  const skipFeePolicy = config.skipFeePolicy ?? false;
  const dustRelayFeePerKb = config.dustRelayFeePerKb ?? DUST_RELAY_FEE_PER_KB;
  if (minRelayFeePerKb <= 0n) throw new Error('minRelayFeePerKb must be positive');
  if (maxFee <= 0n) throw new Error('maxFee must be positive');

  const vm = createVirtualMachineBch2026ForProvider(provider, undefined, { standard });
  const consensusVm = standard
    ? createVirtualMachineBch2026ForProvider(provider, undefined, { standard: false })
    : undefined;

  const preVmPipeline = (
    prepared: PreparedTransaction,
    sourceOutputs: readonly SourceOutput[],
    chainState: ChainState,
  ): PipelineResult => {
    const decoded = prepared.transaction as Transaction;
    const spendHeight = chainState.height + 1;
    const nullCheck = checkNullPrevout(decoded.inputs.map((input) => ({
      txid: binToHex(input.outpointTransactionHash), vout: input.outpointIndex,
    })));
    if (!nullCheck.ok) return { success: false, ...nullCheck };
    if (sourceOutputs.length !== decoded.inputs.length) {
      return {
        ok: false, success: false, code: REJECT_INVALID,
        error: 'bad-txns-inputs-missingorspent',
        debugMessage: `sourceOutputs length (${sourceOutputs.length}) does not match inputs length (${decoded.inputs.length})`,
      };
    }
    const finality = checkLocktimeFinality(
      decoded.locktime, decoded.inputs, spendHeight, chainState.medianTimePast,
    );
    if (!finality.ok) return { success: false, ...finality };
    const encodedBytes = prepared.rawBytes;
    const txid = binToHex(hashTransactionUiOrder(encodedBytes));
    const maturity = checkCoinbaseMaturity(sourceOutputs.map((output) => ({
      isCoinbase: output.isCoinbase, height: output.height ?? 1,
    })), spendHeight);
    if (!maturity.ok) return { success: false, ...maturity };
    const spendable = checkUnspendableInputs(sourceOutputs);
    if (!spendable.ok) return { success: false, ...spendable };
    const values = checkInputValueRanges(sourceOutputs.map((output) => output.valueSatoshis));
    if (!values.ok) return { success: false, ...values };

    const inputSum = sourceOutputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
    let outputSum = 0n;
    for (const output of decoded.outputs) {
      if (output.valueSatoshis < 0n || output.valueSatoshis > MAX_MONEY) {
        return {
          ok: false, success: false, code: REJECT_INVALID,
          error: 'bad-txns-outputvalues-outofrange',
        };
      }
      outputSum += output.valueSatoshis;
      if (outputSum > MAX_MONEY) {
        return {
          ok: false, success: false, code: REJECT_INVALID,
          error: 'bad-txns-outputvalues-outofrange',
        };
      }
    }
    const fee = inputSum - outputSum;
    if (fee < 0n) {
      return {
        ok: false, success: false, code: REJECT_INVALID, error: 'bad-txns-in-belowout',
        debugMessage: `value in (${inputSum}) < value out (${outputSum})`,
      };
    }
    const sequence = checkSequenceLocks(decoded.version, sourceOutputs.map((output, index) => ({
      sequenceNumber: decoded.inputs[index]?.sequenceNumber ?? 0xffffffff,
      height: output.height ?? 1,
      ...(output.medianTimePast === undefined ? {} : { medianTimePast: output.medianTimePast }),
    })), spendHeight, chainState.medianTimePast);
    if (!sequence.ok) return { success: false, ...sequence };
    if (!skipFeePolicy) {
      const minimumFee = checkMinRelayFee(fee, encodedBytes.length, minRelayFeePerKb);
      if (!minimumFee.ok) return { success: false, ...minimumFee };
      const absurdFee = checkAbsurdFee(fee, maxFee);
      if (!absurdFee.ok) return { success: false, ...absurdFee };
    }
    if (standard) {
      const dust = checkDustOutputs(decoded.outputs, dustRelayFeePerKb);
      if (!dust.ok) return { success: false, ...dust };
    }
    return { ok: true, decoded, encodedBytes, fee, txid };
  };

  const classifyScriptError = (
    primaryError: string,
    consensusCheck: () => true | string,
  ): Pick<VerifyFailure, 'code' | 'error'> => {
    if (consensusVm) {
      const consensusResult = consensusCheck();
      return consensusResult === true
        ? { code: REJECT_NONSTANDARD, error: `non-mandatory-script-verify-flag (${primaryError})` }
        : { code: REJECT_INVALID, error: `mandatory-script-verify-flag-failed (${consensusResult})` };
    }
    return { code: REJECT_INVALID, error: `mandatory-script-verify-flag-failed (${primaryError})` };
  };

  const verify: TxVerifier['verify'] = (rawHex, sourceOutputs, chainState) => {
    const prepared = getPrepared();
    if (prepared === undefined || prepared.rawHex !== rawHex) {
      return fallback.verify(rawHex, sourceOutputs, chainState);
    }
    const pipeline = preVmPipeline(prepared, sourceOutputs, chainState);
    if (!pipeline.ok) return toFailure(pipeline);
    if (!consumePreparedCovenantValidation(provider, prepared, sourceOutputs, pipeline.txid)) {
      const vmOutputs = toVmOutputs(sourceOutputs);
      const resolved = { sourceOutputs: vmOutputs, transaction: pipeline.decoded };
      const result = vm.verify(resolved);
      if (result !== true) {
        const classified = classifyScriptError(result, () => consensusVm?.verify(resolved) ?? result);
        return { success: false, ...classified };
      }
    }
    const validatedTx = {
      txid: pipeline.txid,
      rawHex,
      fee: pipeline.fee,
      size: pipeline.encodedBytes.length,
      transaction: pipeline.decoded,
      sourceOutputs,
    };
    return {
      success: true,
      txid: pipeline.txid,
      fee: pipeline.fee,
      size: pipeline.encodedBytes.length,
      validatedTx,
    };
  };

  return { verify, debug: fallback.debug };
}
