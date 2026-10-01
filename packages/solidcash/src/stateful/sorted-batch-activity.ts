/**
 * Select the physical mutations from a compiler-published sorted-batch union.
 *
 * Message-bus functions publish the union of every bounded handler's write slots. At runtime, slots belonging to
 * unselected handlers are inactive, and runtime aliases are owned by their canonical slot. Neither class may
 * allocate predecessor outputs: doing so shifts the absolute output band of later active batches.
 */
export function planActiveSortedBatchMutation<T>(
  slotIndices: readonly number[],
  inactiveSlots: ReadonlySet<number>,
  aliasSkippedSlots: ReadonlySet<number>,
  planner: (activeSlotIndices: readonly number[]) => T,
  mutates: (slotIndex: number) => boolean = () => true,
): { activeSlotIndices: number[]; mutationPlan?: T } {
  const activeSlotIndices = slotIndices.filter((slotIndex) => (
    !inactiveSlots.has(slotIndex) && !aliasSkippedSlots.has(slotIndex) && mutates(slotIndex)
  ));
  return activeSlotIndices.length === 0
    ? { activeSlotIndices }
    : { activeSlotIndices, mutationPlan: planner(activeSlotIndices) };
}

/**
 * An authenticated sorted-batch read lane owns no collection transition, but its unique proof input must be
 * recreated at the same absolute output coordinate. This is distinct from an inactive/runtime-alias lane (`-2`),
 * which owns no output at all.
 */
export const VMAP_BATCH_READ_ONLY_SENTINEL = -3n;

type SortedBatchProofLayout = {
  slots: readonly {
    kind: string;
    offset: number;
    slotIndex?: number;
  }[];
};

/**
 * Resolve the fixed participant offsets whose compiler witnesses require read-only proof preservation.
 *
 * The hidden vector is positional by entry slot, while transaction ownership is physical by block offset. Keeping
 * this projection in one place prevents final output arbitration from treating a read-only proof as a disposable
 * balanced slot. A published read-only witness without its corresponding entry slot is malformed metadata and must
 * fail before transaction evaluation.
 */
export function sortedBatchReadOnlyProofOffsets(
  layout: SortedBatchProofLayout | undefined,
  internalArgs: Readonly<Record<string, unknown>>,
): number[] {
  if (!layout) return [];
  const offsets = new Set<number>();
  for (const [name, value] of Object.entries(internalArgs)) {
    const match = /^__internal__vmapBatchPredOut_(\d+)$/.exec(name);
    if (!match || value !== VMAP_BATCH_READ_ONLY_SENTINEL) continue;
    const slotIndex = Number(match[1]);
    const slot = layout.slots.find((candidate) => (
      candidate.kind === 'entry' && candidate.slotIndex === slotIndex
    ));
    if (!slot) {
      throw new Error(`Sorted-batch read-only proof slot ${slotIndex} has no compiler-published entry offset`);
    }
    offsets.add(slot.offset);
  }
  return [...offsets].sort((left, right) => left - right);
}

/**
 * Assign each authenticated proof input to one physical batch lane.
 *
 * Mutating lanes take precedence because their transition either recreates an absent predecessor or replaces an
 * existing target. Preserving the same proof from a read lane would duplicate that collection node. Remaining
 * read-only lanes preserve one proof each; later lanes sharing that proof are no-output aliases.
 */
export function assignSortedBatchProofOwners(
  slotIndices: readonly number[],
  proofIdentity: (slotIndex: number) => string,
  mutates: (slotIndex: number) => boolean,
): ReadonlyMap<number, number> {
  const ownerByIdentity = new Map<string, number>();
  const ownerBySlot = new Map<number, number>();
  const prioritized = [
    ...slotIndices.filter(mutates),
    ...slotIndices.filter((slotIndex) => !mutates(slotIndex)),
  ];
  for (const slotIndex of prioritized) {
    const identity = proofIdentity(slotIndex);
    const owner = ownerByIdentity.get(identity) ?? slotIndex;
    ownerByIdentity.set(identity, owner);
    ownerBySlot.set(slotIndex, owner);
  }
  return ownerBySlot;
}

/**
 * Select read lanes which share an authenticated proof input with another lane and therefore own no collection
 * output. Their fixed block coordinate is balanced with a neutral output; materializing a default entry there
 * would create a collection node that the generated batch journal never authorized.
 */
