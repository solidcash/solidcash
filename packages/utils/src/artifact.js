/**
 * Largest message-bus batch message-bus blob any generated covenant admits, in bytes (X106).
 *
 * ONE home for a value with two enforcers. The compiler compiles this bound into every message-bus route
 * (`require(batchBlob.length <= N)`) and republishes it as `Artifact.messageBus.maximumBlobBytes`; the SDK's
 * messageBus graph generator enforces the same bound while framing each participant's message-envelope rows. Both
 * carried a bare `223` and nothing made them move together. `@solidcash/utils` is the only package both the
 * compiler and the SDK already depend on, so it is the only place the two can share a literal.
 *
 * The value is load-bearing rather than cosmetic: for a chunk-backed value crossing a handler boundary the
 * blob envelope, NOT the trailing region, is the binding constraint. The bound is the BCH maximum stack-item
 * size: the blob is one unlocking-bytecode push and can use the canonical PUSHDATA2 form through 520 bytes.
 * Silent drift between the copies would therefore move a real consensus-facing limit.
 */
export const MAX_MESSAGE_BUS_BLOB_BYTES = 520;
/**
 * Shared wire ABI for bounded kernel entry-journal transport. Each opaque `bytes` slot contains a canonical
 * encoded bytes[] vector. A maximum-size record is 150 bytes plus its two-byte element frame, so three records
 * stay below BCH's 520-byte item ceiling while four may not. Segment membership is ordinal-based and therefore
 * remains stable when a clean record acquires a longer dirty value tail. The 99-record limit is an explicit
 * global transport/indexing ceiling across all streams, aligned as a deliberate v1 budget with the reviewed
 * one-stream access ceiling. Finalized transactions remain subject to independent BCH size and cost limits.
 */
export const KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX = '__internal__kernelJournalRecordSegment_';
export const KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT = 3;
export const KERNEL_ENTRY_JOURNAL_MAX_RECORDS = 99;
export const KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS = Math.ceil(KERNEL_ENTRY_JOURNAL_MAX_RECORDS / KERNEL_ENTRY_JOURNAL_RECORDS_PER_SEGMENT);
/** Shared wire constants for the atomic single-transaction message bus. */
export const ATOMIC_MESSAGE_BUS_DOMAIN_HEX = '4c33425553310000';
export const ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS = 8;
// This is a wire-format bound, not an independent production policy: finalized-byte and VM preflight are the
// authoritative network admission gates. Keeping a smaller arbitrary ceiling rejects otherwise valid graphs
// before those exact checks (and makes the limit depend on how many authenticated resource rows a contract uses).
export const ATOMIC_MESSAGE_BUS_MAX_ROWS = 0xffff;
/** P2SH32(OP_TRUE) used only to balance compiler-published output-only participant slots. */
export const BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
/**
 * Read one callsite's published occurrence bound.
 *
 * `once` is a straight-line callsite, so its count is structurally one whether or not the compiler wrote a
 * bound down. Every other class reports exactly what the artifact carries: an absent leg means the compiler
 * proved nothing there, never that any count is admissible.
 */
export function occurrenceBoundOf(call) {
    const kind = call.occurrence ?? 'once';
    if (kind === 'once') {
        return { kind, minimum: 1, maximum: 1, exact: true, source: call.occurrenceBoundSource ?? 'structural' };
    }
    const minimum = call.minimumOccurrences;
    const maximum = call.maximumOccurrences;
    return {
        kind,
        ...(minimum !== undefined && { minimum }),
        ...(maximum !== undefined && { maximum }),
        exact: minimum !== undefined && minimum === maximum,
        // A conditional callsite's ceiling of one is a property of the branch, not of any written-down bound, so
        // its provenance is structural even when the compiler spent no bytes saying so.
        source: call.occurrenceBoundSource ?? (kind === 'conditional' ? 'structural' : undefined),
    };
}
const boundProvenance = (bound) => bound.source === 'literal' ? 'a compile-time trip count'
    : bound.source === 'guard' ? 'a dominating require guard'
        : bound.source === 'structural' ? 'a single-reach branch'
            : 'the compiler';
/**
 * Validate a chosen reached-occurrence count against the compiler-published bound.
 *
 * Returns undefined when the count is admitted, otherwise a precise diagnostic naming the callsite, the
 * chosen count, the bound it violates and where that bound came from. A consumer that plans a count outside
 * the published bound builds a transaction the caller covenant rejects; this turns that into a plan-time
 * error. An absent bound leg is never treated as permission - callers decide separately whether an unproven
 * ceiling is admissible at all.
 */
export function occurrenceCountViolation(call, count) {
    const bound = occurrenceBoundOf(call);
    const where = `callsite ${call.callsiteId ?? '?'}`;
    if (!Number.isInteger(count) || count < 0) {
        return `${where} was planned with ${count} occurrences, which is not a reached-row count`;
    }
    if (bound.kind !== 'loop' && count > 1) {
        return `${where} is a ${bound.kind} callsite reached at most once, but ${count} occurrences were planned`;
    }
    if (bound.maximum !== undefined && count > bound.maximum) {
        return `${where} was planned with ${count} occurrences, above the ${bound.maximum} `
            + `proven by ${boundProvenance(bound)}`;
    }
    if (bound.minimum !== undefined && count < bound.minimum) {
        return `${where} was planned with ${count} occurrences, below the ${bound.minimum} `
            + `proven by ${boundProvenance(bound)}`
            + (bound.exact ? `; this callsite reaches exactly ${bound.minimum} rows` : '');
    }
    return undefined;
}
const UNKNOWN_PROVENANCE = Object.freeze({ kind: 'unknown' });
/**
 * Read a low-level call's published target provenance.
 *
 * Returns `unknown` when the artifact publishes none, which is every artifact compiled before the field
 * existed. A consumer must treat `unknown` exactly as it treats `parameter`: not fixed, not proven, refuse.
 */
