import { binToHex } from '@bitauth/libauth';
import { Op, Script } from './script.js';
import { FullLocationData } from './types.js';

/**
 * Cross-function bytecode outlining.
 *
 * A BCH-2026 `OP_INVOKE` evaluates a function body "as if it were the active bytecode (without resetting the
 * stack, alternate stack, or evaluation limits)". A byte-identical instruction span that appears in several
 * OP_DEFINE'd bodies can therefore be moved verbatim into its own function and replaced at each site by
 * `<id> OP_INVOKE`, with no change to observable semantics.
 *
 * Three properties make a span relocatable, and all three are enforced below:
 *
 * 1. Control flow is self-contained: OP_IF/OP_NOTIF/OP_BEGIN open and OP_ENDIF/OP_UNTIL close inside the span,
 *    and the nesting depth never drops below where the span started. A span that straddles a branch would leave
 *    the interpreter's control stack unbalanced across the invoke boundary.
 * 2. It defines nothing: OP_DEFINE inside a shared body would run again on the second invoke and fail with
 *    "function identifier previously defined".
 * 3. It reads no bytecode-relative context. OP_ACTIVEBYTECODE returns the *function body* once invoked, not the
 *    enclosing script; OP_CODESEPARATOR moves the signing checkpoint; and OP_CHECKSIG and friends sign the
 *    active bytecode, so moving one would change both the sighash preimage and the body the SDK reports as
 *    that function's signing bytecode. All are excluded.
 *
 * Spans are relocatable byte-wise because each Script element encodes independently, so the emitted bytes of a
 * span are the same wherever they appear.
 */

const OPEN_OPS = new Set<number>([Op.OP_IF, Op.OP_NOTIF, Op.OP_BEGIN]);
const CLOSE_OPS = new Set<number>([Op.OP_ENDIF, Op.OP_UNTIL]);
// Never relocate: see properties (2) and (3) above.
const BARRIER_OPS = new Set<number>([
  Op.OP_DEFINE, Op.OP_ACTIVEBYTECODE, Op.OP_CODESEPARATOR,
  Op.OP_CHECKSIG, Op.OP_CHECKSIGVERIFY, Op.OP_CHECKMULTISIG, Op.OP_CHECKMULTISIGVERIFY,
]);

// Smallest match considered. Below this a span cannot repay one id push plus OP_INVOKE per site.
const MINIMUM_WINDOW_ELEMENTS = 8;
// Candidate groups examined per round, most-repeated first. Bounds the per-round extension work.
const CANDIDATE_GROUPS_PER_ROUND = 4096;
// Only the strongest measured candidates enter the overlap-selection phase. Separating this from the search
// frontier lets large lower-frequency spans compete without allowing thousands of marginal spans to crowd it.
const PROFITABLE_CANDIDATES_PER_ROUND = 512;
// Rounds of outlining. Each round applies every disjoint profitable candidate it finds, so a handful of rounds
// reaches the fixed point; the cap only bounds pathological inputs.
const MAXIMUM_ROUNDS = 6;
// Compact helper identifiers descend from -12, so an outlined id encodes in one or two VM-number bytes: a push
// of at most three bytes. Costing every site at that width can under-state a saving but never over-state one.
const PROBE_IDENTIFIER_PUSH_BYTES = 3;
// Keeps allocated identifiers inside the two-byte VM-number range the cost model above assumes.
const MAXIMUM_OUTLINED_FUNCTIONS = 4096;

export interface OutlineBody {
  script: Script;
  locationData: FullLocationData;
  /**
   * Instruction indices that must stay in this body. The SDK attributes a failing evaluation by matching the
   * VM's reported instruction pointer against the require/log pointers recorded for the function; an anchor that
   * moved into a shared function would report a pointer in the wrong instruction space and lose the attribution.
   */
  anchors?: readonly number[];
}

export interface OutlinedFunction {
  id: Uint8Array;
  script: Script;
  locationData: FullLocationData;
}

