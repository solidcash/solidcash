import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, encodeTransactionOutput, hash256, hexToBin,
  type AuthenticationProgramStateCommon, type Output, type Transaction,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../stateful/balancedBlocks.js';
import type { BalancedAssembly, BalancedAssemblyOptions } from '../stateful/balancedBlocks.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { assertGraphTrailingCapacity, type GraphTrailingRegion } from './graph.js';

/**
 * Measure each participant's ACTUAL runtime-resource run off the unsigned builder, and refuse a run the
 * balanced model cannot describe.
 *
 * `assertGraphTrailingCapacity` is the rule; this is what makes it a gate instead of a capability the composer
 * must remember to invoke. The composer never declares its run: it is read from the transaction, so stripping
 * the declaration cannot silence the check.
 *
 * WHAT COUNTS. A run is the contiguous prefix of token-bearing outputs starting at the region's first slot -
 * one per dynamic-storage chunk, loop entry or loop sidecar. Inside the declared region every token output
 * counts, because the region is that participant's private space. PAST the region a token output counts only
 * when it carries the participant's own state category (read off its master input) AND is not explained as
 * another block's master output. That second clause is what catches the shape the model could not otherwise
 * see: with two dynamic participants, an over-capacity run spills into the NEXT participant's block, where
 * neither the token-outside-the-region rule nor the input/output balance rule fires, and only the VM objects.
 *
 * It under-counts rather than over-counts wherever the evidence is ambiguous - a trailing output minted under
 * some other category, or a next participant sharing this one's category - so it never manufactures a refusal
 * for a transaction the covenants would have accepted. Nor does it manufacture one past the LAST block: a
 * claimed output there is already refused by the token-outside-the-region rule below, so the only thing that
 * changes for that shape is which message the composer reads.
 */
const trailingRunsFromBuilder = (
  builder: TransactionBuilder, assembly: BalancedAssembly, regions: readonly GraphTrailingRegion[],
): Record<number, number> => {
  const runs: Record<number, number> = {};
  const blockAt = new Map(assembly.blocks.map((block) => [block.base, block]));
  for (const region of regions) {
    const block = assembly.blocks.find((candidate) => candidate.participant === region.participant)!;
    const own = builder.inputs[block.base]?.token?.category;
    const blockEnd = block.base + block.blockLayout.blockSize;
    let run = 0;
    for (let index = region.base; index < builder.outputs.length; index += 1) {
      const token = builder.outputs[index].token;
      if (token === undefined) break;
      if (index >= region.base + region.capacity) {
        // Outside the region: only the participant's own category, and only where no other block's master
        // output already explains the slot.
        if (index < blockEnd || own === undefined || token.category !== own) break;
        const displaced = blockAt.get(index);
        if (displaced !== undefined
          && builder.inputs[displaced.base]?.token?.category === token.category) break;
      }
      run += 1;
    }
    runs[region.participant] = run;
  }
  return runs;
};

/** The declared regions of a derived assembly, in the same participant indexing the assembly uses. */
const trailingRegionsOf = (assembly: BalancedAssembly): GraphTrailingRegion[] =>
  assembly.blocks.flatMap((block) => (block.blockLayout.trailingBase === undefined
    || block.blockLayout.trailingCapacity === undefined
    ? []
    : [{
      participant: block.participant,
      base: block.base + block.blockLayout.trailingBase,
      capacity: block.blockLayout.trailingCapacity,
    }]));

/**
 * Structural block-assembly gate, run BEFORE any unlocker is asked for bytecode.
 *
 * The assembly is read off the builder's own inputs (each participant's master input carries the compiler-
 * published block layout), so this fires without the caller opting in. Only a transaction where NO input
 * publishes a participant master is left alone; a transaction that publishes one but cannot be described is
 * refused - see `deriveBalancedAssemblyFromInputs`.
 *
 * It also runs the runtime-resource capacity rule (`assertGraphTrailingCapacity`) against runs measured off the
 * transaction itself. That rule used to exist without a caller: an over-capacity chunk run was built, funded and
 * signed, and only then refused by the VM at the first projection input - a slot that names nothing about the
 * cause. A gate the caller must remember to call is not a gate.
 *
 * Returns the assembly it checked, or undefined when the transaction is out of the block model's scope.
 */
