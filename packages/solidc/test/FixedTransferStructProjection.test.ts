import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

const compilePay = (body: string): ReturnType<typeof compileString> => compileString(`contract Vault() {
  struct Payment { bytes25 recipient; int amount; int marker; }
  function pay(bytes25 recipient, int amount, bool alternate) public {
    Payment memory payment = Payment(recipient, amount, 0);
    ${body}
    this.transfer(payment.recipient, payment.amount);
    require(true);
  }
}`, options);

describe('fixed BCH transfer struct projections', () => {
  it('preserves known fields when a sibling becomes opaque', () => {
    const artifact = compilePay('payment.marker = tx.locktime;');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
      }] });
  });

  it('joins a changed field in source order while retaining its sibling', () => {
    const artifact = compilePay('if (alternate) payment.amount = amount + 1; payment.marker = tx.locktime;');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 2 },
          ifTrue: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
          ifFalse: { kind: 'handlerInput', inputIndex: 1 } },
      }] });
  });

  it('does not retain a field after an opaque overwrite or loop mutation', () => {
    for (const body of ['payment.amount = tx.locktime;',
      'while (payment.amount < amount + 3) { payment.amount = payment.amount + 1; }']) {
      const artifact = compilePay(body);
      expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
        .toBeUndefined();
    }
  });

  it('does not publish stale projections for potentially aliased memory locals', () => {
    const artifact = compilePay(`Payment memory aliasPayment = payment;
      payment.amount = amount + 1; aliasPayment.amount = tx.locktime;`);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toBeUndefined();
  });

  it('invalidates the owning aggregate when a nested memory reference escapes', () => {
    const artifact = compileString(`contract Vault() {
      struct Payment { bytes25 recipient; int amount; }
      struct Envelope { Payment payment; }
      function pay(bytes25 recipient, int amount) public {
        Envelope memory envelope = Envelope(Payment(recipient, amount));
        Payment memory aliasPayment = envelope.payment;
        aliasPayment.amount = tx.locktime;
        this.transfer(envelope.payment.recipient, envelope.payment.amount);
        require(true);
      }
    }`, options);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toBeUndefined();
  });

  it('fences aliases embedded in a new aggregate constructor', () => {
    const artifact = compileString(`contract Vault() {
      struct Payment { bytes25 recipient; int amount; }
      struct Envelope { Payment payment; }
      function pay(bytes25 recipient, int amount) public {
        Payment memory payment = Payment(recipient, amount);
        Envelope memory envelope = Envelope(payment);
        payment.amount = amount + 1;
        envelope.payment.amount = tx.locktime;
        this.transfer(payment.recipient, payment.amount);
        require(true);
      }
    }`, options);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toBeUndefined();
  });

  it('projects nested fields and fixed-array elements independently of dynamic siblings', () => {
    const artifact = compileString(`contract Vault() {
      struct Payment { bytes25 recipient; int[2] amounts; string note; }
      struct Envelope { Payment payment; int marker; }
      function pay(bytes25 recipient, int amount, string note) public {
        Envelope memory envelope = Envelope(Payment(recipient, [amount, 1], note), 0);
        envelope.marker = tx.locktime;
        this.transfer(envelope.payment.recipient, envelope.payment.amounts[0]);
        require(true);
      }
    }`, options);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay'))
      .toMatchObject({ eligible: true, transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
      }] });
  });

  it('does not reuse a fixed-array projection after an element write', () => {
    const artifact = compileString(`contract Vault() {
      function pay(bytes25 recipient, int amount) public {
        int[2] memory amounts = [amount, 1];
        amounts[0] = tx.locktime;
        this.transfer(recipient, amounts[0]);
        require(true);
      }
    }`, options);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers?.[0]?.amountRecipe)
      .toBeUndefined();
  });
});
