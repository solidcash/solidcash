import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind, categoryPin, concatBytes, sha256, TokenCapability, validatorTemplateHash,
} from '@solidcash/utils';
import {
  assertValidatorCoverage, decideValidatorNeed, recogniseValidator, standaloneObjections,
  ValidatorCoverageError, type EntryFacts, type ValidatorUtxo,
} from '../../../src/per-call/composer/need-test.js';

/**
 * The need test and validator recognition, driven through the shipped predicates.
 *
 * Both are rules the specification states in terms of facts about a planned entry and about a UTXO, so the tests state
 * the facts directly rather than building a composition that happens to have them. The recognition cases each vary
 * exactly one fact, so a refusal is attributable to that fact.
 */

const CATEGORY = new Uint8Array(32).fill(0x5a);
const OTHER_CATEGORY = new Uint8Array(32).fill(0x77);
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52, 0x75, 0x76]);
/** An arbitrary transcript, since a master skips it and never interprets it. */
const TRANSCRIPT = new Uint8Array([0x50, 0x43, 0x37, 0x01, 0x00, 0x00, 0x00]);

const standaloneFacts = (overrides: Partial<EntryFacts> = {}): EntryFacts => ({
  contract: 'Ledger',
  functionName: 'deposit',
  kind: FrameKind.ROOT,
  callerIsUser: true,
  originEqualsCaller: true,
  makesExternalCall: false,
  mastersOfContract: 1,
  ...overrides,
});

/** A validator UTXO whose redemption path is the category pin followed by a program. */
const validatorUtxo = (overrides: {
  category?: Uint8Array;
  capability?: number;
  hasNft?: boolean;
  program?: Uint8Array;
  pin?: Uint8Array;
} = {}): ValidatorUtxo => {
  const pin = overrides.pin ?? categoryPin(overrides.category ?? CATEGORY, TokenCapability.MUTABLE);
  const redeemScript = concatBytes([pin, overrides.program ?? VALIDATOR_PROGRAM]);
  return {
    unlockingBytecode: concatBytes([encodeDataPush(TRANSCRIPT), encodeDataPush(redeemScript)]),
    category: overrides.category ?? CATEGORY,
    capability: overrides.capability ?? TokenCapability.MUTABLE,
    hasNft: overrides.hasNft ?? true,
  };
};

const expectation = { category: CATEGORY, templateHash: validatorTemplateHash(VALIDATOR_PROGRAM) };

describe('the need test', () => {
  it('lets an entry that stands alone go without a validator', () => {
    expect(decideValidatorNeed(standaloneFacts())).toStrictEqual({ needsValidator: false, reasons: [] });
    expect(standaloneObjections(standaloneFacts())).toStrictEqual([]);
  });

  it('needs a validator for a frame that was reached by a call', () => {
    const need = decideValidatorNeed(standaloneFacts({ kind: FrameKind.CALL, callerIsUser: false }));
    expect(need.needsValidator).toBe(true);
    expect(need.reasons).toHaveLength(1);
    // The same fact disqualifies the entry from standing alone.
    expect(standaloneObjections(standaloneFacts({ kind: FrameKind.CALL })).length).toBeGreaterThan(0);
  });

  it('needs a validator for an entry that makes an external call', () => {
    const need = decideValidatorNeed(standaloneFacts({ makesExternalCall: true }));
    expect(need.needsValidator).toBe(true);
    expect(need.reasons.join(' ')).toMatch(/external call/);
  });

  it('needs a validator when the transaction spends more than one master of the contract', () => {
    const need = decideValidatorNeed(standaloneFacts({ mastersOfContract: 2 }));
    expect(need.needsValidator).toBe(true);
    expect(need.reasons.join(' ')).toMatch(/2 masters/);
  });

  it('reports every reason at once rather than the first', () => {
    const need = decideValidatorNeed(standaloneFacts({
      kind: FrameKind.CALL, makesExternalCall: true, mastersOfContract: 3,
    }));
    expect(need.reasons).toHaveLength(3);
  });

  it('disqualifies a standalone entry whose origin is not its caller', () => {
    const objections = standaloneObjections(standaloneFacts({ originEqualsCaller: false }));
    expect(objections).toHaveLength(1);
    expect(objections[0]).toMatch(/origin is its caller/);
  });

  it('disqualifies a standalone entry that is not its contract\'s only master', () => {
    expect(standaloneObjections(standaloneFacts({ mastersOfContract: 0 }))[0]).toMatch(/only master/);
    expect(standaloneObjections(standaloneFacts({ mastersOfContract: 2 }))[0]).toMatch(/only master/);
  });

  it('disqualifies a standalone entry called by something that is not a user', () => {
    expect(standaloneObjections(standaloneFacts({ callerIsUser: false }))[0]).toMatch(/signed input/);
  });
});