export interface OutlinedBody extends OutlineBody {
  /**
   * Original instruction index -> index in the rewritten body. Instructions that moved into a shared function
   * map to their `OP_INVOKE` site, so require/log instruction pointers still land on executable code.
   */
  indexMap: number[];
}

export interface OutlineResult {
  bodies: OutlinedBody[];
  functions: OutlinedFunction[];
  savedBytes: number;
}

const elementKey = (element: Script[number]): string =>
  (typeof element === 'number' ? `o${element}` : `d${binToHex(element)}`);

const isParameterElement = (element: Script[number]): boolean => element instanceof Uint8Array
  || (typeof element === 'number' && (element === Op.OP_0 || element === Op.OP_1NEGATE
    || (element >= Op.OP_1 && element <= Op.OP_16)));

/** Encoded size of one Script element, mirroring libauth's minimal `encodeDataPush`. */
const elementByteSize = (element: Script[number]): number => {
  if (typeof element === 'number') return 1;
  const { length } = element;
  if (length === 0) return 1;
  if (length === 1 && ((element[0] !== 0 && element[0] <= 16) || element[0] === 129)) return 1;
  if (length <= 75) return length + 1;
  if (length <= 255) return length + 2;
  return length + 3;
};

const controlDelta = (element: Script[number]): number => {
  if (typeof element !== 'number') return 0;
  if (OPEN_OPS.has(element)) return 1;
  if (CLOSE_OPS.has(element)) return -1;
  return 0;
};

const isBarrier = (element: Script[number]): boolean =>
  typeof element === 'number' && BARRIER_OPS.has(element);

/**
 * Longest balanced, barrier-free sub-span of `elements`, measured in encoded bytes.
 *
 * `firstIndexAtDepth` holds, per nesting depth, the earliest index still reachable without having dropped below
 * that depth. Every decrease drops the deeper entries, so a later hit on the same depth is guaranteed not to
 * have dipped below it in between - exactly the balance condition an invoked body needs.
 *
 * OP_ELSE needs its own rule. It carries delta 0, so depth alone cannot tell an OP_ELSE nested inside the span
 * from one whose OP_IF sits outside it: a span running from just after an OP_IF to just before its OP_ENDIF is
 * depth-balanced yet leaves the OP_ELSE dangling, and the invoked body aborts with "OP_ELSE outside of a
 * conditional". Reaching one therefore retires every candidate start at the current depth, keeping only starts
 * shallower than it - those have the matching OP_IF inside the span.
 */
function longestBalancedSpan(
  elements: Script, anchored: (index: number) => boolean,
): { start: number; end: number; bytes: number } {
  // Prefix byte sizes make every candidate's encoded length an O(1) subtraction.
  const prefixBytes = new Array<number>(elements.length + 1).fill(0);
  for (let i = 0; i < elements.length; i += 1) {
    prefixBytes[i + 1] = prefixBytes[i] + elementByteSize(elements[i]);
  }
  let best = { start: 0, end: 0, bytes: 0 };
  let depth = 0;
  let firstIndexAtDepth = new Map<number, number>([[0, 0]]);
  for (let i = 0; i < elements.length; i += 1) {
    if (isBarrier(elements[i]) || anchored(i)) {
      depth = 0;
      firstIndexAtDepth = new Map<number, number>([[0, i + 1]]);
      continue;
    }
    if (elements[i] === Op.OP_ELSE) firstIndexAtDepth.delete(depth);
    const previousDepth = depth;
    depth += controlDelta(elements[i]);
    if (depth < 0) {
      depth = 0;
      firstIndexAtDepth = new Map<number, number>([[0, i + 1]]);
      continue;
    }
    if (depth < previousDepth) {
      for (const key of [...firstIndexAtDepth.keys()]) {
        if (key > depth) firstIndexAtDepth.delete(key);
      }
    }
    const start = firstIndexAtDepth.get(depth);
    if (start === undefined) {
      firstIndexAtDepth.set(depth, i + 1);
      continue;
    }
    const bytes = prefixBytes[i + 1] - prefixBytes[start];
    if (bytes > best.bytes) best = { start, end: i + 1, bytes };
  }
  return best;
}

