import {
  encodeTransaction, encodeTransactionInput, encodeTransactionOutput,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';

/**
 * F1 MEASUREMENT LIBRARY. Reports where a composed Layer-3 transaction sits against the REAL BCH-2026
 * consensus limits and the REAL BCH-2026 standard relay limits. It measures; it changes no behaviour.
 *
 * Three things this library exists to keep straight, each of which has already produced a wrong number on
 * this board:
 *
 *  1. AN ABORTED EVALUATION REPORTS THE BUDGET BACK, NOT THE COST. libauth checks operation-cost density
 *     after every operation and aborts on the first excess, so a cost read off a failed evaluation is always
 *     within one operation of the budget however much work remained. Every cost here is measured RUN TO
 *     COMPLETION on a relaxed density ceiling, with every other consensus knob at its real value.
 *
 *  2. "FITS" AND "RELAYABLE" ARE DIFFERENT CLAIMS. Consensus allows a 1,000,000-byte transaction; standard
 *     relay policy allows 100,000. A shape can pass every consensus knob and still never propagate.
 *
 *  3. STANDARD AND CONSENSUS PRICE HASHING DIFFERENTLY, IN BOTH DIRECTIONS. A hash digest iteration costs
 *     192 under standard rules and 64 under consensus rules, so the same script has a HIGHER operation cost
 *     when relayed than when mined directly. The iteration BUDGET runs the other way: 0.5 iterations per
 *     density byte under standard rules against 3.5 under consensus, a 7x tighter allowance. Neither figure
 *     can be substituted for the other, and a single "hashDigestIterationsPerByte" knob cannot express both.
 */

/** Real BCH-2026 consensus limits, read from libauth rather than restated, so a libauth bump is visible. */
export const BCH_2026_CONSENSUS = {
  maximumBytecodeLength: ConsensusBch2026.maximumBytecodeLength,
  maximumTransactionLengthBytes: ConsensusBch2026.maximumTransactionLengthBytes,
  maximumStackItemLength: ConsensusBch2026.maximumStackItemLength,
  maximumTokenCommitmentLength: ConsensusBch2026.maximumTokenCommitmentLength,
  maximumTransactionSignatureChecks: ConsensusBch2026.maximumTransactionSignatureChecks,
  operationCostBudgetPerByte: ConsensusBch2026.operationCostBudgetPerByte,
  densityControlBaseLength: ConsensusBch2026.densityControlBaseLength,
  hashDigestIterationsPerByte: ConsensusBch2026.hashDigestIterationsPerByteNonstandard,
  hashDigestIterationCost: ConsensusBch2026.hashDigestIterationCostConsensus,
} as const;

/** Real BCH-2026 standard (relay policy) limits, likewise read from libauth. */
export const BCH_2026_STANDARD = {
  maximumTransactionSize: ConsensusBch2026.maximumStandardTransactionSize,
  maximumUnlockingBytecodeLength: ConsensusBch2026.maximumStandardUnlockingBytecodeLength,
  maximumLockingBytecodeLength: ConsensusBch2026.maximumStandardLockingBytecodeLength,
  hashDigestIterationsPerByte: ConsensusBch2026.hashDigestIterationsPerByteStandard,
  hashDigestIterationCost: ConsensusBch2026.hashDigestIterationCostStandard,
} as const;

/**
 * Relaxed ceiling for run-to-completion reads. ONLY the two density budgets move; the byte, stack-item,
 * commitment and transaction-length knobs stay at their real consensus values so nothing real is masked.
 */
export const RUN_TO_COMPLETION_LIMITS = {
  maximumInputBytes: BCH_2026_CONSENSUS.maximumBytecodeLength,
  maximumStackItemBytes: BCH_2026_CONSENSUS.maximumStackItemLength,
  maximumTransactionBytes: BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
  maximumNftCommitmentBytes: BCH_2026_CONSENSUS.maximumTokenCommitmentLength,
  operationCostBudgetPerByte: 800_000,
  hashDigestIterationsPerByte: 3_000,
} as const;

export interface InputMeasurement {
  input: number;
  /** Unlocking bytecode length: the byte figure both density budgets are computed from. */
  unlockingBytes: number;
  /** `densityControlBaseLength` + unlocking bytecode length. */
  densityBytes: number;
  /** Operation cost as libauth reports it, i.e. priced with the STANDARD hash-iteration cost of 192. */
  standardCost: number;
  /** The same evaluation repriced with the CONSENSUS hash-iteration cost of 64. */
  consensusCost: number;
  standardCostRatio: number;
  consensusCostRatio: number;
  hashIterations: number;
  standardHashRatio: number;
  consensusHashRatio: number;
  signatureChecks: number;
  /** Per-input SigChecks allowance: `floor((unlockingBytes + 60) / 43)`. */
  signatureCheckLimit: number;
  signatureCheckRatio: number;
  unlockingBytesRatio: number;
  instructions: number;
  pushedBytes: number;
  arithmetic: number;
}

export interface EnvelopeMeasurement {
  shape: string;
  inputCount: number;
  outputCount: number;
  serializedBytes: number;
  standardSizeRatio: number;
  consensusSizeRatio: number;
  totalSignatureChecks: number;
  totalSignatureCheckRatio: number;
  /** Largest output locking bytecode, against the 2026 standard 201-byte allowance. */
  maximumLockingBytes: number;
  lockingBytesRatio: number;
  /** Serialized bytes contributed by each input and each output, so a size overrun can be costed exactly. */
  inputSerializedBytes: number[];
  outputSerializedBytes: number[];
  /** Bytes the standard relay ceiling is exceeded by; zero or negative when the shape is inside it. */
  standardSizeOverrun: number;
  inputs: InputMeasurement[];
  worstCostInput: InputMeasurement;
  worstHashInput: InputMeasurement;
  worstUnlockingInput: InputMeasurement;
  /** Every limit this shape is measured against, ordered by utilization: the first one binds. */
  binding: BindingLimit[];
}

export interface BindingLimit {
  limit: string;
  regime: 'consensus' | 'standard';
  measured: number;
  allowed: number;
  ratio: number;
  /** What the measurement is attributed to: a named input, or the whole transaction. */
  where: string;
}

const COST_DELTA_PER_ITERATION =
  BCH_2026_STANDARD.hashDigestIterationCost - BCH_2026_CONSENSUS.hashDigestIterationCost;

/**
 * Measure every input of an already-built transaction, run to completion. The transaction is NOT rebuilt, so
 * the same bytes and the same density control length are what both regimes are assessed against.
 */
export function measureInputs(
  transaction: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0]['transaction'],
  sourceOutputs: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0]['sourceOutputs'],
): InputMeasurement[] {
  const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: RUN_TO_COMPLETION_LIMITS } as never);
  return transaction.inputs.map((_input, input) => {
    const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as never as {
      error?: string;
      metrics: Record<string, number>;
    };
    if (state.error !== undefined) {
      throw new Error(`run-to-completion evaluation still failed at input ${input}: ${state.error}`);
    }
    const metrics = state.metrics;
    const densityBytes = metrics.densityControlLength;
    const unlockingBytes = densityBytes - BCH_2026_CONSENSUS.densityControlBaseLength;
    const budget = densityBytes * BCH_2026_CONSENSUS.operationCostBudgetPerByte;
    const standardCost = metrics.operationCost;
    const hashIterations = metrics.hashDigestIterations;
    const consensusCost = standardCost - hashIterations * COST_DELTA_PER_ITERATION;
    const signatureCheckLimit = Math.floor((unlockingBytes + 60) / 43);
    return {
      input,
      unlockingBytes,
      densityBytes,
      standardCost,
      consensusCost,
      standardCostRatio: standardCost / budget,
      consensusCostRatio: consensusCost / budget,
      hashIterations,
      standardHashRatio: hashIterations / (densityBytes * BCH_2026_STANDARD.hashDigestIterationsPerByte),
      consensusHashRatio: hashIterations / (densityBytes * BCH_2026_CONSENSUS.hashDigestIterationsPerByte),
      signatureChecks: metrics.signatureCheckCount,
      signatureCheckLimit,
      signatureCheckRatio: metrics.signatureCheckCount / signatureCheckLimit,
      unlockingBytesRatio: unlockingBytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
      instructions: metrics.evaluatedInstructionCount,
      pushedBytes: metrics.stackPushedBytes,
      arithmetic: metrics.arithmeticCost,
    };
  });
}

