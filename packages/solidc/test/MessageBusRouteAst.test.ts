import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `
pragma solidcash ^0.13.0;

contract Bus() {
  int public stored;
  function set(int next) public {
    require(next >= 0);
    this.stored = next;
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
});
