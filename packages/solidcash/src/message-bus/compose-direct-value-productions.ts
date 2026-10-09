import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { computeCollectionHash, VALUE_INLINE_LIMIT, type AbiFunction, type EntryAccessAbi } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { encodeStoredValueSource } from '../stateful/sc-encode-stored-element-source.js';
import { evaluateExternalExpression } from '../stateful/sc-evaluate-external-expression.js';
import { selectMappingEntryByKeys } from '../stateful/mapping-key-lookup.js';
import { terminalValueChunkProducerClaim } from '../stateful/ValueChunkProducerIdentity.js';
import { valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor } from '../stateful/value-chunk-persist.js';
import type { CallDescriptor } from './compose-prepared-invocation.js';
import { resolveMessageBusAbiFunction } from './message-bus.js';

type Collection = NonNullable<NonNullable<CallDescriptor['artifact']['stateLayout']>['collections']>[number];
type Candidate = {
  descriptor: CallDescriptor;
  handler: AbiFunction;
  access: EntryAccessAbi;
  accessIndex: number;
  collection: Collection;
};

/**
 * Transparent typed-call discovery does not build an isolated nested callee, so its ordinary direct
 * chunkable mapping write has no opportunity to stage a post-value. A complete compiler whole-value
 * recipe and an authenticated pre-transaction entry can provide that value without VM mining.
 *
 * Only one reached write to this owner/collection is supported here. Multiple writes need the ordered
 * route fold, not a snapshot of the first write's pre-state; they remain for the existing route planner.
 */
export async function stageUniqueDirectValueProductions(
  descriptors: CallDescriptor[],
  stateOf: (contract: CallDescriptor['contract']) => Promise<Record<string, unknown>>,
): Promise<void> {
  const candidates: Candidate[] = [];
  const writeCounts = new Map<string, number>();
  const ownerCollection = (descriptor: CallDescriptor, collectionName: string): string => (
    `${descriptor.contract.categoryId.toLowerCase()}:`
    + `${descriptor.contract.inner.lockingBytecode.toLowerCase()}:`
    + collectionName
  );
  for (const descriptor of descriptors) {
    const artifact = descriptor.artifact;
    const handler = resolveMessageBusAbiFunction(artifact, descriptor.functionName, descriptor.selector);
    if (!handler) continue;
    for (const [accessIndex, access] of (handler.entryAccesses ?? []).entries()) {
      if (!access.operations.includes('write')) continue;
      const knownCollection = artifact.stateLayout?.collections?.find((item) => (
        item.name === access.collection || item.signature === access.collection
      ));
      const identity = ownerCollection(descriptor, knownCollection?.name ?? access.collection);
      writeCounts.set(identity, (writeCounts.get(identity) ?? 0) + 1);
      if (descriptor.executor !== undefined || descriptor.executionArtifact !== undefined
        || access.storedValueSource?.version !== 1
        || access.storedValueSource.execution !== 'unconditional-once') continue;
      const collection = knownCollection?.chunkableValue === true ? knownCollection : undefined;
      if (collection) candidates.push({ descriptor, handler, access, accessIndex, collection });
    }
  }
  for (const candidate of candidates) {
    const { descriptor, handler, access, accessIndex, collection } = candidate;
    if (descriptor.valueChunkProductions?.length
      || writeCounts.get(ownerCollection(descriptor, collection.name)) !== 1
      || descriptor.producerPath?.status !== 'complete') continue;
    const entries = await descriptor.contract.getEntries(collection.signature);
    const incomingEntries = entries.flatMap((item) => {
      if (!item.slot) return [];
      const value = encodeFunctionArgument(
        item.value as FunctionArgument, collection.valueType,
        descriptor.artifact.structs ?? descriptor.artifact.stateLayout?.structs,
      );
      return value instanceof Uint8Array
        ? [{ collection: collection.signature, slot: item.slot, value }] : [];
    });
    if (incomingEntries.length !== entries.length) continue;
    const expressionHost = {
      resolveExternalArgs: descriptor.contract._resolveExternalArgs.bind(descriptor.contract),
    };
    const preState = await stateOf(descriptor.contract);
    const visibleInputs = handler.inputs.filter((input) => !input.name.startsWith('__internal__'));
    const stateOwner = {
      categoryId: descriptor.contract.categoryId,
      lockingBytecode: descriptor.contract.inner.lockingBytecode,
    };
    const resolveValueProductions: NonNullable<CallDescriptor['resolveValueChunkProductionsFromArgs']> = (
      nextArgs,
    ) => {
      const keys = (access.keyParams ?? []).map((name) => {
        const index = visibleInputs.findIndex((input) => input.name === name);
        const key = index < 0 ? undefined : nextArgs[index];
        return typeof key === 'number' && Number.isSafeInteger(key) ? BigInt(key) : key;
      });
      if (keys.length === 0 || keys.length !== (collection.keyTypes ?? [collection.keyType]).length
        || keys.some((key) => typeof key !== 'bigint' && typeof key !== 'boolean'
          && typeof key !== 'string' && !(key instanceof Uint8Array))) return [];
      const entry = selectMappingEntryByKeys(entries,
        keys as Array<bigint | boolean | string | Uint8Array>,
        collection.keyTypes ?? [collection.keyType], collection);
      if (!entry?.slot) return []; // Insertions need a separate authenticated predecessor plan.
      const value = encodeStoredValueSource({
        evaluateExternalExpression: (...args) => evaluateExternalExpression(expressionHost, ...args),
      }, access, collection.valueType, [...nextArgs], handler, descriptor.artifact,
      preState, undefined, incomingEntries);
      if (!value || value.length <= VALUE_INLINE_LIMIT) return [];
      const write: ValueChunkWriteDescriptor = {
        categoryId: descriptor.contract.categoryId,
        collection: collection.name,
        collectionSignature: collection.signature,
        collectionHash: binToHex(computeCollectionHash(collection.signature)),
        keySlot: binToHex(entry.slot),
        entryAccessSlot: access.slotIndex ?? accessIndex,
        routeSlot: access.slotIndex ?? accessIndex,
        operation: 'update',
        outputBase: -1,
        outputCount: 0,
      };
      const claim = terminalValueChunkProducerClaim({
        rows: [{ selector: handler.selector, handler, producerPath: descriptor.producerPath }],
        collectionIdentities: [collection.name, collection.signature],
        fixedChunkableWriteSelectors: descriptor.artifact.messageBus?.fixedChunkableWritePolicy?.selectors,
        executionLockingBytecode: descriptor.contract.inner.lockingBytecode,
        stateOwnerCategoryId: stateOwner.categoryId,
        stateOwnerLockingBytecode: stateOwner.lockingBytecode,
        resourceIdentity: valueChunkWriteResourceIdentity(write),
      });
      return claim ? Object.freeze([{ write, claim, stateOwner, value }]) : [];
    };
    descriptor.resolveValueChunkProductionsFromArgs = resolveValueProductions;
    const initial = resolveValueProductions(descriptor.args);
    if (initial.length) descriptor.valueChunkProductions = initial;
  }
}
