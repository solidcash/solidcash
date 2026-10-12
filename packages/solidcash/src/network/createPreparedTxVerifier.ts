import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { hashTransactionUiOrder } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Output as LibauthOutput } from '@bitauth/libauth/build/lib/message/transaction-types.js';
import { verifyTransactionTokens } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-tokens.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
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
import { consumePreparedCovenantValidation } from './prepared-covenant-receipt.js';

type PipelineSuccess = {
  ok: true;
  decoded: Transaction;
  encodedBytes: Uint8Array;
  fee: bigint;
  txid: string;
};
type PipelineResult = PipelineSuccess | ({ ok: false } & VerifyFailure);
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
 * Prepared-transaction adapter for mem-cash 0.0.10's verification pipeline.
 *
 * The core node has already decoded the raw transaction once to resolve its source outputs. SDK builders can
 * additionally provide that same decoded transaction, avoiding the verifier's second decode/re-encode cycle.
 * Every pre-VM check and its ordering mirrors mem-cash 0.0.10; calls without an exact prepared match delegate to
 * the stock verifier. This adapter is selected for every BCH-2026 mock profile at its call site.
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

  const maximumTokenCommitmentLength = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? ConsensusBch2026.maximumTokenCommitmentLength;
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
    const vmOutputs = toVmOutputs(sourceOutputs);
    // A receipt covers the inputs' evaluation only: the token rules, commitment length included, are checked here
    // as `verify` checks them, and a refusal takes the full pass so its error is the one `verify` gives.
    if (!consumePreparedCovenantValidation(provider, prepared, sourceOutputs, pipeline.txid)
      || verifyTransactionTokens(pipeline.decoded, vmOutputs, { maximumTokenCommitmentLength }) !== true) {
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