export const preflightLayer3BlockAssembly = (
  builder: TransactionBuilder, options?: BalancedAssemblyOptions,
): BalancedAssembly | undefined => {
  const assembly = deriveBalancedAssemblyFromInputs(
    builder.inputs as never, builder.inputs.length,
  );
  if (!assembly) return undefined;
  // The describability rule runs BEFORE the generic structural checks, so an over-capacity run reports its
  // cause. Left second, the same transaction reports whatever its overflow happened to collide with - a token
  // in the sidecar tail, or nothing at all when the collision lands inside the next participant's block.
  const regions = trailingRegionsOf(assembly);
  if (regions.length > 0) {
    assertGraphTrailingCapacity(
      { participantInputs: assembly.blocks.map((block) => block.base), trailingRegions: regions },
      trailingRunsFromBuilder(builder, assembly, regions),
    );
  }
  preflightBalancedBlockAssembly(builder, assembly, options);
  return assembly;
};

/**
 * Run the structural gate on a transaction whose caller has already declared it a Layer-3 composition.
 *
 * `preflightLayer3BlockAssembly` stays silent on a transaction no input describes, because it is also a
 * standalone capability that may be pointed at anything. The two Layer-3 send paths below are not: reaching
 * them means the caller asserts this transaction IS a participant composition, so "nothing was checkable" is a
 * refusal rather than a pass. Without this, stripping `abiFunction` from every master input silences the gate
 * completely while the transaction bytes stay identical.
 */
const requireLayer3BlockAssembly = (builder: TransactionBuilder): void => {
  if (preflightLayer3BlockAssembly(builder) !== undefined) return;
  throw new Error(
    'layer3: no participant master block could be derived from this transaction, so the balanced block '
    + 'assembly gate cannot run; every participant master input must expose its contract unlocker',
  );
};

/* ------------------------------------------------------------------------------------------------------ */
/* The finalized-bytes gate                                                                                 */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * WHY THIS GATE EXISTS HERE AND NOT AT PLAN TIME.
 *
 * R1 built a plan-time envelope screen and then MEASURED that it cannot be the gate, for two reasons that do
 * not depend on each other:
 *
 *  1. Nothing reaches REFUSE. At the re-derived estimator allowances the relay-size REFUSE threshold is
 *     141,562 bytes while the largest shape ever built predicts 112,955, so the screen is inert on every real
 *     subject. A screen that cannot say no is not a gate.
 *  2. A per-input VM evaluation is STRUCTURALLY BLIND to three whole classes of limit - transaction size, dust
 *     and output shape. Those are properties of the finalized transaction, not of any one input's script, so no
 *     amount of per-input evaluation can see them. Measured: a 100,650-byte transaction carrying a 10-satoshi
 *     one-byte output produced ZERO per-input refusals at both real profiles.
 *
 * This is that missing gate, sitting where the transaction actually exists. Two prior misses are exactly its
 * subject: C3 serialized to 100,354 bytes against a 100,000-byte ceiling and every in-repo check passed it - a
 * human noticed the number - and C1 was refused `64: dust` on a real node for a 10-satoshi placeholder against
 * a 474-satoshi threshold, invisible because the mock sets `enforceDust: false` and `dustRelayFeePerKb: 0n`.
 *
 * WHAT IT IS NOT. Layer-3 derivation is an untrusted witness construction; every accepted shape is justified
 * by covenants and consensus, never by this gate. This is a usability and correctness aid: it refuses bytes no
 * peer would forward, and it makes nothing newly buildable. Suppressing it cannot make an invalid transaction
 * valid, and passing it is agreement with a rule set rather than evidence about a shape.
 *
 * PROVIDER LIMITS ARE DELIBERATELY NOT READ. `evaluateEveryInput` builds its VM from
 * `provider.consensusLimits`, and on every Layer-3 test that is the relaxed semantic profile - 100x the real
 * bytecode ceiling and 20,000,000x the real op-cost budget. An envelope check against those numbers passes
 * vacuously. Every threshold below is a libauth BCH-2026 constant or arithmetic over the finalized bytes, and
 * no argument can raise one.
 */

