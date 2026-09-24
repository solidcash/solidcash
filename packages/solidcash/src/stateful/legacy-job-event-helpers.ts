/**
 * Legacy JobEvent helper facade: Marketplace-shaped JobEvent **helper API** adapter facade.
 *
 * legacy JobEvent naming retirement: neutral `legacy*` / value-chunk names are the only public exports.
 * JobEvent-branded aliases have been deleted on the fixtures tip; marketplace
 * beta titles must import the neutrals (or keep their own local aliases).
 */

export {
  legacyLiveValueChunkBandWidth,
  legacyComputePublishValueChunkBand,
  legacyFillValueChunkBandHoles,
  legacyPersistedValueChunkWidth,
  legacyPersistedValueChunkValue,
  legacyPersistedValueChunkLock,
  legacyPersistedValueChunkUnlockRecipe,
  legacyRememberValueChunkValue,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkUnlockRecipe,
  legacyStageValueChunkValue,
  legacyIsPersistedValueChunkReady,
} from './StatefulTransactionBuilder.js';

export {
  legacyIsPublishJobEventName,
  legacyGroupLooksLikePublishJobEvent,
  legacyIsJobEventsCollection,
  LEGACY_JOB_EVENTS_COLLECTION_ALIASES,
} from './legacy-planning-heuristics.js';
