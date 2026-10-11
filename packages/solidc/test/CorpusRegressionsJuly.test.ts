import { describe, it, expect } from 'vitest';
import { computeFunctionSelectorHex } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// Solidity corpus shapes that compiled in July and regressed since.

describe('a library call reads the caller\'s msg.sender', () => {
  it('provisions the sender context for an entry that calls a public library function reading msg.sender', () => {
    const artifact = compileString(`
      library SenderLib { function current() public returns (address) { return msg.sender; } }
      contract Recorder {
        address public sender;
        function record() public { sender = SenderLib.current(); }
      }
    `, { evmCompat: true });
    expect(artifact.abi.find((fn) => fn.name === 'record')?.usesMsgSender).toBe(true);
  });

  it('carries the sender through a library function that reaches the read through another one', () => {
    const artifact = compileString(`
      library SenderLib {
        function direct() internal view returns (address) { return msg.sender; }
        function viaHelper() public view returns (address) { return SenderLib.direct(); }
      }
      contract Recorder {
        address public sender;
        function record() public { sender = SenderLib.viaHelper(); }
      }
    `, { evmCompat: true });
    expect(artifact.abi.find((fn) => fn.name === 'record')?.usesMsgSender).toBe(true);
  });
});

describe('evmCompat abi.encode of an external self function value', () => {
  it('encodes this.f as one word: the contract identity, the selector, then 8 zero bytes', () => {
    const artifact = compileString(`
      interface IRegistry { function register(function (string memory) external fn) external; }
      contract C {
        function g(string calldata) external {}
        function word() external view returns (bytes memory) { return abi.encode(this.g); }
        function call() external view returns (bytes memory) { return abi.encodeCall(IRegistry.register, (this.g)); }
      }
    `, { evmCompat: true });
    const selector = computeFunctionSelectorHex('g(string)', true);
    // The selector push is followed by the 8-byte zero padding, folded into one push or concatenated after it.
    expect(artifact.debug?.bytecode ?? '').toMatch(new RegExp(`${selector}(7e08)?0{16}`));
  });
});
