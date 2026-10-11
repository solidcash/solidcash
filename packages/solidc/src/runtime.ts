/**
 * The framed-composition runtime an SDK executes against: the validator's decision procedure, lifecycle
 * classification, composition placeholders, the master prologue and the witness reader.
 *
 * This is its own entry because the compiler barrel is not browser-safe: `./index.js` re-exports `compileFile*`
 * (filesystem) and `compiler.js` (which hashes through `node:crypto` and keeps a disk cache). SDK runtime imports
 * go through this entry, so a browser bundle of the SDK never loads the compiler. Compiling stays a Node-side
 * concern; a browser app supplies compiled artifacts.
 */
export * as composition from './framed/master/composition.js';
export * as masterPrologue from './framed/master/prologue.js';
export * as witnessReader from './framed/master/witness-reader.js';
export * as compositionPlaceholders from './framed/master/placeholders.js';
export * as framedValidator from './framed/validator/index.js';
export * as framedLifecycle from './framed/master/lifecycle.js';
