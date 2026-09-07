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
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            ${update}
            emit Tick(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes an authenticated read-only scalar pre-state factor', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        int factor;
        function multiply(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.total = this.total * this.factor;
            emit Tick(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['a directly written factor', `int factor;
      function alter() internal { this.factor = this.factor + 1; }
      function multiply(int limit) public {
        this.factor = this.factor + 1;
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factor;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a transitively written factor', `int factor;
      function alter() internal { this.factor = this.factor + 1; }
      function multiply(int limit) public {
        alter();
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factor;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a directly deleted factor', `int factor;
      function multiply(int limit) public {
        delete this.factor;
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factor;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a transitively deleted factor', `int factor;
      function erase() internal { delete this.factor; }
      function multiply(int limit) public {
        erase();
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factor;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a mapping value factor', `mapping(int => int) factors;
      function multiply(int limit) public {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factors[0];
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['an array element factor', `int[] factors;
      function multiply(int limit) public {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * this.factors[0];
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a dynamic-state-derived factor', `bytes seed;
      function multiply(int limit) public {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * int(this.seed.length);
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a transaction-derived factor', `function multiply(int limit) public {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * tx.inputs.length;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a signature-derived factor', `function multiply(int limit, pubkey key, sig proof) public {
        int factor = int(bigint(checkSig(proof, key)));
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * factor;
          emit Tick(this.total);
        }
        require(true);
      }`],
    ['a nonlinear state factor', `int factor;
      function multiply(int limit) public {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          this.total = this.total * (this.factor * this.factor);
          emit Tick(this.total);
        }
        require(true);
      }`],
  ])('keeps %s fenced', (_label, body) => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        ${body}
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