const worstBy = (
  rows: InputMeasurement[], key: (row: InputMeasurement) => number,
): InputMeasurement => rows.reduce((left, right) => (key(right) > key(left) ? right : left));

/** Assemble the full envelope for one built transaction and rank every limit by utilization. */
export function assessEnvelope(
  shape: string,
  transaction: Parameters<typeof encodeTransaction>[0],
  sourceOutputs: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0]['sourceOutputs'],
): EnvelopeMeasurement {
  const inputs = measureInputs(transaction as never, sourceOutputs);
  const serializedBytes = encodeTransaction(transaction).length;
  const totalSignatureChecks = inputs.reduce((sum, row) => sum + row.signatureChecks, 0);
  const maximumLockingBytes = Math.max(
    ...transaction.outputs.map((output) => output.lockingBytecode.length),
  );
  const worstCostInput = worstBy(inputs, (row) => row.standardCostRatio);
  const worstHashInput = worstBy(inputs, (row) => row.standardHashRatio);
  const worstUnlockingInput = worstBy(inputs, (row) => row.unlockingBytesRatio);
  const worstSigCheckInput = worstBy(inputs, (row) => row.signatureCheckRatio);
  const worstConsensusCostInput = worstBy(inputs, (row) => row.consensusCostRatio);
  const worstConsensusHashInput = worstBy(inputs, (row) => row.consensusHashRatio);
  const binding: BindingLimit[] = [
    {
      limit: 'standard transaction size',
      regime: 'standard',
      measured: serializedBytes,
      allowed: BCH_2026_STANDARD.maximumTransactionSize,
      ratio: serializedBytes / BCH_2026_STANDARD.maximumTransactionSize,
      where: 'transaction',
    },
    {
      limit: 'consensus transaction size',
      regime: 'consensus',
      measured: serializedBytes,
      allowed: BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      ratio: serializedBytes / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      where: 'transaction',
    },
    {
      limit: 'standard hash-iteration density',
      regime: 'standard',
      measured: worstHashInput.hashIterations,
      allowed: Math.floor(
        worstHashInput.densityBytes * BCH_2026_STANDARD.hashDigestIterationsPerByte,
      ),
      ratio: worstHashInput.standardHashRatio,
      where: `input ${worstHashInput.input}`,
    },
    {
      limit: 'consensus hash-iteration density',
      regime: 'consensus',
      measured: worstConsensusHashInput.hashIterations,
      allowed: Math.floor(
        worstConsensusHashInput.densityBytes * BCH_2026_CONSENSUS.hashDigestIterationsPerByte,
      ),
      ratio: worstConsensusHashInput.consensusHashRatio,
      where: `input ${worstConsensusHashInput.input}`,
    },
    {
      limit: 'operation-cost density (standard hash pricing)',
      regime: 'standard',
      measured: worstCostInput.standardCost,
      allowed: worstCostInput.densityBytes * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      ratio: worstCostInput.standardCostRatio,
      where: `input ${worstCostInput.input}`,
    },
    {
      limit: 'operation-cost density (consensus hash pricing)',
      regime: 'consensus',
      measured: worstConsensusCostInput.consensusCost,
      allowed: worstConsensusCostInput.densityBytes * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      ratio: worstConsensusCostInput.consensusCostRatio,
      where: `input ${worstConsensusCostInput.input}`,
    },
    {
      limit: 'unlocking bytecode length',
      regime: 'consensus',
      measured: worstUnlockingInput.unlockingBytes,
      allowed: BCH_2026_CONSENSUS.maximumBytecodeLength,
      ratio: worstUnlockingInput.unlockingBytesRatio,
      where: `input ${worstUnlockingInput.input}`,
    },
    {
      limit: 'standard unlocking bytecode length',
      regime: 'standard',
      measured: worstUnlockingInput.unlockingBytes,
      allowed: BCH_2026_STANDARD.maximumUnlockingBytecodeLength,
      ratio: worstUnlockingInput.unlockingBytes / BCH_2026_STANDARD.maximumUnlockingBytecodeLength,
      where: `input ${worstUnlockingInput.input}`,
    },
    {
      limit: 'standard locking bytecode length',
      regime: 'standard',
      measured: maximumLockingBytes,
      allowed: BCH_2026_STANDARD.maximumLockingBytecodeLength,
      ratio: maximumLockingBytes / BCH_2026_STANDARD.maximumLockingBytecodeLength,
      where: 'widest output',
    },
    {
      limit: 'per-input SigChecks',
      regime: 'consensus',
      measured: worstSigCheckInput.signatureChecks,
      allowed: worstSigCheckInput.signatureCheckLimit,
      ratio: worstSigCheckInput.signatureCheckRatio,
      where: `input ${worstSigCheckInput.input}`,
    },
    {
      limit: 'transaction SigChecks',
      regime: 'consensus',
      measured: totalSignatureChecks,
      allowed: BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      ratio: totalSignatureChecks / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      where: 'transaction',
    },
  ].sort((left, right) => right.ratio - left.ratio);
  return {
    shape,
    inputCount: transaction.inputs.length,
    outputCount: transaction.outputs.length,
    serializedBytes,
    inputSerializedBytes: transaction.inputs.map((input) => encodeTransactionInput(input).length),
    outputSerializedBytes: transaction.outputs.map((output) => encodeTransactionOutput(output).length),
    standardSizeOverrun: serializedBytes - BCH_2026_STANDARD.maximumTransactionSize,
    standardSizeRatio: serializedBytes / BCH_2026_STANDARD.maximumTransactionSize,
    consensusSizeRatio: serializedBytes / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
    totalSignatureChecks,
    totalSignatureCheckRatio: totalSignatureChecks / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
    maximumLockingBytes,
    lockingBytesRatio: maximumLockingBytes / BCH_2026_STANDARD.maximumLockingBytecodeLength,
    inputs,
    worstCostInput,
    worstHashInput,
    worstUnlockingInput,
    binding,
  };
}

