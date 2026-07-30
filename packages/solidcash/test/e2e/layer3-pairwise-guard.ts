/**
 * R3-10 / X134. THE SCOPE GUARD BEHIND "no covenant compares participant rows to each other", WITH THE
 * LIVENESS CONTROLS IT DID NOT HAVE.
 *
 * The claim is a scope claim about the deployed covenants: owner uniqueness lives entirely in the SDK planner
 * (`planCompiledGraph` refuses two rows naming one locking bytecode) and nothing on chain compares two
 * participant rows to each other. Two fixtures assert it - `Layer3BoundedMaximumGraphC3.test.ts` and
 * `Layer3ReviewA1.test.ts` - and both used to assert it the same way and with the same omission, which is why
 * the detector now lives here once instead of twice.
 *
 * WHAT WENT WRONG, in the same guard, at four levels:
 *
 *  1. The FIRST version hunted the identifiers `participantLbcN == participantLbcM`. X65 replaced the 8-way
 *     dispatch with an input-index table, those identifiers stopped existing, and the regex could never match
 *     again. The guard was green and checked nothing.
 *  2. The SECOND version expressed the property instead of the spelling - no comparison may carry a participant
 *     locking bytecode on both sides - but asserted only that the filtered result was EMPTY. Nothing asserted
 *     the splitter had found any comparison at all, so a generator that emitted comparisons differently would
 *     have yielded `[]` and passed. That is the same defect one level out.
 *  3. Both versions split the source on newlines before splitting on `&&`/`||`, and the generated covenants put
 *     the right-hand comparand of nine comparisons on its own line (7 in the projection verifier, 2 in the
 *     controller). A line splitter sees `foo` and `== bar` as two separate clauses, and `''.split('==')[0]`
 *     matches nothing, so ANY pairwise comparison written across two lines was invisible. Rejoining statements
 *     before splitting closed that, and immediately revealed the one real both-sides comparison in the tree.
 *  4. X134, closed here. The detector's whole vocabulary was `lockingBytecode|participantLbc`. A row-to-row
 *     comparison written as `frame.slice(a) == otherFrame.slice(b)` - two table rows compared directly, NEITHER
 *     side naming a locking bytecode - was silent under that vocabulary. It is reproduced by
 *     `SYNTHETIC_ROW_PAIRWISE_SOURCE` and the fixtures assert both halves: the locking-bytecode rule sees
 *     nothing, the row rule flags it.
 *
 * THE ONE BOTH-SIDES LOCKING-BYTECODE COMPARISON, which the line splitter could not see: the root controller
 * carries `tx.outputs[this.activeInputIndex].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode`.
 * It is not a row-to-row comparison: it is the controller preserving its OWN script at its OWN index, at one
 * index rather than between two participants. It is exempted BY NAME below and its presence is ASSERTED.
 *
 * WHY THE ROW RULE COULD NOT SIMPLY WIDEN THE VOCABULARY. `lockingBytecode` on one side and a table row on the
 * other is the HONEST base binding both covenants are built on -
 * `tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength)` - so a union vocabulary would
 * flag the very comparison the design depends on. The row rule is therefore a SECOND, independent rule over a
 * different population, not a widening of the first.
 *
 * WHAT IS STILL OPEN, WITH THE MEASUREMENT THAT SAYS WHY. The derivation propagates only through `bytes`-typed
 * assignments, so a row-to-row comparison DECODED INTO SCALARS FIRST is invisible: written inline it is caught
 * (the clause names both frames), written through two `bigint` locals it is not. Both forms are pinned below by
 * `SYNTHETIC_ROW_SCALAR_INLINE_SOURCE` and `SYNTHETIC_ROW_SCALAR_VIA_LOCALS_SOURCE`, the second asserting the
 * CURRENT boundary, so it is a recorded limit rather than an unknown.
 *
 * Propagating through scalars too was measured and rejected. Every field in both loops is decoded from the
 * transcript, so scalar propagation marks nearly every identifier: the projection verifier goes from 10 derived
 * identifiers and 5 both-sides clauses to 38 and 13, and the controller from 4 and 0 to 31 and 8. The 16 new
 * clauses are the covenants' own bookkeeping - `tail == transcript.length`, `batchCursor == ownerBatch.length`,
 * `parent == openIndex`, `subtreeEnd == invocationCount - 1` - so closing this form costs 16 more named
 * exemptions covering the arithmetic, which is a detector that cries wolf rather than one that reports. The
 * scalar form is left open deliberately and measured, not overlooked.
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

/**
 * X134. Every comparison in the generated covenants that carries TRANSCRIPT BYTES on both sides, each named,
 * each with the reason it is not a row-to-row uniqueness comparison, each asserted PRESENT by the fixtures with
 * an exact clause count. There are five clauses under four names and all five are in the projection verifier;
 * the controller has none.
 *
 * `count` is asserted exactly, not as a floor: a sixth clause landing under an existing name would otherwise be
 * absorbed silently, which is the exact failure mode this guard exists to prevent.
 */
