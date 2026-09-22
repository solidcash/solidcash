// SDK-internal object lineage for message-bus envelopes. Keeping this registry outside the public message-bus
// barrel prevents public metadata or copied bytes from acquiring route-planning authority.
const canonicalBatchBlobs = new WeakSet<Uint8Array>();

export function markCanonicalBatchBlob(blob: Uint8Array): void {
  canonicalBatchBlobs.add(blob);
}

export function hasCanonicalBatchBlobLineage(blob: Uint8Array): boolean {
  return canonicalBatchBlobs.has(blob);
}