describe('recognising a validator', () => {
  it('recognises a validator that holds the category and runs the expected program', () => {
    expect(recogniseValidator(validatorUtxo(), expectation)).toStrictEqual({ recognised: true });
  });

  it('refuses a UTXO that holds no token', () => {
    expect(recogniseValidator(validatorUtxo({ hasNft: false }), expectation))
      .toStrictEqual({ recognised: false, reason: 'the validator holds no token' });
  });

  it('refuses a UTXO whose capability is not mutable', () => {
    const outcome = recogniseValidator(validatorUtxo({ capability: TokenCapability.MINTING }), expectation);
    expect(outcome.recognised).toBe(false);
    expect(outcome.recognised === false && outcome.reason).toMatch(/not mutable/);
  });

  it('refuses a UTXO of another category', () => {
    const outcome = recogniseValidator(validatorUtxo({ category: OTHER_CATEGORY }), expectation);
    expect(outcome.recognised).toBe(false);
    expect(outcome.recognised === false && outcome.reason).toMatch(/different category/);
  });

  it('refuses a redeem script that does not begin with the category pin', () => {
    // A pin for another category, which is a valid pin of the right shape and the wrong value.
    const outcome = recogniseValidator(
      validatorUtxo({ pin: categoryPin(OTHER_CATEGORY, TokenCapability.MUTABLE) }),
      expectation,
    );
    expect(outcome.recognised).toBe(false);
    expect(outcome.recognised === false && outcome.reason).toMatch(/does not begin with the category pin/);
  });

  it('refuses a validator running a different program', () => {
    const outcome = recogniseValidator(validatorUtxo({ program: new Uint8Array([0x53, 0x54]) }), expectation);
    expect(outcome.recognised).toBe(false);
    expect(outcome.recognised === false && outcome.reason).toMatch(/different program/);
  });

  it('refuses an unlocking bytecode that carries no redeem script', () => {
    const outcome = recogniseValidator({ ...validatorUtxo(), unlockingBytecode: new Uint8Array(0) }, expectation);
    expect(outcome.recognised).toBe(false);
    expect(outcome.recognised === false && outcome.reason).toMatch(/no redeem script/);
  });

  it('recognises by the redemption path rather than by the transcript, which it never reads', () => {
    // Two validators differing only in their transcript: both are recognised, because the transcript is the caller's
    // business and a master skips it.
    const first = validatorUtxo();
    const second: ValidatorUtxo = {
      ...first,
      unlockingBytecode: concatBytes([
        encodeDataPush(new Uint8Array([0x50, 0x43, 0x37, 0x01, 0xff, 0x01, 0x02, 0x03])),
        // The redeem script is the push that follows the transcript, whatever the transcript's length.
        first.unlockingBytecode.subarray(encodeDataPush(TRANSCRIPT).length),
      ]),
    };
    expect(recogniseValidator(first, expectation)).toStrictEqual({ recognised: true });
    expect(recogniseValidator(second, expectation)).toStrictEqual({ recognised: true });
  });

  it('ties the expected program hash to the program bytes it names', () => {
    // The expectation is built from the program, so a master carrying a different constant is a different master.
    const other = validatorTemplateHash(new Uint8Array([0x53, 0x54]));
    expect([...other]).not.toStrictEqual([...expectation.templateHash]);
    expect(sha256(VALIDATOR_PROGRAM).length).toBe(32);
  });
});

describe('a plan\'s validator coverage', () => {
  const covered = (facts: Partial<EntryFacts>, hasValidator: boolean): { facts: EntryFacts; hasValidator: boolean } =>
    ({ facts: standaloneFacts(facts), hasValidator });

  it('accepts a plan that covers every entry which needs a validator', () => {
    expect(() => assertValidatorCoverage([
      covered({ kind: FrameKind.CALL, callerIsUser: false }, true),
      covered({ makesExternalCall: true }, true),
      covered({ mastersOfContract: 2 }, true),
    ])).not.toThrow();
  });

  it('accepts a standalone entry that satisfies the conditions for standing alone', () => {
    expect(() => assertValidatorCoverage([covered({}, false)])).not.toThrow();
  });

  it('accepts an entry that is covered although it did not need to be', () => {
    expect(() => assertValidatorCoverage([covered({}, true)])).not.toThrow();
  });

  it('refuses an entry that needs a validator and has none, naming why', () => {
    let raised: ValidatorCoverageError | undefined;
    try {
      assertValidatorCoverage([covered({ makesExternalCall: true }, false)]);
    } catch (error) {
      raised = error as ValidatorCoverageError;
    }
    expect(raised).toBeInstanceOf(ValidatorCoverageError);
    expect(raised!.contract).toBe('Ledger');
    expect(raised!.functionName).toBe('deposit');
    expect(raised!.reasons.join(' ')).toMatch(/external call/);
  });

  it('refuses a standalone entry that fails a condition for standing alone', () => {
    let raised: ValidatorCoverageError | undefined;
    try {
      assertValidatorCoverage([covered({ originEqualsCaller: false }, false)]);
    } catch (error) {
      raised = error as ValidatorCoverageError;
    }
    expect(raised).toBeInstanceOf(ValidatorCoverageError);
    expect(raised!.reasons.join(' ')).toMatch(/origin is its caller/);
  });

  it('reports the first entry that cannot be covered, with its name', () => {
    expect(() => assertValidatorCoverage([
      covered({}, false),
      covered({ functionName: 'withdraw' } as Partial<EntryFacts>, false),
    ].map((entry, index) => (index === 1 ? { ...entry, facts: { ...entry.facts, originEqualsCaller: false } } : entry))))
      .toThrow(/Ledger.withdraw/);
  });
});
