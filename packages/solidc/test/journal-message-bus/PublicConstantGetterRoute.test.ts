import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

/**
 * A `public constant` has an ABI getter but no state variable. The kernel route's scalar-getter branch reads
 * `contract.stateVariables`, so it missed the constant and emitted a call to a function that does not exist
 * (`Found symbol decimals with type undefined where type function was expected`). A real ERC-20 declares
 * `uint8 public constant decimals`, so this refused its whole message-bus artifact and fell back to direct.
 */
describe('public constant getters in the message-bus route', () => {
  it('admits the constant getter and keeps the route', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Constants() {
        uint8 public constant decimals = 18;
        uint256 value;
        function set(uint256 next) public { value = next; }
        function get() public view returns (uint256) { return value; }
      }`, {
      evmCompat: true, forceStateful: true, composition: 'direct', suppressWarnings: true,
      messageBus: true, messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 50_000,
    });
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'decimals'))
      .toMatchObject({ eligible: true });
    expect(artifact.compiler.options?.messageBus).toBe(true);
  });
});
