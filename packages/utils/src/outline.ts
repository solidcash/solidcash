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
 * 3. It does not cross another invocation boundary. Relocating an existing OP_INVOKE into a second outlined
 *    helper adds a nested continuation frame, and BCH-2026 control-flow state is scoped to those frames. Keep
 *    each invocation in the body where it was originally emitted.
 * 4. It reads no bytecode-relative context. OP_ACTIVEBYTECODE returns the *function body* once invoked, not the
 *    enclosing script; OP_CODESEPARATOR moves the signing checkpoint; and OP_CHECKSIG and friends sign the
 *    active bytecode, so moving one would change both the sighash preimage and the body the SDK reports as
 *    that function's signing bytecode. All are excluded.
 *
 * Spans are relocatable byte-wise because each Script element encodes independently, so the emitted bytes of a
 * span are the same wherever they appear.
 */

// Never relocate: see properties (2) and (3) above.
const BARRIER_OPS = [
  Op.OP_DEFINE, Op.OP_INVOKE, Op.OP_ACTIVEBYTECODE, Op.OP_CODESEPARATOR,
  Op.OP_CHECKSIG, Op.OP_CHECKSIGVERIFY, Op.OP_CHECKMULTISIG, Op.OP_CHECKMULTISIGVERIFY,
];
// Candidate balancing scans the same elements across many overlapping regions and outlining strategies. Dense
// opcode tables keep those inner-loop classifications at indexed reads rather than repeated Set lookups.
const CONTROL_DELTAS = new Int8Array(256);
CONTROL_DELTAS[Op.OP_IF] = 1;
CONTROL_DELTAS[Op.OP_NOTIF] = 1;
CONTROL_DELTAS[Op.OP_BEGIN] = 1;
CONTROL_DELTAS[Op.OP_ENDIF] = -1;
CONTROL_DELTAS[Op.OP_UNTIL] = -1;
const BARRIER_FLAGS = new Uint8Array(256);
for (const opcode of BARRIER_OPS) BARRIER_FLAGS[opcode] = 1;

/**
 * Smallest match considered. Below this a span cannot repay one id push plus OP_INVOKE per site.
 *
 * Was 8, calibrated when an identifier cost a three-byte push and a site therefore cost four bytes. Ids now
 * come from a single-byte pool first, so a site costs two and shorter spans start paying: purely on size, 5 is
 * the optimum (90,395 -> 89,930 on the corpus, and independently 5,503 -> 5,470 on the real-world examples).
 *
 * 12 is the standalone/default safety floor, and the reason is not size. Sharing more aggressively than that
 * reads the script's structure rather than just running it: at 5 the SDK could no longer derive a return value
 * (`SolidityCorpusBehavior`), and split facet sizing, split call-edge unions and proxy delegate initialisers
 * all failed; at 6 a multi-NFT delegate initializer still failed. Those subsystems are the constraint, not the
 * cost model.
 *
 * RAISED 7 -> 12 when the vmap entry-write derivation joined that list of structure-reading subsystems. It reads
 * the emitted script rather than just running it, and below 12 the spans it needs get shared out from under it:
 * At the time, `EntryWriteBehavior.test.ts` failed 5/30 with "auto-derivation oscillation" at 7, 10 and 11,
 * and passed at 12.
 * Bisected to 71a8971ab (single-byte helper ids), but NOT to anything revertible in it - not the id relocation
 * (disabling `rehomeHotHelperIds` changes nothing) and not the candidate sort tie-break. It is the cost model
 * admitting shorter spans, which is the same failure mode this floor already existed to hold back.
 *
 * Later compiler/SDK derivation changes made 10 pass the vmap and runtime regressions again. Solidc now probes
 * 12 through 10 for ordinary contracts and keeps a narrower window only when its measured whole-script result is smaller;
 * message-bus contracts retain 12 because their exact active-bytecode resource model is separately pinned.
 * Keeping 12 as this API's default preserves conservative behavior for direct utility callers.
 */
export const MINIMUM_WINDOW_ELEMENTS = 12;
// Smallest single data push seeded as a candidate in its own right. A site costs an id push plus OP_INVOKE, so
// below this width sharing one cannot repay a definition however often it repeats.
const MINIMUM_POOLED_CONSTANT_BYTES = 6;
// Candidate groups examined per round, most-valuable first. Bounds the per-round extension work.
//
// Was 512, which was binding: raising it recovers 77 bytes over the corpus and saturates at this value, with
// no measurable compile-time cost. Rounds do NOT need raising - 12 of them emit exactly what 6 do, so the
// fixed point really is reached inside the existing budget.
// Solidc additionally probes 512 for ordinary contracts: considering fewer groups can avoid a marginal early
// match fragmenting a longer span, and the caller compares the measured whole-script results.
const CANDIDATE_GROUPS_PER_ROUND = 1024;
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
const opcodeKeys = Array.from({ length: 256 }, (_unused, opcode) => `o${opcode}`);

