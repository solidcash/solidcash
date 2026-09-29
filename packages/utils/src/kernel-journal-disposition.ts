import type { KernelJournalDispositionsAbi } from './artifact.js';
import {
  domainSeparatedFingerprint,
  FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION,
} from './domain-separated-fingerprint.js';

/** Tagged pushed-data commitment embedded in a compiler-authored kernel route. `SCJD`, version 1. */
export const KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX = '53434a4401';

/**
 * Hash the canonical, names-free disposition projection which the SDK consumes.
 * Domain-separated length-prefixed fields (no JSON identity digest).
 */
export function kernelJournalDispositionManifestDigest(manifest: KernelJournalDispositionsAbi): string {
  const fields: { name: string; value: string }[] = [
    { name: 'version', value: String(manifest.version) },
  ];
  for (const [handlerIndex, handler] of manifest.handlers.entries()) {
    const prefix = `handler.${handlerIndex}`;
    fields.push({ name: `${prefix}.selectorHex`, value: handler.selectorHex });
    fields.push({
      name: `${prefix}.completedDescriptorDigest`,
      value: handler.completedDescriptorDigest,
    });
    fields.push({ name: `${prefix}.mode`, value: handler.mode });
    for (const [streamIndex, stream] of handler.streams.entries()) {
      const streamPrefix = `${prefix}.stream.${streamIndex}`;
      fields.push({
        name: `${streamPrefix}.journalAccessStreamIndex`,
        value: String(stream.journalAccessStreamIndex),
      });
      fields.push({ name: `${streamPrefix}.descriptorDigest`, value: stream.descriptorDigest });
      fields.push({ name: `${streamPrefix}.disposition`, value: stream.disposition });
    }
  }
  return domainSeparatedFingerprint(FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION, fields);
}

/** Canonical artifact-ASM marker for `<SCJD || version || manifest digest> OP_DROP`. */
export function kernelJournalDispositionCommitmentMarker(digest: string): string | undefined {
  if (!/^[0-9a-f]{64}$/.test(digest)) return undefined;
  return `${KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX}${digest} OP_DROP`;
}

/** Whether artifact ASM contains exactly one complete marker token pair (never a substring of another push). */
export function hasUniqueKernelJournalDispositionCommitment(bytecode: string, digest: string): boolean {
  const marker = kernelJournalDispositionCommitmentMarker(digest);
  if (!marker) return false;
  const [data, drop] = marker.split(' ');
  const tokens = bytecode.trim().split(/\s+/);
  let matches = 0;
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    if (tokens[index] === data && tokens[index + 1] === drop) matches += 1;
  }
  // Whole-program outlining serializes an executable OP_DEFINE body as one artifact-ASM data token. Recognize
  // the same minimally encoded push/drop pair inside those body bytes; do not accept the unframed digest as a
  // substring of arbitrary pushed data.
  const encoded = `25${data}75`;
  for (const token of tokens) {
    if (!/^[0-9a-f]+$/.test(token)) continue;
    let offset = token.indexOf(encoded);
    while (offset >= 0) {
      matches += 1;
      offset = token.indexOf(encoded, offset + 1);
    }
  }
  return matches === 1;
}
