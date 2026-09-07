import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

type MessageBusHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handlerFor = (
  state: string, body: string, parameters = 'int limit',
): MessageBusHandler | undefined => {
  const artifact = compileString(`event Tick(int value);
    contract C() {
      int total;
      ${state}
      function run(${parameters}) public {
        ${body}
        require(true);
      }
    }`, KERNEL);
  return artifact.messageBus?.handlers.find((handler) => handler.name === 'run');
};

describe('authenticated pre-state scalar recurrence coefficients', () => {
  it('publishes an immutable scalar state coefficient in the exact event recipe', () => {
    const handler = handlerFor('int coefficient;', `
      for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
        emit Tick(this.total);
        this.total = this.total + this.coefficient * cursor;
        emit Tick(this.total);
      }
    `);
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(JSON.stringify(handler?.runtimeLoopEvents?.[0].arguments)).toContain(
      '"kind":"state","name":"coefficient"',
    );
  });

  it.each([
    ['a direct loop write', 'int coefficient;', `
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + this.coefficient * cursor;
        this.coefficient = this.coefficient + 1;
        emit Tick(this.total);
      }
    `, 'int limit'],
    ['a transitive helper write', `int coefficient;
      function change() internal { this.coefficient = this.coefficient + 1; }`, `
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + this.coefficient * cursor;
        change();
        emit Tick(this.total);
      }
    `, 'int limit'],
    ['a mapping resource', 'mapping(int => int) coefficients;', `
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + this.coefficients[0] * cursor;
        emit Tick(this.total);
      }
    `, 'int limit'],
    ['a dynamic array layout', 'int[] coefficients;', `
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + this.coefficients.length * cursor;
        emit Tick(this.total);
      }
    `, 'int limit'],
    ['transaction introspection', '', `
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + tx.locktime * cursor;
        emit Tick(this.total);
      }
    `, 'int limit'],
    ['a transaction signature', '', `
      int coefficient = int(bytes(proof));
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        this.total = this.total + coefficient * cursor;
        emit Tick(this.total);
      }
    `, 'int limit, sig proof'],
    ['a transitive helper signature parameter', `
      function accumulate(int bound, sig proof) internal {
        int coefficient = int(bytes(proof));
        for (int cursor = 0; cursor < bound; cursor = cursor + 1) {
          this.total = this.total + coefficient * cursor;
          emit Tick(this.total);
        }
      }
    `, 'accumulate(limit, authorization);', 'int limit, sig authorization'],
  ])('keeps %s outside runtime event recurrence recipes', (_label, state, body, parameters) => {
    expect(handlerFor(state, body, parameters)).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
