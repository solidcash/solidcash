/**
 * phase-boundary extract: compiler-described route event commitment discovery
 * (phase-boundary extract from StatefulContract.ts).
 */

import { hexToBin } from '@bitauth/libauth';
import { isAuthenticatedEventRepairCommitment } from './StatefulTransactionBuilder.js';

export function isCompilerDescribedRouteEventCommitment(
  commitment: string | undefined,
  compilerMetadata: { compilerOwnedEventSlot: boolean; eventSignature?: string },
): commitment is string {
  if (commitment === undefined || commitment.length === 0 || commitment.length % 2 !== 0) return false;
  const compilerDescribed = compilerMetadata.compilerOwnedEventSlot
    && typeof compilerMetadata.eventSignature === 'string'
    && compilerMetadata.eventSignature.length > 0;
  if (compilerMetadata.compilerOwnedEventSlot && !compilerDescribed) return false;
  return isAuthenticatedEventRepairCommitment(hexToBin(commitment), compilerDescribed);
}