interface Occurrence { body: number; start: number }
interface CandidateOccurrence extends Occurrence {
  parameters: Script;
  originalBytes: number;
}

interface Candidate {
  span: Script;
  bytes: number;
  sourceSpanLength: number;
  parameterOffsets: number[];
  occurrences: CandidateOccurrence[];
  saved: number;
}

function candidateSavings(
  candidate: Pick<Candidate, 'bytes'>,
  occurrences: readonly CandidateOccurrence[],
  idPushBytes: number,
): number {
  const definitionOverhead = candidate.bytes < 76 ? 1 : candidate.bytes < 256 ? 2 : 3;
  const definitionCost = definitionOverhead + candidate.bytes + idPushBytes + 1;
  const original = occurrences.reduce((total, occurrence) => total + occurrence.originalBytes, 0);
  const sites = occurrences.reduce<number>((total, occurrence) => total
    + occurrence.parameters.reduce<number>((bytes, parameter) => bytes + elementByteSize(parameter), 0)
    + idPushBytes + 1, 0);
  return original - definitionCost - sites;
}

/**
 * Every profitable outlining candidate across `bodies`, best-saving first.
 *
 * Windows are bucketed by a rolling hash over per-element key ids rather than by joined strings: the corpus is
 * scanned once per round, and only same-bucket groups pay for an element-by-element comparison.
 */