export const ROW_COMPARISON_EXEMPTIONS: readonly {
  name: string; pattern: RegExp; count: number; reason: string;
}[] = [
  {
    name: 'owner-emissions-vs-canonical-row',
    pattern: /\bownerEmissions\.slice\([^()]*\)\s*==\s*expectedRow\b/,
    count: 1,
    reason: 'the owner\'s own emission bytes against the canonical row rebuilt from the invocation record; '
      + 'cross-row because `expectedRow` carries the CALLEE row\'s length header, but it is the emission '
      + 'binding, not a check that two rows differ',
  },
  {
    name: 'owner-callers-vs-caller-identity',
    pattern: /\bownerCallers\.slice\([^()]*\)\s*==\s*expectedCaller\b/,
    count: 1,
    reason: 'the owner\'s declared caller against the CALLER row\'s length header plus the script physically '
      + 'co-spent at that row\'s base; a binding of one row to one other named row, not a comparison for '
      + 'uniqueness',
  },
  {
    name: 'owner-batch-vs-invocation-row',
    pattern: /\bownerBatch\.slice\([^()]*\)\s*==\s*row\.slice\([^()]*\)/,
    count: 2,
    reason: 'the owner\'s compiled batch against the INVOCATION row it answers - selector, then arguments. '
      + 'An invocation row is not a participant row, so neither clause is in the claim\'s scope',
  },
  {
    name: 'owner-result-vector-vs-invocation-row',
    pattern: /\bresultVector\.slice\([^()]*\)\s*==\s*row\.slice\([^()]*\)/,
    count: 1,
    reason: 'the owner\'s returned bytes against the INVOCATION row that declares them; same scope note as '
      + 'the batch clauses above',
  },
];

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
  /** X134: identifiers PROVEN to carry transcript bytes, by derivation rather than by name. */
  rowDerived: string[];
  /** Comparisons carrying transcript bytes on at least one side - the row rule's live population. */
  mentioningRow: string[];
  /** Comparisons carrying transcript bytes on BOTH sides of one operator, exemptions included. */
  rowBothSides: string[];
  /** `rowBothSides` minus the named row exemptions: the shape X134 says does not exist. */
  rowPairwise: string[];
  /** Exemption name to the number of clauses it matched, so each can be asserted present. */
  rowExempted: Record<string, number>;
}

/** Strip comments, rejoin lines, collapse whitespace. Multi-line comparisons become one clause. */
function rejoin(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Blank out every `[...]` index expression, innermost first.
 *
 * A row value used as an INDEX does not make the result row bytes: `tx.inputs[<row byte>].lockingBytecode` is a
 * script physically co-spent at a position the transcript chose, not a slice of the transcript. Without this,
 * the honest base binding and both index-table lookups would be reported as carrying row bytes.
 */
function stripIndexes(text: string): string {
  let stripped = text;
  let previous = '';
  while (stripped !== previous) {
    previous = stripped;
    stripped = stripped.replace(/\[[^[\]]*\]/g, '[]');
  }
  return stripped;
}

/**
 * X134. Which identifiers carry transcript bytes, computed rather than listed.
 *
 * Seeded from the `bytes` PARAMETERS of the covenant's functions - the transcript is the only one in either
 * generated source - and propagated to fixpoint through assignments whose target is `bytes`-declared. Typed
 * propagation is what keeps it usable: every scalar field in the loops is decoded from the transcript too, so
 * propagating through `bigint` would mark `participantInput == expectedParticipantInput` as a row comparison
 * and the rule would report nothing but noise.
 *
 * Computing the set instead of naming it is the point. A generator that renames `frame` to anything else is
 * still covered, which is the failure this guard has now had four times.
 */
function rowDerivedIdentifiers(rejoined: string): string[] {
  const bytesDeclared = new Set<string>();
  for (const match of rejoined.matchAll(/\bbytes(?:\d+)?\s+([A-Za-z_]\w*)/g)) bytesDeclared.add(match[1]);
  const derived = new Set<string>();
  for (const fn of rejoined.matchAll(/\bfunction\s+\w+\s*\(([^)]*)\)/g)) {
    for (const parameter of fn[1].split(',')) {
      const named = /^\s*bytes\s+([A-Za-z_]\w*)\s*$/.exec(parameter);
      if (named) derived.add(named[1]);
    }
  }
  const statements = rejoined.split(/[;{}]/);
  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of statements) {
      const assignment = /^\s*(?:bytes(?:\d+)?\s+)?([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/.exec(statement);
      if (!assignment) continue;
      const [, target, value] = assignment;
      if (!bytesDeclared.has(target) || derived.has(target)) continue;
      const stripped = stripIndexes(value);
      for (const seed of derived) {
        if (new RegExp(`\\b${seed}\\b`).test(stripped)) { derived.add(target); changed = true; break; }
      }
    }
  }
  return [...derived];
}

