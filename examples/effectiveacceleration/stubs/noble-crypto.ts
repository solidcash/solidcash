// @noble/ciphers v0.5 had a `/crypto` subpath exporting randomBytes; v2 moved it. Provide it via WebCrypto.
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
