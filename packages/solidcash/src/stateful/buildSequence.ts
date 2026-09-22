/**
 * Monotonic identifier for one stateful build pass (entry-access resolution plus block-layout provisioning).
 *
 * The provisioning decisions that decide whether a fixed block slot receives a real resource, an alias skip, or a
 * funder placeholder live in `StatefulTransactionBuilder`, while the entry-access plan that produces them is built
 * in `StatefulContract`. The composer observes only the assembled aggregate, so a stall diagnostic emitted there
 * cannot say which plan produced the offending slot. Sharing one counter through this leaf module lets every
 * participant-side record carry the same id without introducing an import cycle between those modules.
 */
let buildSequence = 0;

/** Advance the sequence and return the id of the new build pass. */
export const nextBuildId = (): number => {
  buildSequence += 1;
  return buildSequence;
};

/** Id of the most recent build pass, or 0 before the first one starts. */
export const peekBuildId = (): number => buildSequence;