/** Real BCH-2026 figures this gate decides against. Read from libauth so a version bump is visible. */
const RELAY_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumStandardTransactionSize;
const CONSENSUS_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumTransactionLengthBytes;
const CONSENSUS_UNLOCKING_BYTES_LIMIT = ConsensusBch2026.maximumBytecodeLength;
const RELAY_LOCKING_BYTES_LIMIT = ConsensusBch2026.maximumStandardLockingBytecodeLength;
const RELAY_DATA_CARRIER_LIMIT = ConsensusBch2026.maximumDataCarrierBytes;

/**
 * BCHN's dust threshold as arithmetic: `3 * dustRelayFee.GetFee(GetSerializeSize(txout) + 148)`, which at the
 * default 1,000 sat/kB dust relay fee is `3 * (serialized + 148)`. The 148 is the assumed cost of the input
 * that will eventually sweep the output, which is why the floor grows with the output's own size.
 *
 * The SDK already computes exactly this in `calculateDust` (`src/utils.ts`, spelled `444 + outputSize * 3`).
 * The reason a 10-satoshi output survived every measurement on this effort is not a wrong formula: it is that
 * `validateOutput` is handed `provider.policy?.enforceDust ?? true` and the Layer-3 profile sets it false. The
 * rule was correct, present, and switched off. This one is not switchable by a provider field.
 */
const DUST_SPEND_SIZE_ALLOWANCE = 148;
const DUST_RELAY_FEE_PER_KB = 1_000;

/** `consensus` cannot be suppressed by any argument; `policy` can, by an explicit caller opt-out. */
export type FinalizedByteRegime = 'consensus' | 'policy';

export interface FinalizedByteRule {
  /** Stable diagnostic name. A refusal quotes this, so it must not be reworded silently. */
  id: string;
  regime: FinalizedByteRegime;
  scope: 'transaction' | 'input' | 'output';
  /** The number, or the arithmetic when the threshold is per-subject. */
  threshold: string;
  /** Where the threshold comes from, and how well it is known. */
  source: string;
}

/**
 * THE RULE SET. Byte rules only: everything here is decidable from the finalized transaction with no VM.
 *
 * The regime split is load-bearing and is not a severity ranking dressed up. The 100,000-byte ceiling is
 * POLICY, established on a real BCHN v29 node: the same 101,513 bytes were refused `64: tx-size` through the
 * mempool and ACCEPTED in a hand-assembled block. Conflating it with the 1,000,000-byte consensus figure would
 * refuse transactions a miner will include; conflating them the other way would call an invalid transaction
 * merely unrelayable.
 */
