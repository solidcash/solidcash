import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, encodeTransactionOutput, hash256, hexToBin,
  type Output, type Transaction,
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
      + 'locking bytecode, not the token-prefixed serialization. Whether BCHN applies this to the prefixed '
      + 'form is UNVERIFIED here, and measuring the prefixed form would refuse an honest p2sh32 state output '
      + 'carrying a 128-byte commitment and a fungible amount at 203 bytes; under-refusing is the correct '
      + 'direction while the applicability is uncertain. The two Layer-3 send paths agree on this number by '
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
      + 'every Layer-3 test are 100x this figure.',
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
}

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
 * Layer-3 test publishes are exactly what made the existing capacity checks vacuous.
 */
export function assessFinalizedTransactionBytes(
  transaction: Transaction, subjects: readonly (FinalizedByteSubject | undefined)[] = [],
): FinalizedByteVerdict {
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
      const subject = subjects[index];
      refuse('consensus-unlocking-bytes', `input ${index}`, bytes, CONSENSUS_UNLOCKING_BYTES_LIMIT,
        `${bytes} unlocking bytecode bytes is ${bytes - CONSENSUS_UNLOCKING_BYTES_LIMIT} over the `
        + `${CONSENSUS_UNLOCKING_BYTES_LIMIT}-byte per-input script limit`
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
  const verdict = assessFinalizedTransactionBytes(transaction, options.inputSubjects ?? []);
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

/**
 * X175/X186. THE COVENANT'S OWN OBJECTION to a finalized transaction, or undefined when every input evaluates.
 *
 * The same per-input BCH-2026 evaluation `sendPreflightedLayer3Transaction` runs, from the same
 * provider-derived factory `StatefulTransactionBuilder._strictRecursiveVmPreflight` uses, which at
 * `@mem-cash/validation` 0.0.8 agrees with the mock's own decider on every shape measured (X121).
 *
 * `debug()` IS NOT THE INSTRUMENT TO REACH FOR at any of the sites that route through here. The four
 * `StatefulContract` lifecycle-admin sites bypass it outright; `TransactionBuilder.send` debugs a COVENANT
 * input best-effort and SWALLOWS the result, and does not debug a custom unlocker at all. Evaluating the
 * finalized bytes needs no wallet template and no swallowing.
 *
 * NEVER THROWS, and that is load-bearing: it annotates a refusal that is already decided, so a harness that
 * cannot supply source outputs must leave the byte refusal exactly as it was rather than replace it.
 *
 * X186. IT ASKS `stateSuccess`, NOT `state.error`, AND THE DIFFERENCE IS A WHOLE FAILURE CLASS. `evaluate`
 * reports only errors raised BY an operation; a script that runs to completion and leaves a FALSY item on top
 * has no `error` at all, so reading the field alone declared a broken covenant clean and let its refusal report
 * bytes only - the absorption shape this whole mechanism exists to remove, surviving inside the instrument
 * meant to close it. Measured on a one-byte `OP_0` locking script paying dust: `state.error` undefined,
 * `stateSuccess` `Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack
 * item: ""`, which is the SAME sentence the provider's own `verify` produces for those bytes. libauth's
 * `success` returns `state.error` when there is one and checks truthiness otherwise, so this is a strict
 * widening that cannot lose a message it used to report - and it can only ever annotate a refusal that has
 * already been decided, never create one.
 */
export function covenantObjectionOf(
  builder: TransactionBuilder, transaction: Transaction,
): string | undefined {
  try {
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const objection = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
      if (objection !== true) return `input ${inputIndex}: ${objection}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * X175/X186. THE BYTE GATE WHEREVER NO DECIDER IS GUARANTEED TO HAVE SPOKEN FIRST. It reports BOTH objections,
 * so the ordering it used to have cannot matter.
 *
 * WHAT THE ORDERING COST. At a site with no covenant verdict ahead of it the gate is the first decider to
 * speak, and a transaction that broke its covenant AND paid dust reported the dust. That is the exact shape
 * that made the seventh vacuous guard on this effort: a hostile test whose loose match absorbed a new gate's
 * dust error and kept passing while its rejection was no longer the forgery's. Pinning the window with an
 * ordering row recorded the hazard; it did not remove it, because any future hostile that pays dust and
 * matches loosely walks back into it.
 *
 * SO NEITHER OBJECTION IS ALLOWED TO MASK THE OTHER. When the bytes are refused this asks the covenant too, and
 * a transaction that breaks both names both - covenant FIRST, matching the ordering principle every other live
 * site already follows ("a transaction that cannot execute reports its semantic cause"). A test matching on the
 * covenant's message and a test matching on the byte rule now both find their own subject, whichever fires.
 *
 * WHERE IT IS ROUTED. The four `StatefulContract` lifecycle-admin sites (destroy, split, merge,
 * `_sendRawBuilder`), which bypass `debug()`, and `TransactionBuilder.send`, whose two residual windows are a
 * COVENANT input (debugged best-effort, result swallowed) and a CUSTOM UNLOCKER (not debugged at all). The
 * `send` window is why this lives here rather than beside its first caller.
 *
 * THE BLAST RADIUS IS THE SET THE GATE ALREADY REFUSED, and nothing else. The VM is consulted only on a path
 * that has already decided to throw, so no transaction that used to settle can now fail, and it costs nothing
 * on the admitted path because the bytes are assessed FIRST and an admitted verdict returns before anything
 * else runs. A byte-only refusal keeps its message byte for byte - `assertFinalizedTransactionBytes` still
 * produces it. `admitted` decides the branch rather than the refusal list because these sites pass no
 * `allowNonRelayable`, so every refusal is enforced and `admitted === false` is exactly "the assert throws".
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor and an attacker does not call
 * `StatefulContract.split` or `TransactionBuilder.send`. A composer reads two causes here instead of building,
 * funding, signing and broadcasting twice to find the second one.
 */
export function assertFinalizedBytesWithCovenant(
  builder: TransactionBuilder, transaction: Transaction,
  subjects: readonly (FinalizedByteSubject | undefined)[],
): void {
  const verdict = assessFinalizedTransactionBytes(transaction, subjects);
  if (verdict.admitted) return;
  const covenant = covenantObjectionOf(builder, transaction);
  // Byte-only: the one decider that speaks is the one that always spoke, with the message it always produced.
  if (covenant === undefined) assertFinalizedTransactionBytes(transaction, { inputSubjects: subjects });
  throw new Error(
    `layer3: finalized transaction refused by its covenant and ${verdict.refusals.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n  [covenant] ${covenant}\n`
    + verdict.refusals.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`).join('\n'),
  );
}

/**
 * X198. THE COVENANT DECIDER FOR BOTH LAYER-3 ENTRY POINTS, and it asks `stateSuccess` for the same reason
 * `covenantObjectionOf` does - except this one THROWS, so the field it read was a fail-closed boundary.
 *
 * IT USED TO READ `state.error`, WHICH IS A STRICT SUBSET OF THE VM'S OWN VERDICT. libauth's BCH instruction
 * set defines `success(state)` as "return `state.error` if there is one, otherwise refuse an empty stack or a
 * non-truthy top item", and `createVirtualMachine` hands that same function to `vm.verify`. So `stateSuccess`
 * IS the VM's verification predicate and `state.error` is only its first branch. The DEMONSTRATED gap is the
 * non-truthy top item: it produced a full objection that this function never looked at, admitted the
 * transaction, and passed the bytes to the byte rules and then to the network. (The empty-stack branch is NOT
 * demonstrated - BCH's clean-stack rule raises before it can fire - and row 2b of the test records that.)
 *
 * THE CLASS IS WHAT THE COMPILER EMITS, not a curiosity. `GenerateTargetTraversal` deletes the final
 * `require`'s OP_VERIFY when the stack is shallow ("If the final op is OP_VERIFY and the stack size is less
 * than 4 we remove it from the script"), so a plain contract's LAST check leaves its boolean on the stack
 * rather than verifying it: `require(v == brand)` compiles to a script ending in OP_NUMEQUAL, and its failure
 * raises nothing. `X198SubmitCovenantAbsorption` builds a real two-participant composition whose fee-slot
 * covenant fails exactly that way and measures both halves - `covenantObjectionOf` naming `input 7`, and this
 * function admitting the same bytes.
 *
 * THE WIDENING CANNOT LOSE A MESSAGE. `success` returns `state.error` verbatim when there is one, so every
 * diagnostic this produced before it produces byte for byte, at the same input index.
 *
 * THE BLAST RADIUS WAS MEASURED, NOT ASSUMED. A census instrumented this function to log every objection the
 * VM PRODUCED alongside whether the old `state.error` read OBSERVED it, over the Layer-3 population that can
 * reach here. Across all three capstones plus two further graph fixtures - 179 tests - the VM produced 84
 * objections and the old read saw all 84: every one was a raised error (82 OP_VERIFY, 2 OP_SPLIT). The
 * population never steers into the window, which is why it survived X186; the evidence that it is real is
 * CONSTRUCTED, not sampled. The mock provider refuses the constructed shape on its own, so this only moves the
 * refusal earlier and never disagrees with the network.
 */
const evaluateEveryInput = (
  builder: TransactionBuilder, transaction: Transaction,
): void => {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);

  transaction.inputs.forEach((_input, inputIndex) => {
    const objection = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
    if (objection !== true) {
      throw new Error(`layer3: BCH-2026 preflight failed at input ${inputIndex}: ${objection}`);
    }
  });
};

/**
 * Evaluate every input of a fully assembled Layer-3 transaction on the BCH-2026 VM, then decide its finalized
 * bytes against the byte rules.
 *
 * Layer-3 derivation is an untrusted witness-construction step. Neither check is a substitute for covenant
 * checks: the first establishes that the exact final transaction satisfies every covenant, the second that its
 * bytes are ones a peer would forward. `options` reaches only the byte rules.
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
 *
 * SCOPE. EVERY LIVE BROADCAST SITE IN `src/` NOW CARRIES THE BYTE GATE. There were eight; the eighth,
 * `StatefulContract._sendBuilderWithCustomUnlockers`, had no caller anywhere and is deleted rather than gated
 * (see the note at its former position). The seven live ones are this function,
 * `StatefulTransactionBuilder`'s submit phase, `TransactionBuilder.send`, and the four `StatefulContract`
 * lifecycle-admin sites - destroy, split, merge and `_sendRawBuilder`.
 *
 * THE BLAST RADIUS IS MEASURED, NOT ASSUMED (X126). Every broadcast of the whole SDK e2e population was first
 * assessed against these rules without enforcing them - 5,370 sends across 422 green files - and the per-site
 * table is in `test/e2e/layer3-gatesite-probe.ts`. Six of the seven ungated sites would newly refuse NOTHING;
 * the submit phase would newly refuse two tests in one fixture, both because that fixture paid 100/200/300
 * satoshis to a one-byte script and tripped `output-dust` at the same 474-satoshi threshold BCHN used to
 * refuse C1. The gate was node-correct and the fixture was building a transaction the network rejects, so the
 * fixture was corrected (amounts are incidental to what it asserts) and the gate landed there.
 *
 * WHY THE FOUR ADMIN SITES LANDED ANYWAY, ON 0% (X163). The population reaches them 14 times across 11 tests,
 * and 0% over 13 net-ok sends is not evidence - at that sample size the one real defect the submit-path
 * measurement found would have been invisible. The population coverage was not the evidence; CONSTRUCTED
 * coverage was. All four compute a payout arithmetically with no floor - destroy's `totalInputSats - fee`,
 * split's `totalFunding - newMintingAmount * splitCount - fee`, merge's `consumedSatoshis + totalFunding - fee`
 * - and all four then write it over a placeholder BY INDEX on `builder.outputs`, the one path into an output
 * that `addOutput`'s policy check never sees. Each was driven to a 100-satoshi output against a 576-satoshi
 * threshold, and `MockNetworkProvider` accepted every one, because its default policy is `enforceDust: false`.
 * That is the C1 blind spot exactly, on four paths the population happened never to steer into.
 * `test/e2e/L4StatefulAdminSiteGate.test.ts` is the constructed set.
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
