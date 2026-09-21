/** One compiler-authored logical call/effect occurrence before physical-owner coalescing. */
export interface PhysicalOwnerOccurrence {
  /** Stable compiler-authored root-to-occurrence identity. */
  readonly occurrenceKey: string;
  /** Exact canonical external-call group which physically carries this occurrence. */
  readonly physicalOwner: number;
  /** Stable identity of the enclosing graph call, omitted only for transaction-root children. */
  readonly parentOccurrenceKey?: string;
  /** Stable identities of earlier sibling calls whose authenticated results this occurrence consumes. */
  readonly resultProducerOccurrenceKeys?: readonly string[];
}

export interface PhysicalOwnerComponent {
  /** Canonical physical owner group indices, sorted for deterministic diagnostics. */
  readonly owners: readonly number[];
  /** Exact logical occurrence identities represented by these owners. */
  readonly occurrenceKeys: readonly string[];
  /** Component indices this component depends on. Components are already dependency-first. */
  readonly dependencyComponents: readonly number[];
  /** True for a multi-owner callback or a logical call/effect edge which collapses to one owner. */
  readonly cyclic: boolean;
}

export interface PhysicalOwnerPlan {
  readonly physicalOwnerByOccurrence: Readonly<Record<string, number>>;
  /** Strongly connected components in deterministic dependency-first order. */
  readonly components: readonly PhysicalOwnerComponent[];
}

export class PhysicalOwnerPlanError extends Error {
  constructor(message: string) {
    super(`Physical-owner plan: ${message}`);
    this.name = 'PhysicalOwnerPlanError';
  }
}

const sortedNumbers = (values: Iterable<number>): number[] =>
  [...values].sort((left, right) => left - right);
const sortedStrings = (values: Iterable<string>): string[] => [...values].sort();

/**
 * Collapse exact compiler-authored occurrences onto their canonical physical owners and return a deterministic
 * dependency-first SCC schedule. Call/effect parent edges are retained even when no result is produced. Result
 * edges remain occurrence-addressed until their logical graph is proven acyclic, then participate in the same
 * physical-owner schedule.
 */
