import { encodeTransaction, encodeTransactionOutput } from '@bitauth/libauth';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, ORDINARY_LIMITS, measureInputs, refusedInputsAt,
} from './layer3-envelope-f1.js';
import type { Calibration, Estimate, GraphShapeSpec } from './layer3-estimator-f2.js';
import { estimate } from './layer3-estimator-f2.js';

/**
 * R1. THE SELECTED PRODUCTION ENVELOPE, AND THE GATE THAT ENFORCES IT.
 *
 * F1 measured where seven built shapes land. X49 put four of them in front of a real BCHN v29.0.0 node. F2
 * built an estimator that predicts before anything is built. This file turns those measurements into a
 * SELECTED boundary and a REFUSAL, which is a different kind of object from all three: a measurement reports,
 * an estimator advises, and a gate says no.
 *
 * THE THREE THINGS THAT DECIDED THE DESIGN, each of which is a measurement someone already paid for.
 *
 *  1. A DIFFERENT LIMIT BINDS FIRST FOR ALMOST EVERY SHAPE (F1). C1 and A13 bind on the 10,000-byte per-input
 *     script limit, C2 on operation-cost density, C3 on the 100,000-byte relay ceiling, the N=2 sweep on
 *     per-input SigChecks. A gate that checks one number would be wrong about four of the seven. Every rule
 *     below is therefore checked independently and every violated rule is reported, not just the first.
 *
 *  2. THE ONE REFUSAL NO CAPACITY MEASUREMENT WOULD EVER HAVE FOUND WAS DUST (X49). C1 is inside every
 *     capacity limit in the envelope and the node still refused it, because output 15 pays 10 satoshis to a
 *     one-byte `OP_1` script against a 474-satoshi threshold. It was invisible for the whole effort because
 *     the semantic profile sets `enforceDust: false` and `MockNetworkProvider` then sets
 *     `dustRelayFeePerKb: 0n`. A production envelope that models only capacity would have admitted a
 *     transaction the network refuses. Dust is therefore a first-class rule here.
 *
 *  3. THE GATE MUST READ THE REAL LIMITS, NOT THE PROVIDER'S. `preflightLayer3Transaction` evaluates every
 *     input against `createVirtualMachineBch2026ForProvider(builder.provider)`, and every Layer-3 test runs
 *     on a provider whose `consensusLimits` are the relaxed semantic profile. Against a 10,000,000-byte
 *     transaction ceiling and a 10,000,000-per-byte operation budget, an envelope check passes vacuously.
 *     `assessProductionEnvelope` never reads `provider.consensusLimits`; it reads the constants F1 pinned
 *     out of libauth. This is the difference between a gate and a gate-shaped hole.
 *
 * WHAT THIS FILE IS NOT. It is not wired into any send path - it holds no `src/` lease and changes no
 * behaviour. It is the specification of the gate plus an executable reference implementation, so the
 * placement decision can be made against something that runs rather than against a paragraph.
 */

/* ------------------------------------------------------------------------------------------------------ */
/* The envelope                                                                                             */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * How well each rule's threshold is known. This is about the RULE, not about any shape measured against it,
 * and it is separate from the board's SEMANTIC/CONSENSUS_FIT/POLICY_FIT ladder, which grades shapes.
 */
export type RuleEvidence =
  /** A BCHN v29.0.0 regtest node was measured refusing or accepting at this exact threshold. */
  | 'NODE_MEASURED'
  /** The threshold is a libauth BCH-2026 constant, pinned by F1 and re-pinned here. */
  | 'LIBAUTH_PINNED'
  /** Neither: the rule is included on the conservative side and its measurement is an open row. */
  | 'UNMEASURED_CONSERVATIVE';

