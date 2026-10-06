/**
 * Whether an entry needs a validator, and how a validator is recognised.
 *
 * A master that cannot prove its own position needs a validator input to authenticate the frame, the call edges and
 * the settlement. The rule is a property of the entry, not of the contract:
 *
 *   - a frame that is not entered by a user was reached by a call, and only a validator can bind the edge;
 *   - an entry that makes an external call has edges to bind;
 *   - a contract with more than one master in the transaction is settled by a validator rather than by a master.
 *
 * When none of those hold the entry stands alone, and then a set of conditions must hold instead — the same
 * conditions expressed as what would make a standalone entry inadmissible.
 *
 * A validator is recognised by its own redemption path, not by its address: the last push of its unlocking bytecode
 * is its redeem script, which must begin with the category pin and end with a program hashing to the constant every
 * master carries. P2SH32 already proved that the script is the one its lock commits to, so re-deriving the address
 * here would add nothing.
 */

import { sha256, splitLastPush, categoryPin, TokenCapability, FramedEncodingError } from '@solidcash/utils';
import { FrameKind } from '@solidcash/utils';

/** What a planned entry says about itself, in the terms the rule is stated in. */
export interface EntryFacts {
  /** The contract the entry belongs to. */
  readonly contract: string;
  /** The entry's name, for diagnostics. */
  readonly functionName: string;
  /** The frame the entry runs as: `ROOT` for a user, otherwise the kind the caller produced. */
  readonly kind: number;
  /** Whether the caller reference points at a user's signed input rather than at another master. */
  readonly callerIsUser: boolean;
  /** Whether the origin reference is the same input as the caller reference. */
  readonly originEqualsCaller: boolean;
  /** Whether the entry makes any external call. */
  readonly makesExternalCall: boolean;
  /** How many masters of this contract the transaction spends. */
  readonly mastersOfContract: number;
}

/** The verdict for one entry. */
export interface ValidatorNeed {
  readonly needsValidator: boolean;
  /** Why a validator is needed, or — when none is — the conditions that would have to hold instead. */
  readonly reasons: readonly string[];
}

/** A validator UTXO, as introspection reports it. */
export interface ValidatorUtxo {
  /** The last push of the unlocking bytecode, which is the redeem script. */
  readonly unlockingBytecode: Uint8Array;
  /** The token facts of the UTXO. */
  readonly category: Uint8Array;
  readonly capability: number;
  readonly hasNft: boolean;
}

/** What the master expects of the validator it points at. */
export interface ValidatorExpectation {
  /** The category the composition is running under. */
  readonly category: Uint8Array;
  /** The hash of the validator program, which every master carries as a constant. */
  readonly templateHash: Uint8Array;
}

/** The outcome of recognition. */
export type Recognition =
  | { readonly recognised: true }
  | { readonly recognised: false; readonly reason: string };

/** Decides whether one entry needs a validator. */
export function decideValidatorNeed(facts: EntryFacts): ValidatorNeed {
  const reasons: string[] = [];
  if (facts.kind !== FrameKind.ROOT) {
    reasons.push('the frame was reached by a call rather than entered by a user');
  }
  if (facts.makesExternalCall) {
    reasons.push('the entry makes an external call, so its edges need binding');
  }
  if (facts.mastersOfContract > 1) {
    reasons.push(`the transaction spends ${facts.mastersOfContract} masters of ${facts.contract}`);
  }
  return { needsValidator: reasons.length > 0, reasons };
}

/**
 * The conditions a standalone entry must satisfy, as the reasons that would disqualify it. An empty list means the
 * entry may stand alone.
 *
 * These are the same facts the need test reads, from the other side: an entry with no validator has nothing to bind
 * its position or its edges, so every one of them has to be true by construction.
 */