const elementKey = (element: Script[number]): string => {
  if (typeof element === 'number') return opcodeKeys[element];
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
  return CONTROL_DELTAS[element];
};

const isBarrier = (element: Script[number]): boolean =>
  typeof element === 'number' && BARRIER_FLAGS[element] !== 0;
const neverAnchored = (): boolean => false;

interface BalanceScratch {
  // Candidate regions are scanned sequentially. Reusing these dense tables avoids constructing a Map (or fresh
  // typed arrays) for every overlapping region; generation stamps reset the logical contents in constant time.
  firstIndexAtDepth: Int32Array;
  depthGeneration: Uint32Array;
  generation: number;
}

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
  regionStart: number, regionLength: number, bytePrefix: Uint32Array, scratch: BalanceScratch,
): { start: number; end: number; bytes: number } {
  let bestStart = 0;
  let bestEnd = 0;
  let bestBytes = 0;
  let depth = 0;
  const { firstIndexAtDepth, depthGeneration } = scratch;
  let generation = ++scratch.generation;
  depthGeneration[0] = generation;
  firstIndexAtDepth[0] = 0;
  for (let i = 0; i < regionLength; i += 1) {
    const element = elements[regionStart + i];
    if (isBarrier(element) || anchored(i)) {
      depth = 0;
      generation = ++scratch.generation;
      depthGeneration[0] = generation;
      firstIndexAtDepth[0] = i + 1;
      continue;
    }
    if (element === Op.OP_ELSE) depthGeneration[depth] = 0;
    const previousDepth = depth;
    depth += controlDelta(element);
    if (depth < 0) {
      depth = 0;
      generation = ++scratch.generation;
      depthGeneration[0] = generation;
      firstIndexAtDepth[0] = i + 1;
      continue;
    }
    if (depth < previousDepth) {
      for (let key = depth + 1; key <= previousDepth; key += 1) depthGeneration[key] = 0;
    }
    if (depthGeneration[depth] !== generation) {
      depthGeneration[depth] = generation;
      firstIndexAtDepth[depth] = i + 1;
      continue;
    }
    const start = firstIndexAtDepth[depth];
    const bytes = bytePrefix[regionStart + i + 1] - bytePrefix[regionStart + start];
    if (bytes > bestBytes) {
      bestStart = start;
      bestEnd = i + 1;
      bestBytes = bytes;
    }
  }
  return { start: bestStart, end: bestEnd, bytes: bestBytes };
}

interface Occurrence { body: number; start: number }

interface Candidate {
  span: Script;
  bytes: number;
  occurrences: Occurrence[];
  saved: number;
}

function sortCandidates(candidates: Candidate[], ranking: 'savings' | 'density'): Candidate[] {
  return candidates.sort((left, right) => (ranking === 'density'
    ? (right.saved / right.bytes) - (left.saved / left.bytes) : right.saved - left.saved)
    || right.saved - left.saved || right.bytes - left.bytes);
}