export interface EnvelopeRule {
  /** Stable diagnostic name. A refusal quotes this, so it must never be reworded silently. */
  id: string;
  regime: 'consensus' | 'policy';
  scope: 'transaction' | 'input' | 'output';
  /** Whether the rule can be decided from the serialized bytes alone, with no VM evaluation. */
  cost: 'bytes' | 'vm';
  evidence: RuleEvidence;
  reason: string;
}

/**
 * THE SELECTED ENVELOPE, v1.
 *
 * Consensus rules are not a choice: a transaction that breaks one is invalid however it is transported.
 * Policy rules ARE a choice, and the choice made here is that the production envelope targets RELAY, not
 * mining. A shape inside consensus and outside policy - which is exactly C3 - is out of the envelope,
 * because an SDK that hands a user bytes no peer will forward has not built them a transaction.
 */
export const PRODUCTION_ENVELOPE_RULES: readonly EnvelopeRule[] = Object.freeze([
  {
    id: 'relay-transaction-size',
    regime: 'policy',
    scope: 'transaction',
    cost: 'bytes',
    evidence: 'NODE_MEASURED',
    reason: 'BCHN refuses a transaction over 100,000 serialized bytes with `64: tx-size` before it looks up '
      + 'inputs. X49 measured the boundary to the byte and separately mined the same bytes in a submitted '
      + 'block, so this is policy and not consensus.',
  },
  {
    id: 'output-dust',
    regime: 'policy',
    scope: 'output',
    cost: 'bytes',
    evidence: 'NODE_MEASURED',
    reason: 'BCHN refuses `64: dust` for any non-OP_RETURN output paying less than 3 * (serialized output '
      + 'bytes + 148) satoshis at the default 1,000 sat/kB dust relay fee. Measured on C1, whose 10-satoshi '
      + 'output to a one-byte script faced a 474-satoshi threshold.',
  },
  {
    id: 'scriptsig-push-only',
    regime: 'policy',
    scope: 'input',
    cost: 'bytes',
    evidence: 'NODE_MEASURED',
    reason: 'BCHN refuses `scriptsig-not-pushonly`. Enumerated as enforced by the node X49 measured.',
  },
  {
    id: 'input-unlocking-bytes',
    regime: 'consensus',
    scope: 'input',
    cost: 'bytes',
    evidence: 'LIBAUTH_PINNED',
    reason: 'Per-input unlocking bytecode is capped at 10,000 bytes. This is what binds C1 and A13 first. '
      + 'X49 separately accepted a 6,035-byte scriptSig on the node, so the legacy 1,650-byte standard limit '
      + 'is gone in v29 and the standard and consensus ceilings coincide.',
  },
  {
    id: 'consensus-transaction-size',
    regime: 'consensus',
    scope: 'transaction',
    cost: 'bytes',
    evidence: 'LIBAUTH_PINNED',
    reason: 'A transaction over 1,000,000 bytes is invalid at consensus. Subsumed by the relay ceiling while '
      + 'that is selected, and kept explicit so the two are never conflated again.',
  },
  {
    id: 'standard-locking-bytes',
    regime: 'policy',
    scope: 'output',
    cost: 'bytes',
    evidence: 'LIBAUTH_PINNED',
    reason: 'Standard output locking bytecode is capped at 201 bytes.',
  },
  {
    id: 'standard-output-template',
    regime: 'policy',
    scope: 'output',
    cost: 'bytes',
    evidence: 'UNMEASURED_CONSERVATIVE',
    reason: 'A mainnet BCHN refuses an output whose scriptPubKey matches no standard template. X49 measured '
      + 'that the REGTEST node does NOT enforce this, and did not measure a mainnet node, so the rule is '
      + 'included on the conservative side rather than on evidence. It costs the envelope nothing: every '
      + 'output the balanced layout produces is p2pkh, p2sh20, p2sh32 or OP_RETURN.',
  },
  {
    id: 'operation-cost-density',
    regime: 'consensus',
    scope: 'input',
    cost: 'vm',
    evidence: 'LIBAUTH_PINNED',
    reason: 'Operation cost may not exceed 800 per density byte. This is what binds C2 and the N=4/N=8 sweep '
      + 'first. Priced with the standard hash cost of 192 per iteration, which is the more expensive of the '
      + 'two regimes and therefore the one a relayed transaction is judged by.',
  },
  {
    id: 'hash-iteration-density',
    regime: 'consensus',
    scope: 'input',
    cost: 'vm',
    evidence: 'LIBAUTH_PINNED',
    reason: 'Hash digest iterations may not exceed 0.5 per density byte under standard rules or 3.5 under '
      + 'consensus rules. Both are checked; the standard allowance is 7x tighter and binds first.',
  },
  {
    id: 'per-input-sigchecks',
    regime: 'consensus',
    scope: 'input',
    cost: 'vm',
    evidence: 'LIBAUTH_PINNED',
    reason: 'An input may perform at most floor((unlocking bytes + 60) / 43) signature checks. This is what '
      + 'binds the N=2 sweep first, and libauth\'s nonstandard instruction set drops it, so it is computed '
      + 'here rather than left to the VM.',
  },
  {
    id: 'transaction-sigchecks',
    regime: 'consensus',
    scope: 'transaction',
    cost: 'vm',
    evidence: 'LIBAUTH_PINNED',
    reason: 'A transaction may perform at most 3,000 signature checks.',
  },
  {
    id: 'input-accepted',
    regime: 'consensus',
    scope: 'input',
    cost: 'vm',
    evidence: 'LIBAUTH_PINNED',
    reason: 'Every input must evaluate successfully at the real BCH-2026 limits in BOTH regimes, with nothing '
      + 'relaxed. A shape can be inside every ratio above and still be refused by a rule no ratio expresses.',
  },
]);

