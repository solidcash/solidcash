import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/index.js';

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh' as const,
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

const artifact = (body: string): any => compileStringMulti(`
    pragma solidity ^0.8.0;
    contract Guess { function guess(uint256 value) public {} }
    contract Attack {
      function attack(Guess target) public {
        ${body}
      }
    }
  `, BUS).Attack;

const handler = (body: string): any => artifact(body).hiddenBatch!.handlers
  .find((entry: any) => entry.name === 'attack');

describe('hidden-batch pre-semantic external-edge classification', () => {
  it('does not count an abi namespace intrinsic as a second outgoing edge', () => {
    const attack = handler(`
      uint256 answer = uint256(keccak256(abi.encodePacked(uint256(1))));
      target.guess(answer);
    `);
    expect(attack.eligible).toBe(true);
    expect(attack.rejectionReason).toBeUndefined();
  });

  it('still counts two real contract calls as two outgoing edges', () => {
    const refused = artifact(`
      uint256 answer = 1;
      target.guess(answer);
      target.guess(answer);
    `);
    expect(refused.hiddenBatch).toBeUndefined();
    const diagnostic = refused.diagnostics?.find((entry: any) => entry.code === 'hidden-batch-route-not-synthesized');
    expect(diagnostic?.message).toContain("'attack': batched-handler-forward-call-not-enabled");
  });
});
