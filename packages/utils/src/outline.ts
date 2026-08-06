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
// Smallest single data push seeded as a candidate in its own right. A site costs an id push plus OP_INVOKE, so
// below this width sharing one cannot repay a definition however often it repeats.
const MINIMUM_POOLED_CONSTANT_BYTES = 6;
// Candidate groups examined per round, most-repeated first. Bounds the per-round extension work.
const CANDIDATE_GROUPS_PER_ROUND = 512;
// Rounds of outlining. Each round applies every disjoint profitable candidate it finds, so a handful of rounds
// reaches the fixed point; the cap only bounds pathological inputs.
const MAXIMUM_ROUNDS = 6;
// Fallback identifier width when the caller does not report what its next allocation costs. Compact helper
// identifiers descend from -12, so one encodes in one or two VM-number bytes: a push of at most three bytes.
// Costing every site at that width can under-state a saving but never over-state one.
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

// Outlining rescans every body once per round, so the same data element is hex-encoded up to MAXIMUM_ROUNDS
// times. Keyed on identity, so two distinct arrays holding equal bytes still compute (and agree on) one key.
const dataKeys = new WeakMap<Uint8Array, string>();

const elementKey = (element: Script[number]): string => {
  if (typeof element === 'number') return `o${element}`;
  let key = dataKeys.get(element);
  if (key === undefined) {
    key = `d${binToHex(element)}`;
    dataKeys.set(element, key);
  }
  return key;
};

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

interface Candidate {
  span: Script;
  bytes: number;
  occurrences: Occurrence[];
  saved: number;
}

/** Net bytes saved by sharing `count` copies of a `bytes`-sized span behind `idPushBytes`-sized invocations. */
function savingsOf(bytes: number, count: number, idPushBytes: number): number {
  const definitionOverhead = bytes < 76 ? 1 : bytes < 256 ? 2 : 3;
  const definitionCost = definitionOverhead + bytes + idPushBytes + 1; // body push + id push + OP_DEFINE
  const siteCost = idPushBytes + 1; // id push + OP_INVOKE
  return count * bytes - definitionCost - count * siteCost;
}

const scriptBytes = (script: Script): number =>
  script.reduce<number>((sum, element) => sum + elementByteSize(element), 0);

/**
 * Total bytes the caller will emit for this corpus: every body verbatim, plus one
 * `<body-push> <id-push> OP_DEFINE` per outlined function.
 *
 * Per-candidate savings are estimated against the corpus as it stood at the start of a round, so a round that
 * applies several overlapping-in-effect candidates can cost more than the sum of its parts promised. Measuring
 * the whole corpus is what lets a round be judged on its actual result rather than on that estimate.
 */
function emittedBytes(bodies: { script: Script }[], functions: OutlinedFunction[]): number {
  let total = bodies.reduce((sum, body) => sum + scriptBytes(body.script), 0);
  for (const fn of functions) {
    const bytes = scriptBytes(fn.script);
    const definitionOverhead = bytes < 76 ? 1 : bytes < 256 ? 2 : 3;
    total += definitionOverhead + bytes + elementByteSize(fn.id) + 1;
  }
  return total;
}

/**
 * Every profitable outlining candidate across `bodies`, best-saving first.
 *
 * Windows are bucketed by a rolling hash over per-element key ids rather than by joined strings: the corpus is
 * scanned once per round, and only same-bucket groups pay for an element-by-element comparison.
 */