const ruleById = new Map(PRODUCTION_ENVELOPE_RULES.map((rule) => [rule.id, rule]));

/** Every rule id, so a caller can assert completeness rather than trust the list. */
export const PRODUCTION_ENVELOPE_RULE_IDS: readonly string[] =
  Object.freeze(PRODUCTION_ENVELOPE_RULES.map((rule) => rule.id));

/* ------------------------------------------------------------------------------------------------------ */
/* The dust rule                                                                                            */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * BCHN's dust threshold, restated as arithmetic: `3 * dustRelayFee.GetFee(GetSerializeSize(txout) + 148)`,
 * which at the default 1,000 sat/kB is `3 * serialized + 444`.
 *
 * THE SDK ALREADY COMPUTES EXACTLY THIS, in `calculateDust` at `packages/solidcash/src/utils.ts`, spelled
 * `444 + outputSize * 3`. So the reason a 10-satoshi output survived every measurement in this effort is not
 * a wrong formula. It is that `validateOutput` is handed `provider.policy?.enforceDust ?? true`, and the
 * Layer-3 semantic profile sets that to `false`. The rule was correct, present, and switched off.
 *
 * The 148 is the assumed cost of the input that will eventually spend the output, which is why the threshold
 * grows with the output's own size: a bigger output is more expensive to sweep. OP_RETURN outputs are exempt,
 * matching both BCHN's `IsStandardTx` and the SDK's own `validateOutput`.
 */
export const DUST_RELAY_FEE_PER_KB = 1_000;
export const DUST_SPEND_SIZE_ALLOWANCE = 148;

export interface LibauthOutput {
  lockingBytecode: Uint8Array;
  valueSatoshis: bigint;
  token?: unknown;
}

export const serializedOutputBytes = (output: LibauthOutput): number =>
  encodeTransactionOutput(output as never).length;

export function dustThresholdFor(output: LibauthOutput): number {
  const serialized = serializedOutputBytes(output);
  return Math.ceil(3 * (serialized + DUST_SPEND_SIZE_ALLOWANCE) * DUST_RELAY_FEE_PER_KB / 1_000);
}

