import { binToHex } from '@bitauth/libauth';
import { decodeInt } from './data.js';
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
 * 3. By default, it does not cross another invocation boundary. Relocating an existing OP_INVOKE into a second
 *    outlined helper adds a nested continuation frame, and BCH-2026 control-flow state is scoped to those
 *    frames. A compiler may opt in only its own proven nesting-safe helper ids; their encoded-id/OP_INVOKE pairs
 *    remain atomic and every other invocation stays in the body where it was originally emitted.
 * 4. It reads no bytecode-relative context. OP_ACTIVEBYTECODE returns the *function body* once invoked, not the
 *    enclosing script; OP_CODESEPARATOR moves the signing checkpoint; and OP_CHECKSIG and friends sign the
 *    active bytecode, so moving one would change both the sighash preimage and the body the SDK reports as
 *    that function's signing bytecode. All are excluded.
 * 5. It does not participate in an alternate-stack handoff. The VM preserves the alternate stack across
 *    OP_INVOKE, but compiler-generated bodies use unbalanced TOALTSTACK/FROMALTSTACK sequences as a private
 *    protocol between surrounding fragments. Extracting either half gives a shared helper a caller-dependent
 *    alternate-stack ABI, and later outlining rounds can nest that helper in a different frame. Keep those
 *    protocol boundaries visible in their owning body.
 *
 * Spans are relocatable byte-wise because each Script element encodes independently, so the emitted bytes of a
 * span are the same wherever they appear.
 */

