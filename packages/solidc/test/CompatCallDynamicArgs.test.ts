import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// A Solidity-compat low-level call binds its payload's arguments to the co-spent callee's unlocking pushes. A
// string/bytes argument binds through its head offset word to the length-prefixed tail it names; other ABI-dynamic
// shapes are still refused by name.
const OPTIONS = { evmCompat: true } as const;

const withCaller = (callerBody: string): string => `
pragma solidity ^0.8.0;
contract Inbox {
  event Received(address caller, uint256 amount, string message);
  function post(string memory message, uint256 amount) public payable returns (uint256) {
    emit Received(msg.sender, msg.value, message);
    return amount + 1;
  }
  function attach(uint256 amount, bytes memory blob) public payable returns (uint256) {
    return amount + blob.length;
  }
}
contract Sender {
  event Response(bool success, bytes data);
  ${callerBody}
}`;

describe('Solidity-compat low-level call with ABI-dynamic arguments', () => {
  it('binds a string literal and a uint carried by abi.encodeWithSignature to a same-file callee', () => {
    const artifact = compileString(withCaller(`function send(address payable target) public payable {
    (bool success, bytes memory data) = target.call{value: msg.value, gas: 5000}(
      abi.encodeWithSignature("post(string,uint256)", "hello inbox", 123));
    emit Response(success, data);
  }`), OPTIONS);
    expect(artifact.contractName).toBe('Sender');
    expect(artifact.abi.map((fn) => fn.name)).toContain('send');
  });

  it('binds a bytes value that follows a static word', () => {
    const artifact = compileString(withCaller(`function forward(address target, uint256 amount, bytes memory blob)
    public {
    (bool ok, ) = target.call{value: 0}(abi.encodeWithSignature("attach(uint256,bytes)", amount, blob));
    require(ok);
  }`), OPTIONS);
    expect(artifact.abi.map((fn) => fn.name)).toContain('forward');
  });

  it('still refuses a dynamic array argument by name', () => {
    expect(() => compileString(withCaller(`function sendAll(address target, uint256[] memory values) public {
    (bool ok, ) = target.call{value: 0}(abi.encodeWithSignature("total(uint256[])", values));
    require(ok);
  }`), OPTIONS)).toThrow(/COMPAT_CALL_UNBOUND_ARGUMENTS.*argument 0 \('[^']*\[\]'\) is ABI-dynamic/);
  });
});
