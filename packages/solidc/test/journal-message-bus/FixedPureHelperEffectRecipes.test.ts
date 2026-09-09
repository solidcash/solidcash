import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('pure helper fixed BCH effect recipes', () => {
  it('replays acyclic straight-line recipient and amount helpers in source order', () => {
    const artifact = compileString(`contract Payer() {
      function choose(bool alternate, address first, address second) private pure returns (address) {
        return alternate ? second : first;
      }
      function adjusted(uint amount, bool bonus) internal pure returns (uint) {
        uint incremented = amount + 7;
        return bonus ? incremented : amount;
      }
      function pay(bool enabled, bool alternate, address first, address second, uint amount) public {
        if (enabled) this.transfer(choose(alternate, first, second), adjusted(amount, alternate));
        this.transfer(first, amount);
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [
        {
          transferIndex: 0,
          recipientRecipe: { kind: 'conditional', resultType: 'address' },
          amountRecipe: { kind: 'conditional', resultType: 'uint256' },
          condition: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        },
        {
          transferIndex: 1,
          recipientRecipe: { kind: 'handlerInput', inputIndex: 2 },
          amountRecipe: { kind: 'handlerInput', inputIndex: 4 },
        },
      ],
    });
  });

  it('replays a pure helper amount for Solidity address.transfer', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Payer {
        function adjusted(uint amount) internal pure returns (uint) { return amount + 3; }
        function pay(address payable recipient, uint amount) public {
          recipient.transfer(adjusted(amount));
          require(true);
        }
      }`, { ...KERNEL, solidityImportCompat: true });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
      }],
    });
  });

  it.each([
    ['state-reading', 'uint saved;', 'view', 'return this.saved;', ''],
    ['transaction-reading', '', 'view', 'return uint(tx.outputs[0].value) + amount;', ''],
    ['effectful', '', '', 'this.transfer(recipient, 1); return amount;', 'address recipient, '],
    ['recursive', '', 'pure', 'return derive(amount);', ''],
  ])('keeps an unrelated %s helper outside fixed-effect replay', (_label, state, mutability, body, prefix) => {
    const artifact = compileString(`contract Payer() {
      ${state}
      function derive(${prefix}uint amount) internal ${mutability} returns (uint) { ${body} }
      function pay(address recipient, uint amount) public {
        this.transfer(recipient, derive(${prefix ? 'recipient, ' : ''}amount));
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('selects a same-arity pure helper by its exact argument type', () => {
    const artifact = compileString(`contract Payer() {
      function derive(uint amount) internal pure returns (uint) { return amount + 1; }
      function derive(int amount) internal pure returns (int) { return amount + 2; }
      function pay(address recipient, uint amount) public {
        this.transfer(recipient, derive(amount));
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: {
          kind: 'cast', resultType: 'uint256',
          operand: {
            kind: 'binary', operator: '+',
            right: { kind: 'intLiteral', value: '1' },
          },
        },
      }],
    });
  });

  it('fences a transaction-signature-derived helper result', () => {
    const artifact = compileString(`contract Payer() {
      function destination(sig proof) private pure returns (bytes) { return bytes(proof); }
      function pay(sig proof, uint amount) public {
        this.transfer(destination(proof), amount);
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('does not borrow an outer recipe for a shadowed unfoldable local', () => {
    const artifact = compileString(`contract Payer() {
      address destination;
      function pay(address first, uint amount) public {
        address selected = first;
        {
          address selected = this.destination;
          this.transfer(selected, amount);
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
