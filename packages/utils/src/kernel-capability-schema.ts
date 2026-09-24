/**
 * capability schema: explicit kernel capability schema + absence semantics.
 *
 * Optional `messageBus` fields historically overloaded `undefined` to mean
 * legacy / unsupported / inactive / incomplete. This schema stamps one concrete
 * status per known capability so consumers fail closed instead of guessing.
 */

/** How a capability's absence or presence must be interpreted. */
export type KernelCapabilityStatus =
  | 'asserted'     // present and authoritative for this artifact
  | 'legacy'       // field omitted; compatibility path may apply
  | 'unsupported'  // intentionally unavailable; must fail closed
  | 'inactive'     // published but inactive for this route / stub
  | 'incomplete';   // expected for kernel but missing; must fail closed

export type KernelCapabilityId =
  | 'resourceFoldPlans'
  | 'deployability'
  | 'kernelEntryJournal'
  | 'verifierProgram'
  | 'admissionSource'
  | 'fixedChunkableWritePolicy'
  | 'atomicMessageBus';

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
  deployability?: { status?: string };
  resourceFoldPlans?: readonly unknown[];
  kernelEntryJournal?: unknown;
  verifierProgram?: unknown;
  fixedChunkableWritePolicy?: unknown;
  atomicMessageBus?: unknown;
};

const KNOWN_IDS: readonly KernelCapabilityId[] = [
  'resourceFoldPlans',
  'deployability',
  'kernelEntryJournal',
  'verifierProgram',
  'admissionSource',
  'fixedChunkableWritePolicy',
  'atomicMessageBus',
];

/**
 * Stamp a capability schema from a messageBus-like object.
 * Kernel convention treats missing expected fields as `incomplete` or `unsupported`
 * (never silent undefined).
 */
export function buildKernelCapabilitySchema(
  input: KernelCapabilityStampInput,
): KernelCapabilitySchema {
  const convention = input.convention ?? 'legacy-unroll';
  const kernel = convention === 'kernel-row-loop';
  const stub = input.available === false;

  const entry = (
    id: KernelCapabilityId,
    present: boolean,
    opts?: { unsupportedWhenAbsent?: boolean; detail?: string; inactive?: boolean },
  ): KernelCapabilityEntry => {
    if (opts?.inactive === true || (stub && present)) {
      return { id, status: 'inactive', ...(opts?.detail && { detail: opts.detail }) };
    }
    if (present) {
      return { id, status: 'asserted', ...(opts?.detail && { detail: opts.detail }) };
    }
    if (kernel && opts?.unsupportedWhenAbsent === true) {
      return { id, status: 'unsupported' };
    }
    if (kernel) {
      return { id, status: 'incomplete', detail: opts?.detail ?? 'expected on kernel artifact' };
    }
    return { id, status: 'legacy' };
  };

  const deployStatus = input.deployability?.status;
  const capabilities: KernelCapabilityEntry[] = [
    entry('atomicMessageBus', input.atomicMessageBus !== undefined, {
      unsupportedWhenAbsent: true,
    }),
    entry('admissionSource', input.admissionSource === 'attribution-spans'
      || input.admissionSource === 'legacy-eligibility', {
      detail: kernel && input.admissionSource !== 'attribution-spans'
        ? 'kernel requires attribution-spans'
        : input.admissionSource === 'legacy-eligibility'
          ? 'legacy-eligibility'
          : undefined,
    }),
    entry('deployability', input.deployability !== undefined, {
      detail: deployStatus,
    }),
    entry('resourceFoldPlans', (input.resourceFoldPlans?.length ?? 0) > 0, {
      // Fold plans are optional even on kernel when no chunkable push collections exist.
      unsupportedWhenAbsent: false,
    }),
    // Empty fold list on kernel with no collections → treat as unsupported (not incomplete).
    // Override: if kernel and plans array absent entirely → legacy-ish incomplete only when
    // we expected folds; absence of the field means no fold capability (unsupported).
    entry('kernelEntryJournal', input.kernelEntryJournal !== undefined, {
      unsupportedWhenAbsent: true,
    }),
    entry('verifierProgram', input.verifierProgram !== undefined, {
      unsupportedWhenAbsent: false,
    }),
    entry('fixedChunkableWritePolicy', input.fixedChunkableWritePolicy !== undefined, {
      unsupportedWhenAbsent: false,
    }),
  ];

  // Refine resourceFoldPlans: field absent on kernel ⇒ unsupported (no fold authority), not incomplete.
  const foldIndex = capabilities.findIndex((capability) => capability.id === 'resourceFoldPlans');
  if (foldIndex >= 0 && input.resourceFoldPlans === undefined && kernel) {
    capabilities[foldIndex] = { id: 'resourceFoldPlans', status: 'unsupported' };
  }
  // Empty array present ⇒ inactive (published but no plans).
  if (foldIndex >= 0 && input.resourceFoldPlans !== undefined && input.resourceFoldPlans.length === 0) {
    capabilities[foldIndex] = { id: 'resourceFoldPlans', status: 'inactive', detail: 'empty plan list' };
  }

  return {
    version: 1,
    convention,
    capabilities,
  };
}

/** Look up one capability; missing schema entry fails closed as incomplete. */
export function resolveKernelCapability(
  schema: KernelCapabilitySchema | undefined,
  id: KernelCapabilityId,
): KernelCapabilityEntry {
  if (schema === undefined) {
    return { id, status: 'legacy', detail: 'capability schema absent' };
  }
  if (schema.version !== 1) {
    throw new Error(`kernel-capability: unsupported schema version ${String(schema.version)}`);
  }
  const found = schema.capabilities.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`kernel-capability: schema missing entry for '${id}'`);
  }
  return found;
}

/**
 * Fail closed unless the capability status is one of `allowed`.
 * Typical kernel consumers allow only `asserted` (and sometimes `inactive`).
 */
export function assertKernelCapabilityStatus(
  schema: KernelCapabilitySchema | undefined,
  id: KernelCapabilityId,
  allowed: readonly KernelCapabilityStatus[],
): KernelCapabilityEntry {
  const entry = resolveKernelCapability(schema, id);
  if (!allowed.includes(entry.status)) {
    throw new Error(
      `kernel-capability: '${id}' status '${entry.status}' not in [${allowed.join(', ')}]`
        + (entry.detail ? ` (${entry.detail})` : ''),
    );
  }
  return entry;
}

/** True when every known capability id appears exactly once in the schema. */
export function assertKernelCapabilitySchemaComplete(
  schema: KernelCapabilitySchema,
): void {
  if (schema.version !== 1) {
    throw new Error(`kernel-capability: unsupported schema version ${String(schema.version)}`);
  }
  const seen = new Set<string>();
  for (const entry of schema.capabilities) {
    if (seen.has(entry.id)) {
      throw new Error(`kernel-capability: duplicate entry for '${entry.id}'`);
    }
    seen.add(entry.id);
  }
  for (const id of KNOWN_IDS) {
    if (!seen.has(id)) {
      throw new Error(`kernel-capability: schema incomplete; missing '${id}'`);
    }
  }
}

export const KERNEL_CAPABILITY_IDS: readonly KernelCapabilityId[] = KNOWN_IDS;
