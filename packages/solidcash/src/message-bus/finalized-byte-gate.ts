/**
 * Finalized-transaction byte gate (consensus + policy byte rules).
 *
 * Extracted from `preflight.ts` so the byte gate is a leaf module with no VM or graph dependency. The
 * non-stateful `TransactionBuilder.send` and the send-fee byte checks import it directly instead of loading the
 * whole covenant-preflight graph, and it breaks the preflight/graph import cycle.
 */

import { encodeTransaction, encodeTransactionOutput } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Output } from '@bitauth/libauth/build/lib/message/transaction-types.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { MessageBusDiagnosticError } from './diagnostics.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';

/** Real BCH-2026 figures this gate decides against. Read from libauth so a version bump is visible. */
const RELAY_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumStandardTransactionSize;
const CONSENSUS_TRANSACTION_SIZE_LIMIT = ConsensusBch2026.maximumTransactionLengthBytes;
const CONSENSUS_UNLOCKING_BYTES_LIMIT = ConsensusBch2026.maximumBytecodeLength;
const RELAY_LOCKING_BYTES_LIMIT = ConsensusBch2026.maximumStandardLockingBytecodeLength;
const RELAY_DATA_CARRIER_LIMIT = ConsensusBch2026.maximumDataCarrierBytes;

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
      + 'locking bytecode, not the token-prefixed serialization. Whether BCHN applies this to the prefixed '
      + 'form is UNVERIFIED here, and measuring the prefixed form would refuse an honest p2sh32 state output '
      + 'carrying a 128-byte commitment and a fungible amount at 203 bytes; under-refusing is the correct '
      + 'direction while the applicability is uncertain. The two message bus send paths agree on this number by '
      + 'measurement: `decodeTransactionUnsafe` splits the token prefix back out, so a built transaction and '
      + 'the decoded broadcast bytes report the same bare length.',
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
    threshold: 'unlocking bytecode must be a pure push sequence: every opcode <= OP_16 (0x60)',
    source: 'NODE MEASURED. BCHN refuses `64: scriptsig-not-pushonly`; a non-push-only scriptSig was put in '
      + 'front of the node and refused with exactly that. The predicate matches `CScript::IsPushOnly` to the '
      + 'opcode, OP_RESERVED included - see `isPushOnlyBytecode`.',
  },
  {
    id: 'consensus-unlocking-bytes',
    regime: 'consensus',
    scope: 'input',
    threshold: `${CONSENSUS_UNLOCKING_BYTES_LIMIT} unlocking bytecode bytes`,
    source: 'libauth `ConsensusBch2026.maximumBytecodeLength`. The standard ceiling coincides: X49 accepted a '
      + '6,035-byte scriptSig on the node, so the legacy 1,650-byte standard limit is gone in v29 and one rule '
      + 'expresses both. Reported here as well as in the VM because the VM reads the provider limits, which on '
      + 'every message bus test are 100x this figure.',
  },
  /*
   * `standard-output-template` IS DELIBERATELY ABSENT AND MUST NOT BE RE-ADDED WITHOUT A NEW MEASUREMENT.
   *
   * It was measured against `mainnet/bitcoin-cash-node:v29.0.0`, on a throwaway container started with an
   * explicit `-acceptnonstdtxn=0`, and BCHN does not enforce it: a bare `OP_1` output was funded, accepted,
   * mined, and then spent with an EMPTY unlocking script. The same one-byte script at 10 satoshis is refused
   * `64: dust`, which proves the per-output policy loop runs and reaches that script - it looked and declined
   * to refuse.
   *
   * A rule that refuses more than the node does is wrong, not conservative. Keeping this one would have taken
   * two working shapes out of the envelope over eighteen fixtures that build a bare `OP_1` output.
   */
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
  'Minimum relay fee. Computable from these bytes, and DELIBERATELY not a rule: unlike dust, this class is '
  + 'not invisible. `MockNetworkProvider` already publishes `minRelayFeePerKb: 1000n` to its verifier '
  + 'unconditionally, so every fixture that broadcasts through the mock has already been judged against it, '
  + 'and the SDK own `checkMaxFee` covers the other direction. The threshold is also not node-measured on '
  + 'this effort. A rule here would add a second decider for a class that already has one.',
  'More than one OP_RETURN output (`multi-op-return`). BCHN enforces it; nobody here has measured it.',
  'The rest of `IsStandardTx`: version range, mempool ancestor and descendant limits, and the transaction '
  + 'version policy. Seven byte rules are not the complete standardness set and this list is not exhaustive.',
  'Anything about chain state - double spends, mempool conflicts, missing or already-spent inputs, coinbase '
  + 'maturity, locktime and sequence finality. These are not properties of the bytes.',
  'Consensus minimum transaction size. libauth publishes 65 bytes and BCHN enforces 100; the two disagree and '
  + 'no admissible message bus composition comes within an order of magnitude of either, so a rule here would be '
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