export const isOpReturnOutput = (output: LibauthOutput): boolean =>
  output.lockingBytecode.length > 0 && output.lockingBytecode[0] === 0x6a;

/**
 * The standard output templates BCHN's `Solver` recognises, restricted to the ones the balanced layout can
 * actually produce. Bare multisig and non-standard scripts are deliberately absent.
 */
export function standardOutputTemplate(lockingBytecode: Uint8Array): string | undefined {
  const bytes = lockingBytecode;
  if (bytes.length > 0 && bytes[0] === 0x6a) return 'op-return';
  if (bytes.length === 25 && bytes[0] === 0x76 && bytes[1] === 0xa9 && bytes[2] === 0x14
    && bytes[23] === 0x88 && bytes[24] === 0xac) return 'p2pkh';
  if (bytes.length === 23 && bytes[0] === 0xa9 && bytes[1] === 0x14 && bytes[22] === 0x87) return 'p2sh20';
  if (bytes.length === 35 && bytes[0] === 0xaa && bytes[1] === 0x20 && bytes[34] === 0x87) return 'p2sh32';
  return undefined;
}

/**
 * A pure push sequence, which is what `scriptsig-not-pushonly` requires. Deliberately a SEPARATE function
 * from F2's `redeemScriptLength`, which returns 0 both for "not push-only" and for "an empty final push":
 * reusing it here would conflate a refusal with a legal empty push.
 */
export function isPushOnly(bytecode: Uint8Array): boolean {
  let cursor = 0;
  while (cursor < bytecode.length) {
    const opcode = bytecode[cursor];
    cursor += 1;
    let length: number;
    if (opcode <= 0x4b) length = opcode;
    else if (opcode === 0x4c) { length = bytecode[cursor]; cursor += 1; }
    else if (opcode === 0x4d) { length = bytecode[cursor] | (bytecode[cursor + 1] << 8); cursor += 2; }
    else if (opcode === 0x4e) {
      length = bytecode[cursor] | (bytecode[cursor + 1] << 8)
        | (bytecode[cursor + 2] << 16) | (bytecode[cursor + 3] << 24);
      cursor += 4;
    } else if (opcode === 0x4f || (opcode >= 0x51 && opcode <= 0x60)) length = 0;
    else return false;
    if (!Number.isFinite(length) || length < 0 || cursor + length > bytecode.length) return false;
    cursor += length;
  }
  return true;
}

/* ------------------------------------------------------------------------------------------------------ */
/* The build-time gate                                                                                      */
/* ------------------------------------------------------------------------------------------------------ */

export interface EnvelopeRefusal {
  rule: string;
  where: string;
  measured: number;
  allowed: number;
  /** How far past the limit, in the rule's own units. Always positive on a refusal. */
  overBy: number;
  detail: string;
}

export interface EnvelopeReading {
  rule: string;
  where: string;
  measured: number;
  allowed: number;
  ratio: number;
}

export interface ProductionEnvelopeVerdict {
  shape: string;
  admitted: boolean;
  /** Every violated rule, not only the first. A user shrinking one limit needs to know about the others. */
  refusals: EnvelopeRefusal[];
  /** Utilization of every rule that produced a number, ordered by ratio: the first is what binds. */
  readings: EnvelopeReading[];
  /** Rules that were not decided, with the reason. Non-empty means the verdict is INCOMPLETE, never ADMIT. */
  undecided: { rule: string; reason: string }[];
  serializedBytes: number;
  inputCount: number;
  outputCount: number;
}

export interface GateOptions {
  /**
   * Skip the VM rules. Byte rules alone decide `relay-transaction-size`, `output-dust`, the two bytecode
   * lengths, the output template and push-only, at zero VM cost. Every skipped rule is reported in
   * `undecided`, and `admitted` is FALSE whenever `undecided` is non-empty - a cheap check may narrow the
   * work, never widen the admission.
   */
  bytesOnly?: boolean;
}

