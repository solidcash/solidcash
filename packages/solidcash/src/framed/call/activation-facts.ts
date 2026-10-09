/**
 * The facts a call frame's guarded mapping writes are decided from, read off the deployment the frame runs on.
 *
 * A write a branch guards publishes the condition it runs under, which the call path decides from the frame's
 * arguments and sender beside these facts (`writeRuns`): the state its records hold, the values its collections'
 * nodes hold, and the address the frame observes as `address(this)`, all as the frame starts.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact } from '@solidcash/utils';
import type { FramedDeploymentSet } from '../deploy/index.js';
import { deploymentStateValues, liveMappingValueReader } from '../proxy/external-calls.js';
import type { WriteActivationFacts } from '../proxy/write-activation.js';

/** The facts a frame of `artifact` decides its guarded writes from, on the deployment it runs on at `selfAddress`. */
export function deploymentActivationFacts(
  artifact: Artifact, categoryId: string, deployment: FramedDeploymentSet, selfAddress: Uint8Array,
): WriteActivationFacts {
  const layout = artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  return {
    stateValues: deploymentStateValues(layout, categoryId, deployment),
    selfAddress,
    readMappingValue: liveMappingValueReader(artifact, {
      category: hexToBin(categoryId),
      recordCommitments: deployment.records.map((record) => hexToBin(record.token?.nft?.commitment ?? '')),
      chunks: [...deployment.chunks, ...deployment.collectionNodes],
      nodesByCollection: deployment.nodesByCollection,
    }, artifact.structs),
  };
}
