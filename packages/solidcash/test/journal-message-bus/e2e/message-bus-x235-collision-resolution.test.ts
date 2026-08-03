import { describe, expect, it } from 'vitest';
import {
  resolveContainedRoutes, type StagedRoute,
} from './message-bus-x204-settlement-probe.js';

const route = (contract: string, participantBytecode: string, sourceDigest: string): StagedRoute => ({
  contract,
  participantBytecode,
  sourceDigest,
  handlers: ['run'],
  published: ['run'],
  blobBytes: 2,
  test: 'synthetic collision',
  seq: 1,
});

describe('X235 settlement collision attribution', () => {
  const blob = 'cafe';
  const alpha = route('Alpha', 'aabb', 'source-alpha');
  const beta = route('Beta', 'ccdd', 'source-beta');
  const routes = new Map([[blob, [alpha, beta]]]);

  it('resolves a same-blob collision to the one contained participant', () => {
    const result = resolveContainedRoutes(`00${blob}11${alpha.participantBytecode}22`, routes);
    expect(result.drove).toEqual([alpha]);
    expect(result.collisionResolutions).toMatchObject([{
      resolutionCardinality: 1,
      candidateIdentities: expect.arrayContaining([
        expect.stringContaining('source-alpha:Alpha:'),
        expect.stringContaining('source-beta:Beta:'),
      ]),
      matchedIdentities: [expect.stringContaining('source-alpha:Alpha:')],
    }]);
  });

  it('records zero matches and credits no route', () => {
    const result = resolveContainedRoutes(`00${blob}11`, routes);
    expect(result.drove).toEqual([]);
    expect(result.collisionResolutions[0].resolutionCardinality).toBe(0);
    expect(result.collisionResolutions[0].matchedIdentities).toEqual([]);
  });

  it('records multiple matches and credits no route', () => {
    const result = resolveContainedRoutes(
      `00${blob}11${alpha.participantBytecode}22${beta.participantBytecode}33`, routes,
    );
    expect(result.drove).toEqual([]);
    expect(result.collisionResolutions[0].resolutionCardinality).toBe(2);
    expect(result.collisionResolutions[0].matchedIdentities).toHaveLength(2);
  });
});