/**
 * Scan one generated covenant source for comparisons that compare participant rows to each other.
 *
 * TWO independent rules over one clause population. Rule 1 is a participant locking bytecode on both sides of
 * one operator. Rule 2 (X134) is transcript-derived bytes on both sides, which catches the row-to-row shape
 * that names no locking bytecode at all.
 *
 * Comments are stripped first: three comment lines across the two covenants contain `==`, and a guard that
 * flagged prose would be worse than one that flagged nothing. Statements are then rejoined and split on `;` and
 * on braces rather than on newlines, so a comparison spanning two source lines is one clause and an `if`
 * header is not glued to the statement it guards.
 */
export function scanComparisons(source: string): ComparisonScan {
  const rejoined = rejoin(source);
  const comparisons = rejoined
    .split(/[;{}]/)
    .flatMap((statement) => statement.split(/&&|\|\|/))
    .filter((clause) => /[=!]=/.test(clause));
  const rowDerived = rowDerivedIdentifiers(rejoined);
  const carriesRow = (text: string): boolean => {
    const stripped = stripIndexes(text);
    return rowDerived.some((seed) => new RegExp(`\\b${seed}\\b`).test(stripped));
  };
  // Every ADJACENT comparand pair, not just the first two: a clause can carry more than one operator, and
  // reading only `split(...)[0]` and `[1]` would miss a comparison that is not the leftmost one.
  const onBothSides = (clause: string, carries: (text: string) => boolean): boolean => {
    const comparands = clause.split(/[=!]=/);
    return comparands.some((left, index) => index + 1 < comparands.length
      && carries(left) && carries(comparands[index + 1]));
  };
  const mentioningLbc = comparisons.filter((clause) => PARTICIPANT_LBC.test(clause));
  const bothSides = comparisons.filter((clause) => onBothSides(clause, (text) => PARTICIPANT_LBC.test(text)));
  const rowBothSides = comparisons.filter((clause) => onBothSides(clause, carriesRow));
  const rowExempted: Record<string, number> = {};
  for (const exemption of ROW_COMPARISON_EXEMPTIONS) {
    rowExempted[exemption.name] = rowBothSides.filter((clause) => exemption.pattern.test(clause)).length;
  }
  return {
    comparisons,
    mentioningLbc,
    bothSides,
    pairwise: bothSides.filter((clause) => !SELF_PRESERVATION_EXEMPTION.test(clause)),
    exempted: bothSides.filter((clause) => SELF_PRESERVATION_EXEMPTION.test(clause)),
    rowDerived,
    mentioningRow: comparisons.filter((clause) => carriesRow(clause)),
    rowBothSides,
    rowPairwise: rowBothSides.filter(
      (clause) => !ROW_COMPARISON_EXEMPTIONS.some((exemption) => exemption.pattern.test(clause)),
    ),
    rowExempted,
  };
}

/** The anchor the injection below hangs on: the honest base binding, present in BOTH generated covenants. */
export const BASE_BINDING_ANCHOR =
  'require(tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength));';

/**
 * A MUTATION CONTROL ON THE REAL SOURCE, which is the strongest anti-vacuity control available here.
 *
 * A synthetic positive control proves the detector can see a shape in a source the guard wrote. This proves it
 * would see that shape in the source the GENERATOR wrote, by adding one row-to-row comparison to the real
 * participant loop and nothing else. It throws when the anchor is gone, so the control cannot outlive its
 * subject - which is the exact way this guard died the first time.
 */
export function injectPairwiseComparison(source: string): string {
  if (!source.includes(BASE_BINDING_ANCHOR)) {
    throw new Error('layer3-pairwise-guard: the base-binding anchor is gone from the generated covenant, so '
      + 'the mutation control cannot be applied. Re-anchor it on the current participant loop - do NOT delete '
      + 'it, or the row rule below goes back to being asserted only against sources this file wrote.');
  }
  return source.replace(BASE_BINDING_ANCHOR, `${BASE_BINDING_ANCHOR}
      require(frame.slice(6, 6 + lbcLength) == transcript.slice(cursor + 6, cursor + 6 + lbcLength));`);
}

