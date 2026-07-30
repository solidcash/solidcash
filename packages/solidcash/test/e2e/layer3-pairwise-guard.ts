/**
 * R3-10. THE SCOPE GUARD BEHIND "no covenant compares participant rows to each other", WITH THE LIVENESS
 * CONTROLS IT DID NOT HAVE.
 *
 * The claim is a scope claim about the deployed covenants: owner uniqueness lives entirely in the SDK planner
 * (`planCompiledGraph` refuses two rows naming one locking bytecode) and nothing on chain compares two
 * participant rows to each other. Two fixtures assert it - `Layer3BoundedMaximumGraphC3.test.ts` and
 * `Layer3ReviewA1.test.ts` - and both used to assert it the same way and with the same omission, which is why
 * the detector now lives here once instead of twice.
 *
 * WHAT WENT WRONG TWICE, in the same guard, at two levels:
 *
 *  1. The FIRST version hunted the identifiers `participantLbcN == participantLbcM`. X65 replaced the 8-way
 *     dispatch with an input-index table, those identifiers stopped existing, and the regex could never match
 *     again. The guard was green and checked nothing.
 *  2. The SECOND version expressed the property instead of the spelling - no comparison may carry a participant
 *     locking bytecode on both sides - but asserted only that the filtered result was EMPTY. Nothing asserted
 *     the splitter had found any comparison at all, so a generator that emitted comparisons differently would
 *     have yielded `[]` and passed. That is the same defect one level out.
 *
 * AND A THIRD, FOUND WHILE REPAIRING THE SECOND AND MEASURED HERE. Both versions split the source on newlines
 * before splitting on `&&`/`||`, and the generated covenants put the right-hand comparand of nine comparisons
 * on its own line (7 in the projection verifier, 2 in the controller). A line splitter sees `foo` and
 * `== bar` as two separate clauses, and `''.split('==')[0]` matches nothing, so ANY pairwise comparison written
 * across two lines was invisible to the guard. This detector rejoins statements before splitting, so it is not.
 *
 * WHAT THE REJOIN IMMEDIATELY REVEALED, and this is a real result rather than a tidy-up: the root controller
 * DOES carry a comparison with a locking bytecode on both sides -
 * `tx.outputs[this.activeInputIndex].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode` -
 * which the line splitter could not see. It is not a row-to-row comparison: it is the controller preserving its
 * OWN script at its OWN index, at one index rather than between two participants. It is therefore exempted BY
 * NAME below and its presence is ASSERTED, so the exemption cannot quietly become dead text while a genuine
 * pairwise comparison lands beside it.
 */

/**
 * The controller's self-preservation rule: its own output script equals its own input script, same index.
 *
 * Whitespace-tolerant because the source it matches spans two lines before the rejoin.
 */
export const SELF_PRESERVATION_EXEMPTION =
  /tx\.outputs\[this\.activeInputIndex\]\.lockingBytecode\s*==\s*tx\.inputs\[this\.activeInputIndex\]\.lockingBytecode/;

/** The vocabulary a comparand has to mention to count as carrying a participant locking bytecode. */
const PARTICIPANT_LBC = /lockingBytecode|participantLbc/;

/** What the detector found, so a caller can assert on liveness as well as on emptiness. */
export interface ComparisonScan {
  /** Every comparison clause, comments stripped and multi-line statements rejoined. */
  comparisons: string[];
  /** Those mentioning a participant locking bytecode anywhere - the filter's own vocabulary, live. */
  mentioningLbc: string[];
  /** Those with a participant locking bytecode on both sides of one operator, exemptions included. */
  bothSides: string[];
  /** `bothSides` minus the named exemptions: the pairwise row comparisons the claim says do not exist. */
  pairwise: string[];
  /** Which named exemptions matched, so a caller can assert the exemption is still real. */
  exempted: string[];
}

/**
 * Scan one generated covenant source for comparisons that carry a participant locking bytecode on both sides.
 *
 * Comments are stripped first: three comment lines across the two covenants contain `==`, and a guard that
 * flagged prose would be worse than one that flagged nothing. Statements are then rejoined and split on `;`
 * rather than on newlines, so a comparison spanning two source lines is one clause.
 */
export function scanComparisons(source: string): ComparisonScan {
  const rejoined = source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ');
  const comparisons = rejoined
    .split(';')
    .flatMap((statement) => statement.split(/&&|\|\|/))
    .filter((clause) => /[=!]=/.test(clause));
  const mentioningLbc = comparisons.filter((clause) => PARTICIPANT_LBC.test(clause));
  // Every ADJACENT comparand pair, not just the first two: a clause can carry more than one operator, and
  // reading only `split(...)[0]` and `[1]` would miss a pairwise comparison that is not the leftmost one.
  const bothSides = comparisons.filter((clause) => {
    const comparands = clause.split(/[=!]=/);
    return comparands.some((left, index) => index + 1 < comparands.length
      && PARTICIPANT_LBC.test(left) && PARTICIPANT_LBC.test(comparands[index + 1]));
  });
  const exempted = bothSides.filter((clause) => SELF_PRESERVATION_EXEMPTION.test(clause));
  return {
    comparisons,
    mentioningLbc,
    bothSides,
    pairwise: bothSides.filter((clause) => !SELF_PRESERVATION_EXEMPTION.test(clause)),
    exempted,
  };
}

/**
 * A POSITIVE CONTROL ON THE DETECTOR, which is what R3-10 is actually asking for.
 *
 * A non-emptiness floor on the clause count says the splitter found something; it does not say the splitter
 * would find THE THING. This source would be a genuine pairwise participant comparison, and it is written
 * across a newline on purpose, so it also pins the line-split blind spot closed. `assertDetectorIsLive`
 * asserting it is flagged is the difference between a guard that is non-vacuous and a guard that is known to
 * work.
 */
export const SYNTHETIC_PAIRWISE_SOURCE = `contract Fake() {
  function f() public {
    require(tx.inputs[participantA].lockingBytecode
      == tx.inputs[participantB].lockingBytecode);
    require(true);
  }
}`;

/** A near-miss: the same shape with a table row on the right, which is the HONEST base binding. */
export const SYNTHETIC_BASE_BINDING_SOURCE = `contract Fake() {
  function f() public {
    require(tx.inputs[participantInput].lockingBytecode
      == frame.slice(6, 6 + lbcLength));
    require(true);
  }
}`;
