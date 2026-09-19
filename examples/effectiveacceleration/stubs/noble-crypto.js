// @noble/ciphers v0.5 had a `/crypto` subpath exporting randomBytes; v2 moved it. Provide it via WebCrypto.
export function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
}
//# sourceMappingURL=noble-crypto.js.map