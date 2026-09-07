import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('geometric scalar-state event recurrences', () => {
  it('publishes invariant-factor recurrence phases over a non-unit domain', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function multiply(int limit, int factor) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            this.total = this.total * factor;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'multiply');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
    expect(JSON.stringify(handler?.runtimeLoopEvents?.[0].arguments)).not.toContain('"**"');
  });

  it.each([
    ['a counter-dependent factor', 'this.total = this.total * (cursor + 1);'],
    ['a loop-carried local factor', 'factor = factor + 1; this.total = this.total * factor;'],
    ['mixed additive and geometric updates',
      'this.total = this.total * factor; this.total = this.total + 1;'],
    ['division/truncation in the factor', 'this.total = this.total * (factor / 2);'],
    ['a continue-crossed recurrence',
      'this.total = this.total * factor; if (factor > 0) { continue; }'],
  ])('keeps %s fenced', (_label, update) => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        function multiply(int limit, int factor) public {
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            ${update}
            emit Tick(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a state-derived factor fenced', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        int factor;
        function multiply(int limit) public {
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            this.total = this.total * this.factor;
            emit Tick(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