export function sortedBatchNoOutputReadSlots(
  slotIndices: readonly number[],
  proofOwnerBySlot: ReadonlyMap<number, number>,
  mutates: (slotIndex: number) => boolean,
): number[] {
  return slotIndices.filter((slotIndex) => (
    !mutates(slotIndex) && proofOwnerBySlot.get(slotIndex) !== slotIndex
  ));
}

export function sortedBatchOperationsMutate(operations: readonly string[]): boolean {
  return operations.includes('write') || operations.includes('delete');
}

/** A selected route row cannot consume a union entry lane with no selected operation. */
export function inactiveRouteEntrySlotsFromOperations(
  accesses: readonly { slotIndex?: number }[],
  activeOperations: ReadonlyMap<number, readonly string[]>,
): number[] {
  return accesses.flatMap((access, index) => {
    const slotIndex = access.slotIndex ?? index;
    return (activeOperations.get(slotIndex)?.length ?? 0) === 0 ? [slotIndex] : [];
  });
}

export interface RuntimeEntryAliasCandidate {
  slotIndex: number;
  collection: string;
  priorSlots: readonly number[];
  target?: string;
  proof?: string;
  operations: readonly string[];
  inactive?: boolean;
}

/** Equal targets may reuse one proof input; a shared predecessor alone cannot merge distinct targets. */
export function runtimeEntryAliasOwners(
  entries: readonly RuntimeEntryAliasCandidate[],
): ReadonlyMap<number, number> {
  const bySlot = new Map(entries.map((entry) => [entry.slotIndex, entry]));
  const owners = new Map<number, number>();
  for (const entry of entries) {
    if (entry.inactive) continue;
    for (const priorSlot of entry.priorSlots) {
      const ownerSlot = owners.get(priorSlot) ?? priorSlot;
      const owner = bySlot.get(ownerSlot);
      if (!owner || owner.inactive || owner.collection !== entry.collection
        || owner.proof === undefined || entry.proof === undefined) continue;
      if (entry.proof === owner.proof && entry.target !== undefined && entry.target === owner.target
        && ((sortedBatchOperationsMutate(entry.operations)
            && sortedBatchOperationsMutate(owner.operations))
          || (entry.operations.includes('read')
            && owner.operations.some((operation) => operation === 'read' || operation === 'write')))) {
        owners.set(entry.slotIndex, ownerSlot);
        break;
      }
    }
  }
  return owners;
}

/**
 * Select the value reconstructed for one fixed sorted-batch target from successive output-pin observations.
 *
 * Batch planning publishes a structural `slot || next` commitment before the VM-derived value is known. The
 * generated covenant can later compare that same structural prefix while proving the batch topology, after it
 * has already compared `slot || next || value` for the handler's final journal value. In a relaxed fixed-point
 * trace both comparisons are observable; the later structural comparison is not a write of the type's default
 * value and must not erase the authenticated tail. Two value-bearing candidates still retain ordinary last-write
 * semantics, and a genuinely empty final value remains the structural candidate when no tail is observed.
 */
export function sortedBatchTraceCommitmentsShareNode(
  left: string,
  right: string,
): boolean {
  const structuralHexLength = 64 * 2;
  return (left.length === structuralHexLength
      && right.length > structuralHexLength && right.startsWith(left))
    || (right.length === structuralHexLength
      && left.length > structuralHexLength && left.startsWith(right));
}

export function selectSortedBatchTraceCommitment(existing: string | undefined, candidate: string): string {
  const structuralHexLength = 64 * 2;
  if (existing !== undefined
    && existing.length > structuralHexLength
    && candidate.length === structuralHexLength
    && existing.startsWith(candidate)) return existing;
  return candidate;
}

/**
 * Whether one compiler-published entry lane owns a value continuation in the concrete route envelope.
 *
 * Route ABIs publish the union of every admitted handler's operations. Once runtime activity is available, that
 * projection is authoritative: a write declared only by an unselected handler must not allocate output geometry.
 */
export function routeCollectionValueWriteIsActive(
  slotIndex: number,
  collection: string,
  declaredOperations: readonly string[],
  activeOperations?: ReadonlyMap<number, readonly string[]>,
  activeWriteCollections?: readonly string[],
): boolean {
  const operations = activeOperations === undefined
    ? declaredOperations
    : activeOperations.get(slotIndex) ?? [];
  return operations.includes('write')
    && (activeWriteCollections === undefined || activeWriteCollections.includes(collection));
}

