/**
 * phase-boundary extract: SC public-surface extract — queryEvents named/anonymous event reads.
 */

import type { Artifact, EventDefinitionAbi } from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  getAnonymousEventNftAddress,
  getEventNftAddress,
} from './covenant-helpers.js';
import {
  readAnonymousEventsFromChain,
  readEventsFiltered,
  valuesEqual,
  type EventFilter,
  type ParsedEvent,
} from './StateReader.js';

export interface QueryEventsHost {
  ensureResolved(): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly inner: Contract<any, any> & {
    artifact: Artifact;
    provider: NetworkProvider;
  };
  readonly categoryId: string;
}

/**
 * Resolve an event by name or signature, then read matching NFT commitments from chain
 * (anonymous shared address or named event address), optionally filtering indexed params.
 */
export async function queryEvents(
  host: QueryEventsHost,
  eventNameOrSignature: string,
  filters?: EventFilter,
): Promise<ParsedEvent[]> {
  await host.ensureResolved();
  const artifact = host.inner.artifact;
  const eventDefs: EventDefinitionAbi[] = artifact.events ?? [];
  const provider = host.inner.provider;
  const structs = artifact.stateLayout?.structs;

  const eventDef = eventNameOrSignature.includes('(')
    ? eventDefs.find((e: EventDefinitionAbi) => e.signature === eventNameOrSignature)
    : eventDefs.find((e: EventDefinitionAbi) => e.name === eventNameOrSignature);

  if (!eventDef) {
    throw new Error(`Unknown event: ${eventNameOrSignature}`);
  }

  if (eventDef.anonymous) {
    const anonymousAddress = getAnonymousEventNftAddress(host.inner, host.categoryId);
    const allAnonymousDefs = eventDefs.filter((e: EventDefinitionAbi) => e.anonymous);
    const allEvents = await readAnonymousEventsFromChain(
      provider, anonymousAddress, host.categoryId, allAnonymousDefs, structs,
    );

    let filtered = allEvents.filter((e) => e.eventSignature === eventDef.signature);

    if (filters && Object.keys(filters).length > 0) {
      const indexedParams = new Set(
        eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
      );
      for (const key of Object.keys(filters)) {
        if (!indexedParams.has(key)) {
          throw new Error(
            `Filter key '${key}' is not an indexed parameter of event '${eventDef.name}'`,
          );
        }
      }
      filtered = filtered.filter((event) => Object.entries(filters).every(
        ([key, val]) => valuesEqual(event.values[key], val),
      ));
    }

    return filtered;
  }

  const eventAddress = getEventNftAddress(host.inner, host.categoryId, eventDef.signature);
  return readEventsFiltered(
    provider, eventAddress, host.categoryId, eventDef, filters, structs,
  );
}
