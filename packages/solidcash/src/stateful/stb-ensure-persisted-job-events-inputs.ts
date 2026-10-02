/** @deprecated Historical internal import path; use the value-chunk continuation helper. */
import type { UnlockableUtxo } from '../interfaces.js';
import {
  ensurePersistedValueChunkInputs,
  type EnsurePersistedValueChunkInputsHost,
} from './stb-ensure-persisted-value-chunk-inputs.js';

export type EnsurePersistedJobEventsInputsHost = Omit<EnsurePersistedValueChunkInputsHost,
'setPendingValueChunkPredecessors' | 'placeValueChunkPredecessorInputs'> & {
  setPendingJobEventsPredecessors(extras: UnlockableUtxo[]): void;
  placeJobEventsPredecessorInputs(extras: UnlockableUtxo[]): void;
};

export function ensurePersistedJobEventsInputs(host: EnsurePersistedJobEventsInputsHost): Promise<void> {
  return ensurePersistedValueChunkInputs({
    ...host,
    setPendingValueChunkPredecessors: (extras) => host.setPendingJobEventsPredecessors(extras),
    placeValueChunkPredecessorInputs: (extras) => host.placeJobEventsPredecessorInputs(extras),
  });
}
