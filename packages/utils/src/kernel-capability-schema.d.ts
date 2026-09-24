/**
 * capability schema: explicit kernel capability schema + absence semantics.
 *
 * Optional `messageBus` fields historically overloaded `undefined` to mean
 * legacy / unsupported / inactive / incomplete. This schema stamps one concrete
 * status per known capability so consumers fail closed instead of guessing.
 */
/** How a capability's absence or presence must be interpreted. */
export type KernelCapabilityStatus = 'asserted' | 'legacy' | 'unsupported' | 'inactive' | 'incomplete';
export type KernelCapabilityId = 'resourceFoldPlans' | 'deployability' | 'kernelEntryJournal' | 'verifierProgram' | 'admissionSource' | 'fixedChunkableWritePolicy' | 'atomicMessageBus';
export interface KernelCapabilityEntry {
    id: KernelCapabilityId;
    status: KernelCapabilityStatus;
    /** Optional detail (e.g. deployability over-budget, stub route). */
    detail?: string;
}
export interface KernelCapabilitySchema {
    version: 1;
    /** Kernel convention that owns this schema stamp. */
    convention: 'kernel-row-loop' | 'legacy-unroll';
    capabilities: readonly KernelCapabilityEntry[];
}
/** Inputs used when the compiler (or tests) stamps a schema from a messageBus shape. */
export type KernelCapabilityStampInput = {
    convention?: 'kernel-row-loop' | 'legacy-unroll';
    available?: boolean;
    admissionSource?: 'attribution-spans' | 'legacy-eligibility';
    deployability?: {
        status?: string;
    };
    resourceFoldPlans?: readonly unknown[];
    kernelEntryJournal?: unknown;
    verifierProgram?: unknown;
    fixedChunkableWritePolicy?: unknown;
    atomicMessageBus?: unknown;
};
/**
 * Stamp a capability schema from a messageBus-like object.
 * Kernel convention treats missing expected fields as `incomplete` or `unsupported`
 * (never silent undefined).
 */
export declare function buildKernelCapabilitySchema(input: KernelCapabilityStampInput): KernelCapabilitySchema;
/** Look up one capability; missing schema entry fails closed as incomplete. */
export declare function resolveKernelCapability(schema: KernelCapabilitySchema | undefined, id: KernelCapabilityId): KernelCapabilityEntry;
/**
 * Fail closed unless the capability status is one of `allowed`.
 * Typical kernel consumers allow only `asserted` (and sometimes `inactive`).
 */
export declare function assertKernelCapabilityStatus(schema: KernelCapabilitySchema | undefined, id: KernelCapabilityId, allowed: readonly KernelCapabilityStatus[]): KernelCapabilityEntry;
/** True when every known capability id appears exactly once in the schema. */
export declare function assertKernelCapabilitySchemaComplete(schema: KernelCapabilitySchema): void;
export declare const KERNEL_CAPABILITY_IDS: readonly KernelCapabilityId[];