const refuse = (
  refusals: EnvelopeRefusal[], rule: string, where: string, measured: number, allowed: number, detail: string,
): void => {
  refusals.push({ rule, where, measured, allowed, overBy: measured - allowed, detail });
};

/**
 * THE GATE. Decides one FINALIZED transaction against the selected envelope.
 *
 * It takes the built transaction and its source outputs and nothing else. In particular it does NOT take a
 * plan, a descriptor, a builder or a provider:
 *
 *   - not a plan, because the bytes are what the network judges and a plan is not the bytes. The same plan
 *     built twice can differ by an output, and one of the two can be refused;
 *   - not a provider, because `provider.consensusLimits` is exactly the thing that made every existing
 *     Layer-3 capacity check vacuous. The limits here are F1's pinned libauth constants and cannot be
 *     overridden by an argument.
 */
export function assessProductionEnvelope(
  shape: string,
  transaction: Parameters<typeof encodeTransaction>[0],
  sourceOutputs: Parameters<typeof measureInputs>[1],
  options: GateOptions = {},
): ProductionEnvelopeVerdict {
  const refusals: EnvelopeRefusal[] = [];
  const readings: EnvelopeReading[] = [];
  const undecided: { rule: string; reason: string }[] = [];
  const serializedBytes = encodeTransaction(transaction).length;

  /* --- transaction-scope byte rules --- */
  readings.push({
    rule: 'relay-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: BCH_2026_STANDARD.maximumTransactionSize,
    ratio: serializedBytes / BCH_2026_STANDARD.maximumTransactionSize,
  });
  if (serializedBytes > BCH_2026_STANDARD.maximumTransactionSize) {
    refuse(refusals, 'relay-transaction-size', 'transaction', serializedBytes,
      BCH_2026_STANDARD.maximumTransactionSize,
      `${serializedBytes - BCH_2026_STANDARD.maximumTransactionSize} bytes over the relay ceiling; the node `
      + 'refuses these bytes with `64: tx-size`');
  }
  readings.push({
    rule: 'consensus-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
    ratio: serializedBytes / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
  });
  if (serializedBytes > BCH_2026_CONSENSUS.maximumTransactionLengthBytes) {
    refuse(refusals, 'consensus-transaction-size', 'transaction', serializedBytes,
      BCH_2026_CONSENSUS.maximumTransactionLengthBytes, 'invalid at consensus, not merely unrelayable');
  }

  /* --- input-scope byte rules --- */
  let worstUnlocking = { input: -1, bytes: 0 };
  transaction.inputs.forEach((input, index) => {
    const bytes = input.unlockingBytecode.length;
    if (bytes > worstUnlocking.bytes) worstUnlocking = { input: index, bytes };
    if (bytes > BCH_2026_CONSENSUS.maximumBytecodeLength) {
      refuse(refusals, 'input-unlocking-bytes', `input ${index}`, bytes,
        BCH_2026_CONSENSUS.maximumBytecodeLength, 'unlocking bytecode over the per-input script limit');
    }
    if (!isPushOnly(input.unlockingBytecode)) {
      refuse(refusals, 'scriptsig-push-only', `input ${index}`, 1, 0,
        'unlocking bytecode is not a pure push sequence; the node refuses `scriptsig-not-pushonly`');
    }
  });
  readings.push({
    rule: 'input-unlocking-bytes',
    where: `input ${worstUnlocking.input}`,
    measured: worstUnlocking.bytes,
    allowed: BCH_2026_CONSENSUS.maximumBytecodeLength,
    ratio: worstUnlocking.bytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
  });

  /* --- output-scope byte rules --- */
  let worstDust = { output: -1, ratio: 0, satoshis: 0, threshold: 0 };
  let worstLocking = { output: -1, bytes: 0 };
  transaction.outputs.forEach((output, index) => {
    const locking = output.lockingBytecode.length;
    if (locking > worstLocking.bytes) worstLocking = { output: index, bytes: locking };
    if (locking > BCH_2026_STANDARD.maximumLockingBytecodeLength) {
      refuse(refusals, 'standard-locking-bytes', `output ${index}`, locking,
        BCH_2026_STANDARD.maximumLockingBytecodeLength, 'locking bytecode over the standard ceiling');
    }
    if (standardOutputTemplate(output.lockingBytecode) === undefined) {
      refuse(refusals, 'standard-output-template', `output ${index}`, 1, 0,
        'locking bytecode matches no standard template (p2pkh, p2sh20, p2sh32 or OP_RETURN)');
    }
    if (isOpReturnOutput(output as LibauthOutput)) return;
    const threshold = dustThresholdFor(output as LibauthOutput);
    const satoshis = Number(output.valueSatoshis);
    // Ratio inverted deliberately: dust is a FLOOR, so utilization is threshold-over-value and a value at
    // exactly the threshold reads 1.0000x like every other rule at its boundary.
    const ratio = satoshis === 0 ? Infinity : threshold / satoshis;
    if (ratio > worstDust.ratio) worstDust = { output: index, ratio, satoshis, threshold };
    if (satoshis < threshold) {
      refuse(refusals, 'output-dust', `output ${index}`, threshold, satoshis,
        `${threshold - satoshis} satoshis short of the ${threshold}-satoshi threshold for a `
        + `${serializedOutputBytes(output as LibauthOutput)}-byte output; the node refuses \`64: dust\``);
    }
  });
  readings.push({
    rule: 'standard-locking-bytes',
    where: `output ${worstLocking.output}`,
    measured: worstLocking.bytes,
    allowed: BCH_2026_STANDARD.maximumLockingBytecodeLength,
    ratio: worstLocking.bytes / BCH_2026_STANDARD.maximumLockingBytecodeLength,
  });
  if (worstDust.output >= 0) {
    readings.push({
      rule: 'output-dust',
      where: `output ${worstDust.output}`,
      measured: worstDust.threshold,
      allowed: worstDust.satoshis,
      ratio: worstDust.ratio,
    });
  }

  /* --- VM rules --- */
  const vmRules = PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.cost === 'vm').map((rule) => rule.id);
  if (options.bytesOnly === true) {
    for (const rule of vmRules) undecided.push({ rule, reason: 'bytesOnly: the VM rules were not evaluated' });
  } else {
    const rows = measureInputs(transaction as never, sourceOutputs);
    let worstCost = rows[0];
    let worstStandardHash = rows[0];
    let worstConsensusHash = rows[0];
    let worstSigCheck = rows[0];
    let totalSigChecks = 0;
    for (const row of rows) {
      if (row.standardCostRatio > worstCost.standardCostRatio) worstCost = row;
      if (row.standardHashRatio > worstStandardHash.standardHashRatio) worstStandardHash = row;
      if (row.consensusHashRatio > worstConsensusHash.consensusHashRatio) worstConsensusHash = row;
      if (row.signatureCheckRatio > worstSigCheck.signatureCheckRatio) worstSigCheck = row;
      totalSigChecks += row.signatureChecks;
      if (row.standardCostRatio > 1) {
        refuse(refusals, 'operation-cost-density', `input ${row.input}`, row.standardCost,
          row.densityBytes * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
          'operation cost exceeds 800 per density byte at the standard hash price of 192 per iteration');
      }
      if (row.standardHashRatio > 1 || row.consensusHashRatio > 1) {
        refuse(refusals, 'hash-iteration-density', `input ${row.input}`, row.hashIterations,
          Math.floor(row.densityBytes * BCH_2026_STANDARD.hashDigestIterationsPerByte),
          'hash digest iterations exceed the per-density-byte allowance');
      }
      if (row.signatureChecks > row.signatureCheckLimit) {
        refuse(refusals, 'per-input-sigchecks', `input ${row.input}`, row.signatureChecks,
          row.signatureCheckLimit, 'more signature checks than floor((unlocking bytes + 60) / 43) permits');
      }
    }
    readings.push(
      {
        rule: 'operation-cost-density',
        where: `input ${worstCost.input}`,
        measured: worstCost.standardCost,
        allowed: worstCost.densityBytes * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
        ratio: worstCost.standardCostRatio,
      },
      {
        rule: 'hash-iteration-density',
        where: `input ${worstStandardHash.input}`,
        measured: worstStandardHash.hashIterations,
        allowed: Math.floor(worstStandardHash.densityBytes * BCH_2026_STANDARD.hashDigestIterationsPerByte),
        ratio: Math.max(worstStandardHash.standardHashRatio, worstConsensusHash.consensusHashRatio),
      },
      {
        rule: 'per-input-sigchecks',
        where: `input ${worstSigCheck.input}`,
        measured: worstSigCheck.signatureChecks,
        allowed: worstSigCheck.signatureCheckLimit,
        ratio: worstSigCheck.signatureCheckRatio,
      },
      {
        rule: 'transaction-sigchecks',
        where: 'transaction',
        measured: totalSigChecks,
        allowed: BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
        ratio: totalSigChecks / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      },
    );
    if (totalSigChecks > BCH_2026_CONSENSUS.maximumTransactionSignatureChecks) {
      refuse(refusals, 'transaction-sigchecks', 'transaction', totalSigChecks,
        BCH_2026_CONSENSUS.maximumTransactionSignatureChecks, 'over the transaction signature-check ceiling');
    }
    // The direct question, asked last because it is the expensive one and because a shape can be inside
    // every ratio above and still be refused by a rule no ratio expresses.
    for (const regime of [true, false]) {
      for (const row of refusedInputsAt(transaction as never, sourceOutputs, regime, ORDINARY_LIMITS)) {
        refuse(refusals, 'input-accepted', `input ${row.input}`, 1, 0,
          `refused at the real ${regime ? 'standard' : 'consensus'} profile: ${row.error}`);
      }
    }
  }

  readings.sort((left, right) => right.ratio - left.ratio);
  return {
    shape,
    admitted: refusals.length === 0 && undecided.length === 0,
    refusals,
    readings,
    undecided,
    serializedBytes,
    inputCount: transaction.inputs.length,
    outputCount: transaction.outputs.length,
  };
}

