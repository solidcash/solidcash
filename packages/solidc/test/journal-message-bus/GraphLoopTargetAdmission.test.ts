import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

/**
 * A router-shaped participant reaches a pair address computed from a loop index:
 * `IPair(pairFor(a, path[i])).getReserves()`. The direct entry threads that per-iteration target through a
 * compiler-synthesized witness array. A route handler clone has a compiler-owned parameter frame and cannot
 * receive that witness, so route synthesis must refuse exactly that handler and still publish the rest of the
 * route. Before the refusal, the clone kept an untyped `__internal__loopTargets<n>` access and the final
 * typecheck failed the whole contract, leaving the router with no route at all.
 */
const ROUTERISH = `pragma solidity ^0.8.20;
interface IPair {
  function getReserves() external view returns (uint112, uint112, uint32);
}
contract Routerish {
  address public factory;
  uint public touched;
  function setFactory(address next) external {
    factory = next;
    touched = touched + 1;
  }
  function pairFor(address tokenA, address tokenB) private pure returns (address) {
    return address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB)))));
  }
  function reservesAlong(address[] calldata path) external view returns (uint total) {
    total = 0;
    for (uint i = 0; i + 1 < path.length; i++) {
      (uint112 reserve0,,) = IPair(pairFor(path[i], path[i + 1])).getReserves();
      total = total + uint(reserve0);
    }
  }
}`;

describe('graph handler with a loop-computed call target', () => {
  it('refuses that handler by name and publishes the route for the rest', { timeout: 30_000 }, () => {
    const artifact = compileString(ROUTERISH, {
      evmCompat: true,
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
    } as never);
    // The whole contract used to fall back to a direct-only build when the clone's witness stayed untyped.
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.messageBus!.available).toBe(true);
    expect(artifact.messageBus!.admittedHandlerIds).toContain('setFactory');
    expect(artifact.messageBus!.admittedHandlerIds).toContain('factory');
    const loop = artifact.messageBus!.handlers.find((handler) => handler.name === 'reservesAlong');
    expect(loop?.eligible).toBe(false);
    expect(loop?.rejectionReason).toMatch(/^KERNEL_/);
  });
});
