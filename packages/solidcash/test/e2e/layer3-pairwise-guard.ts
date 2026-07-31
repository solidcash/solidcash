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
 *  5. X140, closed here. The derivation used to propagate only through `bytes`-typed assignments, so a
 *     row-to-row comparison DECODED INTO SCALARS FIRST was invisible when routed through two `bigint` locals.
 *     `SYNTHETIC_ROW_SCALAR_VIA_LOCALS_SOURCE` reproduced it; the fixtures now require it to be flagged.
 *
 * HOW X140 CLOSES IT WITHOUT CRYING WOLF, AND THE NUMBER THAT SAYS SO. Propagating through EVERY `bigint`
 * assignment was measured and rejected once: the projection verifier goes from 10 derived identifiers and 5
 * both-sides clauses to 38 and 13, and the controller from 4 and 0 to 31 and 8 - 16 further exemptions, all
 * covering the covenants' own bookkeeping (`tail == transcript.length`, `batchCursor == ownerBatch.length`).
 *
 * A scalar inherits row-hood here only when its defining expression takes a SLICE OF a row - `int(...
 * frame.slice(a, b) ...)` - and never when it merely mentions one. That is the difference between "decoded
 * FROM a row" and "computed BESIDE a row", and it is the whole of the noise: `tail`, `batchCursor`,
 * `emissionCursor`, `resultCursor` and `participantInput` are all derived from a row's LENGTH or from a
 * counter, not from a slice of it. Paired with blanking `.slice(...)` BOUNDS - the same argument
 * `stripIndexes` already makes for `[...]`, since a row value used as a bound does not make the result row
 * bytes - the cost is:
 *
 *     projection  10 -> 28 derived,  5 -> 6 both-sides clauses,  1 new exemption
 *     controller   4 -> 23 derived,  0 -> 2 both-sides clauses,  2 new exemptions
 *
 * THREE new named exemptions, not sixteen, and each names a real binding rather than arithmetic. Every control
 * the previous rules had is unchanged by the widening: the honest base binding, the four near-misses and the
 * mutation control on both real sources all behave exactly as before, and `SYNTHETIC_ROW_SCALAR_INLINE_SOURCE`
 * is still flagged. Blanking slice bounds alone leaves the OLD rule's verdicts byte-identical (projection
 * 10/5, controller 4/0), so it is a refinement of the vocabulary and not a relaxation of it.
 *
 * The widening also catches `SYNTHETIC_ROW_SCALAR_DIRECT_SOURCE`, a decode straight off the transcript with no
 * intermediate frame, which the narrower "only via a frame" variant misses at a cost of only one exemption
 * fewer. That variant was measured and rejected for the hole, not for the price.
 *
 * X140'S SECOND-HOP BOUNDARY IS NOW NARROWLY CLOSED. A decoded scalar may seed another scalar only through a
 * syntactic identity: alias/cast, +/- zero, * or / one, xor/shift zero, or a ternary whose arms carry the same
 * provenance. The alias map retains the original row root, so aliases of one decoded field compared to each
 * other are not mistaken for two rows. Non-identity arithmetic remains outside this scope, and the three named
 * binding exemptions and their exact counts remain unchanged.
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
 * X134, extended by X140. Every comparison in the generated covenants that carries TRANSCRIPT BYTES on both
 * sides, each named, each with the reason it is not a row-to-row uniqueness comparison, each asserted PRESENT
 * by the fixtures with an exact clause count. There are eight clauses under seven names: six in the projection
 * verifier and two in the controller.
 *
 * `count` is the count in the PROJECTION verifier and `controllerCount` the count in the controller, both
 * asserted exactly rather than as floors: a further clause landing under an existing name would otherwise be
 * absorbed silently, which is the exact failure mode this guard exists to prevent. Splitting them per covenant
 * is what keeps "this exemption moved covenant" from reading as "this exemption is still fine".
 */
