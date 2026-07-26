import { describe, expect, it } from 'vitest';
import { layer3 } from '../../src/index.js';

describe('Layer-3 contention model', () => {
  it('matches the multiplicative N-owner success probability reproducibly', () => {
    const report = layer3.simulateLayer3Contention({
      participants: 8,
      activityProbability: 0.08,
      attempts: 1,
      trials: 100_000,
      seed: 7,
    });
    expect(report.theoreticalSuccessProbability).toBeCloseTo(0.92 ** 8, 12);
    expect(report.empiricalSuccessProbability)
      .toBeCloseTo(report.theoreticalSuccessProbability, 2);
  });

  it('shows that participant count compounds stale-outpoint failure', () => {
    const common = {
      activityProbability: 0.1, attempts: 1, trials: 50_000, seed: 11,
    };
    const two = layer3.simulateLayer3Contention({ ...common, participants: 2 });
    const eight = layer3.simulateLayer3Contention({ ...common, participants: 8 });
    expect(eight.empiricalSuccessProbability).toBeLessThan(two.empiricalSuccessProbability);
    expect(eight.theoreticalSuccessProbability).toBeCloseTo(0.9 ** 8, 12);
  });

  it('reports bounded retry/backoff improvement without treating it as soundness', () => {
    const once = layer3.simulateLayer3Contention({
      participants: 8, activityProbability: 0.15, attempts: 1, trials: 50_000, seed: 19,
    });
    const retried = layer3.simulateLayer3Contention({
      participants: 8,
      activityProbability: 0.15,
      attempts: 4,
      retryWindowFactor: 0.5,
      trials: 50_000,
      seed: 19,
    });
    expect(retried.empiricalSuccessProbability).toBeGreaterThan(once.empiricalSuccessProbability);
    expect(retried.meanAttemptsWhenSuccessful).toBeGreaterThan(1);
    expect(retried.meanAttemptsWhenSuccessful).toBeLessThanOrEqual(4);
  });

  it('rejects invalid measurement parameters', () => {
    expect(() => layer3.simulateLayer3Contention({
      participants: 0, activityProbability: 0.1, attempts: 1, trials: 1,
    })).toThrow(/participants/);
    expect(() => layer3.simulateLayer3Contention({
      participants: 1, activityProbability: 1.1, attempts: 1, trials: 1,
    })).toThrow(/activityProbability/);
  });
});
