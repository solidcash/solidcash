import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARKETPLACE_DATA_V1_ABI } from '../wagmi/MarketplaceDataV1.ts';

describe('MarketplaceDataV1 source-level ABI', () => {
  it('contains the six read methods used by the replay model', () => {
    const readMethods = ['getArbitrator', 'getUser', 'getUserRating', 'getReviews', 'getJob', 'getEvents'];
    const methods = new Set(MARKETPLACE_DATA_V1_ABI
      .filter((entry) => entry.type === 'function' && entry.stateMutability === 'view')
      .map((entry) => entry.name));

    for (const method of readMethods) expect(methods.has(method)).toBe(true);
  });

  it('tracks the Solidity source pinned by the generated ABI', () => {
    const source = readFileSync(new URL('../contracts/MarketplaceDataV1.sol', import.meta.url));
    const sourceHash = createHash('sha256').update(source).digest('hex');
    const generated = readFileSync(new URL('../wagmi/MarketplaceDataV1.ts', import.meta.url), 'utf8');
    const abiLine = generated.trimEnd().split('\n').at(-1) ?? '';
    const abiHash = createHash('sha256').update(`${abiLine}\n`).digest('hex');

    expect(sourceHash).toBe('833c3df9eb9b4268b6fbdda66a47f2a6d468ad80b6ae7c5c42c8ac380a37d6c3');
    expect(abiHash).toBe('cebf726794cec111df5ad0334996057840f66cc34ca6d1a408d60607e328d544');
  });
});
