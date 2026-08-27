import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

describe('message-bus heavy work is per function', () => {
  it('rejects lifecycle handlers without cloning a graph helper for them', () => {
    const artifact = compileString(`
      contract Vault {
        int value;
        function set(int next) public { value = next; require(next >= 0); }
        function kill() public selfdestruct { value = 0; require(true); }
      }
    `, { messageBus: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'kill')).toEqual(
      expect.objectContaining({
        eligible: false,
        rejectionReason: 'lifecycle-or-unsafe-handler',
      }),
    );
    const invokeNames = Object.values(artifact.debug?.invokeDebug ?? {}).map((debug) => debug.name);
    expect(invokeNames).not.toContain('__message_bus_graph_kill');
    expect(invokeNames).not.toContain('__message_bus_handler_kill');
  });

  it('does not graph-clone a sibling that has no outgoing call', () => {
    const artifact = compileString(`
      interface IERC20 { function transfer(address to, uint256 amount) returns (bool); }
      contract Mixed {
        int value;
        function ping() public { value = value + 1; require(value > 0); }
        function pay(IERC20 token, address to, uint256 amount) public {
          require(token.transfer(to, amount));
        }
      }
    `, { messageBus: true, maximumInputBytes: 1_000_000 });
    const invokeNames = Object.values(artifact.debug?.invokeDebug ?? {}).map((debug) => debug.name);
    expect(invokeNames).not.toContain('__message_bus_graph_ping');
    expect(invokeNames).not.toContain('__message_bus_handler_ping');
    expect(invokeNames).toContain('__message_bus_graph_pay');
    expect(artifact.abi.find((fn) => fn.name === 'ping')).toBeDefined();
    expect(artifact.abi.find((fn) => fn.name === 'pay')).toBeDefined();
  });

  it('still compiles a pointer-table loop without graph-cloning an unrelated sibling', () => {
    const artifact = compileString(`
      interface IH { function inc(uint value); }
      interface IERC20 { function transfer(address to, uint256 amount) returns (bool); }
      contract Tables {
        int value;
        function(uint) external[] handlers;
        function ping() public { value = 1; require(true); }
        function register(address target) public { this.handlers.push(IH(target).inc); require(true); }
        function fire(uint amount) public {
          for (int i = 0; i < 2; i = i + 1) { handlers[i](amount); }
          require(amount >= 0);
        }
        function pay(IERC20 token, address to, uint256 amount) public {
          require(token.transfer(to, amount));
        }
      }
    `, { messageBus: true, forceStateful: true, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((fn) => fn.name === 'ping')).toBeDefined();
    expect(artifact.abi.find((fn) => fn.name === 'fire')).toBeDefined();
    expect(artifact.abi.find((fn) => fn.name === 'pay')).toBeDefined();
    const invokeNames = Object.values(artifact.debug?.invokeDebug ?? {}).map((debug) => debug.name);
    expect(invokeNames).not.toContain('__message_bus_graph_ping');
    expect(invokeNames).not.toContain('__message_bus_handler_ping');
    expect(invokeNames).toContain('__message_bus_graph_pay');
  });
});
