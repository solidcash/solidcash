import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// `messageBus: undefined` selects auto mode; the published `messageBus` route metadata marks graph mode.
const AUTO = { messageBus: undefined, evmCompat: true } as const;

const HEADER = `
pragma solidity ^0.8.0;
interface Target { function ping() external; }
`;

describe('auto message-bus selection sees inherited code', () => {
  it('selects graph mode for an external call in an inherited function, as for the single contract', () => {
    const single = compileString(`${HEADER}
contract Single {
  uint256 public counter;
  function poke(address a) public { Target(a).ping(); }
  function bump() public { counter += 1; }
}`, AUTO);
    const derived = compileString(`${HEADER}
contract Base {
  uint256 public counter;
  function poke(address a) public { Target(a).ping(); }
}
contract Derived is Base {
  function bump() public { counter += 1; }
}`, AUTO);
    expect(single.messageBus).toBeDefined();
    expect(derived.contractName).toBe('Derived');
    expect(derived.messageBus).toBeDefined();
    expect(derived.messageBus?.convention).toBe(single.messageBus?.convention);
  });

  it('follows transitive bases into an inherited modifier attached to a root function', () => {
    const derived = compileString(`${HEADER}
contract Grand {
  uint256 public counter;
  modifier pinged(address a) { Target(a).ping(); _; }
}
contract Middle is Grand {}
contract Derived is Middle {
  function bump(address a) public pinged(a) { counter += 1; }
}`, AUTO);
    expect(derived.messageBus).toBeDefined();
  });

  it('still narrows a derived contract whose bases make no external call', () => {
    const derived = compileString(`${HEADER}
contract Base {
  uint256 public counter;
  function set(uint256 v) public { counter = v; }
}
contract Derived is Base {
  function bump() public { counter += 1; }
}`, AUTO);
    expect(derived.contractName).toBe('Derived');
    expect(derived.messageBus).toBeUndefined();
  });
});
