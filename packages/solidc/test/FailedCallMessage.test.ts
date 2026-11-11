import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/compiler.js';

/**
 * A low-level call's failure is the caller's own `require` over its success.
 *
 * The EVM's low-level call returns `false` to its caller when the callee reverts, and the caller's check refuses with
 * its own message, which the artifact publishes beside the call: on the call row for a call with a payload, and on
 * the send for a value call. A typed call publishes none, since its callee's revert is the caller's.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IToken { function transfer(address to, uint256 value) external returns (bool); }'
  + ' library TransferHelper {'
  + '   function safeTransfer(address token, address to, uint value) internal {'
  + '     (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));'
  + "     require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED'); }"
  + '   function safeTransferETH(address to, uint value) internal {'
  + '     (bool success,) = to.call{value: value}(new bytes(0));'
  + "     require(success, 'TransferHelper: ETH_TRANSFER_FAILED'); } }"
  + ' contract Helper { uint256 public unit = 1;'
  + '   function pay(address token, address to, uint256 v) external { TransferHelper.safeTransfer(token, to, v); }'
  + '   function payEth(address to, uint256 v) external payable { TransferHelper.safeTransferETH(to, v); }'
  + '   function unchecked_(address to, uint256 v) external payable { (bool ok,) = to.call{value: v}(""); ok; }'
  + '   function typed(IToken token, address to, uint256 v) external { require(token.transfer(to, v), "typed"); } }';

const helper = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Helper!;
const entry = (name: string): (typeof helper.abi)[number] => helper.abi.find((candidate) => candidate.name === name)!;

describe('a low-level call\'s failure message', () => {
  it('is the require over its success, for a call with a payload and for a value call', () => {
    expect(entry('pay').externalCalls?.[0]?.failedCallMessage).toBe('TransferHelper: TRANSFER_FAILED');
    expect(entry('payEth').transfers?.[0]?.failedCallMessage).toBe('TransferHelper: ETH_TRANSFER_FAILED');
  });

  it('is absent for a call no require checks, and for a typed call', () => {
    expect(entry('unchecked_').transfers?.[0]).toBeDefined();
    expect(entry('unchecked_').transfers?.[0]?.failedCallMessage).toBeUndefined();
    expect(entry('typed').externalCalls?.[0]).toBeDefined();
    expect(entry('typed').externalCalls?.[0]?.failedCallMessage).toBeUndefined();
  });
});