/**
 * What an input SPENDS, so an input-scoped refusal can name it. X158.
 *
 * `consensus-unlocking-bytes` reports the input index and the byte count, and that is not enough to act on: an
 * over-limit spend's cause is a CONTRACT, and the index alone does not name it. Worse, the compiler's own
 * `contract-size-limit` diagnostic and this rule measure DIFFERENT subjects, so the contract named there is not
 * the set refused here - see `describeInputSubject`.
 *
 * Optional and additive. A subject is a LABEL appended to the detail; no rule reads one, no threshold moves,
 * and a caller that supplies none gets the identical verdict it got before.
 */
export interface FinalizedByteSubject {
  /** Contract name, when the input is a contract spend. */
  contractName?: string;
  /** Bytes of the redeem script the unlocking bytecode carries (constructor arguments included). */
  redeemBytes?: number;
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
  /** Explicit mock-consensus overrides. Real providers should leave these undefined. */
  consensusLimits?: { maximumInputBytes?: number; maximumTransactionBytes?: number };
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
  /**
   * What each input spends, indexed by input. Purely descriptive: it appends a label to an input-scoped
   * refusal and can neither create nor suppress one. `inputSubjectsOfBuilder` reads it off a builder.
   */
  inputSubjects?: readonly (FinalizedByteSubject | undefined)[];
  /**
   * PredOut preflight claims: compose-discovered PredOut physical claims threaded into the finalized-tx layout assert.
   * Without these, PredOut checks stay compose-path-only.
   */
  predOutClaimsByParticipant?: ReadonlyMap<number, ReadonlyArray<{
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }>>;
}

/**
 * Destination profile proven by a successful exact message-bus preflight. Kept outside TransactionBuilder's
 * public options so relay/consensus policy cannot become another application-controlled construction switch.
 * The final send still reassesses its current bytes; the receipt carries only which destination rules apply.
 */
export const finalizedByteGateReceipts = new WeakMap<TransactionBuilder, FinalizedByteGateOptions>();

export const finalizedByteGateReceiptOf = (
  builder: TransactionBuilder,
): FinalizedByteGateOptions | undefined => finalizedByteGateReceipts.get(builder);

/**
 * Make the finalized-byte gate judge the same profile as its destination provider.
 *
 * `consensusLimits` is already the provider's consensus authority, so a second boolean deciding whether those
 * limits count would be contradictory. A transaction profile wider than the standard relay ceiling identifies
 * a direct-submit/private profile; policy observations remain in the verdict but do not block that path.
 */
export const finalizedByteGateOptionsForProvider = (
  provider: Pick<NetworkProvider, 'consensusLimits'>,
): FinalizedByteGateOptions => ({
  ...(provider.consensusLimits === undefined ? {} : { consensusLimits: provider.consensusLimits }),
  ...((provider.consensusLimits?.maximumTransactionBytes ?? RELAY_TRANSACTION_SIZE_LIMIT)
    > RELAY_TRANSACTION_SIZE_LIMIT ? { allowNonRelayable: true } : {}),
});

