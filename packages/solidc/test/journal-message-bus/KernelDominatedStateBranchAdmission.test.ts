import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  solidityImportCompat: true,
  maximumInputBytes: 10_000_000,
  suppressWarnings: true,
} as const;

describe('kernel successful-path state admission', () => {
  it('ignores scalar update arms excluded by dominating terminal guards', () => {
    const artifact = compileString(`pragma solidity ^0.8.7;
      contract Ledger {
        uint256 private aggregate;
        mapping(address => uint256) private values;
        mapping(address => mapping(address => uint256)) private grants;

        event Grant(address indexed owner, address indexed spender, uint256 value);
        event Move(address indexed from, address indexed to, uint256 value);

        function moveFrom(address from, address to, uint256 value) public returns (bool) {
          address spender = msg.sender;
          spend(from, spender, value);
          move(from, to, value);
          return true;
        }

        function unrestrictedUpdate(address from, address to, uint256 value) public returns (bool) {
          update(from, to, value);
          return true;
        }

        function allowance(address owner, address spender) public view returns (uint256) {
          return grants[owner][spender];
        }

        function spend(address owner, address spender, uint256 value) internal {
          uint256 current = allowance(owner, spender);
          if (current != type(uint256).max) {
            if (current < value) revert();
            approveInner(owner, spender, current - value, false);
          }
        }

        function approveInner(
          address owner, address spender, uint256 value, bool publish
        ) internal {
          grants[owner][spender] = value;
          if (publish) emit Grant(owner, spender, value);
        }

        function move(address from, address to, uint256 value) internal {
          if (from == address(0)) revert();
          if (to == address(0)) revert();
          update(from, to, value);
        }

        function update(address from, address to, uint256 value) internal {
          if (from == address(0)) aggregate = aggregate + value;
          else {
            uint256 prior = values[from];
            if (prior < value) revert();
            values[from] = prior - value;
          }
          if (to == address(0)) aggregate = aggregate - value;
          else values[to] = values[to] + value;
          emit Move(from, to, value);
        }
      }
    `, OPTIONS);

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'moveFrom'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'bool' }] });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'unrestrictedUpdate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });

    const abi = artifact.abi.find((entry) => entry.name === 'moveFrom');
    expect(abi?.entryAccesses?.map((entry) => ({
      collection: entry.collection,
      operations: entry.operations,
    }))).toEqual(expect.arrayContaining([
      { collection: 'grants', operations: ['read', 'write'] },
      { collection: 'values', operations: ['read', 'write'] },
      { collection: 'values', operations: ['read', 'write'] },
    ]));
    // spend() calls approveInner with publish=false, so the Grant emit is dead on moveFrom.
    expect(abi?.emits?.map((emit) => emit.eventName)).toEqual(['Move']);
    expect(abi?.sourceEffectOrder).toBe('unsupported-flow');
    expect(abi?.blockLayout?.slots.filter((slot) => slot.kind === 'entry')).toHaveLength(3);
    expect(abi?.blockLayout?.slots.filter((slot) => slot.kind === 'event')).toHaveLength(1);
    expect(bytecodeToAsm(hexToBin(artifact.debug.bytecode))).toContain('OP_INVOKE');
  });
});
