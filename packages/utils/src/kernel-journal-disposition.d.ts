import type { KernelJournalDispositionsAbi } from './artifact.js';
/** Tagged pushed-data commitment embedded in a compiler-authored kernel route. `SCJD`, version 1. */
export declare const KERNEL_JOURNAL_DISPOSITION_COMMITMENT_TAG_HEX = "53434a4401";
/** Hash the canonical, names-free disposition projection which the SDK consumes. */
export declare function kernelJournalDispositionManifestDigest(manifest: KernelJournalDispositionsAbi): string;
/** Canonical artifact-ASM marker for `<SCJD || version || manifest digest> OP_DROP`. */
export declare function kernelJournalDispositionCommitmentMarker(digest: string): string | undefined;
/** Whether artifact ASM contains exactly one complete marker token pair (never a substring of another push). */
export declare function hasUniqueKernelJournalDispositionCommitment(bytecode: string, digest: string): boolean;
