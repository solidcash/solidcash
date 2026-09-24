/**
 * capability schema: explicit kernel capability schema + absence semantics.
 *
 * Optional `messageBus` fields historically overloaded `undefined` to mean
 * legacy / unsupported / inactive / incomplete. This schema stamps one concrete
 * status per known capability so consumers fail closed instead of guessing.
 */
const KNOWN_IDS = [
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
export function buildKernelCapabilitySchema(input) {
    const convention = input.convention ?? 'legacy-unroll';
    const kernel = convention === 'kernel-row-loop';
    const stub = input.available === false;
    const entry = (id, present, opts) => {
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
    const capabilities = [
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
export function resolveKernelCapability(schema, id) {
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
export function assertKernelCapabilityStatus(schema, id, allowed) {
    const entry = resolveKernelCapability(schema, id);
    if (!allowed.includes(entry.status)) {
        throw new Error(`kernel-capability: '${id}' status '${entry.status}' not in [${allowed.join(', ')}]`
            + (entry.detail ? ` (${entry.detail})` : ''));
    }
    return entry;
}
/** True when every known capability id appears exactly once in the schema. */
export function assertKernelCapabilitySchemaComplete(schema) {
    if (schema.version !== 1) {
        throw new Error(`kernel-capability: unsupported schema version ${String(schema.version)}`);
    }
    const seen = new Set();
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
export const KERNEL_CAPABILITY_IDS = KNOWN_IDS;
//# sourceMappingURL=kernel-capability-schema.js.map