// Never relocate: see properties (2) through (5) above. Treating alternate-stack operations as barriers also
// splits large candidate regions at natural compiler-frame boundaries, avoiding expensive and unsafe extension
// work while retaining ordinary sharing on both sides.
const BARRIER_OPS = [
  Op.OP_DEFINE, Op.OP_INVOKE, Op.OP_ACTIVEBYTECODE, Op.OP_CODESEPARATOR,
  Op.OP_CHECKSIG, Op.OP_CHECKSIGVERIFY, Op.OP_CHECKMULTISIG, Op.OP_CHECKMULTISIGVERIFY,
  Op.OP_TOALTSTACK, Op.OP_FROMALTSTACK,
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
const nestedInvokePolicyIdentities = new WeakMap<object, number>();
let nextNestedInvokePolicyIdentity = 1;

/** Cache namespace for the opt-in nested-invoke policy, including both object identity and current contents. */
const nestedInvokeCacheKey = (allowedIds: ReadonlySet<number> | undefined): string => {
  if (allowedIds === undefined) return 'invoke-barrier';
  let identity = nestedInvokePolicyIdentities.get(allowedIds);
  if (identity === undefined) {
    identity = nextNestedInvokePolicyIdentity;
    nextNestedInvokePolicyIdentity += 1;
    nestedInvokePolicyIdentities.set(allowedIds, identity);
  }
  const contents = [...allowedIds]
    .sort((left, right) => left - right)
    .map((id) => Object.is(id, -0) ? '-0' : String(id))
    .join(',');
  return `nested-invoke:${identity}:${contents}`;
};

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

const isAllowedNestedInvoke = (
  elements: Script, index: number, allowedNestedInvokeIds: ReadonlySet<number> | undefined,
): boolean => {
  if (allowedNestedInvokeIds === undefined || elements[index] !== Op.OP_INVOKE || index === 0) return false;
  const operand = elements[index - 1];
  if (!(operand instanceof Uint8Array)) return false;
  try {
    const id = decodeInt(operand);
    return id >= BigInt(Number.MIN_SAFE_INTEGER)
      && id <= BigInt(Number.MAX_SAFE_INTEGER)
      && allowedNestedInvokeIds.has(Number(id));
  } catch {
    return false;
  }
};

const isBarrier = (
  elements: Script, index: number, allowedNestedInvokeIds: ReadonlySet<number> | undefined,
): boolean => {
  const element = elements[index];
  return typeof element === 'number'
    && BARRIER_FLAGS[element] !== 0
    && !isAllowedNestedInvoke(elements, index, allowedNestedInvokeIds);
};

interface BalanceScratch {
  // Candidate regions are scanned sequentially. Reusing these dense tables avoids constructing a Map (or fresh
  // typed arrays) for every overlapping region; generation stamps reset the logical contents in constant time.
  firstIndexAtDepth: Int32Array;
  depthGeneration: Uint32Array;
  generation: number;
  bestStart: number;
  bestEnd: number;
  bestBytes: number;
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
  elements: Script, anchoredIndices: Uint8Array | undefined,
  regionStart: number, regionLength: number, bytePrefix: Uint32Array, scratch: BalanceScratch,
  allowedNestedInvokeIds: ReadonlySet<number> | undefined,
): BalanceScratch {
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
    if (isBarrier(elements, regionStart + i, allowedNestedInvokeIds)
      || (anchoredIndices !== undefined && anchoredIndices[i] !== 0)) {
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
  scratch.bestStart = bestStart;
  scratch.bestEnd = bestEnd;
  scratch.bestBytes = bestBytes;
  return scratch;
}

interface Candidate {
  span: Script;
  bytes: number;
  /** Flat body/start pairs, kept packed to avoid one object allocation per candidate occurrence. */
  occurrences: number[];
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
  const saved = savingsOf(candidate.bytes, candidate.occurrences.length / 2, idPushBytes);
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

interface CachedBodyFingerprint {
  ids: Int32Array;
  prefix: Uint32Array;
  hashes: Map<number, Int32Array>;
}

interface OutlineIntern {
  keyIds: Map<string, number>;
  bodyByScript: WeakMap<Script, CachedBodyFingerprint>;
}

interface CandidateCorpus {
  bodyIds: Int32Array[];
  bodyBytePrefixes: Uint32Array[];
  scripts: Script[];
  intern?: OutlineIntern;
  bodyAnchorBounds: ({ minimum: number; maximum: number } | undefined)[];
  /**
   * Per-body anchor instruction indices in ascending order. Anchor collection runs once per candidate group and
   * a large leftover corpus produces tens of thousands of groups, so the linear `for (const anchor of anchors)`
   * scan dominated the search. A sorted index plus a lower-bound search visits only the anchors that actually
   * fall inside a candidate's region.
   */
  bodySortedAnchors: (Int32Array | undefined)[];
  maximumBodyLength: number;
  windowHashes: Map<number, Int32Array[]>;
  constantGroups?: number[][];
}

/** Immutable element identities and encoded-byte offsets shared by first-round strategy probes. */
function prepareCandidateCorpus(bodies: OutlineBody[], intern?: OutlineIntern): CandidateCorpus {
  const keyIds = intern?.keyIds ?? new Map<string, number>();
  const idOf = (element: Script[number]): number => {
    if (typeof element === 'number') return element + 1;
    const key = elementKey(element);
    const existing = keyIds.get(key);
    if (existing !== undefined) return existing;
    const assigned = 257 + keyIds.size;
    keyIds.set(key, assigned);
    return assigned;
  };
  const bodyIds = new Array<Int32Array>(bodies.length);
  const bodyBytePrefixes = new Array<Uint32Array>(bodies.length);
  const scripts = new Array<Script>(bodies.length);
  let maximumBodyLength = 0;
  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
    const script = bodies[bodyIndex].script;
    scripts[bodyIndex] = script;
    const cachedBody = intern?.bodyByScript.get(script);
    if (cachedBody !== undefined) {
      bodyIds[bodyIndex] = cachedBody.ids;
      bodyBytePrefixes[bodyIndex] = cachedBody.prefix;
      if (script.length > maximumBodyLength) maximumBodyLength = script.length;
      continue;
    }
    const ids = new Int32Array(script.length);
    const prefix = new Uint32Array(script.length + 1);
    if (script.length > maximumBodyLength) maximumBodyLength = script.length;
    for (let i = 0; i < script.length; i += 1) {
      ids[i] = idOf(script[i]);
      prefix[i + 1] = prefix[i] + elementByteSize(script[i]);
    }
    bodyIds[bodyIndex] = ids;
    bodyBytePrefixes[bodyIndex] = prefix;
    intern?.bodyByScript.set(script, { ids, prefix, hashes: new Map() });
  }
  return {
    bodyIds,
    bodyBytePrefixes,
    scripts,
    intern,
    bodyAnchorBounds: bodies.map((body) => {
      const anchors = body.anchors;
      if (anchors === undefined || anchors.length === 0) return undefined;
      let minimum = anchors[0];
      let maximum = minimum;
      for (let index = 1; index < anchors.length; index += 1) {
        if (anchors[index] < minimum) minimum = anchors[index];
        if (anchors[index] > maximum) maximum = anchors[index];
      }
      return { minimum, maximum };
    }),
    // Sorted copies are built once here; the per-candidate loop then binary-searches instead of scanning.
    bodySortedAnchors: bodies.map((body) => {
      const anchors = body.anchors;
      if (anchors === undefined || anchors.length === 0) return undefined;
      return Int32Array.from([...anchors].sort((left, right) => left - right));
    }),
    maximumBodyLength,
    windowHashes: new Map(),
  };
}

// Multiplicative inverse of 31 modulo 2^32. The outlining hash wraps at 32 bits, so this reverses one appended
// polynomial term exactly rather than merely producing an equivalent bucket distribution.
const HASH_BASE_INVERSE = 3_186_588_639;

// Hash-bucket collisions are split on the exact window. Decimal `id,id,` strings allocate and convert
// every int32; four UTF-16 units per id pack the same identity without conversion.
function packedWindowKey(ids: Int32Array, start: number, width: number): string {
  if (width === 10) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    const v5 = ids[start + 5] | 0;
    key += String.fromCharCode(
      v5 & 0xff,
      (v5 >>> 8) & 0xff,
      (v5 >>> 16) & 0xff,
      (v5 >>> 24) & 0xff,
    );
    const v6 = ids[start + 6] | 0;
    key += String.fromCharCode(
      v6 & 0xff,
      (v6 >>> 8) & 0xff,
      (v6 >>> 16) & 0xff,
      (v6 >>> 24) & 0xff,
    );
    const v7 = ids[start + 7] | 0;
    key += String.fromCharCode(
      v7 & 0xff,
      (v7 >>> 8) & 0xff,
      (v7 >>> 16) & 0xff,
      (v7 >>> 24) & 0xff,
    );
    const v8 = ids[start + 8] | 0;
    key += String.fromCharCode(
      v8 & 0xff,
      (v8 >>> 8) & 0xff,
      (v8 >>> 16) & 0xff,
      (v8 >>> 24) & 0xff,
    );
    const v9 = ids[start + 9] | 0;
    key += String.fromCharCode(
      v9 & 0xff,
      (v9 >>> 8) & 0xff,
      (v9 >>> 16) & 0xff,
      (v9 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 7) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    const v5 = ids[start + 5] | 0;
    key += String.fromCharCode(
      v5 & 0xff,
      (v5 >>> 8) & 0xff,
      (v5 >>> 16) & 0xff,
      (v5 >>> 24) & 0xff,
    );
    const v6 = ids[start + 6] | 0;
    key += String.fromCharCode(
      v6 & 0xff,
      (v6 >>> 8) & 0xff,
      (v6 >>> 16) & 0xff,
      (v6 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 6) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    const v5 = ids[start + 5] | 0;
    key += String.fromCharCode(
      v5 & 0xff,
      (v5 >>> 8) & 0xff,
      (v5 >>> 16) & 0xff,
      (v5 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 3) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 12) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    const v5 = ids[start + 5] | 0;
    key += String.fromCharCode(
      v5 & 0xff,
      (v5 >>> 8) & 0xff,
      (v5 >>> 16) & 0xff,
      (v5 >>> 24) & 0xff,
    );
    const v6 = ids[start + 6] | 0;
    key += String.fromCharCode(
      v6 & 0xff,
      (v6 >>> 8) & 0xff,
      (v6 >>> 16) & 0xff,
      (v6 >>> 24) & 0xff,
    );
    const v7 = ids[start + 7] | 0;
    key += String.fromCharCode(
      v7 & 0xff,
      (v7 >>> 8) & 0xff,
      (v7 >>> 16) & 0xff,
      (v7 >>> 24) & 0xff,
    );
    const v8 = ids[start + 8] | 0;
    key += String.fromCharCode(
      v8 & 0xff,
      (v8 >>> 8) & 0xff,
      (v8 >>> 16) & 0xff,
      (v8 >>> 24) & 0xff,
    );
    const v9 = ids[start + 9] | 0;
    key += String.fromCharCode(
      v9 & 0xff,
      (v9 >>> 8) & 0xff,
      (v9 >>> 16) & 0xff,
      (v9 >>> 24) & 0xff,
    );
    const v10 = ids[start + 10] | 0;
    key += String.fromCharCode(
      v10 & 0xff,
      (v10 >>> 8) & 0xff,
      (v10 >>> 16) & 0xff,
      (v10 >>> 24) & 0xff,
    );
    const v11 = ids[start + 11] | 0;
    key += String.fromCharCode(
      v11 & 0xff,
      (v11 >>> 8) & 0xff,
      (v11 >>> 16) & 0xff,
      (v11 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 8) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    const v5 = ids[start + 5] | 0;
    key += String.fromCharCode(
      v5 & 0xff,
      (v5 >>> 8) & 0xff,
      (v5 >>> 16) & 0xff,
      (v5 >>> 24) & 0xff,
    );
    const v6 = ids[start + 6] | 0;
    key += String.fromCharCode(
      v6 & 0xff,
      (v6 >>> 8) & 0xff,
      (v6 >>> 16) & 0xff,
      (v6 >>> 24) & 0xff,
    );
    const v7 = ids[start + 7] | 0;
    key += String.fromCharCode(
      v7 & 0xff,
      (v7 >>> 8) & 0xff,
      (v7 >>> 16) & 0xff,
      (v7 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 5) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    const v4 = ids[start + 4] | 0;
    key += String.fromCharCode(
      v4 & 0xff,
      (v4 >>> 8) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 24) & 0xff,
    );
    return key;
  }
  if (width === 4) {
    let key = '';
    const v0 = ids[start + 0] | 0;
    key += String.fromCharCode(
      v0 & 0xff,
      (v0 >>> 8) & 0xff,
      (v0 >>> 16) & 0xff,
      (v0 >>> 24) & 0xff,
    );
    const v1 = ids[start + 1] | 0;
    key += String.fromCharCode(
      v1 & 0xff,
      (v1 >>> 8) & 0xff,
      (v1 >>> 16) & 0xff,
      (v1 >>> 24) & 0xff,
    );
    const v2 = ids[start + 2] | 0;
    key += String.fromCharCode(
      v2 & 0xff,
      (v2 >>> 8) & 0xff,
      (v2 >>> 16) & 0xff,
      (v2 >>> 24) & 0xff,
    );
    const v3 = ids[start + 3] | 0;
    key += String.fromCharCode(
      v3 & 0xff,
      (v3 >>> 8) & 0xff,
      (v3 >>> 16) & 0xff,
      (v3 >>> 24) & 0xff,
    );
    return key;
  }
  const chars = new Array<number>(width * 4);
  for (let offset = 0; offset < width; offset += 1) {
    const value = ids[start + offset] | 0;
    const at = offset * 4;
    chars[at] = value & 0xff;
    chars[at + 1] = (value >>> 8) & 0xff;
    chars[at + 2] = (value >>> 16) & 0xff;
    chars[at + 3] = (value >>> 24) & 0xff;
  }
  return String.fromCharCode(...chars);
}

function hashesForWindow(prepared: CandidateCorpus, width: number): Int32Array[] {
  const cached = prepared.windowHashes.get(width);
  if (cached !== undefined) return cached;

  let widerWidth = Number.POSITIVE_INFINITY;
  for (const candidate of prepared.windowHashes.keys()) {
    if (candidate > width && candidate < widerWidth) widerWidth = candidate;
  }
  if (widerWidth !== Number.POSITIVE_INFINITY) {
    let wider = prepared.windowHashes.get(widerWidth)!;
    for (let nextWidth = widerWidth - 1; nextWidth >= width; nextWidth -= 1) {
      const widerAtPreviousWidth = wider;
      const narrower = prepared.bodyIds.map((ids, bodyIndex) => {
        const hashes = new Int32Array(Math.max(0, ids.length - nextWidth + 1));
        const widerHashes = widerAtPreviousWidth[bodyIndex];
        for (let i = 0; i < widerHashes.length; i += 1) {
          hashes[i] = Math.imul(widerHashes[i] - ids[i + nextWidth], HASH_BASE_INVERSE);
        }
        if (hashes.length > widerHashes.length) {
          const start = hashes.length - 1;
          let hash = ids[start];
          for (let offset = 1; offset < nextWidth; offset += 1) {
            hash = (Math.imul(hash, 31) + ids[start + offset]) | 0;
          }
          hashes[start] = hash;
        }
        return hashes;
      });
      prepared.windowHashes.set(nextWidth, narrower);
      wider = narrower;
    }
    return wider;
  }

  const hashes = prepared.bodyIds.map((ids, bodyIndex) => {
    const fingerprint = prepared.intern?.bodyByScript.get(prepared.scripts[bodyIndex]);
    const cachedHashes = fingerprint?.hashes.get(width);
    if (cachedHashes !== undefined) return cachedHashes;
    const result = new Int32Array(Math.max(0, ids.length - width + 1));
    if (width === 8) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 7]) | 0;
      }
    } else if (width === 5) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 4]) | 0;
      }
    } else if (width === 3) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 2]) | 0;
      }
    } else if (width === 6) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 5]) | 0;
      }
    } else if (width === 7) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 6]) | 0;
      }
    } else if (width === 9) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 8]) | 0;
      }
    } else if (width === 10) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 9]) | 0;
      }
    } else if (width === 11) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 10]) | 0;
      }
    } else if (width === 13) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 10]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 11]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 12]) | 0;
      }
    } else if (width === 14) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 10]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 11]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 12]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 13]) | 0;
      }
    } else if (width === 15) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 10]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 11]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 12]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 13]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 14]) | 0;
      }
    } else if (width === 16) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 10]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 11]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 12]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 13]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 14]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 15]) | 0;
      }
    } else if (width === 4) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 3]) | 0;
      }
    } else if (width === 12) {
      for (let start = 0; start < result.length; start += 1) {
        let hash = ids[start];
        hash = (Math.imul(hash, 31) + ids[start + 1]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 2]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 3]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 4]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 5]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 6]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 7]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 8]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 9]) | 0;
        hash = (Math.imul(hash, 31) + ids[start + 10]) | 0;
        result[start] = (Math.imul(hash, 31) + ids[start + 11]) | 0;
      }
    } else if (result.length > 0) {
      let hash = ids[0];
      for (let offset = 1; offset < width; offset += 1) {
        hash = (Math.imul(hash, 31) + ids[offset]) | 0;
      }
      result[0] = hash;
      let pow = 1;
      for (let i = 0; i < width - 1; i += 1) pow = Math.imul(pow, 31);
      for (let start = 1; start < result.length; start += 1) {
        hash = (Math.imul((hash - Math.imul(ids[start - 1], pow)) | 0, 31) + ids[start + width - 1]) | 0;
        result[start] = hash;
      }
    }
    fingerprint?.hashes.set(width, result);
    return result;
  });
  prepared.windowHashes.set(width, hashes);
  return hashes;
}

