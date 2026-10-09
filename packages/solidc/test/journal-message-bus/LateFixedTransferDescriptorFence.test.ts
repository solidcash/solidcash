import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  evmCompat: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('late fixed BCH transfer descriptor fence', () => {
  it('snapshots a dominating reassigned local transfer amount', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function pay(address payable beneficiary, uint amount) public {
          uint adjusted = amount;
          adjusted = adjusted + 1;
          beneficiary.transfer(adjusted);
          require(true);
        }
        function control() public { require(true); }
      }
    `, KERNEL);

    const transfer = artifact.abi.find((entry) => entry.name === 'pay')?.transfers?.[0];
    expect(transfer).toMatchObject({
      recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
    });
    expect(transfer?.amountRecipe).toMatchObject({
      kind: 'binary', operator: '+',
      left: { kind: 'handlerInput', inputIndex: 1 },
      right: { kind: 'intLiteral', value: '1' },
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.blockLayout?.slots.some((slot) => slot.kind === 'transfer')).toBe(true);
  });

  it('snapshots a dominating reassigned local transfer recipient', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function pay(address payable first, address payable second, uint amount) public {
          address payable selected = first;
          selected = second;
          selected.transfer(amount);
          require(true);
        }
        function control() public { require(true); }
      }
    `, KERNEL);

    const transfer = artifact.abi.find((entry) => entry.name === 'pay')?.transfers?.[0];
    expect(transfer).toMatchObject({
      amountRecipe: { kind: 'handlerInput', inputIndex: 2 },
    });
    expect(transfer?.recipientRecipe).toMatchObject({ kind: 'handlerInput', inputIndex: 1 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.blockLayout?.slots.some((slot) => slot.kind === 'transfer')).toBe(true);
  });

  it('snapshots a transfer operand after a replayable partial control-flow join', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function pay(address payable first, address payable second, uint amount, bool choose) public {
          address payable selected = first;
          if (choose) selected = second;
          selected.transfer(amount);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.abi.find((entry) => entry.name === 'pay')?.transfers?.[0]).toMatchObject({
      recipientRecipe: {
        kind: 'conditional', resultType: 'address',
        condition: { kind: 'handlerInput', inputIndex: 3 },
        ifTrue: { kind: 'handlerInput', inputIndex: 1 },
        ifFalse: { kind: 'handlerInput', inputIndex: 0 },
      },
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
    });
  });

  it('admits a pure binary amount with a complete typed recipe', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function pay(address payable beneficiary, uint amount) public {
          beneficiary.transfer(amount + 1);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'handlerInput', inputIndex: 1 },
          right: { kind: 'intLiteral', value: '1' },
        },
      }],
    });
  });

  it('keeps renamed helper parameters descriptor-driven after typed inlining', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function distribute(address payable sink, uint quantity) internal {
          sink.transfer(quantity);
        }
        function pay(address payable beneficiary, uint amount) public {
          distribute(beneficiary, amount);
          require(true);
        }
      }
    `, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
      }],
    });
  });
});
