/**
 * Compose phase-boundary extract: validate unique genesis outpoints
 * and map deployments to slot effects.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { addressToLockScript } from '../utils.js';
import type { AtomicDeploymentSlotEffect } from './graph.js';
import type { MaterializedComposeDeployment } from './compose-materialize-deployments.js';

/**
 * Refuse duplicate genesis outpoints, then project materialized child deployments into atomic slot effects.
 */
export function composeDeploymentSlotEffects(
  materializedDeployments: readonly MaterializedComposeDeployment[],
): AtomicDeploymentSlotEffect[] {
  const activeDeployments = materializedDeployments.filter((deployment) => deployment.active);
  const genesisOutpoints = new Set(activeDeployments.map((deployment) =>
    `${deployment.genesis!.txid.toLowerCase()}:${deployment.genesis!.vout}`));
  if (genesisOutpoints.size !== activeDeployments.length) {
    throw new Error('messageBus: child deployment genesis outpoints must be unique');
  }
  return materializedDeployments.map((deployment) => ({
    participant: deployment.participant,
    invocation: deployment.invocation,
    siteIndex: deployment.siteIndex,
    offset: deployment.offset,
    active: deployment.active,
    ...(deployment.active && {
      genesisTransactionHashHex: deployment.genesis!.txid,
      genesisOutputIndex: deployment.genesis!.vout,
    }),
    outputs: deployment.outputs.map((output) => {
      if (!output.token?.nft) throw new Error('messageBus: child deployment output is missing its NFT');
      return {
        lockingBytecodeHex: binToHex(
          typeof output.to === 'string' ? addressToLockScript(output.to) : output.to,
        ),
        tokenCategoryHex: output.token.category,
        capability: output.token.nft.capability as 'minting' | 'mutable',
        commitmentHex: output.token.nft.commitment,
        tokenAmount: output.token.amount,
        value: output.amount,
      };
    }),
  }));
}