export function standaloneObjections(facts: EntryFacts): readonly string[] {
  const objections: string[] = [];
  if (facts.kind !== FrameKind.ROOT) {
    objections.push('a standalone frame is entered by a user');
  }
  if (!facts.callerIsUser) {
    objections.push('a standalone entry is called by a user\'s signed input');
  }
  if (!facts.originEqualsCaller) {
    objections.push('a standalone entry\'s origin is its caller');
  }
  if (facts.makesExternalCall) {
    objections.push('a standalone entry makes no external call');
  }
  if (facts.mastersOfContract !== 1) {
    objections.push('a standalone entry is its contract\'s only master in the transaction');
  }
  return objections;
}

/** One entry as the plan intends to run it. */
export interface PlannedEntry {
  readonly facts: EntryFacts;
  /** Whether the plan gives this entry a validator input. */
  readonly hasValidator: boolean;
}

/** Raised when a plan does not cover an entry the rules require to be covered. */
export class ValidatorCoverageError extends Error {
  constructor(
    readonly contract: string,
    readonly functionName: string,
    readonly reasons: readonly string[],
  ) {
    super(`${contract}.${functionName}: ${reasons.join('; ')}`);
    this.name = 'ValidatorCoverageError';
  }
}

/**
 * Requires the plan to be admissible as a whole: every entry that needs a validator has one, and every entry that has
 * none satisfies the conditions for standing alone.
 *
 * A validator may be present where one is not needed — an entry reached only from its own contract can still be
 * covered — so the rule only refuses in the two directions that would produce an artifact that cannot be checked.
 */
export function assertValidatorCoverage(entries: readonly PlannedEntry[]): void {
  for (const entry of entries) {
    const need = decideValidatorNeed(entry.facts);
    if (need.needsValidator && !entry.hasValidator) {
      throw new ValidatorCoverageError(entry.facts.contract, entry.facts.functionName, need.reasons);
    }
    if (!need.needsValidator && !entry.hasValidator) {
      const objections = standaloneObjections(entry.facts);
      if (objections.length > 0) {
        throw new ValidatorCoverageError(entry.facts.contract, entry.facts.functionName, [...objections]);
      }
    }
  }
}

/**
 * Recognises a validator: it holds a mutable token of the composition's category, and its redeem script is the
 * category pin followed by a program hashing to the expected constant.
 */
export function recogniseValidator(utxo: ValidatorUtxo, expected: ValidatorExpectation): Recognition {
  if (!utxo.hasNft) {
    return { recognised: false, reason: 'the validator holds no token' };
  }
  if (utxo.capability !== TokenCapability.MUTABLE) {
    return { recognised: false, reason: `the validator holds capability ${utxo.capability}, not mutable` };
  }
  if (utxo.category.length !== expected.category.length) {
    return { recognised: false, reason: 'the validator holds a category of the wrong length' };
  }
  for (let index = 0; index < expected.category.length; index += 1) {
    if (utxo.category[index] !== expected.category[index]) {
      return { recognised: false, reason: 'the validator holds a different category' };
    }
  }

  let redeemScript: Uint8Array;
  try {
    redeemScript = splitLastPush(utxo.unlockingBytecode).payload;
  } catch (error) {
    if (error instanceof FramedEncodingError) {
      return { recognised: false, reason: `the validator's unlocking bytecode carries no redeem script: ${error.message}` };
    }
    throw error;
  }

  // A validator holds its token with the mutable capability, so its pin carries that byte.
  const pin = categoryPin(expected.category, TokenCapability.MUTABLE);
  if (redeemScript.length < pin.length) {
    return { recognised: false, reason: 'the validator\'s redeem script is shorter than the category pin' };
  }
  for (let index = 0; index < pin.length; index += 1) {
    if (redeemScript[index] !== pin[index]) {
      return { recognised: false, reason: 'the validator\'s redeem script does not begin with the category pin' };
    }
  }

  const program = redeemScript.subarray(pin.length);
  const digest = sha256(program);
  if (digest.length !== expected.templateHash.length) {
    return { recognised: false, reason: 'the expected program hash is not a sha256 digest' };
  }
  for (let index = 0; index < digest.length; index += 1) {
    if (digest[index] !== expected.templateHash[index]) {
      return { recognised: false, reason: 'the validator runs a different program' };
    }
  }
  return { recognised: true };
}
