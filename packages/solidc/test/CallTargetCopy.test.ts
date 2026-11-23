import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallAbi } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * A call through a local copy of a stored target: a user's copy (`address t = token`, `Escrow memory e = escrow`), an
 * entry cache or an inliner's binding of a helper's argument. A copy holds the value from where it was taken and what
 * the function changed in it. A write before the call of the stored value after the copy is taken, or of the copy at
 * the target's path, makes the call go through the copy, with a local of its own. With no such write the call keeps
 * the stored value's local, its callee identity and its bytes. A builder resolves the callee from the stored value
 * before the call, so the call is published as written first only when the copy can hold another value: after a write
 * of the stored value before the copy is taken, or of the copy itself.
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
interface IToken { function transfer(address to, uint256 amount) external returns (bool); }
contract Vault {
  struct Escrow { address currency; uint256 amount; }
  struct Line { IToken token; uint256 amount; }
  Escrow escrow;
  Line line;
  address token;
  IToken itoken;
  ${members}
}`;

const OPTIONS = { evmCompat: true, forceStateful: true } as const;

const rawCallOf = (artifact: Artifact, entry: string): ExternalCallAbi | undefined => artifact.abi
  .find((fn) => fn.name === entry)?.externalCalls?.find((call) => call.interfaceName === '__raw__');

const bytesOf = (artifact: Artifact): unknown => ({ bytecode: artifact.bytecode, bodies: artifact.functionBodies });

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
      }
      function helperArgument(address x) external { retokenThenPay(token, x); }
      function retokenThenPay(address t, address x) internal {
        token = x; SafeTransfer.safeTransfer(t, address(this), 5);
      }`), OPTIONS);
    // A helper's argument is a copy too: the call goes to the stored token the helper was given, as before the write.
    for (const entry of ['copyThenWrite', 'copyOnly', 'helperArgument']) {
      expect(rawCallOf(artifact, entry), entry).toBeDefined();
      expect(rawCallOf(artifact, entry)?.targetWrittenBeforeCall, entry).toBeUndefined();
    }
    expect(rawCallOf(artifact, 'writeThenCopy')?.targetWrittenBeforeCall).toBe(true);
    expect(rawCallOf(artifact, 'rewriteCopy')?.targetWrittenBeforeCall).toBe(true);
  });

  it('keeps the stored target\'s local and bytes for a copy written only after the calls', () => {
    const both = (second: string): Artifact => compileString(vault(`
      function both(address x) external {
        IToken t = itoken;
        itoken.transfer(address(this), 1);
        ${second}.transfer(address(this), 2);
        itoken = IToken(x);
      }`), OPTIONS);
    expect(bytesOf(both('t'))).toEqual(bytesOf(both('itoken')));
  });

  it('refuses by name a call through a copy declared twice, after a write of what it was copied from', () => {
    // The call reads the copy where it runs, but `l` names a declaration in each branch.
    const compile = (): Artifact => compileString(vault(`
      function twice(bool c, address x) external {
        if (c) { Line memory l = line; line.token = IToken(x); l.token.transfer(address(this), l.amount); }
        else { Line memory l = line; l.token.transfer(address(this), l.amount); }
      }`), OPTIONS);
    expect(compile).toThrow(/COPY_TARGET_WRITTEN_BEFORE_CALL/);
  });
});