function findCandidates(bodies: OutlineBody[], idPushBytes: number): Candidate[] {
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

  const windows = new Map<number, Occurrence[]>();
  bodyIds.forEach((ids, bodyIndex) => {
    for (let i = 0; i + MINIMUM_WINDOW_ELEMENTS <= ids.length; i += 1) {
      let hash = 0;
      for (let j = 0; j < MINIMUM_WINDOW_ELEMENTS; j += 1) hash = (Math.imul(hash, 31) + ids[i + j]) | 0;
      const group = windows.get(hash) ?? [];
      group.push({ body: bodyIndex, start: i });
      windows.set(hash, group);
    }
  });

  // A hash bucket can mix distinct windows; split each bucket on the actual element ids before extending.
  const groups: { occurrences: Occurrence[]; seed: number }[] = [];
  for (const bucket of windows.values()) {
    if (bucket.length < 2) continue;
    const exact = new Map<string, Occurrence[]>();
    for (const occurrence of bucket) {
      const ids = bodyIds[occurrence.body];
      const key = ids.slice(occurrence.start, occurrence.start + MINIMUM_WINDOW_ELEMENTS).join(',');
      const group = exact.get(key) ?? [];
      group.push(occurrence);
      exact.set(key, group);
    }
    for (const group of exact.values()) {
      if (group.length >= 2) groups.push({ occurrences: group, seed: MINIMUM_WINDOW_ELEMENTS });
    }
  }
  groups.sort((left, right) => right.occurrences.length - left.occurrences.length);
  groups.splice(CANDIDATE_GROUPS_PER_ROUND);

  // A large repeated constant never reaches the window length, however many times it appears and however big
  // it is: 256-bit arithmetic bounds are emitted inline at every overflow check, 32 bytes a time. Seed those
  // one element wide so the same pipeline can share them. An identifier operand is excluded - rewriting the
  // element in front of an OP_DEFINE or OP_INVOKE would redirect dispatch rather than share a constant.
  const constants = new Map<string, Occurrence[]>();
  bodies.forEach((body, bodyIndex) => {
    for (let i = 0; i < body.script.length; i += 1) {
      const element = body.script[i];
      if (typeof element === 'number') continue;
      if (elementByteSize(element) < MINIMUM_POOLED_CONSTANT_BYTES) continue;
      const next = body.script[i + 1];
      if (next === Op.OP_DEFINE || next === Op.OP_INVOKE) continue;
      const key = elementKey(element);
      const group = constants.get(key) ?? [];
      group.push({ body: bodyIndex, start: i });
      constants.set(key, group);
    }
  });
  for (const group of constants.values()) if (group.length >= 2) groups.push({ occurrences: group, seed: 1 });

  const candidates: Candidate[] = [];
  for (const { occurrences: group, seed } of groups) {
    // Grow the match while every occurrence still agrees, so the balance scan sees the full common region.
    let length = seed;
    for (;;) {
      const first = group[0];
      const at = length;
      if (first.start + at >= bodyIds[first.body].length) break;
      const id = bodyIds[first.body][first.start + at];
      const agrees = group.every((occurrence) => {
        const ids = bodyIds[occurrence.body];
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
    const occurrences: Occurrence[] = [];
    for (const occurrence of starts) {
      const previous = occurrences[occurrences.length - 1];
      if (previous && previous.body === occurrence.body && occurrence.start < previous.start + spanLength) continue;
      occurrences.push(occurrence);
    }
    if (occurrences.length < 2) continue;

    const saved = savingsOf(balanced.bytes, occurrences.length, idPushBytes);
    if (saved <= 0) continue;
    candidates.push({
      span: region.slice(balanced.start, balanced.end),
      bytes: balanced.bytes,
      occurrences,
      saved,
    });
  }
  // Ties broken toward the longer span. Claiming is first-come, and a short span applied first fragments every
  // longer span that contains it: the longer one survives the next round only as a shorter, less profitable
  // remainder. Preferring length on equal savings keeps the containing span whole.
  candidates.sort((left, right) => right.saved - left.saved || right.bytes - left.bytes);
  return candidates;
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
  /**
   * Encoded push width of the identifier `allocateId` would hand out next, without consuming it. Supplying it
   * makes the cost model exact; without it every site is costed at the widest identifier a helper can need,
   * which silently rejects candidates that are in fact profitable.
   */
  peekIdPushBytes?: () => number,
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

  for (let round = 0; round < MAXIMUM_ROUNDS; round += 1) {
    // Outlined bodies join the corpus so a repeat that only becomes visible after sharing is still found.
    const corpus = [
      ...working,
      ...functions.map((fn) => ({
        script: fn.script, locationData: fn.locationData, anchors: undefined, origins: undefined,
      })),
    ];
    // The width every candidate is costed at. It decides both which candidates clear the bar and the order they
    // claim sites in, so the caller may legitimately quote a width wider than its next allocation to hold
    // marginal candidates back.
    const idPushBytes = peekIdPushBytes?.() ?? PROBE_IDENTIFIER_PUSH_BYTES;
    const candidates = findCandidates(corpus, idPushBytes);
    if (candidates.length === 0) break;

    // Candidates were all measured against the same corpus, so apply only those whose sites are still intact:
    // a claimed range makes every overlapping candidate stale until the next round re-measures.
    const claimed = corpus.map(() => new Set<number>());
    const applied: { definition: OutlinedFunction; occurrences: Occurrence[]; saved: number }[] = [];
    for (const candidate of candidates) {
      if (functions.length + applied.length >= MAXIMUM_OUTLINED_FUNCTIONS) break;
      const spanLength = candidate.span.length;
      const free = candidate.occurrences.filter((occurrence) => {
        for (let i = 0; i < spanLength; i += 1) {
          if (claimed[occurrence.body].has(occurrence.start + i)) return false;
        }
        return true;
      });
      if (free.length < 2) continue;
      if (savingsOf(candidate.bytes, free.length, idPushBytes) <= 0) continue;
      for (const occurrence of free) {
        for (let i = 0; i < spanLength; i += 1) claimed[occurrence.body].add(occurrence.start + i);
      }
      applied.push({
        definition: {
          id: allocateId(),
          script: candidate.span,
          // The shared body inherits its first site's locations; every site maps to the same source construct.
          locationData: corpus[free[0].body].locationData.slice(free[0].start, free[0].start + spanLength),
        },
        occurrences: free,
        saved: savingsOf(candidate.bytes, free.length, idPushBytes),
      });
    }
    if (applied.length === 0) break;

    // Snapshot every array the rewrite mutates, so a round that turns out not to pay can be undone. The corpus
    // entries for existing functions alias those functions' own arrays, so restoring the corpus restores both.
    const before = emittedBytes(working, functions);
    const snapshot = corpus.map((entry) => ({
      entry,
      script: [...entry.script],
      locationData: [...entry.locationData],
      anchors: entry.anchors ? [...entry.anchors] : undefined,
      origins: entry.origins ? [...entry.origins] : undefined,
    }));

    // Rewrite every site back-to-front across the whole round so earlier indices stay valid within each body.
    const edits = applied.flatMap((entry) =>
      entry.occurrences.map((occurrence) => ({ occurrence, entry })));
    edits.sort((left, right) =>
      right.occurrence.body - left.occurrence.body || right.occurrence.start - left.occurrence.start);
    for (const { occurrence, entry } of edits) {
      const target = corpus[occurrence.body];
      const spanLength = entry.definition.script.length;
      const location = target.locationData[occurrence.start];
      target.script.splice(occurrence.start, spanLength, entry.definition.id, Op.OP_INVOKE);
      target.locationData.splice(occurrence.start, spanLength, location, location);
      if (target.origins) {
        const origin = target.origins[occurrence.start];
        target.origins.splice(occurrence.start, spanLength, origin, origin);
      }
      if (target.anchors) {
        // Anchors never sit inside a relocated span, so they only need shifting by what the body lost.
        const shrink = spanLength - 2;
        target.anchors = target.anchors.map((index) =>
          (index >= occurrence.start + spanLength ? index - shrink : index));
      }
    }

    for (const entry of applied) functions.push(entry.definition);

    const after = emittedBytes(working, functions);
    if (after >= before) {
      // The round did not pay for itself. Put every mutated array back and stop: the next round would re-measure
      // the same corpus against the same identifier width and reach the same decision.
      functions.length -= applied.length;
      for (const saved of snapshot) {
        saved.entry.script.splice(0, saved.entry.script.length, ...saved.script);
        saved.entry.locationData.splice(0, saved.entry.locationData.length, ...saved.locationData);
        if (saved.anchors) saved.entry.anchors = saved.anchors;
        const { origins } = saved.entry;
        if (saved.origins && origins) origins.splice(0, origins.length, ...saved.origins);
      }
      break;
    }
    savedBytes += before - after;
  }

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

  return { bodies: rewritten, functions, savedBytes };
}