/**
 * The budget at which an input MUST be refused: half the density it was measured to actually need. A fixed
 * fraction of the ordinary 800 is not good enough as a control - a shape measured at 0.22x survives a
 * four-fold cut and the control then proves nothing - so the control budget is derived from the reading.
 */
export function knobControlBudgetFor(row: InputMeasurement): number {
  return Math.max(1, Math.floor(row.standardCost / row.densityBytes / 2));
}

/**
 * THE KNOB-LIVENESS CONTROL. "Inside capacity at 800/byte" is only evidence if the budget knob can refuse
 * these exact bytes. Same transaction, same source outputs, a budget the input provably cannot meet: it must
 * now fail on density. Without this, an accepted reading may only mean the evaluation never ran.
 */
export function densityKnobControl(
  transaction: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0]['transaction'],
  sourceOutputs: Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0]['sourceOutputs'],
  input: number,
  operationCostBudgetPerByte = 200,
): string | undefined {
  const vm = createVirtualMachineBch2026ForProvider({
    consensusLimits: { ...RUN_TO_COMPLETION_LIMITS, operationCostBudgetPerByte },
  } as never);
  const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as never as { error?: string };
  return state.error;
}

/** One line per shape, for a console table that reads the same way as the board's envelope table. */
export function formatEnvelope(envelope: EnvelopeMeasurement): string {
  const first = envelope.binding[0];
  return [
    `${envelope.shape}`,
    `inputs=${envelope.inputCount}`,
    `serialized=${envelope.serializedBytes}B`,
    `stdSize=${(envelope.standardSizeRatio * 100).toFixed(1)}%`,
    `worstCost=input ${envelope.worstCostInput.input} @ ${envelope.worstCostInput.standardCostRatio.toFixed(4)}x`,
    `worstHash=input ${envelope.worstHashInput.input} @ ${envelope.worstHashInput.standardHashRatio.toFixed(4)}x`,
    `binds=${first.limit} (${first.regime}) ${first.ratio.toFixed(4)}x at ${first.where}`,
  ].join(' | ');
}
