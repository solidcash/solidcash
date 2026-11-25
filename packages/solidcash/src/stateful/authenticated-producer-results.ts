import type { FunctionArgument } from '../Argument.js';

export interface ProducerResultOccurrence {
  callsiteId: number;
  sourceCallsiteId?: number;
  sourceLogicalIndex?: number;
  occurrenceIndex?: number;
}

/** Results authenticated per reached source occurrence, not just per physical callsite. */
export class AuthenticatedProducerResults implements ReadonlyMap<number, FunctionArgument> {
  private readonly lanes = new Map<number, Map<string, FunctionArgument>>();

  constructor(private readonly parent: number) {}

  add(occurrence: ProducerResultOccurrence, value: FunctionArgument): void {
    const { callsiteId, sourceCallsiteId = callsiteId, sourceLogicalIndex, occurrenceIndex = 0 } = occurrence;
    if ([callsiteId, sourceCallsiteId, occurrenceIndex, ...(sourceLogicalIndex === undefined ? [] : [sourceLogicalIndex])]
      .some((coordinate) => !Number.isSafeInteger(coordinate) || coordinate < 0)) {
      throw new Error('Producer result has invalid source occurrence coordinates.');
    }
    const key = JSON.stringify([sourceCallsiteId, sourceLogicalIndex ?? null, occurrenceIndex]);
    const values = this.lanes.get(callsiteId) ?? new Map<string, FunctionArgument>();
    if (values.has(key)) {
      throw new Error(`Duplicate authenticated producer lane ${this.parent}:${callsiteId}.`);
    }
    values.set(key, value);
    this.lanes.set(callsiteId, values);
  }

  get size(): number { return this.lanes.size; }

  has(callsiteId: number): boolean { return this.lanes.has(callsiteId); }

  get(callsiteId: number): FunctionArgument | undefined {
    const values = this.lanes.get(callsiteId);
    if (values === undefined) return undefined;
    if (values.size !== 1) {
      throw new Error(
        `Scalar result consumer cannot select among ${values.size} authenticated producer occurrences `
        + `at lane ${this.parent}:${callsiteId}.`,
      );
    }
    return values.values().next().value;
  }

  getOccurrence(occurrence: ProducerResultOccurrence): FunctionArgument | undefined {
    const { callsiteId, sourceCallsiteId = callsiteId, sourceLogicalIndex, occurrenceIndex = 0 } = occurrence;
    return this.lanes.get(callsiteId)?.get(JSON.stringify([
      sourceCallsiteId, sourceLogicalIndex ?? null, occurrenceIndex,
    ]));
  }

  keys(): MapIterator<number> { return this.lanes.keys(); }

  *values(): MapIterator<FunctionArgument> {
    for (const callsiteId of this.keys()) yield this.get(callsiteId)!;
  }

  *entries(): MapIterator<[number, FunctionArgument]> {
    for (const callsiteId of this.keys()) yield [callsiteId, this.get(callsiteId)!];
  }

  [Symbol.iterator](): MapIterator<[number, FunctionArgument]> { return this.entries(); }

  forEach(
    callbackfn: (value: FunctionArgument, key: number, map: ReadonlyMap<number, FunctionArgument>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this) callbackfn.call(thisArg, value, key, this);
  }
}