/**
 * A POSITIVE CONTROL ON RULE 1, which is what R3-10 is actually asking for.
 *
 * A non-emptiness floor on the clause count says the splitter found something; it does not say the splitter
 * would find THE THING. This source would be a genuine pairwise participant comparison, and it is written
 * across a newline on purpose, so it also pins the line-split blind spot closed.
 */
export const SYNTHETIC_PAIRWISE_SOURCE = `contract Fake() {
  function f() public {
    require(tx.inputs[participantA].lockingBytecode
      == tx.inputs[participantB].lockingBytecode);
    require(true);
  }
}`;

/**
 * A near-miss: the same shape with a table row on the right, which is the HONEST base binding.
 *
 * X134 seeds `frame` from the transcript here, which it did not do before. Without that the row rule had
 * nothing to derive and this control was vacuous FOR THE NEW RULE while still reading like a near-miss - the
 * same species of quiet vacuity this file exists to record.
 */
export const SYNTHETIC_BASE_BINDING_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint cursor) public {
    bytes frame = transcript.slice(cursor, transcript.length);
    require(tx.inputs[participantInput].lockingBytecode
      == frame.slice(6, 6 + lbcLength));
    require(true);
  }
}`;

/**
 * X134'S REPRODUCTION. Two table rows compared directly, NEITHER side naming a locking bytecode, written
 * across a newline so it also stays inside the rejoin's remit. Rule 1 is silent on this and the fixtures assert
 * that it is - the hole is recorded, not just patched.
 */
export const SYNTHETIC_ROW_PAIRWISE_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes otherFrame = transcript.slice(b, transcript.length);
    require(frame.slice(6, 20)
      == otherFrame.slice(6, 20));
    require(true);
  }
}`;

/**
 * The row-table variant, and the likelier one in THIS generator: the projection verifier keeps every
 * participant's header in one accumulator, so a uniqueness check would most naturally compare that accumulator
 * to itself at two different row strides. One base identifier, two rows.
 */
export const SYNTHETIC_ROW_TABLE_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes lbcHeaders = hex"";
    lbcHeaders = bytes.concat(lbcHeaders, frame.slice(0, 6));
    require(lbcHeaders.slice(a * 6, a * 6 + 2) == lbcHeaders.slice(b * 6, b * 6 + 2));
    require(true);
  }
}`;

/**
 * The scalar form, HALF of which the rule catches: two rows compared after decoding, written inline. The clause
 * names both frames, so the row rule sees it. Asserted flagged.
 */
export const SYNTHETIC_ROW_SCALAR_INLINE_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes otherFrame = transcript.slice(b, transcript.length);
    require(int(bytes.concat(frame.slice(0, 2), hex"00"))
      == int(bytes.concat(otherFrame.slice(0, 2), hex"00")));
    require(true);
  }
}`;

/**
 * THE RECORDED HOLE, and the reason it is recorded rather than closed: the same comparison routed through two
 * `bigint` locals. The derivation stops at `bytes`, so neither comparand names a row and the rule is silent.
 *
 * The fixtures assert this is NOT flagged. That is not an endorsement - it is the boundary written down where
 * it can be seen, so closing it later is a deliberate change with a visible before. The header block above
 * carries the measurement (16 new exemptions) that says why widening to scalars is the wrong trade today.
 */
export const SYNTHETIC_ROW_SCALAR_VIA_LOCALS_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes otherFrame = transcript.slice(b, transcript.length);
    bigint one = int(bytes.concat(frame.slice(0, 2), hex"00"));
    bigint two = int(bytes.concat(otherFrame.slice(0, 2), hex"00"));
    require(one == two);
    require(true);
  }
}`;

/**
 * The row rule's OVER-REPORTING controls, all four legitimate shapes the two covenants actually use: a row
 * against a header literal, a row against a hash of the whole transcript, a row against an unlocking bytecode,
 * and a mask against a constant. None may be flagged.
 */
export const SYNTHETIC_ROW_NEAR_MISS_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes unlocking = tx.inputs[a].unlockingBytecode;
    bytes usedMask = hex"0000000000000000";
    require(transcript.slice(0, 9) == hex"4c3347524150483100");
    require(tx.inputs[a].nftCommitment == sha256(transcript));
    require(unlocking.slice(6, 20) == frame.slice(6, 20));
    usedMask = bytes.concat(usedMask.slice(0, a), hex"01", usedMask.slice(a + 1, 8));
    require(usedMask.slice(0, b) == hex"0101010101010101".slice(0, b));
    require(true);
  }
}`;
