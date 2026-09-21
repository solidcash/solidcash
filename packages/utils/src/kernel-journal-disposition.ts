import { binToHex, utf8ToBin } from '@bitauth/libauth';
import type { KernelJournalDispositionsAbi } from './artifact.js';
import { sha256 } from './hash.js';

/** Tagged pushed-data commitment embedded in a compiler-authored kernel route. `SCJD`, version 1. */
export const KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX = '53434a4401';

/** Hash the canonical, names-free disposition projection which the SDK consumes. */
export function kernelJournalDispositionManifestDigest(manifest: KernelJournalDispositionsAbi): string {
  const canonical: KernelJournalDispositionsAbi = {
    version: 1,
    handlers: manifest.handlers.map((handler) => ({
      selectorHex: handler.selectorHex,
      completedDescriptorDigest: handler.completedDescriptorDigest,
      mode: handler.mode,
      streams: handler.streams.map((stream) => ({
        journalAccessStreamIndex: stream.journalAccessStreamIndex,
        descriptorDigest: stream.descriptorDigest,
        disposition: stream.disposition,
      })),
    })),
  };
  return binToHex(sha256(utf8ToBin(JSON.stringify(canonical))));
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
