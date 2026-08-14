import { describe, expect, it } from 'vitest';
import { formatArtifact } from '../src/artifact.js';

describe('artifact formatting', () => {
  it('serializes null metadata in TypeScript artifacts', () => {
    const artifact = { contractName: 'WithNull', metadata: { ast: null } } as any;
    expect(formatArtifact(artifact, 'ts')).toContain('ast: null');
  });

  it('restores jobs.length-1 on publishJobPost upsert ABI that omitted fixedKeySources', () => {
    const artifact = {
      contractName: 'MarketplaceV1',
      abi: [{
        name: 'publishJobPost',
        dynamicWrites: ['jobs'],
        sortedUpsertLoopInfo: [{
          collection: 'whitelistWorkers',
          fixedKeyParams: [],
          varyingArrayParam: 'allowedWorkers_',
          valueConst: '1',
          op: 'set',
        }],
      }],
    } as any;
    const parsed = JSON.parse(formatArtifact(artifact, 'json'));
    expect(parsed.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toEqual([{
      kind: 'expression',
      expressionLabel: 'binop:-(unop:.length(state:jobs),lit:1)',
    }]);
  });
});
