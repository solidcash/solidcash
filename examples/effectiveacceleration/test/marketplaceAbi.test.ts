import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { effectiveAccelerationRoot } from '../solidcash.config.ts';

// The suite binds to what the compile publishes, so the artifact is the subject: a compile is a precondition
// (`node packages/testing/dist/cli.js compile` from this directory).
const artifact = JSON.parse(readFileSync(
  new URL('../artifacts/solidcash/MarketplaceDataV1.json', import.meta.url),
  'utf8',
)) as { abi: Array<{ name: string; modifiers: string[] }> };

describe('MarketplaceDataV1 compiled ABI', () => {
  it('contains the six read methods used by the replay model', () => {
    const readMethods = ['getArbitrator', 'getUser', 'getUserRating', 'getReviews', 'getJob', 'getEvents'];
    const views = new Set(artifact.abi
      .filter((entry) => entry.modifiers?.includes('view'))
      .map((entry) => entry.name));

    for (const method of readMethods) expect(views.has(method)).toBe(true);
  });

  it('was compiled from the pinned application source', () => {
    const source = readFileSync(
      path.join(effectiveAccelerationRoot(), 'contract', 'contracts', 'MarketplaceDataV1.sol'),
    );
    expect(createHash('sha256').update(source).digest('hex'))
      .toBe('833c3df9eb9b4268b6fbdda66a47f2a6d468ad80b6ae7c5c42c8ac380a37d6c3');
  });
});