function findCandidates(
  bodies: OutlineBody[], idPushBytes: number, parameterize: boolean, candidateLimit: number,
): Candidate[] {
  const windowElements = MINIMUM_WINDOW_ELEMENTS;
  const keyIds = new Map<string, number>();
  const idOf = (element: Script[number]): number => {
    const key = elementKey(element);
    const existing = keyIds.get(key);
    if (existing !== undefined) return existing;
    const assigned = keyIds.size + 1;
    keyIds.set(key, assigned);
    return assigned;
  };
  const bodyIds = bodies.map((body) => body.script.map(idOf));
  // In the second phase data pushes are parameters at discovery; opcodes must still match exactly. Profitability
  // below decides whether moving the differing pushes to the callsite actually saves bytes.
  const templateIds = bodies.map((body) => body.script.map((element) =>
    (isParameterElement(element) ? 0 : idOf(element))));
  const matchingIds = parameterize ? templateIds : bodyIds;

  const windows = new Map<number, Occurrence[]>();
  matchingIds.forEach((ids, bodyIndex) => {
    for (let i = 0; i + windowElements <= ids.length; i += 1) {
      let hash = 0;
      for (let j = 0; j < windowElements; j += 1) hash = (Math.imul(hash, 31) + ids[i + j]) | 0;
      const group = windows.get(hash) ?? [];
      group.push({ body: bodyIndex, start: i });
      windows.set(hash, group);
    }
  });

  // A hash bucket can mix distinct windows; split each bucket on the actual element ids before extending.
  const groups: Occurrence[][] = [];
  for (const bucket of windows.values()) {
    if (bucket.length < 2) continue;
    const exact = new Map<string, Occurrence[]>();
    for (const occurrence of bucket) {
      const ids = matchingIds[occurrence.body];
      const key = ids.slice(occurrence.start, occurrence.start + windowElements).join(',');
      const group = exact.get(key) ?? [];
      group.push(occurrence);
      exact.set(key, group);
    }
    for (const group of exact.values()) if (group.length >= 2) groups.push(group);
  }
  groups.sort((left, right) => right.length - left.length);

  const candidates: Candidate[] = [];
  for (const group of groups.slice(0, CANDIDATE_GROUPS_PER_ROUND)) {
    // Grow the match while every occurrence still agrees, so the balance scan sees the full common region.
    let length = windowElements;
    for (;;) {
      const first = group[0];
      const at = length;
      if (first.start + at >= matchingIds[first.body].length) break;
      const id = matchingIds[first.body][first.start + at];
      const agrees = group.every((occurrence) => {
        const ids = matchingIds[occurrence.body];
        return occurrence.start + at < ids.length && ids[occurrence.start + at] === id;
      });
      if (!agrees) break;
      length += 1;
    }

    const head = group[0];
    const region = bodies[head.body].script.slice(head.start, head.start + length);
    // A span is only relocatable if it is anchor-free at *every* occurrence, so test them all against one
    // region-relative index space.
    const anchorSets = group.map((occurrence) => ({
      offset: occurrence.start,
      anchors: bodies[occurrence.body].anchors,
    }));
    const anchored = (index: number): boolean => anchorSets.some(({ offset, anchors }) =>
      anchors !== undefined && anchors.includes(offset + index));
    const balanced = longestBalancedSpan(region, anchored);
    if (balanced.bytes === 0) continue;

    // Overlapping copies cannot both be replaced; keep a maximal non-overlapping subset in body order.
    const spanLength = balanced.end - balanced.start;
    const starts = group
      .map((occurrence) => ({ body: occurrence.body, start: occurrence.start + balanced.start }))
      .sort((left, right) => left.body - right.body || left.start - right.start);
    const startsKept: Occurrence[] = [];
    for (const occurrence of starts) {
      const previous = startsKept[startsKept.length - 1];
      if (previous && previous.body === occurrence.body && occurrence.start < previous.start + spanLength) continue;
      startsKept.push(occurrence);
    }
    if (startsKept.length < 2) continue;

    const parameterOffsets: number[] = [];
    for (let offset = 0; parameterize && offset < spanLength; offset += 1) {
      const values = startsKept.map((occurrence) => bodies[occurrence.body].script[occurrence.start + offset]);
      if (values.every((value) => elementKey(value) === elementKey(values[0]))) continue;
      if (!values.every(isParameterElement)) {
        parameterOffsets.length = 0;
        break;
      }
      parameterOffsets.push(offset);
    }
    // Parameter pushes are parked on the altstack before the shared body starts. A body that manipulates the
    // altstack or conditionally skips a placeholder could consume or strand them, so parameterization is limited
    // to straight-line, altstack-free spans. Exact candidates retain the broader balanced-control-flow support.
    const sourceSpan = region.slice(balanced.start, balanced.end);
    if (parameterOffsets.length > 0 && sourceSpan.some((element) => typeof element === 'number'
      && (OPEN_OPS.has(element) || CLOSE_OPS.has(element) || element === Op.OP_ELSE
        || element === Op.OP_TOALTSTACK || element === Op.OP_FROMALTSTACK))) continue;
    const span = [...new Array(parameterOffsets.length).fill(Op.OP_TOALTSTACK), ...sourceSpan];
    for (const offset of parameterOffsets) span[parameterOffsets.length + offset] = Op.OP_FROMALTSTACK;
    const bytes = span.reduce((total, element) => total + elementByteSize(element), 0);
    const occurrences: CandidateOccurrence[] = startsKept.map((occurrence) => ({
      ...occurrence,
      parameters: parameterOffsets.map((offset) =>
        bodies[occurrence.body].script[occurrence.start + offset]),
      originalBytes: bodies[occurrence.body].script
        .slice(occurrence.start, occurrence.start + spanLength)
        .reduce<number>((total, element) => total + elementByteSize(element), 0),
    }));
    const candidate = { span, bytes, sourceSpanLength: spanLength, parameterOffsets, occurrences, saved: 0 };
    const saved = candidateSavings(candidate, occurrences, idPushBytes);
    if (saved <= 0) continue;
    candidates.push({
      span,
      bytes,
      sourceSpanLength: spanLength,
      parameterOffsets,
      occurrences,
      saved,
    });
  }
  candidates.sort((left, right) => right.saved - left.saved);
  return candidates.slice(0, candidateLimit);
}