export function formatVerdict(verdict: ProductionEnvelopeVerdict): string {
  const binding = verdict.readings[0];
  return [
    verdict.shape,
    verdict.admitted ? 'ADMITTED' : 'REFUSED',
    `inputs=${verdict.inputCount}`,
    `serialized=${verdict.serializedBytes}B`,
    binding === undefined ? 'binds=none' : `binds=${binding.rule} ${binding.ratio.toFixed(4)}x at ${binding.where}`,
    verdict.refusals.length === 0 ? 'refusals=none'
      : `refusals=${verdict.refusals.map((row) => `${row.rule}@${row.where}`).join(',')}`,
    verdict.undecided.length === 0 ? 'undecided=none' : `undecided=${verdict.undecided.length}`,
  ].join(' | ');
}

/* ------------------------------------------------------------------------------------------------------ */
/* The plan-time screen                                                                                    */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * WHY THE PLAN-TIME SCREEN CANNOT BE THE GATE, stated as the arithmetic that decides it.
 *
 * F2 is a conservative estimator, and conservative cuts BOTH ways once it is asked to refuse:
 *
 *   - it over-predicts in-sample by up to +41.6%, so refusing on `predicted > limit` refuses shapes that
 *     actually fit. A13 predicts 28,938 bytes and measures 23,845; at any ceiling between those two, a
 *     prediction-based refusal is a FALSE REFUSAL of a shape the network would accept;
 *   - it under-predicts OUT of sample by up to 12.3% on a row it called in range, so admitting on
 *     `predicted <= limit` admits shapes that are actually over. A design predicted at 95,000 bytes can
 *     measure 100,000-and-something and be refused by the node the SDK just told it would be fine.
 *
 * So the screen produces three verdicts and only one of them is a refusal:
 *
 *   CLEAR   predicted <= limit / (1 + underPredictionAllowance). Even the worst measured under-prediction
 *           leaves the shape inside. NOT a guarantee - the build-time gate is still authoritative.
 *   WARN    between the two thresholds. The estimator cannot separate fit from overrun here, and says so
 *           instead of guessing.
 *   REFUSE  predicted > limit * (1 + overPredictionAllowance). No measured over-prediction can explain the
 *           gap, so the shape is over whatever the estimator's error happens to be on it.
 *
 * BOTH allowances are MEASURED, not chosen. `Layer3ProductionEnvelopeR1.test.ts` re-derives them from the
 * calibration at the commit it runs at rather than reading a recorded number, because F1's costed fix for C3
 * stopped working the moment its figure moved.
 */