/**
 * Every profitable outlining candidate across `bodies`, best-saving first.
 *
 * Windows are bucketed by a rolling hash over per-element key ids rather than by joined strings: the corpus is
 * scanned once per round, and only same-bucket groups pay for an element-by-element comparison.
 */
function findCandidates(
  bodies: OutlineBody[], idPushBytes: number, ranking: 'savings' | 'density', minimumWindowElements: number,
  candidateGroupsPerRound: number, prepared: CandidateCorpus = prepareCandidateCorpus(bodies),
  allowedNestedInvokeIds?: ReadonlySet<number>,
): Candidate[] {
  const { bodyIds, bodyBytePrefixes, bodyAnchorBounds, bodySortedAnchors, maximumBodyLength } = prepared;
  const commonPrefixLength = (leftBody: number, leftStart: number, rightBody: number, rightStart: number): number => {
    const left = bodyIds[leftBody];
    const right = bodyIds[rightBody];
    if (leftStart >= left.length || rightStart >= right.length) return 0;
    // Large leftover corpora can have hundreds of bodies. Memoizing every diagonal as an Int32Array of
    // the full body length spent more time allocating than it saved on repeated scans.
    let n = 0;
    const leftLimit = left.length - leftStart;
    const rightLimit = right.length - rightStart;
    const limit = leftLimit < rightLimit ? leftLimit : rightLimit;
    while (n + 8 <= limit
      && left[leftStart + n] === right[rightStart + n]
      && left[leftStart + n + 1] === right[rightStart + n + 1]
      && left[leftStart + n + 2] === right[rightStart + n + 2]
      && left[leftStart + n + 3] === right[rightStart + n + 3]
      && left[leftStart + n + 4] === right[rightStart + n + 4]
      && left[leftStart + n + 5] === right[rightStart + n + 5]
      && left[leftStart + n + 6] === right[rightStart + n + 6]
      && left[leftStart + n + 7] === right[rightStart + n + 7]) {
      n += 8;
    }
    while (n + 4 <= limit
      && left[leftStart + n] === right[rightStart + n]
      && left[leftStart + n + 1] === right[rightStart + n + 1]
      && left[leftStart + n + 2] === right[rightStart + n + 2]
      && left[leftStart + n + 3] === right[rightStart + n + 3]) {
      n += 4;
    }
    while (n < limit && left[leftStart + n] === right[rightStart + n]) n += 1;
    return n;
  };
  const balanceScratch: BalanceScratch = {
    firstIndexAtDepth: new Int32Array(maximumBodyLength + 1),
    depthGeneration: new Uint32Array(maximumBodyLength + 1),
    generation: 0,
    bestStart: 0,
    bestEnd: 0,
    bestBytes: 0,
  };

  // Seed groups are flat body/start pairs. Most leftover 4-grams are unique; delay allocating a group array
  // until a hash is seen twice so singletons never become empty buckets.
  const windows = new Map<number, number[]>();
  const firstBodyByHash = new Map<number, number>();
  const firstStartByHash = new Map<number, number>();
  const windowHashes = hashesForWindow(prepared, minimumWindowElements);
  for (let bodyIndex = 0; bodyIndex < bodyIds.length; bodyIndex += 1) {
    const ids = bodyIds[bodyIndex];
    if (ids.length < minimumWindowElements) continue;
    const hashes = windowHashes[bodyIndex];
    for (let i = 0; i + minimumWindowElements <= ids.length; i += 1) {
      const hash = hashes[i];
      const group = windows.get(hash);
      if (group !== undefined) {
        group.push(bodyIndex, i);
        continue;
      }
      const firstBody = firstBodyByHash.get(hash);
      if (firstBody === undefined) {
        firstBodyByHash.set(hash, bodyIndex);
        firstStartByHash.set(hash, i);
        continue;
      }
      windows.set(hash, [firstBody, firstStartByHash.get(hash)!, bodyIndex, i]);
      firstBodyByHash.delete(hash);
      firstStartByHash.delete(hash);
    }
  }

  // A hash bucket can mix distinct windows; split each bucket on the actual element ids before extending.
  const groups: { occurrences: number[]; seed: number; rank?: number }[] = [];
  for (const bucket of windows.values()) {
    if (bucket.length < 4) continue;
    const firstBody = bucket[0];
    const firstStart = bucket[1];
    const firstIds = bodyIds[firstBody];
    let collision = false;
    for (let occurrenceIndex = 2; occurrenceIndex < bucket.length && !collision; occurrenceIndex += 2) {
      const body = bucket[occurrenceIndex];
      const start = bucket[occurrenceIndex + 1];
      const ids = bodyIds[body];
      let offset = 0;
      while (offset + 8 <= minimumWindowElements) {
        if (ids[start + offset] !== firstIds[firstStart + offset]
          || ids[start + offset + 1] !== firstIds[firstStart + offset + 1]
          || ids[start + offset + 2] !== firstIds[firstStart + offset + 2]
          || ids[start + offset + 3] !== firstIds[firstStart + offset + 3]
          || ids[start + offset + 4] !== firstIds[firstStart + offset + 4]
          || ids[start + offset + 5] !== firstIds[firstStart + offset + 5]
          || ids[start + offset + 6] !== firstIds[firstStart + offset + 6]
          || ids[start + offset + 7] !== firstIds[firstStart + offset + 7]) {
          collision = true;
          break;
        }
        offset += 8;
      }
      while (offset + 4 <= minimumWindowElements) {
        if (ids[start + offset] !== firstIds[firstStart + offset]
          || ids[start + offset + 1] !== firstIds[firstStart + offset + 1]
          || ids[start + offset + 2] !== firstIds[firstStart + offset + 2]
          || ids[start + offset + 3] !== firstIds[firstStart + offset + 3]) {
          collision = true;
          break;
        }
        offset += 4;
      }
      for (; !collision && offset < minimumWindowElements; offset += 1) {
        if (ids[start + offset] !== firstIds[firstStart + offset]) {
          collision = true;
          break;
        }
      }
    }
    if (!collision) {
      groups.push({ occurrences: bucket, seed: minimumWindowElements });
      continue;
    }
    const exact = new Map<string, number[]>();
    for (let occurrenceIndex = 0; occurrenceIndex < bucket.length; occurrenceIndex += 2) {
      const body = bucket[occurrenceIndex];
      const start = bucket[occurrenceIndex + 1];
      const ids = bodyIds[body];
      const key = packedWindowKey(ids, start, minimumWindowElements);
      let group = exact.get(key);
      if (group === undefined) {
        group = [];
        exact.set(key, group);
      }
      group.push(body, start);
    }
    for (const group of exact.values()) {
      if (group.length >= 4) groups.push({ occurrences: group, seed: minimumWindowElements });
    }
  }
  // Ranked by the gross bytes a group could share - occurrences times the encoded size of its seed - not by
  // occurrence count. Count alone treats a seed of eight one-byte opcodes as equal to one carrying a 32-byte
  // constant, so the truncation below could drop the more valuable group.
  for (const group of groups) {
    const body = group.occurrences[0];
    const start = group.occurrences[1];
    const seedBytes = bodyBytePrefixes[body][start + group.seed] - bodyBytePrefixes[body][start];
    group.rank = (group.occurrences.length / 2) * seedBytes;
  }
  if (groups.length > 1) groups.sort((left, right) => right.rank! - left.rank!);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_OUTLINE_TIMING === '1') {
    console.error('[outline-groups]', JSON.stringify({
      minimumWindowElements,
      candidateGroupsPerRound,
      hashBuckets: windows.size,
      rankedGroups: groups.length,
    }));
  }
  if (groups.length > candidateGroupsPerRound) groups.splice(candidateGroupsPerRound);

  // A large repeated constant never reaches the window length, however many times it appears and however big
  // it is: 256-bit arithmetic bounds are emitted inline at every overflow check, 32 bytes a time. Seed those
  // one element wide so the same pipeline can share them. An identifier operand is excluded - rewriting the
  // element in front of an OP_DEFINE or OP_INVOKE would redirect dispatch rather than share a constant.
  let constantGroups = prepared.constantGroups;
  if (constantGroups === undefined) {
    const constants = new Map<number, number[]>();
    for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
      const body = bodies[bodyIndex];
      const ids = bodyIds[bodyIndex];
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
        const key = ids[i];
        let group = constants.get(key);
        if (group === undefined) {
          group = [];
          constants.set(key, group);
        }
        group.push(bodyIndex, i);
      }
    }
    constantGroups = [];
    for (const group of constants.values()) {
      if (group.length >= 4) constantGroups.push(group);
    }
    prepared.constantGroups = constantGroups;
  }
  for (const group of constantGroups) groups.push({ occurrences: group, seed: 1 });

  const candidates: Candidate[] = [];
  for (const { occurrences: group, seed } of groups) {
    // Grow the match while every occurrence still agrees, so the balance scan sees the full common region.
    const firstBody = group[0];
    const firstStart = group[1];
    const firstIds = bodyIds[firstBody];
    let length = firstIds.length - firstStart;
    for (let occurrenceIndex = 2; occurrenceIndex < group.length; occurrenceIndex += 2) {
      const remaining = bodyIds[group[occurrenceIndex]].length - group[occurrenceIndex + 1];
      if (remaining < length) length = remaining;
    }
    for (let occurrenceIndex = 2; occurrenceIndex < group.length && length > seed; occurrenceIndex += 2) {
      const body = group[occurrenceIndex];
      const start = group[occurrenceIndex + 1];
      const matching = seed + Math.min(
        length - seed,
        commonPrefixLength(firstBody, firstStart + seed, body, start + seed),
      );
      length = matching;
    }

    // The balanced span can only be shorter than this full common region, and overlap removal can only reduce
    // its usable occurrence count. If this optimistic upper bound cannot pay for outlining, no descendant span
    // can become profitable; avoid anchor collection and the control-flow scan entirely.
    const maximumBytes = bodyBytePrefixes[firstBody][firstStart + length]
      - bodyBytePrefixes[firstBody][firstStart];
    if (savingsOf(maximumBytes, group.length / 2, idPushBytes) <= 0) continue;

    const headScript = bodies[firstBody].script;
    // A span is only relocatable if it is anchor-free at *every* occurrence, so test them all against one
    // region-relative index space.
    let anchoredIndices: Uint8Array | undefined;
    for (let occurrenceIndex = 0; occurrenceIndex < group.length; occurrenceIndex += 2) {
      const body = group[occurrenceIndex];
      const start = group[occurrenceIndex + 1];
      const bounds = bodyAnchorBounds[body];
      if (bounds === undefined || bounds.maximum < start || bounds.minimum >= start + length) continue;
      const sorted = bodySortedAnchors[body];
      if (sorted === undefined) continue;
      // Lower bound for `start`, then walk only anchors that fall inside [start, start + length). The bounds
      // guard above already proved at least one anchor is in range, so `low` is guaranteed to be within bounds.
      let low = 0;
      let high = sorted.length - 1;
      let first = sorted.length;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (sorted[middle] >= start) {
          first = middle;
          high = middle - 1;
        } else {
          low = middle + 1;
        }
      }
      for (let index = first; index < sorted.length; index += 1) {
        const relative = sorted[index] - start;
        if (relative >= length) break;
        if (relative >= 0) {
          anchoredIndices ??= new Uint8Array(length);
          anchoredIndices[relative] = 1;
        }
      }
    }
    const balanced = longestBalancedSpan(
      headScript, anchoredIndices, firstStart, length, bodyBytePrefixes[firstBody], balanceScratch,
      allowedNestedInvokeIds,
    );
    if (balanced.bestBytes === 0) continue;

    // Overlapping copies cannot both be replaced; keep a maximal non-overlapping subset. `group` already follows
    // body/start order: windows and constants are scanned in that order, and collision partitioning only filters
    // those streams. Avoid sorting the same sequence again for every candidate.
    const spanLength = balanced.bestEnd - balanced.bestStart;
    const occurrences: number[] = [];
    let previousBody = -1;
    let nextAvailableStart = 0;
    for (let occurrenceIndex = 0; occurrenceIndex < group.length; occurrenceIndex += 2) {
      const body = group[occurrenceIndex];
      const start = group[occurrenceIndex + 1] + balanced.bestStart;
      if (previousBody === body && start < nextAvailableStart) continue;
      occurrences.push(body, start);
      previousBody = body;
      nextAvailableStart = start + spanLength;
    }
    if (occurrences.length < 4) continue;
    // Never place a span boundary between an OP_INVOKE and the operand push that feeds it. Splitting the pair
    // leaves a bare OP_INVOKE taking its identifier off the stack, and the surrounding rewrites can then reach
    // it with a different value than the one that was pushed - the script invokes an identifier nothing defined.
    let splitsInvoke = false;
    for (let occurrenceIndex = 0; occurrenceIndex < occurrences.length; occurrenceIndex += 2) {
      const script = bodies[occurrences[occurrenceIndex]].script;
      const start = occurrences[occurrenceIndex + 1];
      if (script[start] === Op.OP_INVOKE || script[start + spanLength] === Op.OP_INVOKE) {
        splitsInvoke = true;
        break;
      }
    }
    if (splitsInvoke) continue;

    const saved = savingsOf(balanced.bestBytes, occurrences.length / 2, idPushBytes);
    if (saved <= 0) continue;
    candidates.push({
      span: headScript.slice(firstStart + balanced.bestStart, firstStart + balanced.bestEnd),
      bytes: balanced.bestBytes,
      occurrences,
      saved,
    });
  }
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
  /**
   * Outlining rounds to run. Each round applies every disjoint profitable candidate, so a handful reach the
   * fixed point; leftover follow-up passes can use fewer than MAXIMUM_ROUNDS without changing the first-pass
   * budget.
   */
  maximumRounds: number = MAXIMUM_ROUNDS,
  /**
   * Existing compiler-helper function ids that are proven safe to invoke from another outlined helper. The
   * default remains the hard OP_INVOKE barrier. Only an immediately preceding encoded id in this set relaxes
   * that barrier, and the id/OP_INVOKE pair is never split across an outlined-body boundary.
   */
  allowedNestedInvokeIds?: ReadonlySet<number>,
): OutlineResult {
  // `origins` tracks, per current position, the original instruction index it came from, so require/log
  // instruction pointers can be remapped once the rewriting settles.
  // Most leftover bodies are never rewritten. Alias the caller's arrays until the first splice so idle
  // Large helper tails are not copied on every follow-up pass.
  const working = bodies.map((body) => ({
    script: body.script,
    locationData: body.locationData,
    anchors: [...(body.anchors ?? [])],
    origins: undefined as number[] | undefined,
    owned: false,
  }));
  const functions: OutlinedFunction[] = [];
  const claimed: Uint8Array[] = [];
  const nestedInvokePolicy = allowedNestedInvokeIds === undefined
    ? undefined
    : new Set(allowedNestedInvokeIds);
  const nestedInvokePolicyKey = nestedInvokeCacheKey(allowedNestedInvokeIds);
  const intern: OutlineIntern = (initialCandidateCache?.get('intern') as OutlineIntern | undefined) ?? {
    keyIds: new Map(),
    bodyByScript: new WeakMap(),
  };
  initialCandidateCache?.set('intern', intern);
  let savedBytes = 0;

  const rounds = maximumRounds < 1 ? 1 : maximumRounds;
  const debugRounds = (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_OUTLINE_TIMING === '1';
  let __tFind = 0, __tApply = 0, __tRewrite = 0;
  let __lastBuildMs = 0, __lastApplyMs = 0, __lastAnchorMs = 0;
  for (let round = 0; round < rounds; round += 1) {
    const roundStarted = debugRounds ? Date.now() : 0;
    const __f0 = Date.now();
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
    const initialCacheKey = `${nestedInvokePolicyKey}:${idPushBytes}:${minimumWindowElements}:${candidateGroupsPerRound}`;
    let cached = round === 0
      ? initialCandidateCache?.get(initialCacheKey) as Candidate[] | undefined
      : undefined;
    // Candidate discovery is independent of identifier width. A narrower identifier admits a strict superset
    // of the profitable candidates for a wider one, so reuse its immutable discovery snapshot and recost it.
    if (round === 0 && cached === undefined && initialCandidateCache !== undefined) {
      for (let width = 1; width < idPushBytes && cached === undefined; width += 1) {
        cached = initialCandidateCache.get(
          `superset:${nestedInvokePolicyKey}:${width}:${minimumWindowElements}:${candidateGroupsPerRound}`,
        ) as Candidate[] | undefined;
      }
    }
    let prepared = round === 0
      ? initialCandidateCache?.get(`prepared-corpus:${nestedInvokePolicyKey}`) as CandidateCorpus | undefined
      : undefined;
    if (cached === undefined && prepared === undefined) {
      prepared = prepareCandidateCorpus(corpus, intern);
      if (round === 0) initialCandidateCache?.set(`prepared-corpus:${nestedInvokePolicyKey}`, prepared);
    }
    const candidates = cached === undefined
      ? findCandidates(
        corpus, idPushBytes, ranking, minimumWindowElements, candidateGroupsPerRound, prepared,
        nestedInvokePolicy,
      )
      : costCandidates(cached, idPushBytes, ranking);
    if (round === 0 && cached === undefined) {
      initialCandidateCache?.set(initialCacheKey, [...candidates]);
      // Applied spans can be rewritten in later rounds; keep a separate immutable array for other width probes.
      initialCandidateCache?.set(
        `superset:${initialCacheKey}`,
        candidates.map((candidate) => ({ ...candidate, span: [...candidate.span] })),
      );
    }
    __tFind += Date.now() - __f0;
    const __a0 = Date.now();
    if (candidates.length === 0) break;

    // Candidates were all measured against the same corpus, so apply only those whose sites are still intact:
    // a claimed range makes every overlapping candidate stale until the next round re-measures.
    while (claimed.length < corpus.length) {
      claimed.push(new Uint8Array(corpus[claimed.length].script.length));
    }
    const claimGeneration = round + 1;
    const applied: { definition: OutlinedFunction; occurrences: number[] }[] = [];
    const free: number[] = [];
    for (const candidate of candidates) {
      if (functions.length + applied.length >= MAXIMUM_OUTLINED_FUNCTIONS) break;
      const spanLength = candidate.span.length;
      free.length = 0;
      for (let occurrenceIndex = 0; occurrenceIndex < candidate.occurrences.length; occurrenceIndex += 2) {
        const body = candidate.occurrences[occurrenceIndex];
        const start = candidate.occurrences[occurrenceIndex + 1];
        let unclaimed = true;
        for (let i = 0; i < spanLength; i += 1) {
          if (claimed[body][start + i] === claimGeneration) {
            unclaimed = false;
            break;
          }
        }
        if (unclaimed) free.push(body, start);
      }
      if (free.length < 4) continue;
      if (savingsOf(candidate.bytes, free.length / 2, idPushBytes) <= 0) continue;
      for (let occurrenceIndex = 0; occurrenceIndex < free.length; occurrenceIndex += 2) {
        const body = free[occurrenceIndex];
        const start = free[occurrenceIndex + 1];
        claimed[body].fill(claimGeneration, start, start + spanLength);
      }
      applied.push({
        definition: {
          id: allocateId(),
          script: candidate.span,
          // The shared body inherits its first site's locations; every site maps to the same source construct.
          locationData: corpus[free[0]].locationData.slice(free[1], free[1] + spanLength),
        },
        occurrences: [...free],
      });
    }
    if (applied.length === 0) break;

    // Sites are disjoint, so once the real helper ids have been allocated their byte deltas add exactly. Cost
    // with each id's actual push width rather than the round's quoted width: a round can cross an encoding-width
    // boundary after several allocations. Reject a losing round before mutating anything, avoiding rollback
    // snapshots and whole-corpus before/after measurements.
    let roundSaved = 0;
    for (const entry of applied) {
      roundSaved += savingsOf(
        scriptBytes(entry.definition.script),
        entry.occurrences.length / 2,
        elementByteSize(entry.definition.id),
      );
    }
    if (roundSaved <= 0) break;

    __tApply += Date.now() - __a0;
    const __r0 = Date.now();
    // Most strategy probes discover nothing worth applying. Allocate origin maps only once a rewrite will
    // actually need them; a no-op result can return the identity map directly below.
    for (const body of working) {
      body.origins ??= body.script.map((_element, index) => index);
    }

    const __e0 = Date.now();
    // Rewrite every site back-to-front across the whole round so earlier indices stay valid within each body.
    const edits: { body: number; start: number; entry: typeof applied[number] }[] = [];
    for (const entry of applied) {
      for (let occurrenceIndex = 0; occurrenceIndex < entry.occurrences.length; occurrenceIndex += 2) {
        edits.push({
          body: entry.occurrences[occurrenceIndex],
          start: entry.occurrences[occurrenceIndex + 1],
          entry,
        });
      }
    }
    edits.sort((left, right) =>
      right.body - left.body || right.start - left.start);
    const __e1 = Date.now();
    let __anchorMs = 0;
    for (const { body, start, entry } of edits) {
      const target = corpus[body];
      if (body < working.length && !working[body].owned) {
        target.script = [...target.script];
        target.locationData = [...target.locationData];
        working[body].owned = true;
      }
      intern.bodyByScript.delete(target.script);
      const spanLength = entry.definition.script.length;
      const location = target.locationData[start];
      target.script.splice(start, spanLength, entry.definition.id, Op.OP_INVOKE);
      target.locationData.splice(start, spanLength, location, location);
      if (target.origins) {
        const origin = target.origins[start];
        target.origins.splice(start, spanLength, origin, origin);
      }
      if (target.anchors) {
        // Anchors never sit inside a relocated span, so they only need shifting by what the body lost.
        // Every site after this one shifts by the same amount, and sites before it are untouched, so a single
        // suffix scan updates the array in place. Rebuilding it with `.map()` per edit allocated a fresh array
        // for every occurrence of every applied function, which dominated the rewrite on large leftovers.
        const __an0 = Date.now();
        const anchors = target.anchors;
        const threshold = start + spanLength;
        const shrink = spanLength - 2;
        for (let index = 0; index < anchors.length; index += 1) {
          if (anchors[index] >= threshold) anchors[index] -= shrink;
        }
        __anchorMs += Date.now() - __an0;
      }
    }

    __lastBuildMs = __e1 - __e0;
    __lastApplyMs = Date.now() - __e1;
    __lastAnchorMs = __anchorMs;
    for (const entry of applied) functions.push(entry.definition);
    savedBytes += roundSaved;
    __tRewrite += Date.now() - __r0;
    if (debugRounds) {
      console.error('[outline-round]', JSON.stringify({
        round,
        minimumWindowElements,
        candidateGroupsPerRound,
        corpus: corpus.length,
        candidates: candidates.length,
        applied: applied.length,
        roundSaved,
        elapsedMs: Date.now() - roundStarted,
      }));
    }
  }
  if ((globalThis as any).process?.env?.SOLIDC_DEBUG_OUTLINE_SPLIT === '1') {
    console.error('[outline-split]', JSON.stringify({
      findMs: __tFind, applyClaimMs: __tApply, rewriteMs: __tRewrite,
      bodies: bodies.length, functions: functions.length, savedBytes,
      editsBuildMs: __lastBuildMs, editsApplyMs: __lastApplyMs, anchorMs: __lastAnchorMs,
    }));
  }

  const rewritten: OutlinedBody[] = working.map((body, index) => {
    const originalLength = bodies[index].script.length;
    // One entry longer than the body: a trailing `require` records the position of the implicit final verify,
    // which is one past the last instruction, and that pointer has to move with the body too.
    const indexMap = new Array<number>(originalLength + 1).fill(body.script.length);
    let cursor = 0;
    if (body.origins === undefined) {
      const identityMap = new Array<number>(originalLength + 1);
      for (let position = 0; position <= originalLength; position += 1) identityMap[position] = position;
      return {
        script: body.script,
        locationData: body.locationData,
        indexMap: identityMap,
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
