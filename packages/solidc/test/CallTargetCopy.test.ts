import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * A call through a local copy of a stored target. SafeERC20-style helpers take the target as a parameter, which the
 * inliner binds to the copy, and the address-local pass followed it back to the stored value. A copy holds the value
 * from where it was declared and what the function changed in it, so the call now goes through the copy once a write
 * can change either: the stored value or the copy at the target's path. A builder resolves the callee from the stored
 * value before the call, so the call is published as written first only when the copy can hold another value: after
 * a write of the stored value before the copy is taken, or of the copy itself.
 *
 * Each binding is checked against the EVM in solidcash's call-target-copies.conformance.test.ts.
 */
const vault = (members: string): string => `pragma solidity ^0.8.0;
library SafeTransfer {
  function safeTransfer(address token, address to, uint256 value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
  }
}
contract Vault {
  struct Escrow { address currency; uint256 amount; }
  Escrow escrow;
  address token;
  ${members}
}`;

const rawCallOf = (artifact: Artifact, entry: string): ExternalCallAbi | undefined => artifact.abi
  .find((fn) => fn.name === entry)?.externalCalls?.find((call) => call.interfaceName === '__raw__');

describe('a call through a local copy of a stored target', () => {
  it('publishes the call as written first only when the copy can hold another value than the stored one', () => {
    const artifact = compileString(vault(`
      function copyThenWrite(address x) external {
        address t = token; token = x; SafeTransfer.safeTransfer(t, address(this), 5);
      }
      function writeThenCopy(address x) external {
        token = x; address t = token; SafeTransfer.safeTransfer(t, address(this), 5);
      }
      function rewriteCopy(address x) external {
        Escrow memory e = escrow; e.currency = x; SafeTransfer.safeTransfer(e.currency, address(this), e.amount);
      }
      function copyOnly() external {
        Escrow memory e = escrow; SafeTransfer.safeTransfer(e.currency, address(this), e.amount);
      }`), { evmCompat: true, forceStateful: true });
    for (const entry of ['copyThenWrite', 'copyOnly']) {
      expect(rawCallOf(artifact, entry), entry).toBeDefined();
      expect(rawCallOf(artifact, entry)?.targetWrittenBeforeCall, entry).toBeUndefined();
    }
    expect(rawCallOf(artifact, 'writeThenCopy')?.targetWrittenBeforeCall).toBe(true);
    expect(rawCallOf(artifact, 'rewriteCopy')?.targetWrittenBeforeCall).toBe(true);
  });
});
