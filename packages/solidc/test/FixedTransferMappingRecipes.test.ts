import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

const compilePay = (body: string, helpers = ''): ReturnType<typeof compileString> => compileString(`contract Vault() {
  struct Payment { bytes25 recipient; int amount; bool enabled; int marker; int[2] marks; }
  mapping(int => Payment) payments;
  function pay(int key) public {
    ${body}
    require(true);
  }
  ${helpers}
}`, options);

describe('fixed BCH transfer mapping recipes', () => {
  it('publishes typed incoming-entry projections for operands and their activation', () => {
    const artifact = compilePay(`Payment memory payment = this.payments[key];
      payment.marker = tx.locktime;
      this.payments[key].marker = 1;
      if (payment.enabled) this.transfer(payment.recipient, payment.amount);`);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{
        recipientRecipe: { kind: 'entry', collection: 'payments:mapping(int256 => Payment)',
          keys: [{ kind: 'handlerInput', inputIndex: 0 }], path: ['recipient'], resultType: 'bytes25' },
        amountRecipe: { kind: 'entry', path: ['amount'], resultType: 'int256' },
        condition: { kind: 'fixedEffectRecipe', fixedEffectRecipe: {
          kind: 'entry', path: ['enabled'], resultType: 'bool',
        } },
      }] });
  });

  it('captures a mapping key before reassignment', () => {
    const artifact = compilePay(`Payment memory payment = this.payments[key];
      key = key + 1;
      this.transfer(payment.recipient, payment.amount);`);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toMatchObject({ kind: 'entry', keys: [{ kind: 'handlerInput', inputIndex: 0 }] });
  });

  it('preserves sibling scalar snapshots through array-field mutation and writeback', () => {
    const artifact = compilePay(`Payment memory payment = this.payments[key];
      payment.marks[0] = tx.locktime;
      this.payments[key].marks = payment.marks;
      if (payment.enabled) this.transfer(payment.recipient, payment.amount);`);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{
        recipientRecipe: { kind: 'entry', path: ['recipient'] },
        amountRecipe: { kind: 'entry', path: ['amount'] },
      }] });
  });

  it('refuses a fresh read after a mapping write instead of reusing incoming state', () => {
    const artifact = compilePay(`this.payments[key].amount = tx.locktime;
      this.transfer(this.payments[key].recipient, this.payments[key].amount);`);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toBeUndefined();
    expect(artifact.abi.find((handler) => handler.name === 'pay')).toBeDefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')?.eligible).not.toBe(true);
  });

  it('does not reuse incoming entries after a conditional opaque write or a stateful helper', () => {
    for (const body of ['if (key > 0) this.payments[key].amount = tx.locktime;', 'clear(key);']) {
      const artifact = compilePay(`${body}
        this.transfer(this.payments[key].recipient, this.payments[key].amount);`,
      'function clear(int key) internal { this.payments[key].amount = tx.locktime; }');
      expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
        .toBeUndefined();
    }
  });
});