const costCandidates = (
  candidates: readonly Candidate[], idPushBytes: number, ranking: 'savings' | 'density',
): Candidate[] => sortCandidates(candidates.flatMap((candidate) => {
  const saved = savingsOf(candidate.bytes, candidate.occurrences.length, idPushBytes);
  return saved > 0 ? [{ ...candidate, saved }] : [];
}), ranking);

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
function findCandidates(
  bodies: OutlineBody[], idPushBytes: number, ranking: 'savings' | 'density', minimumWindowElements: number,
  candidateGroupsPerRound: number,
): Candidate[] {
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
  const maximumBodyLength = bodies.reduce((maximum, body) => Math.max(maximum, body.script.length), 0);
  // Pack (left body, right body, signed diagonal) into one collision-free numeric key. Body indices and offsets
  // are bounded by these in-memory arrays, so this stays far below Number.MAX_SAFE_INTEGER for compilable input.
  const diagonalSpan = maximumBodyLength * 2 + 1;
  // Candidate seeds at adjacent offsets often compare the same long equal runs again (particularly generated
  // function bodies with a shared prologue/epilogue). Memoize exact suffix-prefix lengths by body pair and
  // diagonal. Filling the run backwards makes every element on a diagonal participate in at most one scan.
  const commonPrefixByDiagonal = new Map<number, Int32Array>();
  const commonPrefixLength = (leftBody: number, leftStart: number, rightBody: number, rightStart: number): number => {
    const left = bodyIds[leftBody];
    const right = bodyIds[rightBody];
    if (leftStart >= left.length || rightStart >= right.length) return 0;
    const key = (leftBody * bodies.length + rightBody) * diagonalSpan
      + rightStart - leftStart + maximumBodyLength;
    let lengths = commonPrefixByDiagonal.get(key);
    if (lengths === undefined) {
      lengths = new Int32Array(left.length);
      commonPrefixByDiagonal.set(key, lengths);
    }
    const rightOffset = rightStart - leftStart;
    let cursor = leftStart;
    while (cursor < left.length && cursor + rightOffset < right.length
      && lengths[cursor] === 0 && left[cursor] === right[cursor + rightOffset]) cursor += 1;
    let suffix = cursor < left.length && lengths[cursor] !== 0 ? lengths[cursor] - 1 : 0;
    for (let i = cursor - 1; i >= leftStart; i -= 1) {
      suffix += 1;
      lengths[i] = suffix + 1;
    }
    if (lengths[leftStart] === 0) lengths[leftStart] = 1;
    return lengths[leftStart] - 1;
  };
  const bodyBytePrefixes = bodies.map((body) => {
    const prefix = new Uint32Array(body.script.length + 1);
    for (let i = 0; i < body.script.length; i += 1) {
      prefix[i + 1] = prefix[i] + elementByteSize(body.script[i]);
    }
    return prefix;
  });
  const balanceScratch: BalanceScratch = {
    firstIndexAtDepth: new Int32Array(maximumBodyLength + 1),
    depthGeneration: new Uint32Array(maximumBodyLength + 1),
    generation: 0,
  };

  const windows = new Map<number, Occurrence[]>();
  bodyIds.forEach((ids, bodyIndex) => {
    for (let i = 0; i + minimumWindowElements <= ids.length; i += 1) {
      // The first polynomial term is the id itself (`imul(0, 31) + id`); seed it directly and save one multiply
      // in this loop, which runs for every candidate window in every outlining round and strategy.
      let hash = ids[i];
      for (let j = 1; j < minimumWindowElements; j += 1) hash = (Math.imul(hash, 31) + ids[i + j]) | 0;
      let group = windows.get(hash);
      if (group === undefined) {
        group = [];
        windows.set(hash, group);
      }
      group.push({ body: bodyIndex, start: i });
    }
  });

  // A hash bucket can mix distinct windows; split each bucket on the actual element ids before extending.
  const groups: { occurrences: Occurrence[]; seed: number }[] = [];
  for (const bucket of windows.values()) {
    if (bucket.length < 2) continue;
    const first = bucket[0];
    const firstIds = bodyIds[first.body];
    let collision = false;
    for (let occurrenceIndex = 1; occurrenceIndex < bucket.length && !collision; occurrenceIndex += 1) {
      const occurrence = bucket[occurrenceIndex];
      const ids = bodyIds[occurrence.body];
      for (let offset = 0; offset < minimumWindowElements; offset += 1) {
        if (ids[occurrence.start + offset] !== firstIds[first.start + offset]) {
          collision = true;
          break;
        }
      }
    }
    if (!collision) {
      groups.push({ occurrences: bucket, seed: minimumWindowElements });
      continue;
    }
    const exact = new Map<string, Occurrence[]>();
    for (const occurrence of bucket) {
      const ids = bodyIds[occurrence.body];
      const key = ids.slice(occurrence.start, occurrence.start + minimumWindowElements).join(',');
      let group = exact.get(key);
      if (group === undefined) {
        group = [];
        exact.set(key, group);
      }
      group.push(occurrence);
    }
    for (const group of exact.values()) {
      if (group.length >= 2) groups.push({ occurrences: group, seed: minimumWindowElements });
    }
  }
  // Ranked by the gross bytes a group could share - occurrences times the encoded size of its seed - not by
  // occurrence count. Count alone treats a seed of eight one-byte opcodes as equal to one carrying a 32-byte
  // constant, so the truncation below could drop the more valuable group.
  const seedBytes = (group: { occurrences: Occurrence[]; seed: number }): number => {
    const { body, start } = group.occurrences[0];
    return bodyBytePrefixes[body][start + group.seed] - bodyBytePrefixes[body][start];
  };
  const rank = new Map(groups.map((group) => [group, group.occurrences.length * seedBytes(group)]));
  groups.sort((left, right) => rank.get(right)! - rank.get(left)!);
  groups.splice(candidateGroupsPerRound);

  // A large repeated constant never reaches the window length, however many times it appears and however big
  // it is: 256-bit arithmetic bounds are emitted inline at every overflow check, 32 bytes a time. Seed those
  // one element wide so the same pipeline can share them. An identifier operand is excluded - rewriting the
  // element in front of an OP_DEFINE or OP_INVOKE would redirect dispatch rather than share a constant.
  const constants = new Map<number, Occurrence[]>();
  bodies.forEach((body, bodyIndex) => {
    for (let i = 0; i < body.script.length; i += 1) {
      const element = body.script[i];
      if (typeof element === 'number') continue;
      if (elementByteSize(element) < MINIMUM_POOLED_CONSTANT_BYTES) continue;
      const next = body.script[i + 1];
      if (next === Op.OP_DEFINE || next === Op.OP_INVOKE) continue;
      // `<body> <id> OP_DEFINE`: the first element is a function being defined, not a constant being used.
      if (body.script[i + 2] === Op.OP_DEFINE) continue;
      // `bodyIds` already interns byte-identical elements for this discovery pass. Reuse that exact identity rather
      // than rebuilding the (potentially large) constant's string key a second time.
      const key = bodyIds[bodyIndex][i];
      let group = constants.get(key);
      if (group === undefined) {
        group = [];
        constants.set(key, group);
      }
      group.push({ body: bodyIndex, start: i });
    }
  });
  for (const group of constants.values()) if (group.length >= 2) groups.push({ occurrences: group, seed: 1 });

  const candidates: Candidate[] = [];
  for (const { occurrences: group, seed } of groups) {
    // Grow the match while every occurrence still agrees, so the balance scan sees the full common region.
    const first = group[0];
    const firstIds = bodyIds[first.body];
    let length = firstIds.length - first.start;
    for (let occurrenceIndex = 1; occurrenceIndex < group.length && length > seed; occurrenceIndex += 1) {
      const occurrence = group[occurrenceIndex];
      const ids = bodyIds[occurrence.body];
      const limit = Math.min(length, ids.length - occurrence.start);
      const matching = seed + Math.min(
        limit - seed,
        commonPrefixLength(first.body, first.start + seed, occurrence.body, occurrence.start + seed),
      );
      length = matching;
    }

    const head = group[0];
    const headScript = bodies[head.body].script;
    // A span is only relocatable if it is anchor-free at *every* occurrence, so test them all against one
    // region-relative index space.
    let anchoredIndices: Uint8Array | undefined;
    for (const occurrence of group) {
      const anchors = bodies[occurrence.body].anchors;
      if (anchors === undefined) continue;
      for (const anchor of anchors) {
        const relative = anchor - occurrence.start;
        if (relative >= 0 && relative < length) {
          anchoredIndices ??= new Uint8Array(length);
          anchoredIndices[relative] = 1;
        }
      }
    }
    const anchored = anchoredIndices === undefined
      ? neverAnchored
      : (index: number): boolean => anchoredIndices[index] !== 0;
    const balanced = longestBalancedSpan(
      headScript, anchored, head.start, length, bodyBytePrefixes[head.body], balanceScratch,
    );
    if (balanced.bytes === 0) continue;

    // Overlapping copies cannot both be replaced; keep a maximal non-overlapping subset. `group` already follows
    // body/start order: windows and constants are scanned in that order, and collision partitioning only filters
    // those streams. Avoid sorting the same sequence again for every candidate.
    const spanLength = balanced.end - balanced.start;
    const occurrences: Occurrence[] = [];
    for (const source of group) {
      const occurrence = { body: source.body, start: source.start + balanced.start };
      const previous = occurrences[occurrences.length - 1];
      if (previous && previous.body === occurrence.body && occurrence.start < previous.start + spanLength) continue;
      occurrences.push(occurrence);
    }
    if (occurrences.length < 2) continue;
    // Never place a span boundary between an OP_INVOKE and the operand push that feeds it. Splitting the pair
    // leaves a bare OP_INVOKE taking its identifier off the stack, and the surrounding rewrites can then reach
    // it with a different value than the one that was pushed - the script invokes an identifier nothing defined.
    if (occurrences.some((occurrence) => {
      const { script } = bodies[occurrence.body];
      return script[occurrence.start] === Op.OP_INVOKE
        || script[occurrence.start + spanLength] === Op.OP_INVOKE;
    })) continue;

    const saved = savingsOf(balanced.bytes, occurrences.length, idPushBytes);
    if (saved <= 0) continue;
    candidates.push({
      span: headScript.slice(head.start + balanced.start, head.start + balanced.end),
      bytes: balanced.bytes,
      occurrences,
      saved,
    });
  }
  // Ties broken toward the longer span. Claiming is first-come, and a short span applied first fragments every
  // longer span that contains it: the longer one survives the next round only as a shorter, less profitable
  // remainder. Preferring length on equal savings keeps the containing span whole.
  return sortCandidates(candidates, ranking);
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
  ranking: 'savings' | 'density' = 'savings',
  minimumWindowElements: number = MINIMUM_WINDOW_ELEMENTS,
  /** Maximum ranked candidate groups extended in each round; lower probes can change greedy claim order. */
  candidateGroupsPerRound: number = CANDIDATE_GROUPS_PER_ROUND,
  /** Call-scoped cache shared only by attempts that start from the same bodies and anchors. */
  initialCandidateCache?: Map<string, unknown>,
): OutlineResult {
  // `origins` tracks, per current position, the original instruction index it came from, so require/log
  // instruction pointers can be remapped once the rewriting settles.
  const working = bodies.map((body) => ({
    script: [...body.script],
    locationData: [...body.locationData],
    anchors: [...(body.anchors ?? [])],
    origins: undefined as number[] | undefined,
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
    const initialCacheKey = `${idPushBytes}:${minimumWindowElements}:${candidateGroupsPerRound}`;
    let cached = round === 0
      ? initialCandidateCache?.get(initialCacheKey) as Candidate[] | undefined
      : undefined;
    // Candidate discovery is independent of identifier width. A narrower identifier admits a strict superset
    // of the profitable candidates for a wider one, so reuse its immutable discovery snapshot and recost it.
    if (round === 0 && cached === undefined && initialCandidateCache !== undefined) {
      for (let width = 1; width < idPushBytes && cached === undefined; width += 1) {
        cached = initialCandidateCache.get(
          `superset:${width}:${minimumWindowElements}:${candidateGroupsPerRound}`,
        ) as Candidate[] | undefined;
      }
    }
    const candidates = cached === undefined
      ? findCandidates(corpus, idPushBytes, ranking, minimumWindowElements, candidateGroupsPerRound)
      : costCandidates(cached, idPushBytes, ranking);
    if (round === 0 && cached === undefined) {
      initialCandidateCache?.set(initialCacheKey, [...candidates]);
      // Applied spans can be rewritten in later rounds; keep a separate immutable array for other width probes.
      initialCandidateCache?.set(
        `superset:${initialCacheKey}`,
        candidates.map((candidate) => ({ ...candidate, span: [...candidate.span] })),
      );
    }
    if (candidates.length === 0) break;

    // Candidates were all measured against the same corpus, so apply only those whose sites are still intact:
    // a claimed range makes every overlapping candidate stale until the next round re-measures.
    const claimed = corpus.map((body) => new Uint8Array(body.script.length));
    const applied: { definition: OutlinedFunction; occurrences: Occurrence[]; saved: number }[] = [];
    for (const candidate of candidates) {
      if (functions.length + applied.length >= MAXIMUM_OUTLINED_FUNCTIONS) break;
      const spanLength = candidate.span.length;
      const free = candidate.occurrences.filter((occurrence) => {
        for (let i = 0; i < spanLength; i += 1) {
          if (claimed[occurrence.body][occurrence.start + i] !== 0) return false;
        }
        return true;
      });
      if (free.length < 2) continue;
      if (savingsOf(candidate.bytes, free.length, idPushBytes) <= 0) continue;
      for (const occurrence of free) {
        claimed[occurrence.body].fill(1, occurrence.start, occurrence.start + spanLength);
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

    // Most strategy probes discover nothing worth applying. Allocate origin maps only once a rewrite will
    // actually need them; a no-op result can return the identity map directly below.
    for (const body of working) {
      body.origins ??= body.script.map((_element, index) => index);
    }

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
    if (body.origins === undefined) {
      return {
        script: body.script,
        locationData: body.locationData,
        indexMap: Array.from({ length: originalLength + 1 }, (_unused, position) => position),
      };
    }
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