export const FINALIZED_BYTE_RULES: readonly FinalizedByteRule[] = Object.freeze([
  {
    id: 'relay-transaction-size',
    regime: 'policy',
    scope: 'transaction',
    threshold: `${RELAY_TRANSACTION_SIZE_LIMIT} serialized bytes`,
    source: 'NODE MEASURED, byte-exact. BCHN v29 applies the size policy BEFORE input lookup: 100,000 bytes '
      + 'reaches the loop and reports `missing-inputs`, 100,001 is refused `64: tx-size`. The same 101,513 '
      + 'bytes were separately accepted in a hand-assembled block, so this is policy and not consensus.',
  },
  {
    id: 'consensus-transaction-size',
    regime: 'consensus',
    scope: 'transaction',
    threshold: `${CONSENSUS_TRANSACTION_SIZE_LIMIT} serialized bytes`,
    source: 'libauth `ConsensusBch2026.maximumTransactionLengthBytes`. Kept separate from the relay ceiling so '
      + 'the two are never conflated: a shape between them is mineable and unrelayable, which is a different '
      + 'verdict from invalid.',
  },
  {
    id: 'output-dust',
    regime: 'policy',
    scope: 'output',
    threshold: `3 * (serialized output bytes + ${DUST_SPEND_SIZE_ALLOWANCE}) satoshis`,
    source: 'NODE MEASURED. BCHN refused C1 `64: dust` for a 10-satoshi output to a one-byte script against a '
      + '474-satoshi threshold. OP_RETURN outputs are exempt, matching both BCHN `IsStandardTx` and the SDK '
      + 'own `validateOutput`.',
  },
  {
    id: 'relay-locking-bytes',
    regime: 'policy',
    scope: 'output',
    threshold: `${RELAY_LOCKING_BYTES_LIMIT} locking bytecode bytes`,
    source: 'libauth `ConsensusBch2026.maximumStandardLockingBytecodeLength`. Measured against the BARE '
      + 'locking bytecode, not the token-prefixed serialization: a token prefix is stripped before the '
      + 'standardness checks run, and measuring the prefixed form would refuse honest 128-byte-commitment '
      + 'state outputs on a reading nobody has verified. Under-refusing is the correct direction when a '
      + 'threshold applicability is uncertain.',
  },
  {
    id: 'relay-data-carrier',
    regime: 'policy',
    scope: 'output',
    threshold: `${RELAY_DATA_CARRIER_LIMIT} bytes of OP_RETURN locking bytecode`,
    source: 'NODE MEASURED as a class: BCHN refused an OP_RETURN carrying 300 bytes with '
      + '`64: oversize-op-return`. The exact boundary was not measured on a node; the number is libauth '
      + '`maximumDataCarrierBytes`, which matches BCHN default `-datacarriersize`.',
  },
  {
    id: 'scriptsig-push-only',
    regime: 'policy',
    scope: 'input',
    threshold: 'unlocking bytecode must be a pure push sequence',
    source: 'NODE MEASURED. BCHN refuses `64: scriptsig-not-pushonly`; a non-push-only scriptSig was put in '
      + 'front of the node and refused with exactly that.',
  },
  {
    id: 'consensus-unlocking-bytes',
    regime: 'consensus',
    scope: 'input',
    threshold: `${CONSENSUS_UNLOCKING_BYTES_LIMIT} unlocking bytecode bytes`,
    source: 'libauth `ConsensusBch2026.maximumBytecodeLength`. The standard ceiling coincides: X49 accepted a '
      + '6,035-byte scriptSig on the node, so the legacy 1,650-byte standard limit is gone in v29 and one rule '
      + 'expresses both. Reported here as well as in the VM because the VM reads the provider limits, which on '
      + 'every Layer-3 test are 100x this figure.',
  },
]);

const finalizedRuleById = new Map(FINALIZED_BYTE_RULES.map((rule) => [rule.id, rule]));

/** Look a rule up by the id a refusal quotes, so a caller can check a diagnostic against its rule. */
export const finalizedByteRule = (id: string): FinalizedByteRule | undefined => finalizedRuleById.get(id);

/**
 * WHAT THIS GATE CANNOT SEE, stated as scope rather than left as an omission. An envelope claiming
 * completeness it does not have is worse than a narrow one that says where it stops.
 *
 * Each entry names a real refusal class this gate does not decide and why it is out of scope here, so a reader
 * never mistakes an ADMIT for "the network will accept this".
 */