export function planPhysicalOwnerComponents(
  occurrences: readonly PhysicalOwnerOccurrence[],
): PhysicalOwnerPlan {
  const occurrenceByKey = new Map<string, PhysicalOwnerOccurrence>();
  for (const [occurrenceIndex, occurrence] of occurrences.entries()) {
    if (occurrence.occurrenceKey.length === 0) {
      throw new PhysicalOwnerPlanError(`logical occurrence ${occurrenceIndex} has an empty identity.`);
    }
    if (occurrenceByKey.has(occurrence.occurrenceKey)) {
      throw new PhysicalOwnerPlanError(`duplicate occurrence identity '${occurrence.occurrenceKey}'.`);
    }
    if (!Number.isSafeInteger(occurrence.physicalOwner) || occurrence.physicalOwner < 0) {
      throw new PhysicalOwnerPlanError(
        `occurrence '${occurrence.occurrenceKey}' has invalid physical owner ${occurrence.physicalOwner}.`,
      );
    }
    occurrenceByKey.set(occurrence.occurrenceKey, occurrence);
  }

  for (const occurrence of occurrences) {
    const dependencyKeys = [
      ...(occurrence.parentOccurrenceKey === undefined ? [] : [occurrence.parentOccurrenceKey]),
      ...(occurrence.resultProducerOccurrenceKeys ?? []),
    ];
    const uniqueDependencies = new Set<string>();
    for (const dependency of dependencyKeys) {
      if (!occurrenceByKey.has(dependency)) {
        throw new PhysicalOwnerPlanError(
          `occurrence '${occurrence.occurrenceKey}' references missing occurrence '${dependency}'.`,
        );
      }
      if (uniqueDependencies.has(dependency)) {
        throw new PhysicalOwnerPlanError(
          `occurrence '${occurrence.occurrenceKey}' repeats dependency '${dependency}'.`,
        );
      }
      uniqueDependencies.add(dependency);
    }
  }

  // Authenticated return values must have a finite producer-before-consumer order before physical coalescing.
  const logicalResultConsumers = new Map(occurrences.map((occurrence) => [
    occurrence.occurrenceKey, new Set<string>(),
  ]));
  for (const occurrence of occurrences) {
    for (const producer of occurrence.resultProducerOccurrenceKeys ?? []) {
      logicalResultConsumers.get(producer)!.add(occurrence.occurrenceKey);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitLogicalResult = (occurrenceKey: string): void => {
    if (visiting.has(occurrenceKey)) {
      throw new PhysicalOwnerPlanError(
        `authenticated producer-result dependencies contain a logical cycle at '${occurrenceKey}'.`,
      );
    }
    if (visited.has(occurrenceKey)) return;
    visiting.add(occurrenceKey);
    for (const consumer of sortedStrings(logicalResultConsumers.get(occurrenceKey)!)) {
      visitLogicalResult(consumer);
    }
    visiting.delete(occurrenceKey);
    visited.add(occurrenceKey);
  };
  for (const occurrenceKey of sortedStrings(occurrenceByKey.keys())) visitLogicalResult(occurrenceKey);

  const owners = sortedNumbers(new Set(occurrences.map((occurrence) => occurrence.physicalOwner)));
  const dependencies = new Map(owners.map((owner) => [owner, new Set<number>()]));
  const selfDependent = new Set<number>();
  const addPhysicalDependency = (consumerKey: string, producerKey: string): void => {
    const consumerOwner = occurrenceByKey.get(consumerKey)!.physicalOwner;
    const producerOwner = occurrenceByKey.get(producerKey)!.physicalOwner;
    dependencies.get(consumerOwner)!.add(producerOwner);
    if (consumerOwner === producerOwner) selfDependent.add(consumerOwner);
  };
  for (const occurrence of occurrences) {
    // A caller's final state/effects depend on each reached child, including void calls.
    if (occurrence.parentOccurrenceKey !== undefined) {
      addPhysicalDependency(occurrence.parentOccurrenceKey, occurrence.occurrenceKey);
    }
    // A result consumer must be derived after the exact authenticated producer occurrence.
    for (const producer of occurrence.resultProducerOccurrenceKeys ?? []) {
      addPhysicalDependency(occurrence.occurrenceKey, producer);
    }
  }

  // Deterministic Tarjan SCC over consumer -> producer dependency edges.
  let nextIndex = 0;
  const indexByOwner = new Map<number, number>();
  const lowLinkByOwner = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const rawComponents: number[][] = [];
  const connect = (owner: number): void => {
    indexByOwner.set(owner, nextIndex);
    lowLinkByOwner.set(owner, nextIndex);
    nextIndex += 1;
    stack.push(owner);
    onStack.add(owner);
    for (const dependency of sortedNumbers(dependencies.get(owner)!)) {
      if (!indexByOwner.has(dependency)) {
        connect(dependency);
        lowLinkByOwner.set(owner, Math.min(lowLinkByOwner.get(owner)!, lowLinkByOwner.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinkByOwner.set(owner, Math.min(lowLinkByOwner.get(owner)!, indexByOwner.get(dependency)!));
      }
    }
    if (lowLinkByOwner.get(owner) !== indexByOwner.get(owner)) return;
    const component: number[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === owner) break;
    }
    rawComponents.push(component.sort((left, right) => left - right));
  };
  for (const owner of owners) if (!indexByOwner.has(owner)) connect(owner);

  const rawComponentByOwner = new Map<number, number>();
  rawComponents.forEach((component, componentIndex) => {
    for (const owner of component) rawComponentByOwner.set(owner, componentIndex);
  });
  const rawDependencies = rawComponents.map(() => new Set<number>());
  for (const [owner, ownerDependencies] of dependencies) {
    const component = rawComponentByOwner.get(owner)!;
    for (const dependency of ownerDependencies) {
      const dependencyComponent = rawComponentByOwner.get(dependency)!;
      if (dependencyComponent !== component) rawDependencies[component].add(dependencyComponent);
    }
  }

  const rawOrder: number[] = [];
  const visitedComponents = new Set<number>();
  const rawKey = (componentIndex: number): number => rawComponents[componentIndex][0];
  const visitComponent = (componentIndex: number): void => {
    if (visitedComponents.has(componentIndex)) return;
    visitedComponents.add(componentIndex);
    const componentDependencies = [...rawDependencies[componentIndex]]
      .sort((left, right) => rawKey(left) - rawKey(right));
    for (const dependency of componentDependencies) visitComponent(dependency);
    rawOrder.push(componentIndex);
  };
  for (const componentIndex of rawComponents.map((_component, index) => index)
    .sort((left, right) => rawKey(left) - rawKey(right))) visitComponent(componentIndex);

  const orderedIndexByRaw = new Map(rawOrder.map((rawIndex, orderedIndex) => [rawIndex, orderedIndex]));
  const components = rawOrder.map((rawIndex) => {
    const componentOwners = rawComponents[rawIndex];
    const ownerSet = new Set(componentOwners);
    return Object.freeze({
      owners: Object.freeze([...componentOwners]),
      occurrenceKeys: Object.freeze(sortedStrings(occurrences
        .filter((occurrence) => ownerSet.has(occurrence.physicalOwner))
        .map((occurrence) => occurrence.occurrenceKey))),
      dependencyComponents: Object.freeze(sortedNumbers(rawDependencies[rawIndex])
        .map((dependency) => orderedIndexByRaw.get(dependency)!)),
      cyclic: componentOwners.length > 1 || componentOwners.some((owner) => selfDependent.has(owner)),
    });
  });

  return Object.freeze({
    physicalOwnerByOccurrence: Object.freeze(Object.fromEntries(occurrences.map((occurrence) => [
      occurrence.occurrenceKey, occurrence.physicalOwner,
    ]))),
    components: Object.freeze(components),
  });
}
