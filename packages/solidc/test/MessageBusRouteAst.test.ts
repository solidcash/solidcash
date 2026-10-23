import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `
pragma solidcash ^0.14.0;

contract Bus() {
  int public stored;
  event Changed(int indexed next);
  function set(int next) public {
    require(next >= 0);
    this.stored = next;
    emit Changed(next);
  }
}
`;

describe('message-bus route AST assembly', () => {
  it('matches the print-and-parse oracle bytecode', () => {
    const assembled = compileString(SOURCE, {
      messageBus: true,
      forceStateful: true,
      suppressWarnings: true,
    });
    const oracle = compileString(SOURCE, {
      messageBus: true,
      forceStateful: true,
      suppressWarnings: true,
      __messageBusRouteParseOracle: true,
    });
    expect(assembled.messageBus).toBeDefined();
    expect(oracle.messageBus).toBeDefined();
    expect(assembled.debug?.bytecode).toBe(oracle.debug?.bytecode);
    expect(assembled.debug?.bytecode?.length).toBeGreaterThan(0);
  });

  it('matches the oracle on a resource-shaped ERC-20 route with prior-row aliases', () => {
    const token = `
pragma solidcash ^0.14.0;

contract Token() {
  mapping(address => uint) balances;
  mapping(address => mapping(address => uint)) allowances;
  event Transfer(address indexed from, address indexed to, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);

  function balanceOf(address who) public view returns (uint) {
    return balances[who];
  }

  function approve(address spender, uint value) public returns (bool) {
    address owner = msg.sender;
    allowances[owner][spender] = value;
    emit Approval(owner, spender, value);
    return true;
  }

  function transfer(address to, uint value) public returns (bool) {
    require(balances[msg.sender] >= value);
    balances[msg.sender] = balances[msg.sender] - value;
    balances[to] = balances[to] + value;
    emit Transfer(msg.sender, to, value);
    return true;
  }

  function transferFrom(address from, address to, uint value) public returns (bool) {
    require(allowances[from][msg.sender] >= value);
    require(balances[from] >= value);
    allowances[from][msg.sender] = allowances[from][msg.sender] - value;
    balances[from] = balances[from] - value;
    balances[to] = balances[to] + value;
    emit Transfer(from, to, value);
    return true;
  }
}
`;
    const options = {
      messageBus: true,
      forceStateful: true,
      suppressWarnings: true,
      maximumInputBytes: 10_000_000,
    };
    const assembled = compileString(token, options);
    const oracle = compileString(token, { ...options, __messageBusRouteParseOracle: true });
    expect(assembled.messageBus).toBeDefined();
    expect(oracle.messageBus).toBeDefined();
    expect(assembled.debug?.bytecode).toBe(oracle.debug?.bytecode);
    expect(assembled.debug?.bytecode?.length).toBeGreaterThan(0);
  });

  it('keeps graph-free ERC-20 leaves kernel-shaped in a graph-enabled project', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;

contract Token() {
  mapping(address => uint) balances;
  mapping(address => mapping(address => uint)) allowances;

  function approve(address spender, uint value) public returns (bool) {
    allowances[msg.sender][spender] = value;
    return true;
  }

  function transferFrom(address from, address to, uint value) public returns (bool) {
    require(allowances[from][msg.sender] >= value);
    require(balances[from] >= value);
    allowances[from][msg.sender] = allowances[from][msg.sender] - value;
    balances[from] = balances[from] - value;
    balances[to] = balances[to] + value;
    return true;
  }
}
`, {
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      forceStateful: true,
      suppressWarnings: true,
      commitmentLimit: 10_000_000,
      maximumInputBytes: 10_000_000,
    });

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.filter(({ name }) => ['approve', 'transferFrom'].includes(name)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'approve', eligible: true }),
        expect.objectContaining({ name: 'transferFrom', eligible: true }),
      ]));
  });
});