export const FINALIZED_BYTE_GATE_BLIND_SPOTS: readonly string[] = Object.freeze([
  'VM-priced rules - operation-cost density, hash-iteration density, per-input and per-transaction SigChecks. '
  + 'They need an evaluation, not bytes. `evaluateEveryInput` owns that surface and currently runs at the '
  + 'PROVIDER limits, which is an open contradiction (X109/X121) this gate deliberately does not touch.',
  'Minimum relay fee. Computable from these bytes, but the threshold is not node-measured on this effort and '
  + 'the corpus relationship to it is unmeasured, so no rule is claimed. See the measurement in the report.',
  'More than one OP_RETURN output (`multi-op-return`). BCHN enforces it; nobody here has measured it.',
  'The rest of `IsStandardTx`: version range, mempool ancestor and descendant limits, and the transaction '
  + 'version policy. Seven byte rules are not the complete standardness set and this list is not exhaustive.',
  'Anything about chain state - double spends, mempool conflicts, missing or already-spent inputs, coinbase '
  + 'maturity, locktime and sequence finality. These are not properties of the bytes.',
  'Consensus minimum transaction size. libauth publishes 65 bytes and BCHN enforces 100; the two disagree and '
  + 'no admissible Layer-3 composition comes within an order of magnitude of either, so a rule here would be '
  + 'a guard that cannot fire on its own subject.',
  'Whether a covenant is satisfied. That is what the VM evaluation is for, and this gate is not a security '
  + 'boundary in any case.',
]);

export interface FinalizedByteRefusal {
  rule: string;
  regime: FinalizedByteRegime;
  where: string;
  measured: number;
  allowed: number;
  /** How far past the limit, in the rule's own units. Always positive. */
  overBy: number;
  detail: string;
}

export interface FinalizedByteReading {
  rule: string;
  where: string;
  measured: number;
  allowed: number;
  /** Utilization. Above 1 means the rule is broken. */
  ratio: number;
}

export interface FinalizedByteVerdict {
  admitted: boolean;
  /** Every violated rule, not just the first: a caller shrinking one limit needs to know about the others. */
  refusals: readonly FinalizedByteRefusal[];
  /** Utilization of every rule that produced a number, worst first. The head is what binds. */
  readings: readonly FinalizedByteReading[];
  serializedBytes: number;
  inputCount: number;
  outputCount: number;
  /** Total satoshis in outputs. Reported so a caller can compute a fee rate this gate does not judge. */
  outputSatoshis: bigint;
}

export interface FinalizedByteGateOptions {
  /**
   * Admit a transaction whose only refusals are POLICY. This is the mineable-but-unrelayable case: a shape
   * between the 100,000-byte relay ceiling and the 1,000,000-byte consensus ceiling is valid, and a caller
   * submitting directly to a miner is not wrong to build it.
   *
   * It can never suppress a `consensus` refusal, and it is not a provider field on purpose: reading
   * `provider.policy.enforceDust` is exactly how the dust rule came to be present, correct and switched off.
   * Suppressing a policy refusal cannot make an invalid transaction valid, so this widens nothing.
   */
  allowNonRelayable?: boolean;
}

const serializedOutputBytes = (output: Output): number => encodeTransactionOutput(output).length;

/** BCHN's dust floor for one output, in satoshis. */
export const finalizedOutputDustThreshold = (output: Output): number => Math.ceil(
  3 * (serializedOutputBytes(output) + DUST_SPEND_SIZE_ALLOWANCE) * DUST_RELAY_FEE_PER_KB / 1_000,
);

const isOpReturnOutput = (output: Output): boolean =>
  output.lockingBytecode.length > 0 && output.lockingBytecode[0] === 0x6a;

/**
 * A pure push sequence, which is what `scriptsig-not-pushonly` requires.
 *
 * Deliberately not shared with any "redeem script length" helper: those return 0 both for "not push-only" and
 * for "an empty final push", which would conflate a refusal with a legal shape.
 */