/**
 * Share byte-identical instruction spans across `bodies` by moving them into new OP_DEFINE'd functions.
 *
 * `allocateId` yields the encoded push for a function identifier that is free in the surrounding script; it is
 * called once per outlined function. Returns rewritten bodies (same order and length) plus the functions the
 * caller must define. Bodies are only ever shortened, and each replaced span becomes exactly two elements, so
 * `locationData` stays aligned with `script` element-for-element.
 */
export function outlineSharedSpans(
  bodies: OutlineBody[],
  allocateId: () => Uint8Array,
  candidateLimit = PROFITABLE_CANDIDATES_PER_ROUND,
  maximumRounds = MAXIMUM_ROUNDS,
): OutlineResult {
  // `origins` tracks, per current position, the original instruction index it came from, so require/log
  // instruction pointers can be remapped once the rewriting settles.
  const working = bodies.map((body) => ({
    script: [...body.script],
    locationData: [...body.locationData],
    anchors: [...(body.anchors ?? [])],
    origins: body.script.map((_element, index) => index),
  }));
  const functions: OutlinedFunction[] = [];
  let savedBytes = 0;

  // Exact spans reach their fixed point first. Parameterized spans then operate only on that compressed grammar,
  // so they can add savings without displacing a stronger exact candidate from an earlier round.
  for (const parameterize of [false, true]) {
    for (let round = 0; round < maximumRounds; round += 1) {
    // Outlined bodies join the corpus so a repeat that only becomes visible after sharing is still found.
      const corpus = [
        ...working,
        ...functions.map((fn) => ({
          script: fn.script, locationData: fn.locationData, anchors: undefined, origins: undefined,
        })),
      ];
      // Probe with the identifier width the next allocation will actually use, so savings are never over-counted.
      const candidates = findCandidates(corpus, PROBE_IDENTIFIER_PUSH_BYTES, parameterize, candidateLimit);
      if (candidates.length === 0) break;

      // Candidates were all measured against the same corpus, so apply only those whose sites are still intact:
      // a claimed range makes every overlapping candidate stale until the next round re-measures.
      const claimed = corpus.map(() => new Set<number>());
      const applied: {
        definition: OutlinedFunction;
        candidate: Candidate;
        occurrences: CandidateOccurrence[];
        saved: number;
      }[] = [];
      for (const candidate of candidates) {
        if (functions.length + applied.length >= MAXIMUM_OUTLINED_FUNCTIONS) break;
        const spanLength = candidate.sourceSpanLength;
        const free = candidate.occurrences.filter((occurrence) => {
          for (let i = 0; i < spanLength; i += 1) {
            if (claimed[occurrence.body].has(occurrence.start + i)) return false;
          }
          return true;
        });
        if (free.length < 2) continue;
        const saved = candidateSavings(candidate, free, PROBE_IDENTIFIER_PUSH_BYTES);
        if (saved <= 0) continue;
        for (const occurrence of free) {
          for (let i = 0; i < spanLength; i += 1) claimed[occurrence.body].add(occurrence.start + i);
        }
        applied.push({
          definition: {
            id: allocateId(),
            script: candidate.span,
            // The shared body inherits its first site's locations; every site maps to the same source construct.
            locationData: [
              ...new Array(candidate.parameterOffsets.length).fill(corpus[free[0].body].locationData[free[0].start]),
              ...corpus[free[0].body].locationData.slice(free[0].start, free[0].start + spanLength),
            ],
          },
          candidate,
          occurrences: free,
          saved,
        });
      }
      if (applied.length === 0) break;

      // Rewrite every site back-to-front across the whole round so earlier indices stay valid within each body.
      const edits = applied.flatMap((entry) =>
        entry.occurrences.map((occurrence) => ({ occurrence, entry })));
      edits.sort((left, right) =>
        right.occurrence.body - left.occurrence.body || right.occurrence.start - left.occurrence.start);
      for (const { occurrence, entry } of edits) {
        const target = corpus[occurrence.body];
        const spanLength = entry.candidate.sourceSpanLength;
        const location = target.locationData[occurrence.start];
        const replacement: Script = [...occurrence.parameters, entry.definition.id, Op.OP_INVOKE];
        const parameterLocations = entry.candidate.parameterOffsets
          .map((offset) => target.locationData[occurrence.start + offset]);
        target.script.splice(occurrence.start, spanLength, ...replacement);
        target.locationData.splice(occurrence.start, spanLength, ...parameterLocations, location, location);
        if (target.origins) {
          const origin = target.origins[occurrence.start];
          const parameterOrigins = entry.candidate.parameterOffsets
            .map((offset) => target.origins![occurrence.start + offset]);
          target.origins.splice(occurrence.start, spanLength, ...parameterOrigins, origin, origin);
        }
        if (target.anchors) {
        // Anchors never sit inside a relocated span, so they only need shifting by what the body lost.
          const shrink = spanLength - replacement.length;
          target.anchors = target.anchors.map((index) =>
            (index >= occurrence.start + spanLength ? index - shrink : index));
        }
      }

      for (const entry of applied) {
        functions.push(entry.definition);
        savedBytes += entry.saved;
      }
    }
  }

  // A later round can outline the complete body of an earlier helper. That leaves the earlier definition as a
  // one-instruction trampoline (`<new id> OP_INVOKE`) while every original callsite still invokes the old id.
  // Outlined spans exclude every bytecode-relative/signing opcode, so bypassing this extra invoke frame is
  // observationally identical. Collapse all such aliases before emission; large generated handlers can otherwise
  // retain hundreds of tiny trampoline definitions after multi-round outlining.
  const functionById = new Map(functions.map((fn) => [elementKey(fn.id), fn]));
  const aliases = new Map<string, Uint8Array>();
  for (const fn of functions) {
    if (fn.script.length !== 2 || fn.script[1] !== Op.OP_INVOKE
      || !(fn.script[0] instanceof Uint8Array)) continue;
    const target = fn.script[0];
    if (functionById.has(elementKey(target))) aliases.set(elementKey(fn.id), target);
  }
  const resolveAlias = (id: Uint8Array): Uint8Array => {
    let resolved = id;
    const seen = new Set<string>();
    for (;;) {
      const key = elementKey(resolved);
      if (seen.has(key)) return id;
      seen.add(key);
      const next = aliases.get(key);
      if (!next) return resolved;
      resolved = next;
    }
  };
  const rewriteAliases = (script: Script): void => {
    for (let i = 1; i < script.length; i += 1) {
      const id = script[i - 1];
      if (script[i] !== Op.OP_INVOKE || !(id instanceof Uint8Array)) continue;
      script[i - 1] = resolveAlias(id);
    }
  };
  if (aliases.size > 0) {
    for (const body of working) rewriteAliases(body.script);
    for (const fn of functions) rewriteAliases(fn.script);
  }
  const liveFunctions = functions.filter((fn) => !aliases.has(elementKey(fn.id)));

  const rewritten: OutlinedBody[] = working.map((body, index) => {
    const originalLength = bodies[index].script.length;
    // One entry longer than the body: a trailing `require` records the position of the implicit final verify,
    // which is one past the last instruction, and that pointer has to move with the body too.
    const indexMap = new Array<number>(originalLength + 1).fill(body.script.length);
    let cursor = 0;
    body.origins.forEach((origin, position) => {
      while (cursor <= origin && cursor < originalLength) {
        indexMap[cursor] = position;
        cursor += 1;
      }
    });
    return { script: body.script, locationData: body.locationData, indexMap };
  });

  return { bodies: rewritten, functions: liveFunctions, savedBytes };
}