/**
 * Read each input's subject off a builder, for the gate's message. X158.
 *
 * A contract input publishes both halves; anything else - a P2PKH input, a side-car, a custom unlocker -
 * yields `undefined` and the refusal reads exactly as it did before. `contract.bytecode` is a HEX STRING of
 * the redeem script, so its byte length is `.length / 2`; measuring it as characters is the X148/X153 unit
 * error, and it would report a contract at twice its size here.
 */
export const inputSubjectsOfBuilder = (
  builder: Pick<TransactionBuilder, 'inputs'>,
): (FinalizedByteSubject | undefined)[] => builder.inputs.map((input) => {
  const unlocker = input.unlocker as { contract?: { name?: string; bytecode?: string } } | undefined;
  const contract = unlocker?.contract;
  if (contract === undefined) return undefined;
  return {
    contractName: contract.name,
    redeemBytes: typeof contract.bytecode === 'string' ? contract.bytecode.length / 2 : undefined,
  };
});

/**
 * Name the contract behind an over-limit input, and say where its bytes went. X158.
 *
 * THE TWO SUBJECTS ARE NOT THE SAME SET, which is the whole reason this text exists. `solidc` warns when
 * `scriptToBytecode(script).length > 10_000` - the UN-CONSTRUCTED script. Consensus limits the UNLOCKING
 * BYTECODE, which is that script PLUS the constructor-argument pushes baked into the redeem script, PLUS the
 * redeem push prefix, PLUS every call argument. Measured on one contract family: the compiler is silent at
 * 9,878 script bytes and the spend is refused by 3, so the true boundary sits 122 bytes below the compiler's
 * threshold and every contract in that band compiles clean and cannot be spent.
 *
 * `redeemBytes` is what a `Contract` publishes as its locking script preimage, so `unlockingBytes -
 * redeemBytes` is exactly the argument and push-prefix overhead - reported rather than re-derived, because a
 * re-derivation would be a second place to get the same arithmetic wrong.
 */
const describeInputSubject = (subject: FinalizedByteSubject, unlockingBytes: number): string => {
  const name = subject.contractName === undefined ? 'an unnamed contract' : `contract '${subject.contractName}'`;
  if (subject.redeemBytes === undefined) return `; input spends ${name}`;
  const overhead = unlockingBytes - subject.redeemBytes;
  if (subject.redeemBytes > CONSENSUS_UNLOCKING_BYTES_LIMIT) {
    return `; it spends ${name}, whose redeem script is ${subject.redeemBytes} bytes on its own - already `
      + `${subject.redeemBytes - CONSENSUS_UNLOCKING_BYTES_LIMIT} over the limit before any of its `
      + `${overhead} bytes of arguments and redeem push`;
  }
  return `; it spends ${name}, whose ${subject.redeemBytes}-byte redeem script fits the limit on its own but `
    + `leaves only ${CONSENSUS_UNLOCKING_BYTES_LIMIT - subject.redeemBytes} bytes for the ${overhead} bytes of `
    + 'arguments and redeem push it must also carry. The limit is on the WHOLE unlocking bytecode, so a '
    + "contract the compiler's script-size check passes can still be unspendable";
};

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
 * MATCHES `CScript::IsPushOnly` EXACTLY, INCLUDING ITS ONE SURPRISE: every opcode up to and including OP_16
 * (0x60) is push-only, so OP_RESERVED (0x50) IS push-only even though executing it fails. The node's own
 * comment says so. This function first refused 0x50, which would have refused a scriptSig BCHN accepts - the
 * wrong direction, and not made right by 0x50 being useless. Nothing is widened by admitting it either: the
 * VM evaluation runs first on both send paths and refuses OP_RESERVED on its own.
 *
 * A truncated push is NOT push-only, matching `GetOp` failing.
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
    } else if (opcode <= 0x60) length = 0; // OP_1NEGATE, OP_RESERVED and OP_1..OP_16
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
 * message bus test publishes are exactly what made the existing capacity checks vacuous.
 */