export const ROW_COMPARISON_EXEMPTIONS: readonly {
  name: string; pattern: RegExp; count: number; controllerCount?: number; reason: string;
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
  // X140's three, the entire price of closing the scalar-decoded form. Each names a binding; none is
  // arithmetic dressed up as a finding, which is what the 16-exemption variant would have been.
  {
    name: 'batch-args-length-vs-invocation-row',
    pattern: /\bownerBatch\.slice\([^()]*\)[^=]*\)\s*==\s*argsLength\b/,
    count: 1,
    reason: 'the owner\'s compiled batch args-LENGTH field against the length the INVOCATION row declares - '
      + 'the scalar half of `owner-batch-vs-invocation-row`, and in the same scope: an invocation row is not '
      + 'a participant row',
  },
  {
    name: 'controller-subtree-end-vs-invocation-count',
    pattern: /\bsubtreeEnd\s*==\s*invocationCount\b/,
    count: 0,
    controllerCount: 1,
    reason: 'the last frame\'s subtree end against the number of invocations, both indices into the '
      + 'controller\'s own DFS bookkeeping over ONE record; neither is a participant row',
  },
  {
    name: 'controller-parent-vs-open-frame',
    pattern: /\bparent\s*==\s*openIndex\b/,
    count: 0,
    controllerCount: 1,
    reason: 'the parent an invocation declares against the frame currently open in the controller\'s walk - '
      + 'a tree-shape check inside one record, not a comparison of two participant rows',
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
 * Blank out every `.slice(...)` BOUND expression, innermost first.
 *
 * X140. Exactly the argument `stripIndexes` makes, for the other way a row value can appear without making the
 * result row bytes: `unlocking.slice(6, 6 + batchLength)` is a slice of an UNLOCKING SCRIPT, and `batchLength`
 * being row-derived does not change that. Without this, one row-derived length used as a bound on both sides
 * of a comparison reports the comparison as row-to-row. Measured to leave the pre-X140 rule's verdicts
 * byte-identical (projection 10 derived / 5 both-sides, controller 4 / 0), so it narrows nothing that was
 * being caught.
 */
function stripSliceBounds(text: string): string {
  let stripped = text;
  let previous = '';
  while (stripped !== previous) {
    previous = stripped;
    stripped = stripped.replace(/\.slice\s*\([^()]*\)/g, '.slice()');
  }
  return stripped;
}

/** Both blankings, applied to fixpoint: what is left names only values that CARRY row bytes. */
function normalise(text: string): string {
  return stripSliceBounds(stripIndexes(text));
}

/** True only for syntactic scalar identities; these preserve decoded row provenance without tainting maths. */
function isScalarIdentity(value: string, seed: string): boolean {
  let expression = value.replace(/\s+/g, '');
  let previous = '';
  while (expression !== previous) {
    previous = expression;
    expression = expression.replace(/^(?:int|bigint)\((.*)\)$/, '$1');
    expression = expression.replace(/^\((.*)\)$/, '$1');
  }
  const escaped = seed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const atom = `(?:${escaped})`;
  return new RegExp(`^(?:${atom}|${atom}[+-]0|0\\+${atom}|${atom}\\*1|1\\*${atom}|${atom}/1|`
    + `${atom}\\^0|0\\^${atom}|${atom}(?:<<|>>)0|[^?]+\\?${atom}:${atom})$`).test(expression);
}

/**
 * X134, widened by X140. Which identifiers carry transcript bytes, computed rather than listed.
 *
 * Seeded from the `bytes` PARAMETERS of the covenant's functions - the transcript is the only one in either
 * generated source - and propagated to fixpoint:
 *
 *   - a `bytes`-declared target inherits when its defining expression NAMES a row (X134);
 *   - any other target inherits only when its defining expression takes a SLICE OF one (X140), which is the
 *     difference between a field decoded FROM a row and a counter computed BESIDE one. The header carries the
 *     measurement: 3 new exemptions this way against 16 for propagating through every `bigint`.
 *
 * A scalar may seed another scalar only through `isScalarIdentity`; arbitrary arithmetic does not inherit.
 * The recorded two-hop `+ 0` hole is pinned by `SYNTHETIC_ROW_SCALAR_TWO_HOP_SOURCE`.
 *
 * Computing the set instead of naming it is the point. A generator that renames `frame` to anything else is
 * still covered, which is the failure this guard has now had four times.
 */
function rowDerivedIdentifiers(rejoined: string): { derived: string[]; aliases: Map<string, string> } {
  const bytesDeclared = new Set<string>();
  for (const match of rejoined.matchAll(/\bbytes(?:\d+)?\s+([A-Za-z_]\w*)/g)) bytesDeclared.add(match[1]);
  const derived = new Set<string>();
  const aliases = new Map<string, string>();
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
      const assignment =
        /^\s*(?:(?:bytes(?:\d+)?|bigint|int)\s+)?([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/.exec(statement);
      if (!assignment) continue;
      const [, target, value] = assignment;
      if (derived.has(target)) continue;
      const carriesBytes = bytesDeclared.has(target);
      const stripped = normalise(value);
      for (const seed of derived) {
        if (!new RegExp(`\\b${seed}\\b`).test(stripped)) continue;
        // A non-`bytes` target must be DECODED FROM the row, not merely computed in its company. The slice
        // is looked for in the raw value: `normalise` has blanked the bounds, so `frame.slice()` survives as
        // the evidence while `usedMask.slice(0, participantCount)` no longer makes `participantCount` a row.
        const identity = isScalarIdentity(value, seed);
        if (!carriesBytes
          && !new RegExp(`\\b${seed}\\s*\\.\\s*slice\\s*\\(`).test(stripIndexes(value))
          && !identity) continue;
        if (identity) aliases.set(target, seed);
        derived.add(target);
        changed = true;
        break;
      }
    }
  }
  return { derived: [...derived], aliases };
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
  const { derived: rowDerived, aliases } = rowDerivedIdentifiers(rejoined);
  const carriesRow = (text: string): boolean => {
    const stripped = normalise(text);
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
  const aliasRoot = (name: string): string => {
    const seen = new Set<string>();
    let root = name;
    while (aliases.has(root) && !seen.has(root)) {
      seen.add(root);
      root = aliases.get(root)!;
    }
    return root;
  };
  const rootsIn = (text: string): Set<string> => new Set(rowDerived
    .filter((seed) => new RegExp(`\\b${seed}\\b`).test(normalise(text))).map(aliasRoot));
  const detectedRowBothSides = comparisons.filter((clause) => {
    const comparands = clause.split(/[=!]=/);
    return comparands.some((left, index) => {
      if (index + 1 >= comparands.length) return false;
      // A non-neutral arithmetic transform is not comparing the decoded row value; it is bookkeeping over it.
      if (/[+\-*/]|<<|>>|\^/.test(normalise(left).replace(/[+\-]\s*0|\*\s*1|\/\s*1|(?:<<|>>)\s*0|\^\s*0/g, ''))
        || /[+\-*/]|<<|>>|\^/.test(normalise(comparands[index + 1])
          .replace(/[+\-]\s*0|\*\s*1|\/\s*1|(?:<<|>>)\s*0|\^\s*0/g, ''))) return false;
      const leftRoots = rootsIn(left);
      const rightRoots = rootsIn(comparands[index + 1]);
      if (leftRoots.size === 0 || rightRoots.size === 0) return false;
      const differ = [...leftRoots].some((root) => !rightRoots.has(root))
        || [...rightRoots].some((root) => !leftRoots.has(root));
      if (differ) return true;
      const usesAlias = (text: string): boolean => [...aliases.keys()]
        .some((name) => new RegExp(`\\b${name}\\b`).test(text));
      return !usesAlias(left) && !usesAlias(comparands[index + 1]);
    });
  });
  // Named generator bindings remain in the measured population even when both operands resolve to one
  // provenance root; their exact counts are the guard against silently broadening an exemption.
  const rowBothSides = [...new Set([
    ...detectedRowBothSides,
    ...comparisons.filter((clause) => onBothSides(clause, carriesRow)
      && ROW_COMPARISON_EXEMPTIONS.some((exemption) => exemption.pattern.test(clause))),
  ])];
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

/** Inject X140's decoded-scalar identity chain into the real generated participant loop. */
export function injectScalarAliasPairwiseComparison(source: string): string {
  if (!source.includes(BASE_BINDING_ANCHOR)) {
    throw new Error('layer3-pairwise-guard: the base-binding anchor is gone from the generated covenant');
  }
  return source.replace(BASE_BINDING_ANCHOR, `${BASE_BINDING_ANCHOR}
      bigint __x140Left = int(bytes.concat(frame.slice(0, 2), hex"00"));
      bigint __x140Right = int(bytes.concat(transcript.slice(cursor, cursor + 2), hex"00"));
      bigint __x140LeftAgain = __x140Left + 0;
      bigint __x140RightAgain = __x140Right + 0;
      require(__x140LeftAgain == __x140RightAgain);`);
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
 * X140'S REPRODUCTION, now CLOSED: the same comparison routed through two `bigint` locals. Each local is
 * decoded from a SLICE of a row, so each inherits row-hood and the clause is flagged. The fixtures assert both
 * halves - it was the recorded hole, and it is now the thing the widening exists to catch.
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
 * The frameless spelling: two scalars decoded straight off the transcript at two cursors, with no intermediate
 * `bytes` local for a "only via a frame" rule to key on. Flagged, and the reason the narrower variant was
 * rejected - it misses this and saves exactly one exemption.
 */
export const SYNTHETIC_ROW_SCALAR_DIRECT_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bigint one = int(bytes.concat(transcript.slice(a, a + 2), hex"00"));
    bigint two = int(bytes.concat(transcript.slice(b, b + 2), hex"00"));
    require(one == two);
    require(true);
  }
}`;

/**
 * X140'S FORMER RECORDED BOUNDARY: the same comparison with one more hop through a neutral scalar identity.
 * The fixtures require this to be flagged while the real-source measurements retain exactly three exemptions.
 */
export const SYNTHETIC_ROW_SCALAR_TWO_HOP_SOURCE = `contract Fake() {
  function f(bytes transcript, bigint a, bigint b) public {
    bytes frame = transcript.slice(a, transcript.length);
    bytes otherFrame = transcript.slice(b, transcript.length);
    bigint one = int(bytes.concat(frame.slice(0, 2), hex"00"));
    bigint two = int(bytes.concat(otherFrame.slice(0, 2), hex"00"));
    bigint oneAgain = one + 0;
    bigint twoAgain = two + 0;
    require(oneAgain == twoAgain);
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
