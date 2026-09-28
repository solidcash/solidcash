import type { PreparedAtomicMessageBusCall } from './compose-prepared-invocation.js';
import {
  canonicalValueChunkProducerIdentity,
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkStateOwner,
  terminalValueChunkProducerClaim,
  type ValueChunkProducerMutationRow,
} from '../stateful/ValueChunkProducerIdentity.js';
import { valueChunkWriteResourceIdentity } from '../stateful/value-chunk-persist.js';

type Production = NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>[number];

/**
 * Keep the exact terminal lane proved by the executable route. Mutation ordinals
 * are function-local: they cannot order distinct handlers or call occurrences.
 * Validate every resource before dropping any superseded production.
 */
export function retainTerminalValueChunkProductions(
  productions: Map<string, Production>,
  route: {
    rows: readonly ValueChunkProducerMutationRow[];
    executionLockingBytecode: string;
    fixedChunkableWriteSelectors?: readonly string[];
  },
): void {
  const terminalProducerByResource = new Map<string, string>();
  const candidatesByResource = new Map<string, Production[]>();
  const owners = new Set<string>();
  for (const production of productions.values()) {
    const resource = valueChunkWriteResourceIdentity(production.write);
    const claim = canonicalValueChunkProducerResourceClaim(production.claim);
    const owner = canonicalValueChunkStateOwner(production.stateOwner);
    if (!owner || !claim || owner !== canonicalValueChunkStateOwner(claim.producer.stateOwner)
      || claim.resourceIdentity !== resource) {
      throw new Error('messageBus: invalid transported value production identity');
    }
    owners.add(owner);
    const candidates = candidatesByResource.get(resource) ?? [];
    candidates.push(production);
    candidatesByResource.set(resource, candidates);
  }
  if (owners.size > 1) {
    throw new Error('One routed execution carrier cannot own value productions from multiple state owners.');
  }
  for (const [resourceIdentity, candidates] of candidatesByResource) {
    const first = candidates[0]!;
    const terminal = terminalValueChunkProducerClaim({
      ...route,
      collectionIdentities: [first.write.collection, first.write.collectionSignature],
      stateOwnerCategoryId: first.stateOwner.categoryId,
      stateOwnerLockingBytecode: first.stateOwner.lockingBytecode,
      resourceIdentity,
    });
    const producer = terminal && canonicalValueChunkProducerIdentity(terminal.producer);
    if (!producer || !candidates.some((candidate) => (
      canonicalValueChunkProducerIdentity(candidate.claim.producer) === producer
    ))) {
      throw new Error('messageBus: transported value productions omit the routed terminal producer');
    }
    terminalProducerByResource.set(resourceIdentity, producer);
  }
  for (const [identity, production] of productions) {
    const resource = valueChunkWriteResourceIdentity(production.write);
    const producer = canonicalValueChunkProducerIdentity(production.claim.producer);
    if (terminalProducerByResource.get(resource) !== producer) productions.delete(identity);
  }
}