export function lowLevelCallTargetProvenance(call) {
    return call.target ?? UNKNOWN_PROVENANCE;
}
/**
 * Read a function's published signature-guard key provenance.
 *
 * Returns `unknown` when the artifact publishes no guard - the body has none, or the artifact predates the
 * field. Both mean the same thing to a consumer: no authority is proven here.
 */
export function signatureGuardKeyProvenance(fn) {
    return fn.signatureGuard?.key ?? UNKNOWN_PROVENANCE;
}
/**
 * Read what a function's signature-guard KEY is pinned to (X51).
 *
 * `signatureGuardKeyProvenance` says where the checked key came from. A `parameter` key is not the same as an
 * uncontrolled one: `require(hash160(pk) == <x>); require(checkSig(s, pk))` lets the caller supply only the one
 * key whose hash the contract already fixed, so the authority in force is `<x>`'s, not `pk`'s. This returns
 * `<x>`'s provenance when the compiler proved such a pin over EVERY signature check in the body, folded to the
 * weakest, and `unknown` otherwise.
 *
 * `unknown` covers three different situations on purpose - no pin was proven, no signature check exists, or the
 * artifact predates the field - because a consumer must treat all three identically: nothing is proven here.
 * Pair it with an explicit allow-list of admitted kinds, so `unknown` and any kind a later compiler adds fall
 * closed rather than being admitted by omission.
 */
export function signatureGuardKeyCommitment(fn) {
    return fn.signatureGuard?.keyCommitment ?? UNKNOWN_PROVENANCE;
}
/** Old artifacts and guards that do not publish control-flow evidence fail closed. */
export function signatureGuardDominatesDelegatecalls(fn) {
    return fn.signatureGuardDominatesDelegatecalls === true;
}
/**
 * Is this value fixed for a given contract address - committed into the p2sh32 or into the script itself?
 *
 * True for `constructorArg` and `literal` only. `stateVar` is fixed only relative to the contract's own
 * authorized writes, which is a different question a consumer has to answer for itself; `parameter`,
 * `computed` and `unknown` are all "a spender may vary this". Anything not on the true list is refused, so a
 * kind added by a later compiler falls closed here rather than being admitted by omission.
 */
export function isAddressCommittedProvenance(provenance) {
    return provenance.kind === 'constructorArg' || provenance.kind === 'literal';
}
/** Human-readable provenance, for diagnostics that have to say why a value was refused. */
export function describeProvenance(provenance) {
    switch (provenance.kind) {
        case 'constructorArg': return `constructor argument '${provenance.name}'`;
        case 'parameter': return `caller-supplied parameter '${provenance.name}'`;
        case 'stateVar': return `state variable '${provenance.name}'`;
        case 'literal': return 'a compile-time literal';
        case 'computed': return 'a computed expression';
        // Either the body carried nothing to describe or the artifact predates the field; a consumer must not
        // distinguish them, because both mean the artifact proves nothing here.
        default: return 'a source this artifact does not name';
    }
}
export function formatSplitArtifactBundle(bundle, format) {
    if (format === 'ts') {
        const normalised = JSON.parse(JSON.stringify(bundle));
        return `export default ${stringifyAsTs(normalised)} as const;\n`;
    }
    return JSON.stringify(bundle, null, 2);
}
export function formatArtifact(artifact, format) {
    const normalisedArtifact = JSON.parse(JSON.stringify(artifact));
    if (artifact.delegateProxyStateOutputCountPinned
        || normalisedArtifact.abi?.some((fn) => fn.modifiers?.includes('delegate'))) {
        normalisedArtifact.delegateProxyStateOutputCountPinned = true;
    }
    if (format === 'ts') {
        return `export default ${stringifyAsTs(normalisedArtifact)} as const;\n`;
    }
    const compact = globalThis.process
        ?.env?.SOLIDC_COMPACT_ARTIFACT === '1'
        || (typeof normalisedArtifact.debug?.bytecode === 'string'
            && normalisedArtifact.debug.bytecode.length > 400_000);
    return JSON.stringify(normalisedArtifact, null, compact ? 0 : 2);
}
const indent = (level) => '  '.repeat(level);
function stringifyAsTs(obj, indentationLevel = 1) {
    if (obj === null)
        return 'null';
    // For strings we use JSON.stringify to handle escaping, but we want to use single quotes instead of double quotes
    // around string values inside objects, to match regular TS style
    if (typeof obj === 'string') {
        return `'${JSON.stringify(obj).replace(/'/g, "\\'").replace(/\\"/g, '"').slice(1, -1)}'`;
    }
    // Numbers and booleans are just converted to strings
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return JSON.stringify(obj);
    }
    // Arrays are recursively formatted with indentation
    if (Array.isArray(obj)) {
        if (obj.length === 0)
            return '[]';
        const formattedItems = obj.map((item) => `${indent(indentationLevel)}${stringifyAsTs(item, indentationLevel + 1)}`);
        return `[\n${formattedItems.join(',\n')},\n${indent(indentationLevel - 1)}]`;
    }
    // Objects are recursively formatted with indentation
    if (typeof obj === 'object') {
        const entries = Object.entries(obj);
        if (entries.length === 0)
            return '{}';
        const formattedEntries = entries.map(([key, value]) => {
            const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`;
            return `${indent(indentationLevel)}${safeKey}: ${stringifyAsTs(value, indentationLevel + 1)}`;
        });
        return `{\n${formattedEntries.join(',\n')},\n${indent(indentationLevel - 1)}}`;
    }
    throw new Error(`Unsupported type: ${typeof obj}`);
}
//# sourceMappingURL=artifact.js.map