type RouteEntryAccess = {
  collection: string;
  keyParams: readonly string[];
  operations: readonly string[];
  inLoop?: boolean;
};

type RouteHandler = {
  name: string;
  selector: string;
  batchKeyWitnesses?: readonly {
    routeInput: string;
    perRow?: boolean;
  }[];
  physicalEntrySlots?: readonly number[];
};

type DirectFunction = {
  name: string;
  selector?: string;
  entryAccesses?: readonly RouteEntryAccess[];
};

export type MessageBusRouteEntryActivity = {
  inactiveSlotIndices: number[];
  activeOperations: ReadonlyMap<number, readonly string[]>;
  activeWriteCollections: string[];
};

const routeKeyName = (name: string): string => {
  const bare = name.startsWith('id:') ? name.slice(3) : name;
  return bare.startsWith('__message_bus_ek_') ? bare.slice('__message_bus_ek_'.length) : bare;
};

/**
 * Narrow a compiler-published route union to the fixed entry lanes selected by one concrete envelope.
 *
 * `physicalEntrySlots` identifies each direct handler access in the route's canonical row-zero frame. Repeated
 * rows replace only the `_rN` coordinate; this keeps transaction planning independent of collection names and
 * of the order in which handlers happened to be published.
 */
export function selectMessageBusRouteEntryActivity(
  routeEntryAccesses: readonly RouteEntryAccess[],
  reachedHandlers: readonly RouteHandler[],
  directFunctions: readonly DirectFunction[],
): MessageBusRouteEntryActivity {
  const activeOperations = new Map<number, readonly string[]>();
  reachedHandlers.forEach((handler, rowIndex) => {
    const selected = directFunctions.find((candidate) => (
      candidate.selector === handler.selector || candidate.name === handler.name
    ));
    const fixedEntryAccesses = selected?.entryAccesses?.filter((access) => !access.inLoop) ?? [];
    const physicalEntrySlots = handler.physicalEntrySlots ?? [];
    if (fixedEntryAccesses.length !== physicalEntrySlots.length) {
      throw new Error(
        `message-bus handler '${handler.name}' is missing a complete physical entry projection `
        + `(${physicalEntrySlots.length}/${fixedEntryAccesses.length})`,
      );
    }
    physicalEntrySlots.forEach((physicalSlot, directIndex) => {
      const directAccess = fixedEntryAccesses[directIndex];
      const canonicalAccess = routeEntryAccesses[physicalSlot];
      if (!directAccess || !canonicalAccess) return;
      const selectedKeys = canonicalAccess.keyParams.map((key) => (
        routeKeyName(key).replace(/_r\d+$/, `_r${rowIndex}`)
      ));
      const selectedSlot = routeEntryAccesses.findIndex((candidate) => (
        candidate.collection === directAccess.collection
        && candidate.keyParams.length === selectedKeys.length
        && candidate.keyParams.every((key, keyIndex) => routeKeyName(key) === selectedKeys[keyIndex])
      ));
      if (selectedSlot < 0) return;
      const prior = activeOperations.get(selectedSlot) ?? [];
      activeOperations.set(selectedSlot, [...new Set([...prior, ...directAccess.operations])]);
    });
  });
  // The route ABI is the union of every admitted handler's fixed entry lanes. Ownership is therefore positive:
  // a concrete envelope activates exactly the compiler-published physical projections above, and every other
  // union slot is inactive. Inferring inactivity from hidden-argument spellings misses expression-backed lanes
  // (notably indexed public getters) and lets an unselected lane consume an arbitrary real predecessor input.
  const inactiveSlotIndices = routeEntryAccesses.flatMap((_access, slotIndex) => (
    activeOperations.has(slotIndex) ? [] : [slotIndex]
  ));

  const activeWriteCollections = [...new Set(reachedHandlers.flatMap((handler) => {
    const selected = directFunctions.find((candidate) => (
      candidate.selector === handler.selector || candidate.name === handler.name
    ));
    return (selected?.entryAccesses ?? [])
      .filter((access) => access.operations.includes('write') || access.operations.includes('delete'))
      .map((access) => access.collection);
  }))];

  return { inactiveSlotIndices, activeOperations, activeWriteCollections };
}
