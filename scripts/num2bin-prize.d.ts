/**
 * Bytes saved by re-emitting `element` as `<minimal> <width> OP_NUM2BIN`, or 0 when that is not shorter or not
 * byte-exact. `decodeInt` refuses a non-minimal encoding, so the value is read from the equivalent minimal form
 * and the result checked against the original bytes.
 */
export declare function minimalScriptNumberOf(element: Uint8Array): Uint8Array | undefined;
