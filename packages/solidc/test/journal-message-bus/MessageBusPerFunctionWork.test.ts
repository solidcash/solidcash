import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

describe('message-bus heavy work is per function', () => {
  it('preallocates legacy message-bus events independently for state-writing handlers', () => {
    const artifact = compileString(`
      contract Ledger {
        int total;
        event Increased(int value);
        event Replaced(int value);

        function increase(int amount) public {
          this.total = this.total + amount;
          emit Increased(this.total);
          require(amount >= 0);
        }

        function replace(int value) public {
          this.total = value;
          emit Replaced(value);
          require(value >= 0);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });

    expect(artifact.messageBus).toBeDefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'increase'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['increase', 'replace']),
    );
  });

  it('keeps kernel bytecode independent of the diagnostic input-size ceiling', () => {
    const arithmetic = Array.from({ length: 60 }, (_unused, index) =>
      `next = (next * 3 + ${index + 2}) % 1000003;`).join('\n');
    const handlers = Array.from({ length: 24 }, (_unused, index) => `
      function apply${index}(int key, int value) public {
        int next = value;
        ${arithmetic}
        this.values[key] = next;
        require(next >= 0);
      }
    `).join('\n');
    const source = `
      contract Ledger {
        mapping(int => int) values;
        ${handlers}
      }
    `;
    const compile = (
      maximumInputBytes: number, optimizeForCompilationSpeed = true,
    ): ReturnType<typeof compileString> => compileString(source, {
      messageBus: true,
      messageBusKernel: true,
      optimizeForCompilationSpeed,
      maximumInputBytes,
      suppressWarnings: true,
    });

    const lowerCeiling = compile(200_000);
    const higherCeiling = compile(300_000);
    const ordinaryCodegen = compile(300_000, false);
    expect(lowerCeiling.messageBus?.convention).toBe('kernel-row-loop');
    expect(lowerCeiling.debug?.bytecode).toBe(higherCeiling.debug?.bytecode);
    const fastBytes = (lowerCeiling.debug?.bytecode.length ?? Infinity) / 2;
    const ordinaryBytes = (ordinaryCodegen.debug?.bytecode.length ?? Infinity) / 2;
    expect(fastBytes).toBeLessThan(20_000);
    expect(ordinaryBytes).toBeLessThan(20_000);
    expect(Math.abs(fastBytes - ordinaryBytes)).toBeLessThan(1_000);
  });

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
        rejectionReason: 'KERNEL_LIFECYCLE',
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
    expect(invokeNames.some((name) => name === '__message_bus_graph_pay'
      || name === '__message_bus_handler_pay')).toBe(true);
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
    expect(invokeNames.some((name) => name === '__message_bus_graph_pay'
      || name === '__message_bus_handler_pay')).toBe(true);
  });
});
