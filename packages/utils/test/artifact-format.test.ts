import { describe, expect, it } from 'vitest';
import { formatArtifact } from '../src/artifact.js';

describe('artifact formatting', () => {
  it('serializes null metadata in TypeScript artifacts', () => {
    const artifact = { contractName: 'WithNull', metadata: { ast: null } } as any;
    expect(formatArtifact(artifact, 'ts')).toContain('ast: null');
  });
});
