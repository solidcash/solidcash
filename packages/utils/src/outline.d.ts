import { Script } from './script.js';
import { FullLocationData } from './types.js';
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
export declare const MINIMUM_WINDOW_ELEMENTS = 12;
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
/**
 * Share byte-identical instruction spans across `bodies` by moving them into new OP_DEFINE'd functions.
 *
 * `allocateId` yields the encoded push for a function identifier that is free in the surrounding script; it is
 * called once per outlined function. Returns rewritten bodies (same order and length) plus the functions the
 * caller must define. Bodies are only ever shortened, and each replaced span becomes exactly two elements, so
 * `locationData` stays aligned with `script` element-for-element.
 */
export declare function outlineSharedSpans(bodies: OutlineBody[], allocateId: () => Uint8Array, 
/**
 * Encoded push width of the identifier `allocateId` would hand out next, without consuming it. Supplying it
 * makes the cost model exact; without it every site is costed at the widest identifier a helper can need,
 * which silently rejects candidates that are in fact profitable.
 */
peekIdPushBytes?: () => number, ranking?: 'savings' | 'density', minimumWindowElements?: number, 
/** Maximum ranked candidate groups extended in each round; lower probes can change greedy claim order. */
candidateGroupsPerRound?: number, 
/** Call-scoped cache shared only by attempts that start from the same bodies and anchors. */
initialCandidateCache?: Map<string, unknown>, 
/**
 * Outlining rounds to run. Each round applies every disjoint profitable candidate, so a handful reach the
 * fixed point; leftover follow-up passes can use fewer than MAXIMUM_ROUNDS without changing the first-pass
 * budget.
 */
maximumRounds?: number, 
/**
 * Existing compiler-helper function ids that are proven safe to invoke from another outlined helper. The
 * default remains the hard OP_INVOKE barrier. Only an immediately preceding encoded id in this set relaxes
 * that barrier, and the id/OP_INVOKE pair is never split across an outlined-body boundary.
 */
allowedNestedInvokeIds?: ReadonlySet<number>): OutlineResult;
