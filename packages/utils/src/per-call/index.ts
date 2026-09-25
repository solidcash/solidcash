/**
 * Composition wire formats and pure derivations.
 *
 * These modules are deliberately free of I/O and of any transaction or VM dependency, so the formats can be tested
 * directly and differentially: the witness block and transcript codecs, the canonical value and argument encodings,
 * category pins and derived addresses, and the stop-site schema a builder resumes from.
 */

export * from './primitives.js';
export * from './frames.js';
export * from './witness-block.js';
export * from './transcript.js';
export * from './canonical.js';
export * from './identity.js';
export * from './stop-site.js';
