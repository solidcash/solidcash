import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const options = {
  forceStateful: true, solidityImportCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, suppressWarnings: true,
} as const;

const source = `pragma solidity ^0.8.20;
contract Token {
  uint256 total;
  mapping(address => uint256) balances;
  event Transfer(address from, address to, uint256 amount);

  function transfer(address to, uint256 amount) public returns (bool) {
    address owner = msg.sender;
    move(owner, to, amount);
    return true;
  }

  function move(address from, address to, uint256 amount) internal {
    if (from == address(0)) revert("invalid sender");
    if (to == address(0)) revert("invalid recipient");
    update(from, to, amount);
  }

  function update(address from, address to, uint256 amount) internal {
    if (from == address(0)) total += amount;
    else balances[from] -= amount;
    if (to == address(0)) total -= amount;
    else balances[to] += amount;
    emit Transfer(from, to, amount);
  }
}`;

describe('kernel guarded scalar-local admission', () => {
  it('admits helper writes only when both zero-address scalar arms are unreachable', () => {
    const guarded = compileString(source, options);
    expect(guarded.messageBus?.handlers.find((handler) => handler.name === 'transfer'))
      .toMatchObject({ eligible: true });

    const unguarded = compileString(
      source.replace('if (from == address(0)) revert("invalid sender");', ''), options,
    );
    expect(unguarded.messageBus?.handlers.find((handler) => handler.name === 'transfer'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
