import { describe, expect, it } from 'vitest';
import { inactiveBranchDropIndices } from '../src/generation/GenerateTargetTraversal.js';

describe('inactive verifier branch stack cleanup', () => {
  it('drops the top occurrence when active cleanup removes one of duplicate names', () => {
    expect(inactiveBranchDropIndices(['value', 'value', 'base'], ['value', 'base'])).toEqual([0]);
  });

  it('returns sequential indices after each prior drop', () => {
    expect(inactiveBranchDropIndices(
      ['temp', 'value', 'temp', 'value', 'base'],
      ['value', 'base'],
    )).toEqual([0, 0, 0]);
  });
});