export function assessFinalizedTransactionBytes(
  transaction: Transaction, subjects: readonly (FinalizedByteSubject | undefined)[] = [],
  consensusLimits: FinalizedByteGateOptions['consensusLimits'] = {},
): FinalizedByteVerdict {
  const refusals: FinalizedByteRefusal[] = [];
  const readings: FinalizedByteReading[] = [];
  const serializedBytes = encodeTransaction(transaction).length;
  const maximumTransactionBytes = consensusLimits.maximumTransactionBytes
    ?? CONSENSUS_TRANSACTION_SIZE_LIMIT;
  const maximumInputBytes = consensusLimits.maximumInputBytes ?? CONSENSUS_UNLOCKING_BYTES_LIMIT;
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
    allowed: maximumTransactionBytes,
    ratio: serializedBytes / maximumTransactionBytes,
  });
  if (serializedBytes > maximumTransactionBytes) {
    refuse('consensus-transaction-size', 'transaction', serializedBytes, maximumTransactionBytes,
      `${serializedBytes} serialized bytes is ${serializedBytes - maximumTransactionBytes} over the `
      + `${maximumTransactionBytes}-byte consensus ceiling; these bytes are invalid however they are `
      + 'transported, not merely unrelayable');
  }

  /* --- input scope --- */
  let worstUnlocking = { input: -1, bytes: 0 };
  transaction.inputs.forEach((input, index) => {
    const bytes = input.unlockingBytecode.length;
    if (bytes > worstUnlocking.bytes) worstUnlocking = { input: index, bytes };
    if (bytes > maximumInputBytes) {
      const subject = subjects[index];
      refuse('consensus-unlocking-bytes', `input ${index}`, bytes, maximumInputBytes,
        `${bytes} unlocking bytecode bytes is ${bytes - maximumInputBytes} over the `
        + `${maximumInputBytes}-byte per-input script limit`
        + (subject === undefined ? '' : describeInputSubject(subject, bytes)));
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
      allowed: maximumInputBytes,
      ratio: worstUnlocking.bytes / maximumInputBytes,
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
          + `${RELAY_DATA_CARRIER_LIMIT}-byte data-carrier allowance; a node refuses `
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

export const enforcedFinalizedByteRefusals = (
  verdict: FinalizedByteVerdict, allowNonRelayable: boolean | undefined,
): readonly FinalizedByteRefusal[] => allowNonRelayable === true
  ? verdict.refusals.filter((row) => row.regime === 'consensus')
  : verdict.refusals;

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
  const verdict = assessFinalizedTransactionBytes(
    transaction, options.inputSubjects ?? [], options.consensusLimits,
  );
  const policy = verdict.refusals.filter((row) => row.regime === 'policy');
  const enforced = enforcedFinalizedByteRefusals(verdict, options.allowNonRelayable);
  if (enforced.length === 0) return verdict;
  const lines = enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`);
  const suppressed = options.allowNonRelayable === true && policy.length > 0
    ? `\n  (${policy.length} policy refusal(s) suppressed by allowNonRelayable: `
      + `${policy.map((row) => row.rule).join(', ')})`
    : '';
  const binding = enforced[0];
  throw new MessageBusDiagnosticError(
    'MESSAGE_BUS_FINALIZED_BYTE_LIMIT',
    `messageBus: finalized transaction refused by ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n${lines.join('\n')}${suppressed}`,
    {
      rule: binding.rule,
      resourceIdentity: binding.where,
      measured: binding.measured,
      limit: binding.allowed,
      ...(binding.where.startsWith('input ') && { inputIndex: Number(binding.where.slice(6)) }),
    },
    true,
  );
}