export function isPushOnlyBytecode(bytecode: Uint8Array): boolean {
  let cursor = 0;
  while (cursor < bytecode.length) {
    const opcode = bytecode[cursor];
    cursor += 1;
    let length: number;
    if (opcode <= 0x4b) length = opcode;
    else if (opcode === 0x4c) {
      length = bytecode[cursor];
      cursor += 1;
    } else if (opcode === 0x4d) {
      length = bytecode[cursor] | (bytecode[cursor + 1] << 8);
      cursor += 2;
    } else if (opcode === 0x4e) {
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

/**
 * Decide ONE finalized transaction against the byte rules. Pure: no builder, no provider, no plan.
 *
 * Not a plan, because the bytes are what a node judges and a plan is not the bytes - the same plan built twice
 * can differ by an output and one of the two be refused. Not a provider, because the relaxed limits every
 * Layer-3 test publishes are exactly what made the existing capacity checks vacuous.
 */
export function assessFinalizedTransactionBytes(transaction: Transaction): FinalizedByteVerdict {
  const refusals: FinalizedByteRefusal[] = [];
  const readings: FinalizedByteReading[] = [];
  const serializedBytes = encodeTransaction(transaction).length;
  const refuse = (
    rule: string, where: string, measured: number, allowed: number, detail: string,
  ): void => {
    refusals.push({
      rule, regime: finalizedRuleById.get(rule)!.regime, where, measured, allowed,
      overBy: measured - allowed, detail,
    });
  };

  /* --- transaction scope --- */
  readings.push({
    rule: 'relay-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: RELAY_TRANSACTION_SIZE_LIMIT,
    ratio: serializedBytes / RELAY_TRANSACTION_SIZE_LIMIT,
  });
  if (serializedBytes > RELAY_TRANSACTION_SIZE_LIMIT) {
    refuse('relay-transaction-size', 'transaction', serializedBytes, RELAY_TRANSACTION_SIZE_LIMIT,
      `${serializedBytes} serialized bytes is ${serializedBytes - RELAY_TRANSACTION_SIZE_LIMIT} over the `
      + `${RELAY_TRANSACTION_SIZE_LIMIT}-byte standard relay ceiling; a node refuses these bytes with `
      + '`64: tx-size` before it looks up a single input, though a miner may still include them');
  }
  readings.push({
    rule: 'consensus-transaction-size',
    where: 'transaction',
    measured: serializedBytes,
    allowed: CONSENSUS_TRANSACTION_SIZE_LIMIT,
    ratio: serializedBytes / CONSENSUS_TRANSACTION_SIZE_LIMIT,
  });
  if (serializedBytes > CONSENSUS_TRANSACTION_SIZE_LIMIT) {
    refuse('consensus-transaction-size', 'transaction', serializedBytes, CONSENSUS_TRANSACTION_SIZE_LIMIT,
      `${serializedBytes} serialized bytes is ${serializedBytes - CONSENSUS_TRANSACTION_SIZE_LIMIT} over the `
      + `${CONSENSUS_TRANSACTION_SIZE_LIMIT}-byte consensus ceiling; these bytes are invalid however they are `
      + 'transported, not merely unrelayable');
  }

  /* --- input scope --- */
  let worstUnlocking = { input: -1, bytes: 0 };
  transaction.inputs.forEach((input, index) => {
    const bytes = input.unlockingBytecode.length;
    if (bytes > worstUnlocking.bytes) worstUnlocking = { input: index, bytes };
    if (bytes > CONSENSUS_UNLOCKING_BYTES_LIMIT) {
      refuse('consensus-unlocking-bytes', `input ${index}`, bytes, CONSENSUS_UNLOCKING_BYTES_LIMIT,
        `${bytes} unlocking bytecode bytes is ${bytes - CONSENSUS_UNLOCKING_BYTES_LIMIT} over the `
        + `${CONSENSUS_UNLOCKING_BYTES_LIMIT}-byte per-input script limit`);
    }
    if (!isPushOnlyBytecode(input.unlockingBytecode)) {
      refuse('scriptsig-push-only', `input ${index}`, 1, 0,
        'unlocking bytecode is not a pure push sequence; a node refuses `64: scriptsig-not-pushonly`');
    }
  });
  if (worstUnlocking.input >= 0) {
    readings.push({
      rule: 'consensus-unlocking-bytes',
      where: `input ${worstUnlocking.input}`,
      measured: worstUnlocking.bytes,
      allowed: CONSENSUS_UNLOCKING_BYTES_LIMIT,
      ratio: worstUnlocking.bytes / CONSENSUS_UNLOCKING_BYTES_LIMIT,
    });
  }

  /* --- output scope --- */
  let worstDust = { output: -1, ratio: 0, satoshis: 0, threshold: 0 };
  let worstLocking = { output: -1, bytes: 0 };
  let outputSatoshis = 0n;
  transaction.outputs.forEach((output, index) => {
    outputSatoshis += output.valueSatoshis;
    const locking = output.lockingBytecode.length;
    if (isOpReturnOutput(output)) {
      if (locking > RELAY_DATA_CARRIER_LIMIT) {
        refuse('relay-data-carrier', `output ${index}`, locking, RELAY_DATA_CARRIER_LIMIT,
          `${locking} bytes of OP_RETURN locking bytecode is ${locking - RELAY_DATA_CARRIER_LIMIT} over the `
          + `${RELAY_DATA_CARRIER_LIMIT}-byte data carrier allowance; a node refuses `
          + '`64: oversize-op-return`');
      }
      // OP_RETURN is exempt from dust and is not judged against the standard locking-bytecode ceiling, both
      // matching BCHN: a null-data output is its own template.
      return;
    }
    if (locking > worstLocking.bytes) worstLocking = { output: index, bytes: locking };
    if (locking > RELAY_LOCKING_BYTES_LIMIT) {
      refuse('relay-locking-bytes', `output ${index}`, locking, RELAY_LOCKING_BYTES_LIMIT,
        `${locking} locking bytecode bytes is ${locking - RELAY_LOCKING_BYTES_LIMIT} over the `
        + `${RELAY_LOCKING_BYTES_LIMIT}-byte standard allowance`);
    }
    const threshold = finalizedOutputDustThreshold(output);
    const satoshis = Number(output.valueSatoshis);
    // Ratio inverted deliberately: dust is a FLOOR, so utilization is threshold-over-value and an output at
    // exactly the threshold reads 1.0000x like every other rule at its boundary.
    const ratio = satoshis === 0 ? Infinity : threshold / satoshis;
    if (ratio > worstDust.ratio) worstDust = { output: index, ratio, satoshis, threshold };
    if (satoshis < threshold) {
      refuse('output-dust', `output ${index}`, threshold, satoshis,
        `${satoshis} satoshis is ${threshold - satoshis} short of the ${threshold}-satoshi dust threshold for `
        + `a ${serializedOutputBytes(output)}-byte output (3 * (${serializedOutputBytes(output)} + `
        + `${DUST_SPEND_SIZE_ALLOWANCE})); a node refuses \`64: dust\``);
    }
  });
  if (worstLocking.output >= 0) {
    readings.push({
      rule: 'relay-locking-bytes',
      where: `output ${worstLocking.output}`,
      measured: worstLocking.bytes,
      allowed: RELAY_LOCKING_BYTES_LIMIT,
      ratio: worstLocking.bytes / RELAY_LOCKING_BYTES_LIMIT,
    });
  }
  if (worstDust.output >= 0) {
    readings.push({
      rule: 'output-dust',
      where: `output ${worstDust.output}`,
      measured: worstDust.threshold,
      allowed: worstDust.satoshis,
      ratio: worstDust.ratio,
    });
  }

  readings.sort((left, right) => right.ratio - left.ratio);
  return {
    admitted: refusals.length === 0,
    refusals,
    readings,
    serializedBytes,
    inputCount: transaction.inputs.length,
    outputCount: transaction.outputs.length,
    outputSatoshis,
  };
}

/** One-line summary of a verdict: what bound, how hard, and every refusal. */
export function formatFinalizedByteVerdict(verdict: FinalizedByteVerdict): string {
  const binding = verdict.readings[0];
  return [
    verdict.admitted ? 'ADMITTED' : 'REFUSED',
    `inputs=${verdict.inputCount}`,
    `outputs=${verdict.outputCount}`,
    `serialized=${verdict.serializedBytes}B`,
    binding === undefined ? 'binds=none'
      : `binds=${binding.rule} ${binding.ratio.toFixed(4)}x at ${binding.where}`,
    verdict.refusals.length === 0 ? 'refusals=none'
      : `refusals=${verdict.refusals.map((row) => `${row.regime}:${row.rule}@${row.where}`).join(',')}`,
  ].join(' | ');
}

/**
 * THE GATE. Refuse a finalized transaction that breaks a byte rule.
 *
 * Consensus and policy are reported separately and cannot be collapsed: `allowNonRelayable` admits a
 * policy-only refusal and has no effect on a consensus one. A message always names every violated rule, its
 * regime, and the arithmetic that produced the limit, because a caller who fixes only the first refusal has
 * learned nothing about the second.
 */
export function assertFinalizedTransactionBytes(
  transaction: Transaction, options: FinalizedByteGateOptions = {},
): FinalizedByteVerdict {
  const verdict = assessFinalizedTransactionBytes(transaction);
  const consensus = verdict.refusals.filter((row) => row.regime === 'consensus');
  const policy = verdict.refusals.filter((row) => row.regime === 'policy');
  const enforced = options.allowNonRelayable === true ? consensus : [...consensus, ...policy];
  if (enforced.length === 0) return verdict;
  const lines = enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`);
  const suppressed = options.allowNonRelayable === true && policy.length > 0
    ? `\n  (${policy.length} policy refusal(s) suppressed by allowNonRelayable: `
      + `${policy.map((row) => row.rule).join(', ')})`
    : '';
  throw new Error(
    `layer3: finalized transaction refused by ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n${lines.join('\n')}${suppressed}`,
  );
}

const evaluateEveryInput = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);

  transaction.inputs.forEach((_input, inputIndex) => {
    const state = vm.evaluate({
      inputIndex,
      sourceOutputs,
      transaction,
    }) as AuthenticationProgramStateCommon;
    if (state.error !== undefined) {
      throw new Error(`layer3: BCH-2026 preflight failed at input ${inputIndex}: ${state.error}`);
    }
  });
};

/**
 * Evaluate every input of a fully assembled Layer-3 transaction on the BCH-2026 VM.
 *
 * Layer-3 derivation is an untrusted witness-construction step. This gate is not a
 * substitute for covenant checks; it ensures the exact final transaction satisfies
 * every covenant before it is handed to a provider.
 */
export const preflightLayer3Transaction = (
  builder: TransactionBuilder, options?: FinalizedByteGateOptions,
): Transaction => {
  // Structural gate first: a malformed or unbalanced block assembly is rejected before any signature is taken.
  requireLayer3BlockAssembly(builder);
  const transaction = builder.buildLibauthTransaction();
  evaluateEveryInput(builder, transaction);
  // Byte rules LAST, so a transaction that cannot execute reports its semantic cause rather than whichever
  // relay observation happens to be true of it as well. A transaction refused by the VM is broken regardless
  // of whether it would have relayed, and masking that diagnostic with a size or dust message would lose the
  // more informative half. Every existing per-input diagnostic therefore survives unchanged.
  assertFinalizedTransactionBytes(transaction, options);
  return transaction;
};

/**
 * Build and fee-check once, evaluate that exact byte sequence, then broadcast it unchanged.
 *
 * Layer-3 assembly must explicitly include every sidecar and funding input before this call;
 * unlike the general TransactionBuilder send path, this function never mutates the shape
 * between preflight and broadcast.
 */
export async function sendPreflightedLayer3Transaction(
  builder: TransactionBuilder, options?: FinalizedByteGateOptions,
): Promise<string> {
  // Structural gate first: this runs before build() takes a single signature.
  requireLayer3BlockAssembly(builder);
  const raw = builder.build();
  const transaction = decodeTransactionUnsafe(hexToBin(raw));
  evaluateEveryInput(builder, transaction);
  // The byte gate reads the DECODED broadcast bytes, not a re-derived shape, so it judges exactly what
  // `sendRawTransaction` is about to receive. This is the last thing between the composer and the network.
  assertFinalizedTransactionBytes(transaction, options);
  const txid = await builder.provider.sendRawTransaction(raw);
  const expected = binToHex(hash256(hexToBin(raw)).reverse());
  if (txid !== expected) {
    throw new Error(`layer3: provider returned txid '${txid}', expected '${expected}'`);
  }
  return txid;
}