export interface ScreenAllowances {
  /** Worst measured out-of-sample UNDER-prediction, as a positive fraction. Sets the CLEAR threshold. */
  underPrediction: number;
  /** Worst measured in-sample OVER-prediction, as a positive fraction. Sets the REFUSE threshold. */
  overPrediction: number;
}

export type ScreenVerdict = 'CLEAR' | 'WARN' | 'REFUSE';

export interface PlanScreen {
  shape: string;
  verdict: ScreenVerdict;
  /** Per limit, in the estimator's own order. */
  rows: {
    limit: string;
    predicted: number;
    allowed: number;
    clearAt: number;
    refuseAt: number;
    verdict: ScreenVerdict;
  }[];
  /** Drivers outside the calibrated range. Non-empty forces WARN at best: an extrapolation is not evidence. */
  outOfRange: string[];
  estimate: Estimate;
}

export function screenProductionEnvelope(
  spec: GraphShapeSpec, calibration: Calibration, allowances: ScreenAllowances,
): PlanScreen {
  const prediction = estimate(spec, calibration);
  const rows = prediction.limits.map((limit) => {
    const clearAt = limit.allowed / (1 + allowances.underPrediction);
    const refuseAt = limit.allowed * (1 + allowances.overPrediction);
    let verdict: ScreenVerdict = 'WARN';
    if (limit.predicted <= clearAt) verdict = 'CLEAR';
    else if (limit.predicted > refuseAt) verdict = 'REFUSE';
    return { limit: limit.limit, predicted: limit.predicted, allowed: limit.allowed, clearAt, refuseAt, verdict };
  });
  // A single REFUSE decides the shape; otherwise a single WARN downgrades it. An out-of-range driver can
  // never be CLEAR, because an upper envelope carries no guarantee outside the range it was fitted on.
  let verdict: ScreenVerdict = 'CLEAR';
  if (rows.some((row) => row.verdict === 'REFUSE')) verdict = 'REFUSE';
  else if (rows.some((row) => row.verdict === 'WARN') || prediction.outOfRange.length > 0) verdict = 'WARN';
  return { shape: spec.name, verdict, rows, outOfRange: prediction.outOfRange, estimate: prediction };
}

export function formatScreen(screen: PlanScreen): string {
  const worst = screen.rows[0];
  return [
    screen.shape,
    screen.verdict,
    `binds=${worst.limit}`,
    `predicted=${worst.predicted.toFixed(0)}`,
    `clearAt=${worst.clearAt.toFixed(0)}`,
    `refuseAt=${worst.refuseAt.toFixed(0)}`,
    screen.outOfRange.length === 0 ? 'in-range' : `OUT-OF-RANGE(${screen.outOfRange.length})`,
  ].join(' | ');
}

/** Look a rule up by the id a refusal quotes, so a caller can check a diagnostic against its rule. */
export const envelopeRule = (id: string): EnvelopeRule | undefined => ruleById.get(id);
